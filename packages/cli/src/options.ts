/**
 * `options.ts` — tradução pura de `argv` para `ExecutionRequest` (24.3).
 *
 * Esta camada **não** toca processo, disco ou terminal: recebe a lista de
 * argumentos e devolve dados. A leitura de arquivos (`--config`, master +
 * `include`s) é da {@link ./cli.ts}, com `io.readText`.
 *
 * O mapa de flags é o do plano §5.2. Três famílias ficam **fora** do request:
 *  - `--silent`/`--no-color` são do renderer (24.4), nunca do envelope;
 *  - `--config <FILE>` vira `configFile`, porque ler YAML é I/O;
 *  - `--check-time-sheet`/`--check-status-sheet` e `--from` viram caminhos a
 *    ler (`sheetFile`/`messageFile`), pelo mesmo motivo.
 *
 * Os cinco apps de sheet da Fase 18 entram como **subcomandos** (`ts send`,
 * `ts receive`, `ts summary`, `ss send`, `ss receive`): é a forma de juntar
 * num programa só os binários `tj3ts_*`/`tj3ss_*` do Ruby, sem inventar
 * flags que o `tj3` não tem. As flags de cada app (`-r`, `--force`, `--digest`, …)
 * seguem a tabela do `Tj3SheetAppBase` e dos cinco `apps/Tj3{T,S}s*.rb`.
 *
 * Flags adiadas (`--debug*`) **erram** com `not yet available` — nunca são
 * aceitas em silêncio (regra da fase).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli.md §5.2
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.3/24.9.5/24.10.1–4)
 */
import type {
  ExecutionManRequest,
  ExecutionRequest,
  ExecutionResult,
  ExecutionSheetAppOptions,
  OptionSpec,
  SheetAppName,
} from "@vanaware/syntaxmesh";
import { OPTION_SPECS, } from "@vanaware/syntaxmesh";

/** Opções do renderer de terminal (24.4) — não atravessam o envelope. */
export interface RendererOptions {
  /** `--silent`: suprime info/progresso. */
  silent: boolean;
  /** `false` quando `--no-color` foi passado. */
  color: boolean;
}

/** Resultado da tradução: request + renderer + caminhos a ler. */
export interface ParsedArgs {
  /** Pedido a enviar ao `execute` (o envelope do core). */
  request: ExecutionRequest;
  /** Opções de apresentação da CLI (`--silent`/`--no-color`). */
  renderer: RendererOptions;
  /**
   * `--config <FILE>`; `null` quando ausente. O **chamador** lê o arquivo e
   * preenche `request.configContent` — `parseArgs` é puro.
   */
  configFile: string | null;
  /**
   * `--check-time-sheet <FILE>`/`--check-status-sheet <FILE>`; `null` quando
   * ausente. O chamador lê e passa como `appOptions.sheetContent` (24.2.33).
   */
  sheetFile: string | null;
  /**
   * `--from <FILE|->` dos receivers; `null` quando ausente. `-` é o stdin — o
   * chamador lê e passa como `appOptions.rawMessage` (24.10.2).
   */
  messageFile: string | null;
  /**
   * `-d/--directory <DIR>` dos apps de sheet; `null` quando ausente.
   *
   * É a **raiz de leitura/escrita** do chamador, não o `workingDir` do core: no
   * caminho de dados o `MemoryFileStore` já é relativo a ela (ADR 037), então
   * repassá-la prefixaria os caminhos duas vezes.
   */
  sheetDir: string | null;
}

/**
 * Erro de uso (`argv` inválido): sempre exit 1 com mensagem própria em
 * inglês. A CLI traduz isso em `printerr` + `exit(1)`.
 */
export class CliUsageError extends Error {
  /** `message` já sai em inglês e é impressa como está. */
  constructor(message: string,) {
    super(message,);
    this.name = "CliUsageError";
  }
}

/** Flags booleanas mapeadas campo a campo para o request. */
const BOOLEAN_FLAGS: Record<string, keyof ExecutionRequest> = {
  "--abort-on-warnings": "abortOnWarnings",
  "--check-syntax": "checkSyntax",
  "--no-reports": "noReports",
  "--force-reports": "forceReports",
  "--warn-ts-deltas": "warnTsDeltas",
  "--add-trace": "addTrace",
};

/** Flags com valor; o nome normalizado é a chave do request. */
const VALUE_FLAGS = new Set([
  "--config",
  "--list-reports",
  "--report",
  "--reports",
  "--dynamic-attributes",
  "-A",
  "--output-dir",
  "-o",
  "--format",
],);

/**
 * Formatos de `man --format`.
 *
 * O `.smx` é o nome do formato de fonte do SyntaxMesh (o manual original
 * chamava esse recorte de `tjp`); `html` é o manual completo em arquivos.
 */
const MAN_FORMATS: Record<string, ExecutionManRequest["format"]> = {
  text: "text",
  html: "html",
  smx: "smx",
};

/**
 * Valida `man --format`.
 *
 * @throws {CliUsageError} formato desconhecido.
 */
function manFormatOf(value: string | null,): ExecutionManRequest["format"] {
  if (value === null) return "text";
  const format = MAN_FORMATS[value];
  if (format === undefined) {
    throw new CliUsageError(
      `Unknown man format '${value}' (expected text, html or smx).`,
    );
  }
  return format;
}

/**
 * Flags adiadas conscientemente (plano §5.2), com o motivo **em inglês**
 * (English-first — plano §1.7). As que existem em `OPTION_SPECS` usam o rótulo
 * derivado do `deferred` do core via {@link notAvailableLabel}.
 */
const DEFERRED_REASONS: Record<string, string> = {
  "--debug": "no equivalent in the port",
  "--debuglevel": "no equivalent in the port",
  "--debugmodules": "no equivalent in the port",
};

/**
 * Subcomandos de sheet (24.10.1–24.10.4) → app da seção `sheet`.
 *
 * O `tj3` distribui um binário por app; aqui são subcomandos do programa
 * único, na forma `<protocolo> <ação>` (`ts send`, `ss receive`, …).
 */
const SHEET_COMMANDS: Record<string, SheetAppName> = {
  "ts send": "ts-send",
  "ts receive": "ts-receive",
  "ts summary": "ts-summary",
  "ss send": "ss-send",
  "ss receive": "ss-receive",
};

/** Booleanos dos apps de sheet (`--force`, `--dryrun`).
 *
 * `-f` **não** entra aqui: no `tj3` ele é `--force-reports` (`Tj3.rb` l.148-151)
 * e nos apps de sheet é `--force`; quem decide é o subcomando, resolvido depois
 * da varredura (ver `forceRequested`).
 */
const SHEET_BOOLEAN_FLAGS: Record<string, "force" | "dryRun"> = {
  "--force": "force",
  "--dryrun": "dryRun",
  "--dry-run": "dryRun",
};

/** Flags com valor dos apps de sheet (`Tj3SheetAppBase` + os cinco apps). */
const SHEET_VALUE_FLAGS = new Set([
  "-d",
  "--directory",
  "-e",
  "--enddate",
  "-r",
  "--resource",
  "--hideresource",
  "-i",
  "--interval",
  "-t",
  "--to",
  "--sheet",
  "--digest",
  "--from",
],);

/** Subfase citada no `deferred` do core (`Fase 24 — 24.9 (…)` → `24.9`). */
const SUBPHASE = /(\d+\.\d+)/;

/**
 * Rótulo em inglês de uma flag adiada.
 *
 * O `deferred` do core é escrito para o leitor do código (português, com a
 * razão completa); a CLI traduz para a única informação estável — a subfase
 * dona — para a ajuda e os erros ficarem só em inglês.
 */
export function notAvailableLabel(spec: OptionSpec,): string {
  const subphase = spec.deferred?.match(SUBPHASE,)?.[1];
  return subphase === undefined
    ? "no equivalent in the port"
    : `phase ${subphase}`;
}

/** Rótulo para o nome da flag: do `OPTION_SPECS` quando houver. */
function deferredReason(name: string,): string {
  const plain = name.replace(/^-+/, "",);
  const spec = OPTION_SPECS.find((item,) => item.name === plain);
  if (spec?.deferred !== undefined) return notAvailableLabel(spec,);
  return DEFERRED_REASONS[name] ?? "not available";
}

/** Separa `--flag=valor` em nome e valor inline. */
function splitFlag(arg: string,): [string, string | null,] {
  const eq = arg.indexOf("=",);
  if (!arg.startsWith("--",) || eq < 0) return [arg, null,];
  return [arg.slice(0, eq,), arg.slice(eq + 1,),];
}

/**
 * Valor de uma flag com argumento: inline (`--flag=valor`) ou o próximo
 * argumento. Devolve também o novo índice do laço.
 *
 * @throws {CliUsageError} quando não há valor.
 */
function valueOf(
  argv: readonly string[],
  index: number,
  name: string,
  inline: string | null,
): [string, number,] {
  if (inline !== null) return [inline, index,];
  const next = argv[index + 1];
  if (next === undefined) {
    throw new CliUsageError(`Option '${name}' requires a value.`,);
  }
  return [next, index + 1,];
}

/**
 * Converte `argv` em request + renderer.
 *
 * @throws {CliUsageError} flag desconhecida, valor faltando, flag adiada,
 *   app de sheet conflitante ou posicional em excesso.
 */
export function parseArgs(argv: readonly string[],): ParsedArgs {
  const request: ExecutionRequest = {};
  const renderer: RendererOptions = { silent: false, color: true, };
  const appOptions: ExecutionSheetAppOptions = {};
  const positionals: string[] = [];
  let configFile: string | null = null;
  let sheetFile: string | null = null;
  let messageFile: string | null = null;
  let sheetDir: string | null = null;
  // Primeira flag de app vista: dá nome ao erro de “falta o subcomando”.
  let appFlag: string | null = null;
  let freezeRequested = false;
  let freezeDate: string | null = null;
  let freezeByTask = false;
  // `-f` acumulado: só o subcomando (ou a ausência dele) diz se é
  // `--force-reports` do `tj3` ou `--force` dos apps de sheet.
  let forceRequested = false;
  // `man --format <text|html|smx>`: acumulado e só aplicado no subcomando.
  let manFormat: string | null = null;

  /** Um app por execução: dois pedidos diferentes são erro de uso. */
  const setApp = (app: SheetAppName, source: string,): void => {
    if (request.app !== undefined && request.app !== app) {
      throw new CliUsageError(
        `'${source}' conflicts with '${request.app}' (one sheet app per run).`,
      );
    }
    request.app = app;
  };

  for (let i = 0; i < argv.length; i++) {
    const raw = argv[i]!;
    if (raw === "--") {
      positionals.push(...argv.slice(i + 1,),);
      break;
    }
    if (!raw.startsWith("-",) || raw === "-") {
      positionals.push(raw,);
      continue;
    }

    const [name, inline,] = splitFlag(raw,);

    if (name === "-h" || name === "--help") {
      request.help = true;
      continue;
    }
    if (name === "-V" || name === "--version") {
      request.version = true;
      continue;
    }
    if (name === "--silent") {
      renderer.silent = true;
      continue;
    }
    if (name === "--no-color") {
      renderer.color = false;
      continue;
    }

    const deferred = DEFERRED_REASONS[name];
    if (deferred !== undefined) {
      throw new CliUsageError(
        `Option '${name}' is not yet available (${deferredReason(name,)}).`,
      );
    }

    const booleanKey = BOOLEAN_FLAGS[name];
    if (booleanKey !== undefined) {
      if (inline !== null) {
        throw new CliUsageError(`Option '${name}' does not take a value.`,);
      }
      (request as Record<string, unknown>)[booleanKey] = true;
      continue;
    }

    // `--freeze` (Ruby `Tj3.rb` l.86-91). A data e o agrupamento são
    // acumulados e só valem com o pedido explícito de freeze.
    if (name === "--freeze") {
      if (inline !== null) {
        throw new CliUsageError(`Option '${name}' does not take a value.`,);
      }
      freezeRequested = true;
      continue;
    }
    // `--freezebytask` é a grafia do Ruby; `--freeze-by-task` a do manual.
    if (name === "--freeze-by-task" || name === "--freezebytask") {
      if (inline !== null) {
        throw new CliUsageError(`Option '${name}' does not take a value.`,);
      }
      freezeByTask = true;
      continue;
    }
    if (name === "--freezedate") {
      [freezeDate, i,] = valueOf(argv, i, name, inline,);
      continue;
    }

    // Verificação de folha (Ruby `Tj3.rb` l.196-203). O Ruby acumula
    // (`@timeSheets << arg`), mas o envelope checa uma por vez: repetir o
    // **mesmo** tipo é recusado em vez de descartar em silêncio; trocar de
    // tipo segue para o conflito de app, que explica melhor.
    if (name === "--check-time-sheet" || name === "--check-status-sheet") {
      const checkApp: SheetAppName = name === "--check-time-sheet"
        ? "check-ts"
        : "check-ss";
      if (request.app === checkApp) {
        throw new CliUsageError(
          `Option '${name}' accepts only one sheet per run.`,
        );
      }
      [sheetFile, i,] = valueOf(argv, i, name, inline,);
      setApp(checkApp, name,);
      continue;
    }

    // `-f` é ambíguo entre o `tj3` (`--force-reports`) e os apps de sheet
    // (`--force`): acumula e só se decide depois do subcomando.
    if (name === "-f") {
      if (inline !== null) {
        throw new CliUsageError(`Option '${name}' does not take a value.`,);
      }
      forceRequested = true;
      continue;
    }

    const sheetBoolean = SHEET_BOOLEAN_FLAGS[name];
    if (sheetBoolean !== undefined) {
      if (inline !== null) {
        throw new CliUsageError(`Option '${name}' does not take a value.`,);
      }
      appOptions[sheetBoolean] = true;
      appFlag ??= name;
      continue;
    }

    if (SHEET_VALUE_FLAGS.has(name,)) {
      const [value, next,] = valueOf(argv, i, name, inline,);
      i = next;
      switch (name) {
        case "-d":
        case "--directory":
          sheetDir = value;
          break;
        case "-e":
        case "--enddate":
          appOptions.endDate = value;
          break;
        case "-r":
        case "--resource":
          (appOptions.resources ??= []).push(value,);
          break;
        case "--hideresource":
          appOptions.hideResource = value;
          break;
        case "-i":
        case "--interval":
          appOptions.intervalDuration = value;
          break;
        case "-t":
        case "--to":
          // Ruby `Tj3TsSummary.rb` l.52-57: `-t` alimenta as **duas** listas.
          (appOptions.sheetRecipients ??= []).push(value,);
          (appOptions.digestRecipients ??= []).push(value,);
          break;
        case "--sheet":
          (appOptions.sheetRecipients ??= []).push(value,);
          break;
        case "--digest":
          (appOptions.digestRecipients ??= []).push(value,);
          break;
        case "--from":
          messageFile = value;
          break;
      }
      appFlag ??= name;
      continue;
    }

    if (VALUE_FLAGS.has(name,)) {
      const [value, next,] = valueOf(argv, i, name, inline,);
      i = next;
      switch (name) {
        case "--config":
          configFile = value;
          break;
        case "--list-reports":
          request.listReports = value;
          break;
        case "--report":
          request.report = value;
          break;
        case "--reports":
          request.report = value;
          request.reportsIsRegex = true;
          break;
        case "--dynamic-attributes":
        case "-A":
          request.dynamicAttributes = value;
          break;
        case "--output-dir":
        case "-o":
          request.outputDir = value;
          break;
        case "--format":
          manFormat = value;
          break;
      }
      continue;
    }

    throw new CliUsageError(`Unknown option '${name}'.`,);
  }

  if (freezeRequested) {
    request.freeze = {
      ...(freezeDate === null ? {} : { date: freezeDate, }),
      ...(freezeByTask ? { byTask: true, } : {}),
    };
  }

  // Subcomando de sheet (`ts send`, …) — consome dois posicionais.
  if (positionals.length >= 2) {
    const command = `${positionals[0]} ${positionals[1]}`;
    const app = SHEET_COMMANDS[command];
    if (app !== undefined) {
      positionals.splice(0, 2,);
      setApp(app, command,);
    }
  }

  // Subcomando `man` (24.9.1–24.9.3): os posicionais restantes são keywords,
  // então `syntaxmesh man task resource` documenta as duas. Sem keyword o
  // documento é completo (lista em `text`, manual em `html`).
  if (positionals[0] === "man") {
    positionals.shift();
    request.man = {
      format: manFormatOf(manFormat,),
      ...(positionals.length === 0 ? {} : { keywords: [...positionals,], }),
    };
    positionals.length = 0;
  } else if (manFormat !== null) {
    throw new CliUsageError(
      "Option '--format' only applies to the 'man' command.",
    );
  }

  if (appFlag !== null && request.app === undefined) {
    throw new CliUsageError(
      `Option '${appFlag}' requires a sheet app ` +
        "('ts send', 'ts receive', 'ts summary', 'ss send', 'ss receive').",
    );
  }
  if (forceRequested) {
    if (request.app === undefined) {
      // `tj3 -f`: gerar relatórios apesar dos erros de agenda.
      request.forceReports = true;
    } else {
      appOptions.force = true;
    }
  }
  if (
    messageFile !== null && request.app !== "ts-receive" &&
    request.app !== "ss-receive"
  ) {
    throw new CliUsageError(
      "Option '--from' only applies to 'ts receive' and 'ss receive'.",
    );
  }
  if (Object.keys(appOptions,).length > 0) request.appOptions = appOptions;

  if (positionals.length > 0) request.entry = positionals[0];
  // `--report`/`--reports` aceitam um `<project-id>` posicional (forma do
  // tj3). Qualquer outro posicional extra é erro de uso.
  const extras = positionals.slice(1,);
  if (extras.length > 0 && request.report === undefined) {
    throw new CliUsageError(
      `Unexpected argument '${extras[0]}'.`,
    );
  }
  // Sem arquivo só `--help`/`--version` fazem sentido (respondem sem projeto);
  // `man` também não abre projeto nenhum.
  if (
    request.entry === undefined && request.man === undefined &&
    request.help !== true &&
    request.version !== true
  ) {
    throw new CliUsageError("No input file given.",);
  }

  return { request, renderer, configFile, sheetFile, messageFile, sheetDir, };
}

/**
 * `exitCode` da CLI a partir do envelope.
 *
 * A matriz completa (0/1, `abortOnWarnings`, parse quebrado) é do core
 * (24.2.24); aqui só se projeta em `0 | 1` — qualquer código inesperado
 * vira 1 para não mentir sucesso.
 */
export function resolveExit(
  result: ExecutionResult | null | undefined,
): 0 | 1 {
  return result?.exitCode === 0 ? 0 : 1;
}
