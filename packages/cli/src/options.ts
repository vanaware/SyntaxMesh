/**
 * `options.ts` — tradução pura de `argv` para `ExecutionRequest` (24.3).
 *
 * Esta camada **não** toca processo, disco ou terminal: recebe a lista de
 * argumentos e devolve dados. A leitura de arquivos (`--config`, master +
 * `include`s) é da {@link ./cli.ts}, com `io.readText`.
 *
 * O mapa de flags é o do plano §5.2. Duas famílias ficam **fora** do request:
 *  - `--silent`/`--no-color` são do renderer (24.4), nunca do envelope;
 *  - `--config <FILE>` vira `configFile`, porque ler YAML é I/O.
 *
 * Flags adiadas (`--freeze*`, `--check-time-sheet`, `--check-status-sheet`,
 * `--debug*`) **erram** com `not yet available` — nunca são aceitas em
 * silêncio (regra da fase).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli.md §5.2
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.3)
 */
import type {
  ExecutionRequest,
  ExecutionResult,
  OptionSpec,
} from "@vanaware/syntaxmesh";
import { OPTION_SPECS, } from "@vanaware/syntaxmesh";

/** Opções do renderer de terminal (24.4) — não atravessam o envelope. */
export interface RendererOptions {
  /** `--silent`: suprime info/progresso. */
  silent: boolean;
  /** `false` quando `--no-color` foi passado. */
  color: boolean;
}

/** Resultado da tradução: request + renderer + caminho do YAML. */
export interface ParsedArgs {
  request: ExecutionRequest;
  renderer: RendererOptions;
  /**
   * `--config <FILE>`; `null` quando ausente. O **chamador** lê o arquivo e
   * preenche `request.configContent` — `parseArgs` é puro.
   */
  configFile: string | null;
}

/**
 * Erro de uso (`argv` inválido): sempre exit 1 com mensagem própria em
 * inglês. A CLI traduz isso em `printerr` + `exit(1)`.
 */
export class CliUsageError extends Error {
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
],);

/**
 * Flags adiadas conscientemente (plano §5.2), com o motivo **em inglês**
 * (English-first — plano §1.7). As que existem em `OPTION_SPECS` usam o rótulo
 * derivado do `deferred` do core via {@link notAvailableLabel}.
 */
const DEFERRED_REASONS: Record<string, string> = {
  "--freeze": "phase 24.9",
  "--freeze-by-task": "phase 24.9",
  "--freezedate": "phase 24.9",
  "--check-time-sheet": "phase 24.10",
  "--check-status-sheet": "phase 24.10",
  "--debug": "no equivalent in the port",
  "--debuglevel": "no equivalent in the port",
  "--debugmodules": "no equivalent in the port",
};

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
 * Converte `argv` em request + renderer.
 *
 * @throws {CliUsageError} flag desconhecida, valor faltando, flag adiada ou
 *   posicional em excesso.
 */
export function parseArgs(argv: readonly string[],): ParsedArgs {
  const request: ExecutionRequest = {};
  const renderer: RendererOptions = { silent: false, color: true, };
  const positionals: string[] = [];
  let configFile: string | null = null;

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

    if (VALUE_FLAGS.has(name,)) {
      let value = inline;
      if (value === null) {
        const next = argv[i + 1];
        if (next === undefined) {
          throw new CliUsageError(`Option '${name}' requires a value.`,);
        }
        value = next;
        i++;
      }
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
      }
      continue;
    }

    throw new CliUsageError(`Unknown option '${name}'.`,);
  }

  if (positionals.length > 0) request.entry = positionals[0];
  // `--report`/`--reports` aceitam um `<project-id>` posicional (forma do
  // tj3). Qualquer outro posicional extra é erro de uso.
  const extras = positionals.slice(1,);
  if (extras.length > 0 && request.report === undefined) {
    throw new CliUsageError(
      `Unexpected argument '${extras[0]}'.`,
    );
  }
  // Sem arquivo só `--help`/`--version` fazem sentido (respondem sem projeto).
  if (
    request.entry === undefined && request.help !== true &&
    request.version !== true
  ) {
    throw new CliUsageError("No input file given.",);
  }

  return { request, renderer, configFile, };
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
