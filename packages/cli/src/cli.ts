/**
 * `cli.ts` — entry point of the CLI (ADR 034).
 *
 * Deliberately thin by contract (plan §3): it translates `argv` into an
 * `ExecutionRequest`, reads the project and the `include` closure, calls
 * `core.execute` **once** and dispatches the envelope. No language, pipeline or
 * scheduling rule lives here.
 *
 * Single flow of plan §5.1 (addendum v2/v2.1):
 *
 *   argv → `parseArgs` → `io.readText` (master + `include` closure)
 *        → `request.files` → **one** `core.execute(request)` call
 *        → messages → envelope sections → `exit(result.exitCode)`
 *
 * Current state (24.3): the flag translation, the `include` closure and the
 * single `execute` call are delivered. Message presentation is provisional
 * (24.4 — `reporter.ts`) and the section dispatch lives in `output-policy.ts`
 * (24.5); `parsed.sheetFile`/`messageFile`/`sheetDir` are the reads the argv
 * asked for (24.9/24.10).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli.md §5.1/§5.2/§5.3
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.3/24.9/24.10)
 */

import {
  AppConfig,
  execute,
  type ExecutionInputFile,
  type ExecutionRequest,
  type ExecutionResult,
  normalizeInputPath,
  OPTION_SPECS,
  type OptionSpec,
  scanIncludeReferences,
  type SheetAppName,
} from "@vanaware/syntaxmesh";
import {
  args,
  Command,
  copy,
  exists,
  exit,
  isDir,
  isEntrypoint,
  isTty,
  listDir,
  mkpath,
  modulePath,
  print,
  printerr,
  readStdin,
  readText,
  writeText,
} from "./io.ts";
import {
  CliUsageError,
  notAvailableLabel,
  parseArgs,
  type ParsedArgs,
  type RendererOptions,
  resolveExit,
} from "./options.ts";
import { parse as parseYaml, } from "@std/yaml";
import { dispatchSections, type OutputPolicyIo, } from "./output-policy.ts";
import { Reporter, } from "./reporter.ts";
import { lastSummaryLines, } from "./summary.ts";

/** CLI I/O — injectable in tests (no global mock). */
export interface CliIo {
  /** Reads a UTF-8 file (`io.readText` in the real runtime). */
  read: (path: string,) => Promise<string>;
  /** Writes a line to `stdout`. */
  print: (text: string,) => void;
  /** Writes a line to `stderr`. */
  printerr: (text: string,) => void;
  /** Reads the whole `stdin` (`--from -`; default: `io.readStdin`). */
  readStdin?: () => Promise<string>;
  /** Lists a directory (default: `io.listDir`). */
  listDir?: (path: string,) => Promise<string[]>;
  /** `true` when the path is a directory (default: `io.isDir`). */
  isDir?: (path: string,) => Promise<boolean>;
}

/** I/O implementation of the process (`io.ts`). */
export const defaultIo: CliIo = {
  read: readText,
  print,
  printerr,
};

// ---------------------------------------------------------------------------
// Cliffy command — human help for argv (plan §5.2 point 8)
// ---------------------------------------------------------------------------

/** `100` → `--report <id:string>` in Cliffy's flag format. */
function flagSpec(spec: OptionSpec,): string {
  const long = `--${spec.name}`;
  const flags = spec.short === null ? long : `-${spec.short}, ${long}`;
  if (spec.type === "boolean" || spec.argument === null) return flags;
  // Cliffy requires the type when the argument has a name; `<id>` → `<id:string>`.
  return `${flags} ${spec.argument.replace(/^<([^>:]+)>$/, "<$1:string>",)}`;
}

/** Help description; deferred flags cite the owning subphase (in English). */
function descriptionOf(spec: OptionSpec,): string {
  return spec.deferred === undefined
    ? spec.description
    : `${spec.description} (not yet available: ${notAvailableLabel(spec,)})`;
}

/**
 * Command definition for the human help.
 *
 * **Single source**: the options come from `OPTION_SPECS` (core), the same list
 * as the `help` section of the envelope — never two diverging tables (plan §5.2,
 * point 8). The argv parsing belongs to the pure `parseArgs`, not to Cliffy.
 *
 * No return annotation of its own: the return type is Cliffy's **own** chain (the
 * generic carries the declared flags). Narrowing it to `Command`, to
 * `ReturnType<typeof …>` or to a hand-written generic does not compile / becomes
 * another `deno doc --lint` diagnostic — the debt is accepted in the `lint:doc`
 * ceiling (ADR 041).
 */
export function buildCommand() {
  const command = new Command()
    .name(AppConfig.appName,)
    .version(AppConfig.version,)
    .description(
      "Project management, simplified. Runs a TaskJuggler-compatible " +
        "project file (.smx; .tjp accepted for compatibility). " +
        "Use 'syntaxmesh man [<keyword>...]' for the documentation " +
        "(--format text|html|smx; --output-dir for the html manual).",
    )
    .arguments("<file:string>",)
    .option("--silent", "Suppress informational output.",)
    .option("--no-color", "Disable colored output.",);

  for (const spec of OPTION_SPECS) {
    // `--help`/`--version` belong to Cliffy itself.
    if (spec.name === "help" || spec.name === "version") continue;
    command.option(flagSpec(spec,), descriptionOf(spec,),);
  }
  return command;
}

/** ANSI SGR — stripped from the help when `--no-color`. */
// `String.fromCharCode` instead of an escape in the literal: the control value
// does not appear in the source (rule `no-control-regex`).
const ESCAPE = String.fromCharCode(0x1b,);
const ANSI_SGR = new RegExp(`${ESCAPE}\\[[0-9;]*m`, "g",);

/** Plain-text human help (English-first — plan §1.7). */
export async function helpText(): Promise<string> {
  return (await buildCommand().getHelp()).replace(ANSI_SGR, "",);
}

// ---------------------------------------------------------------------------
// `include` closure (plan §5.1)
// ---------------------------------------------------------------------------

/** Files read for the request, with the ones that could not be opened. */
export interface InputClosure {
  /** Master + `include`s, with a canonical `path` (`normalizeInputPath`). */
  files: ExecutionInputFile[];
  /**
   * Requested paths the CLI could not read. A missing master is fatal (the CLI
   * exits before `execute`); a missing `include` becomes `bad_include` in the
   * core, faithful to `tj3`.
   */
  missing: string[];
}

/** POSIX `File.dirname`, like the core's `SourceFileInfo.dirname()`. */
function dirnameOf(path: string,): string {
  const index = path.lastIndexOf("/",);
  if (index < 0) return ".";
  if (index === 0) return "/";
  return path.slice(0, index,);
}

/** `include` path relative to the file that declares it. */
function resolveIncludePath(from: string, reference: string,): string {
  if (reference.startsWith("/",)) return normalizeInputPath(reference,);
  return normalizeInputPath(`${dirnameOf(from,)}/${reference}`,);
}

/**
 * Reads the master and transitively closes every `include`.
 *
 * The order follows discovery (master first, then the includes in order of
 * appearance); repeated paths enter only once, which also cuts cycles before the
 * parser — recursion remains an error of the core.
 */
export async function collectInputFiles(
  entry: string,
  read: (path: string,) => Promise<string> = readText,
): Promise<InputClosure> {
  const files: ExecutionInputFile[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  const pending: string[] = [normalizeInputPath(entry,),];

  while (pending.length > 0) {
    const path = pending.shift()!;
    if (seen.has(path,)) continue;
    seen.add(path,);

    let content: string;
    try {
      content = await read(path,);
    } catch {
      missing.push(path,);
      continue;
    }
    files.push({ path, content, },);

    for (const reference of scanIncludeReferences(content,)) {
      const resolved = resolveIncludePath(path, reference,);
      if (!seen.has(resolved,)) pending.push(resolved,);
    }
  }

  return { files, missing, };
}

// ---------------------------------------------------------------------------
// Reads of the sheet apps (24.10)
// ---------------------------------------------------------------------------

/**
 * Trees of the working directory that the sheet apps read (phase 18).
 *
 * Only these are scanned: the whole root may be the repository, and the app never
 * opens anything outside the templates and the sheets it writes itself.
 */
const SHEET_TREES = [
  "TimeSheetTemplates",
  "TimeSheets",
  "StatusSheetTemplates",
  "StatusSheets",
];

/** Joins directory and name without a double slash (`.` and `""` are the root). */
function joinDisk(dir: string, name: string,): string {
  if (dir === "" || dir === ".") return name;
  return `${dir.replace(/\/+$/u, "",)}/${name}`;
}

/**
 * Reads a sheet tree recursively as **data** (24.10).
 *
 * The `path` of the result is relative to the root
 * (`TimeSheets/2026-05-18/dev.tji`), the same key as the `MemoryFileStore` — the
 * core never sees a disk path. Whatever cannot be read stays out of the seed:
 * the app reports the missing sheet.
 */
async function collectTree(
  diskDir: string,
  relDir: string,
  files: ExecutionInputFile[],
  io: CliIo,
): Promise<void> {
  let names: string[];
  try {
    names = await (io.listDir ?? listDir)(diskDir,);
  } catch {
    return;
  }
  for (const name of names) {
    const disk = joinDisk(diskDir, name,);
    const rel = relDir === "" ? name : `${relDir}/${name}`;
    if (await (io.isDir ?? isDir)(disk,)) {
      await collectTree(disk, rel, files, io,);
      continue;
    }
    try {
      files.push({ path: rel, content: await io.read(disk,), },);
    } catch {
      // Unreadable file (binary/permission): out of the seed, inventing no data.
    }
  }
}

/** Read closure of the sheet apps from the working directory. */
export async function collectSheetFiles(
  root: string,
  io: CliIo = defaultIo,
): Promise<ExecutionInputFile[]> {
  const files: ExecutionInputFile[] = [];
  for (const tree of SHEET_TREES) {
    await collectTree(joinDisk(root, tree,), tree, files, io,);
  }
  return files;
}

/** Outcome of the reads requested by the argv. */
interface ReadOutcome {
  /** `1` when a requested file could not be read; `null` continues the flow. */
  exit: number | null;
  /** Root of the relative paths of the sheet app (`-d`, default `""`). */
  sheetRoot: string;
}

/**
 * Materialises into `appOptions` what the argv points to as a **file** (24.10).
 *
 * `--check-time-sheet`/`--check-status-sheet` become `sheetContent` (data),
 * `--from` becomes `rawMessage` (file or stdin) and the working directory is
 * scanned for the seed of the app. The CLI reads; the core only receives values.
 */
async function applyReads(
  parsed: ParsedArgs,
  request: ExecutionRequest,
  io: CliIo,
): Promise<ReadOutcome> {
  const appOptions = request.appOptions ?? {};
  const sheetRoot = parsed.sheetDir ?? "";

  if (parsed.sheetFile !== null) {
    try {
      appOptions.sheetContent = await io.read(parsed.sheetFile,);
    } catch {
      io.printerr(`Cannot open file '${parsed.sheetFile}'.`,);
      return { exit: 1, sheetRoot, };
    }
    appOptions.sheetFile = parsed.sheetFile;
  }

  if (parsed.messageFile !== null) {
    try {
      appOptions.rawMessage = parsed.messageFile === "-"
        ? await (io.readStdin ?? readStdin)()
        : await io.read(parsed.messageFile,);
    } catch {
      io.printerr(
        `Cannot read the email message from '${parsed.messageFile}'.`,
      );
      return { exit: 1, sheetRoot, };
    }
  }

  const app = request.app;
  if (app !== undefined && app !== "check-ts" && app !== "check-ss") {
    const files = await collectSheetFiles(sheetRoot, io,);
    if (files.length > 0) appOptions.files = files;
  }

  request.appOptions = Object.keys(appOptions,).length === 0
    ? undefined
    : appOptions;
  return { exit: null, sheetRoot, };
}

// ---------------------------------------------------------------------------
// Configuration (24.3.11)
// ---------------------------------------------------------------------------

/** `true` for the five email apps of F18 (the `tj3` config belongs to them). */
function isEmailSheetApp(app: SheetAppName | undefined,): boolean {
  return app !== undefined && app !== "check-ts" && app !== "check-ss";
}

/**
 * Reads the YAML of `--config` (24.3.11).
 *
 * Ruby builds a `RuntimeConfig` at CLI boot and lets each app opt into
 * sections through `@rc.configure(target, 'global' | 'global.log' | …)`
 * (`Tj3AppBase.rb:157`; `Tj3Daemon.rb:88-91` for the log seam). SyntaxMesh
 * keeps the same contract via the shared helper `configureFromSection`:
 *
 *  - The **email sheet apps** get the parsed YAML handed over through
 *    `appOptions.config` (ADR 037); each concrete app then walks
 *    `global` / `timesheets` / `timesheets.sender` … exactly like Ruby.
 *  - The **plain CLI** (and the `check-ts`/`check-ss` sheet apps, which do not
 *    consume SMTP-shaped config) stashes the parsed root on
 *    `request.configObject`. `execute()` then applies `_global` and
 *    `_global._log` to `MessageHandlerInstance` **after** its per-call reset
 *    (mirroring Ruby's `Tj3Daemon#initialize` order — the reset here plays
 *    the same role as Ruby's fresh-handler construction). Unknown keys are
 *    silently dropped, faithful to Ruby's `instance_variables.each`.
 *
 * Anything else in the file is left in `request.configContent` so a future
 * core consumer can still read the raw text — no data is lost.
 */
async function applyConfig(
  configFile: string | null,
  request: ExecutionRequest,
  io: CliIo,
): Promise<number | null> {
  if (configFile === null) return null;
  let content: string;
  try {
    content = await io.read(configFile,);
  } catch {
    io.printerr(`Cannot open configuration file '${configFile}'.`,);
    return 1;
  }
  request.configContent = content;

  let config: Record<string, unknown>;
  try {
    config = (parseYaml(content,) ?? {}) as Record<string, unknown>;
  } catch {
    io.printerr(`Cannot parse configuration file '${configFile}'.`,);
    return 1;
  }

  if (isEmailSheetApp(request.app,)) {
    request.appOptions = { ...(request.appOptions ?? {}), config, };
    return null;
  }

  // Plain CLI / check-ts / check-ss: Ruby `Tj3Daemon` pattern. We stash the
  // parsed root on the request and let `execute()` apply `_global` and
  // `_global._log` to `MessageHandlerInstance` **after** its per-call reset
  // (`packages/core/src/execution/execute.ts`). Applying here would be
  // silently overwritten by that reset.
  request.configObject = config;
  return null;
}

// ---------------------------------------------------------------------------
// Presentation (24.4) and structured sections
// ---------------------------------------------------------------------------

/**
 * Envelope reporter with the effective render options.
 *
 * `--no-color` turns ANSI off, as does a `stdout` that is not a terminal
 * (pipe/redirection) — output never reaches a file coloured.
 */
function makeReporter(renderer: RendererOptions, io: CliIo,): Reporter {
  return new Reporter({
    silent: renderer.silent,
    color: renderer.color && isTty(),
    out: io.print,
    err: io.printerr,
  },);
}

/**
 * Real I/O of the envelope dispatch (24.5).
 *
 * The policy receives only the `io.ts` boundary: it decides **where** each
 * content goes, never how the disk works.
 */
function outputIo(io: CliIo,): OutputPolicyIo {
  return {
    print: io.print,
    write: writeText,
    mkpath,
    copy,
    listDir,
    isDir,
    exists,
  };
}

/**
 * Root of the auxiliary HTML assets (`css/`, `icons/`, `scripts/`).
 *
 * Relative to this module: `packages/cli/src/cli.ts` → `<repo>/assets/`. The
 * folder exists separately because the **source** layout is also the
 * **destination** layout: the HTML references `css/tjreport.css`,
 * `icons/task.png` and `scripts/wz_tooltip.js`, so copying `assets/<name>` to
 * `<output>/<name>` keeps the references valid without rewriting the report.
 *
 * When the distribution does not ship the assets next to the binary, the copy is
 * silently skipped (`dispatchReports` only copies what exists).
 */
function assetRoot(): string {
  return modulePath(import.meta.url, "../../../assets/",);
}

// ---------------------------------------------------------------------------
// Single flow
// ---------------------------------------------------------------------------

/**
 * Runs the CLI with the given arguments and returns the `exitCode`.
 *
 * Exported (instead of running only under `import.meta.main`) to allow unit
 * testing and a single entrypoint on the Deno/Bun/Node runtimes. The I/O is
 * injectable so tests do not depend on the process/disk.
 */
export async function main(
  argv: readonly string[],
  io: CliIo = defaultIo,
): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs(argv,);
  } catch (error) {
    if (error instanceof CliUsageError) {
      io.printerr(error.message,);
      io.printerr("Try 'syntaxmesh --help' for more information.",);
      return 1;
    }
    throw error;
  }

  const { request, renderer, configFile, } = parsed;

  // `man`: the colour of the textual output is a renderer decision (TTY +
  // `--no-color`), never a disk one — the request carries only the boolean.
  if (request.man !== undefined) {
    request.man.color = renderer.color && isTty();
  }

  /** Presents the envelope and translates the exit (single output path). */
  const finish = async (
    result: ExecutionResult,
    sheetRoot: string,
  ): Promise<number> => {
    const reporter = makeReporter(renderer, io,);
    reporter.report(result.messages,);
    await dispatchSections(result, {
      io: outputIo(io,),
      assets: { root: assetRoot(), },
      sheetBaseDir: sheetRoot,
      onError: (text: string,) => reporter.error(text,),
    },);
    // Project summary (in-process convenience — the envelope is the contract).
    reporter.summary(lastSummaryLines(),);
    return resolveExit(result,);
  };

  // Human help for argv belongs to Cliffy (plan §5.2, point 8).
  if (request.help === true) {
    io.print(await helpText(),);
    return 0;
  }

  // `--version` answers and exits **before any read** (`Tj3AppBase#on_tail`):
  // it opens no master, no `--config` and no sheets — with files on the command
  // line their names do not even need to exist.
  if (request.version === true) {
    return await finish(await execute(request,), "",);
  }

  const configExit = await applyConfig(configFile, request, io,);
  if (configExit !== null) return configExit;

  // Reads requested by the argv (24.9/24.10): sheet to check, received message
  // and the seed of the working directory of the sheet apps.
  const reads = await applyReads(parsed, request, io,);
  if (reads.exit !== null) return reads.exit;

  if (request.entry !== undefined) {
    const closure = await collectInputFiles(request.entry, io.read,);
    if (closure.files.length === 0) {
      io.printerr(`Cannot open file '${request.entry}'.`,);
      return 1;
    }
    request.files = closure.files;
  }

  // **One** call: the core runs parse → schedule → reports.
  return await finish(await execute(request,), reads.sheetRoot,);
}

if (isEntrypoint(import.meta.url,)) {
  exit(await main(args,),);
}
