/**
 * `options.ts` — pure translation of `argv` into an `ExecutionRequest` (24.3).
 *
 * This layer does **not** touch the process, the disk or the terminal: it takes
 * the argument list and returns data. Reading files (`--config`, master plus
 * `include`s) belongs to {@link ./cli.ts}, through `io.readText`.
 *
 * The flag map is the one in plan §5.2. Three families stay **out** of the
 * request:
 *  - `--silent`/`--no-color` belong to the renderer (24.4), never to the
 *    envelope;
 *  - `--config <FILE>` becomes `configFile`, because reading YAML is I/O;
 *  - `--check-time-sheet`/`--check-status-sheet` and `--from` become paths to
 *    read (`sheetFile`/`messageFile`), for the same reason.
 *
 * The five sheet apps of phase 18 come in as **subcommands** (`ts send`,
 * `ts receive`, `ts summary`, `ss send`, `ss receive`): that is how the Ruby
 * `tj3ts_*`/`tj3ss_*` binaries are merged into a single program without
 * inventing flags `tj3` does not have. The flags of each app (`-r`, `--force`,
 * `--digest`, …) follow the `Tj3SheetAppBase` table and the five
 * `apps/Tj3{T,S}s*.rb` files.
 *
 * Deferred flags (`--debug*`) **fail** with `not yet available` — they are never
 * accepted silently (phase rule).
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

/** Terminal renderer options (24.4) — they do not cross the envelope. */
export interface RendererOptions {
  /** `--silent`: suppresses info/progress output. */
  silent: boolean;
  /** `false` when `--no-color` was given. */
  color: boolean;
}

/** Result of the translation: request + renderer + paths to read. */
export interface ParsedArgs {
  /** Request to send to `execute` (the core envelope). */
  request: ExecutionRequest;
  /** Presentation options of the CLI (`--silent`/`--no-color`). */
  renderer: RendererOptions;
  /**
   * `--config <FILE>`; `null` when absent. The **caller** reads the file and
   * fills `request.configContent` — `parseArgs` is pure.
   */
  configFile: string | null;
  /**
   * `--check-time-sheet <FILE>`/`--check-status-sheet <FILE>`; `null` when
   * absent. The caller reads it and passes it as `appOptions.sheetContent`
   * (24.2.33).
   */
  sheetFile: string | null;
  /**
   * `--from <FILE|->` of the receivers; `null` when absent. `-` is stdin — the
   * caller reads it and passes it as `appOptions.rawMessage` (24.10.2).
   */
  messageFile: string | null;
  /**
   * `-d/--directory <DIR>` of the sheet apps; `null` when absent.
   *
   * It is the **read/write root** of the caller, not the core's `workingDir`: on
   * the data path the `MemoryFileStore` is already relative to it (ADR 037), so
   * passing it on would prefix the paths twice.
   */
  sheetDir: string | null;
}

/**
 * Usage error (invalid `argv`): always exit 1 with its own message in English.
 * The CLI turns this into `printerr` + `exit(1)`.
 */
export class CliUsageError extends Error {
  /** `message` already comes in English and is printed as is. */
  constructor(message: string,) {
    super(message,);
    this.name = "CliUsageError";
  }
}

/** Boolean flags mapped field by field to the request. */
const BOOLEAN_FLAGS: Record<string, keyof ExecutionRequest> = {
  "--abort-on-warnings": "abortOnWarnings",
  "--check-syntax": "checkSyntax",
  "--no-reports": "noReports",
  "--force-reports": "forceReports",
  "--warn-ts-deltas": "warnTsDeltas",
  "--add-trace": "addTrace",
};

/** Flags with a value; the normalised name is the request key. */
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
 * Formats of `man --format`.
 *
 * `.smx` is the name of the SyntaxMesh source format (the original manual called
 * that slice `tjp`); `html` is the complete manual as files.
 */
const MAN_FORMATS: Record<string, ExecutionManRequest["format"]> = {
  text: "text",
  html: "html",
  smx: "smx",
};

/**
 * Validates `man --format`.
 *
 * @throws {CliUsageError} unknown format.
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
 * Consciously deferred flags (plan §5.2), with the reason **in English**
 * (English-first — plan §1.7). The ones present in `OPTION_SPECS` use the label
 * derived from the core `deferred` via {@link notAvailableLabel}.
 */
const DEFERRED_REASONS: Record<string, string> = {
  "--debug": "no equivalent in the port",
  "--debuglevel": "no equivalent in the port",
  "--debugmodules": "no equivalent in the port",
};

/**
 * Sheet subcommands (24.10.1–24.10.4) → app of the `sheet` section.
 *
 * `tj3` ships one binary per app; here they are subcommands of the single
 * program, shaped as `<protocol> <action>` (`ts send`, `ss receive`, …).
 */
const SHEET_COMMANDS: Record<string, SheetAppName> = {
  "ts send": "ts-send",
  "ts receive": "ts-receive",
  "ts summary": "ts-summary",
  "ss send": "ss-send",
  "ss receive": "ss-receive",
};

/** Booleans of the sheet apps (`--force`, `--dryrun`).
 *
 * `-f` does **not** belong here: in `tj3` it is `--force-reports` (`Tj3.rb`
 * l.148-151) and in the sheet apps it is `--force`; the subcommand decides,
 * resolved after the scan (see `forceRequested`).
 */
const SHEET_BOOLEAN_FLAGS: Record<string, "force" | "dryRun"> = {
  "--force": "force",
  "--dryrun": "dryRun",
  "--dry-run": "dryRun",
};

/** Flags with a value of the sheet apps (`Tj3SheetAppBase` plus the five apps). */
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

/** Subphase cited in the core `deferred` (`Fase 24 — 24.9 (…)` → `24.9`). */
const SUBPHASE = /(\d+\.\d+)/;

/**
 * English label of a deferred flag.
 *
 * The core `deferred` is written for the code reader (Portuguese, with the full
 * reason); the CLI reduces it to the only stable information — the owning
 * subphase — so the help and the errors stay English-only.
 */
export function notAvailableLabel(spec: OptionSpec,): string {
  const subphase = spec.deferred?.match(SUBPHASE,)?.[1];
  return subphase === undefined
    ? "no equivalent in the port"
    : `phase ${subphase}`;
}

/** Label for the flag name: from `OPTION_SPECS` when present. */
function deferredReason(name: string,): string {
  const plain = name.replace(/^-+/, "",);
  const spec = OPTION_SPECS.find((item,) => item.name === plain);
  if (spec?.deferred !== undefined) return notAvailableLabel(spec,);
  return DEFERRED_REASONS[name] ?? "not available";
}

/** Splits `--flag=value` into name and inline value. */
function splitFlag(arg: string,): [string, string | null,] {
  const eq = arg.indexOf("=",);
  if (!arg.startsWith("--",) || eq < 0) return [arg, null,];
  return [arg.slice(0, eq,), arg.slice(eq + 1,),];
}

/**
 * Value of a flag with an argument: inline (`--flag=value`) or the next argument.
 * Also returns the new loop index.
 *
 * @throws {CliUsageError} when there is no value.
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
 * Converts `argv` into request + renderer.
 *
 * @throws {CliUsageError} unknown flag, missing value, deferred flag, conflicting
 *   sheet app or excess positional argument.
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
  // First app flag seen: it names the "missing subcommand" error.
  let appFlag: string | null = null;
  let freezeRequested = false;
  let freezeDate: string | null = null;
  let freezeByTask = false;
  // Accumulated `-f`: only the subcommand (or its absence) says whether it is
  // `tj3`'s `--force-reports` or the sheet apps' `--force`.
  let forceRequested = false;
  // `man --format <text|html|smx>`: accumulated and only applied at the subcommand.
  let manFormat: string | null = null;

  /** One app per run: two different requests are a usage error. */
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

    // `--freeze` (Ruby `Tj3.rb` l.86-91). The date and the grouping are
    // accumulated and only count with the explicit freeze request.
    if (name === "--freeze") {
      if (inline !== null) {
        throw new CliUsageError(`Option '${name}' does not take a value.`,);
      }
      freezeRequested = true;
      continue;
    }
    // `--freezebytask` is the Ruby spelling; `--freeze-by-task` the manual one.
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

    // Sheet verification (Ruby `Tj3.rb` l.196-203). Ruby accumulates
    // (`@timeSheets << arg`), but the envelope checks one at a time: repeating
    // the **same** kind is refused instead of silently discarded; switching kind
    // falls through to the app conflict, which explains it better.
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

    // `-f` is ambiguous between `tj3` (`--force-reports`) and the sheet apps
    // (`--force`): accumulate and decide only after the subcommand.
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
          // Ruby `Tj3TsSummary.rb` l.52-57: `-t` feeds **both** lists.
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

  // Sheet subcommand (`ts send`, …) — consumes two positionals.
  if (positionals.length >= 2) {
    const command = `${positionals[0]} ${positionals[1]}`;
    const app = SHEET_COMMANDS[command];
    if (app !== undefined) {
      positionals.splice(0, 2,);
      setApp(app, command,);
    }
  }

  // `man` subcommand (24.9.1–24.9.3): the remaining positionals are keywords,
  // so `syntaxmesh man task resource` documents both. Without a keyword the
  // document is complete (list in `text`, manual in `html`).
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
      // `tj3 -f`: build reports despite scheduling errors.
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
  // `--report`/`--reports` accept a positional `<project-id>` (the tj3 form).
  // Any other extra positional is a usage error.
  const extras = positionals.slice(1,);
  if (extras.length > 0 && request.report === undefined) {
    throw new CliUsageError(
      `Unexpected argument '${extras[0]}'.`,
    );
  }
  // Without a file only `--help`/`--version` make sense (they answer without a
  // project); `man` does not open any project either.
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
 * CLI `exitCode` from the envelope.
 *
 * The complete matrix (0/1, `abortOnWarnings`, broken parse) belongs to the core
 * (24.2.24); here it is only projected onto `0 | 1` — any unexpected code
 * becomes 1 so as not to pretend success.
 */
export function resolveExit(
  result: ExecutionResult | null | undefined,
): 0 | 1 {
  return result?.exitCode === 0 ? 0 : 1;
}
