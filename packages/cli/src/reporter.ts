/**
 * `reporter.ts` — mensagens do envelope no terminal (24.4).
 *
 * A CLI **não** lê o `MessageHandlerInstance` vivo: as mensagens chegam
 * estruturadas em `result.messages` (`severity`/`id`/`text`/`file`/`line`), o
 * mesmo dado que o envelope transporta para a PWA. Formato fiel ao Ruby
 * (`Message#to_s`): `arquivo:linha: Tipo: texto`, com o tipo capitalizado.
 *
 * Saída em **stderr**, como `$stderr.puts msg.to_s` no Ruby: o `stdout` fica
 * reservado ao conteúdo dos relatórios (política de saída, 24.5), o que torna
 * `syntaxmesh proj.smx --report x > out.html` previsível.
 *
 * @see docs/taskjuggler/lib/taskjuggler/MessageHandler.rb (Message#to_s)
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.4)
 */
import type { ExecutionMessage, } from "@vanaware/syntaxmesh";

/** Escreve uma linha; injetável para os testes não usarem mock global. */
export type WriteLine = (text: string,) => void;

/** Opções do renderer (resolvidas por `--silent`/`--no-color`/TTY). */
export interface ReporterOptions {
  /** `--silent`: suprime info/debug (erros e avisos continuam). */
  silent?: boolean;
  /** `false` desliga o ANSI (pipe, redirecionamento ou `--no-color`). */
  color?: boolean;
  /** `stdout` (resumo do projeto, 24.4.5). */
  out?: WriteLine;
  /** `stderr` (mensagens e contagem final). */
  err?: WriteLine;
}

/** Contagem final, derivada do envelope. */
export interface MessageCounts {
  errors: number;
  warnings: number;
}

/** Cor SGR por severidade (`Message#to_s` do Ruby). */
const COLORS: Record<ExecutionMessage["severity"], string> = {
  fatal: "\u001b[31m",
  error: "\u001b[31m",
  warning: "\u001b[35m",
  info: "\u001b[34m",
  debug: "\u001b[32m",
};

/** Reset do ANSI. */
const RESET = "\u001b[0m";

/** Tipo capitalizado, como `@type.to_s.capitalize` no Ruby. */
function label(severity: ExecutionMessage["severity"],): string {
  return severity.charAt(0,).toUpperCase() + severity.slice(1,);
}

/**
 * Renderiza uma mensagem do envelope em uma linha.
 *
 * `arquivo:linha: Tipo: texto` quando há origem; sem origem cai para
 * `Tipo: texto`. Os campos `file`/`line` do envelope já vêm separados, então a
 * formatação não depende de `SourceFileInfo`.
 */
export function formatMessage(
  message: ExecutionMessage,
  color = false,
): string {
  const origin = message.file === null
    ? ""
    : message.line === null
    ? `${message.file}: `
    : `${message.file}:${message.line}: `;
  const tag = `${label(message.severity,)}: `;
  const body = `${origin}${tag}${message.text}`;
  return color
    ? `${origin}${COLORS[message.severity]}${tag}${message.text}${RESET}`
    : body;
}

/** `--silent` esconde info e debug; erros/avisos sempre aparecem. */
function isHidden(message: ExecutionMessage, silent: boolean,): boolean {
  return silent &&
    (message.severity === "info" || message.severity === "debug");
}

/** Reporter de terminal: mensagens + contagem final. */
export class Reporter {
  private readonly silent: boolean;
  private readonly color: boolean;
  private readonly out: WriteLine;
  private readonly err: WriteLine;

  constructor(options: ReporterOptions = {},) {
    this.silent = options.silent === true;
    this.color = options.color === true;
    this.err = options.err ?? ((text: string,) => console.error(text,));
    this.out = options.out ?? ((text: string,) => console.log(text,));
  }

  /** Imprime uma mensagem respeitando nível, silêncio e cor. */
  message(message: ExecutionMessage,): void {
    if (isHidden(message, this.silent,)) return;
    this.err(formatMessage(message, this.color,),);
  }

  /**
   * Erro nascido na CLI (não no envelope) — ex.: falha de um relatório.
   *
   * Usa o mesmo formato de `Error:` do `Message#to_s` e **nunca** é silenciado:
   * `--silent` cala progresso, não fracasso.
   */
  error(text: string,): void {
    this.err(
      formatMessage({
        severity: "error",
        id: "cli",
        text,
        file: null,
        line: null,
      }, this.color,),
    );
  }

  /** Conta erros/avisos do envelope (fatal conta como erro, como no Ruby). */
  static count(messages: readonly ExecutionMessage[],): MessageCounts {
    let errors = 0;
    let warnings = 0;
    for (const message of messages) {
      if (message.severity === "error" || message.severity === "fatal") {
        errors++;
      } else if (message.severity === "warning") {
        warnings++;
      }
    }
    return { errors, warnings, };
  }

  /**
   * Imprime todas as mensagens e devolve a contagem final.
   *
   * A linha `N errors, M warnings` só aparece quando há algo a reportar — uma
   * execução limpa não ganha ruído. **Adaptação** ao `tj3`: o Ruby não imprime
   * contagem (as mensagens bastam), mas o plano 24.4.4 a pede como resumo.
   */
  report(
    messages: readonly ExecutionMessage[],
  ): MessageCounts {
    for (const message of messages) this.message(message,);
    const counts = Reporter.count(messages,);
    if (counts.errors > 0 || counts.warnings > 0) {
      this.err(summaryLine(counts,),);
    }
    return counts;
  }

  /** Linha de resumo do projeto (`summary.ts`); vazia é no-op. */
  summary(lines: readonly string[],): void {
    if (this.silent) return;
    for (const line of lines) this.out(line,);
  }
}

/** `2 errors, 5 warnings` — sempre com singular/plural corretos. */
export function summaryLine(counts: MessageCounts,): string {
  const plural = (count: number, noun: string,): string =>
    `${count} ${noun}${count === 1 ? "" : "s"}`;
  return `${plural(counts.errors, "error",)}, ${
    plural(counts.warnings, "warning",)
  }`;
}
