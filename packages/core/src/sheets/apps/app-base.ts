/**
 * SheetAppBase — núcleo comum dos cinco apps de sheet.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/Tj3SheetAppBase.rb` mais a parte de
 * `Tj3AppBase.rb` que o núcleo pode assumir: montar o `RuntimeConfig`, definir
 * o fim do período e traduzir o desfecho em código de saída. O que **não** vem
 * para cá é o `OptionParser`: a Fase 24 lê argv/stdin e entrega opções já
 * tipadas (`workingDir`, `dryRun`, `config`, `endDate`, …) — ver
 * `docs/syntaxmesh/fases/fase-24-cli.md` §5.4.
 *
 * Duas adaptações obrigatórias da fase:
 *  - **ADR 036** — não há SMTP: os senders devolvem `EmailMessage` e os
 *    receivers consomem o texto RFC 822 recebido como `string`.
 *  - **ADR 037** — o `FileStore` é injetado pelo chamador (aqui, via
 *    {@link SheetAppContext}), então `run()` é `async`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Tj3SheetAppBase.rb
 * @see docs/taskjuggler/lib/taskjuggler/RuntimeConfig.rb
 * @see docs/taskjuggler/lib/taskjuggler/Tj3AppBase.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18)
 */

import type { FileStore, } from "../../interfaces/file-store.ts";
import { MessageHandlerInstance, } from "../../message-handler.ts";
import { TjRuntimeError, } from "../../model/errors.ts";
import type { Project, } from "../../model/project.ts";
import { TjTime, } from "../../time/tj-time.ts";
import { SheetHandlerBase, } from "../sheet-handler-base.ts";
import { localDate, } from "../sheet-sender.ts";

/** Código de saída de sucesso (Ruby `appMain` → 0). */
export const SHEET_APP_EXIT_OK = 0;
/** Código de saída de falha (Ruby `main` → 1 após `TjRuntimeError`). */
export const SHEET_APP_EXIT_ERROR = 1;

/**
 * Conteúdo de uma seção do arquivo de configuração (`RuntimeConfig`).
 *
 * O YAML do Ruby vira um objeto JS já parseado; as chaves de seção levam o
 * prefixo `_` (`_global`, `_timesheets`, …), como o `p['_' + sec]` de
 * `RuntimeConfig#configure`.
 */
export type SheetAppConfig = Record<string, unknown>;

/** Nome da seção raiz de cada tipo de sheet no config (`_timesheets`/…). */
export type SheetAppConfigRoot = "timesheets" | "statussheets";

/** Papel do app dentro do subsistema, usado para achar a seção do config. */
export type SheetAppRole = "sender" | "receiver" | "summary";

/** Opções comuns aos cinco apps (o que o `OptionParser` preenche na F24). */
export interface SheetAppOptions {
  /** `-d/--directory` (Ruby `@workingDir`). */
  workingDir?: string | null;
  /** `--dryrun`: não grava emails nem faz commit de SCM (ADR 036). */
  dryRun?: boolean;
  /** Configuração já lida do arquivo (Ruby `RuntimeConfig`) — ADR 037. */
  config?: SheetAppConfig | null;
  /**
   * `-e/--enddate`: `YYYY-MM-DD` ou dia da semana (0=domingo … 6=sábado).
   * Ausente = default de cada app (`nextDayOfWeek`).
   */
  endDate?: string | number | null;
  /** Relógio injetável: mantém `date` determinístico nos testes. */
  now?: (() => Date) | null;
}

/**
 * Entrada do app — o que o Ruby obtinha de `tj3client` (projeto) e do STDIN
 * (mensagem). Sem subprocesso, ambos chegam prontos (ADR 036).
 */
export interface SheetAppContext {
  /** Projeto já carregado (`ProjectFileParser`/`tj3client`). */
  project: Project;
  /** Destino de templates, folhas e `outbox/` (ADR 037). */
  fileStore?: FileStore | null;
  /** Texto RFC 822 lido de arquivo/STDIN — usado pelos receivers. */
  rawEmail?: string | null;
}

/**
 * Interpreta `-e/--enddate` como o `optsEndDate` do Ruby.
 *
 * `YYYY-MM-DD` é aceito como data literal (`Time.mktime` normaliza dias fora
 * do mês, como o `Date` do JS); qualquer outra coisa é lida como dia da semana
 * (`arg.to_i % 7`, então texto inválido vira domingo, como no Ruby).
 */
export function parseEndDate(
  value: string | number,
  now: Date = new Date(),
): string {
  if (typeof value === "string") {
    const ymd = /([0-9]{4})-([0-9]{2})-([0-9]{2})/u.exec(value,);
    if (ymd) {
      const year = Number(ymd[1],);
      const month = Number(ymd[2],);
      const day = Number(ymd[3],);
      return localDate(new Date(year, month - 1, day,),);
    }
  }

  const parsed = typeof value === "number"
    ? value
    : Number.parseInt(value, 10,);
  const dayOfWeek = Number.isNaN(parsed,) ? 0 : ((parsed % 7) + 7) % 7;
  return TjTime.fromDate(now,).nextDayOfWeek(dayOfWeek,).toString();
}

/**
 * Base dos apps de sheet (`tj3ts_sender`, `tj3ts_receiver`, `tj3ts_summary`,
 * `tj3ss_sender`, `tj3ss_receiver`).
 *
 * A subclasse só monta o handler e implementa {@link appMain}; configuração,
 * data e código de saída ficam aqui.
 */
export abstract class SheetAppBase {
  /** Nome que assina o email (`X-TaskJuggler`) e o log (Ruby `AppConfig.appName`). */
  readonly appName: string;

  /** `-d/--directory` (Ruby `@workingDir`). */
  workingDir: string | null;

  /** `--dryrun` (Ruby `@dryRun`). */
  dryRun: boolean;

  /** Configuração já parseada (Ruby `RuntimeConfig`), ou `null`. */
  config: SheetAppConfig | null;

  /** Fim do período de reporte em `YYYY-MM-DD` (Ruby `@date`). */
  date: string;

  /** Relógio injetável (Ruby `TjTime.new`). */
  protected readonly now: () => Date;

  constructor(
    appName: string,
    defaultDayOfWeek: number,
    options: SheetAppOptions = {},
  ) {
    this.appName = appName;
    this.workingDir = options.workingDir ?? null;
    this.dryRun = options.dryRun ?? false;
    this.config = options.config ?? null;
    this.now = options.now ?? (() => new Date());

    // Ruby: cada app define `@date = TjTime.new.nextDayOfWeek(<dow>)` no
    // construtor, e o `-e/--enddate` sobrescreve depois.
    this.date = options.endDate === undefined || options.endDate === null
      ? this.defaultDate(defaultDayOfWeek,)
      : parseEndDate(options.endDate, this.now(),);
  }

  /** Handler do app — os apps expõem o concreto (`sender`, `receiver`, …). */
  abstract readonly handler: SheetHandlerBase;

  /** Corpo do app (Ruby `appMain`), sem código de saída. */
  protected abstract appMain(context: SheetAppContext,): Promise<void>;

  /**
   * Executa o app e devolve o código de saída (Ruby `main`).
   *
   * `TjRuntimeError` já foi anunciado pelo `MessageHandler` (`error`/`fatal`);
   * aqui só vira `1`. Erros de programação continuam propagando — o wrapper da
   * F24 é quem os converte em `crash_trap`.
   */
  async run(context: SheetAppContext,): Promise<number> {
    const errorsBefore = MessageHandlerInstance.instance.errors;
    try {
      await this.appMain(context,);
    } catch (error) {
      if (!(error instanceof TjRuntimeError)) throw error;
      return SHEET_APP_EXIT_ERROR;
    }
    return MessageHandlerInstance.instance.errors > errorsBefore
      ? SHEET_APP_EXIT_ERROR
      : SHEET_APP_EXIT_OK;
  }

  /**
   * Default de `date`: próxima ocorrência do dia da semana informado.
   *
   * Fiel a `Tj3TsSender#initialize` (`nextDayOfWeek(1)`) e a
   * `Tj3SsSender#initialize` (`nextDayOfWeek(3)`).
   */
  defaultDate(dayOfWeek: number,): string {
    return TjTime.fromDate(this.now(),).nextDayOfWeek(dayOfWeek,).toString();
  }

  /** Reescreve `date` como o `optsEndDate` do Ruby. */
  setEndDate(value: string | number,): string {
    this.date = parseEndDate(value, this.now(),);
    return this.date;
  }

  /**
   * Aplica uma seção do config no handler (Ruby `RuntimeConfig#configure`).
   *
   * Só campos que **existem** no objeto são copiados, como o Ruby faz ao
   * percorrer as variáveis de instância — um nome errado no arquivo é ignorado
   * em vez de criar um campo novo.
   *
   * @returns `false` quando a seção não está no config.
   */
  configureTarget(target: SheetHandlerBase, section: string,): boolean {
    const node = this.sectionNode(section,);
    if (node === null) return false;

    const fields = target as unknown as Record<string, unknown>;
    for (const [key, value,] of Object.entries(node,)) {
      if (!(key in fields)) continue;
      // O YAML do Ruby lê `2026-05-18` como `Date`; o campo `date` é string.
      fields[key] = value instanceof Date ? localDate(value,) : value;
    }
    return true;
  }

  /**
   * Aplica as três seções do app, na ordem do Ruby (`global`, depois a raiz,
   * depois o papel) — a última que define um campo vence.
   *
   * @returns `true` se alguma seção existia no config.
   */
  configureSheet(
    target: SheetHandlerBase,
    root: SheetAppConfigRoot,
    role: SheetAppRole,
  ): boolean {
    const applied = [
      this.configureTarget(target, "global",),
      this.configureTarget(target, root,),
      this.configureTarget(target, `${root}.${role}`,),
    ];
    return applied.some((value,) => value);
  }

  /**
   * Prepara o handler: config → `workingDir` → `dryRun`, como cada `appMain`
   * do Ruby fazia antes de chamar o pipeline.
   */
  protected prepare(
    handler: SheetHandlerBase,
    root: SheetAppConfigRoot,
    role: SheetAppRole,
  ): void {
    this.configureSheet(handler, root, role,);
    if (this.workingDir !== null) handler.workingDir = this.workingDir;
    handler.dryRun = this.dryRun;
  }

  /** Injeta o `FileStore` recebido no contexto (ADR 037). */
  protected attach(
    handler: SheetHandlerBase,
    context: SheetAppContext,
  ): void {
    if (context.fileStore) handler.setFileStore(context.fileStore,);
  }

  /** Navega `config` até a seção (`_global`, `_timesheets.sender`, …). */
  private sectionNode(section: string,): SheetAppConfig | null {
    let node: unknown = this.config;
    for (const name of section.split(".",)) {
      if (node === null || typeof node !== "object") return null;
      node = (node as SheetAppConfig)["_" + name];
    }
    if (node === null || typeof node !== "object" || Array.isArray(node,)) {
      return null;
    }
    return node as SheetAppConfig;
  }
}
