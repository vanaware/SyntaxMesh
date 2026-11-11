/**
 * Execution boundary contract (Phase 24 — ADR 034, addendum v2.1 §3.2/§3.3).
 *
 * Everything here is **plain data**: strings, numbers, booleans, arrays and
 * plain objects — structured-cloneable and JSON-serialisable, with no
 * functions, class instances or callbacks. That requirement is what lets the
 * same contract cross `postMessage` (a Web Worker), HTTP/RPC (client and
 * server) and plain library use.
 *
 * File contents travel **inline** in `files` (the complete closure of
 * `include`s) and **never come back** in the envelope: the `options` echo
 * carries paths only.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3
 */
import type { MessageType, } from "../message.ts";
import type { ReportsJson, } from "../reports/reports-json.ts";

/** A project file already read by the consumer. */
export interface ExecutionInputFile {
  /**
   * Path/id as referenced by `include` (relative to the parent file). The core
   * does **not** normalise against disk: it only compares canonical forms
   * within the list it was given.
   */
  path: string;
  /** Full file contents. */
  content: string;
}

/** `--freeze` / `--freeze-by-task`. */
export interface ExecutionFreezeRequest {
  /** Cut-off date (`--freezedate`); absent means "now", resolved by the core. */
  date?: string;
  /** Group bookings by task instead of by resource. */
  byTask?: boolean;
}

/** `syntaxmesh man` — syntax documentation from the doc-core (Phase 22). */
export interface ExecutionManRequest {
  /**
   * Output format.
   *
   * - `text` — terminal documentation (default);
   * - `html` — the full manual (or a single keyword page) in `files`;
   * - `smx` — a pasteable `.smx` source excerpt (annotated example).
   */
  format: "html" | "text" | "smx";
  /** Requested keywords; empty or absent means the whole document. */
  keywords?: string[];
  /**
   * Colour the textual output with ANSI escapes.
   *
   * Set by the renderer (the CLI decides from `--no-color`/TTY), never by the
   * disk: it is a boolean payload like any other request field.
   */
  color?: boolean;
  /** Omit `deprecated`/`removed` keywords from the appendix. */
  ignoreOld?: boolean;
}

/** Sheet apps bundled by the CLI (Phase 18 + Phase 24). */
export type SheetAppName =
  | "ts-send"
  | "ts-receive"
  | "ts-summary"
  | "ss-send"
  | "ss-receive"
  | "check-ts"
  | "check-ss";

/**
 * Sheet app options — the **data** subset of the full `SheetAppOptions`.
 *
 * `now` (the injectable clock) is excluded by contract: a function does not
 * cross the envelope boundary. Callers that need a deterministic date call the
 * app directly, in-process.
 *
 * Per-app flags (`resources`, `force`, `recipients`, …) are carried here; which
 * of them a front end exposes is that front end's decision.
 */
export interface ExecutionSheetAppOptions {
  /** Base directory the app resolves relative paths against. */
  workingDir?: string | null;
  /** Report what the app would do without writing or sending anything. */
  dryRun?: boolean;
  /** Parsed YAML configuration handed in by the caller; the core never reads it. */
  config?: Record<string, unknown> | null;
  /** Upper bound of the period being processed (ISO date or epoch value). */
  endDate?: string | number | null;
  /** Sender address (`-f/--from`). */
  from?: string | null;
  /** Raw message received by a receiver app — text, not a file path. */
  rawMessage?: string | null;
  /**
   * Sheet text submitted to `check-ts`/`check-ss`.
   *
   * Passed in as **data**: the check runs `checkTimeSheetContent` /
   * `checkStatusSheetContent` and never touches a `FileStore` or the disk.
   */
  sheetContent?: string | null;
  /** Name used in messages and in `inputFiles` of the sheet check. */
  sheetFile?: string | null;
  /**
   * Read closure of the app: everything it would open from disk (templates,
   * `resources.json`, signatures, sheets) arrives ready here.
   *
   * The consumer walks the working directory and hands the files over as
   * data; the core never opens a file.
   */
  files?: ExecutionInputFile[];
  /** Directories that must exist before the app runs (per-period folders). */
  dirs?: string[];
  /** `-r/--resource <ID>` (repeatable) — sender and summary apps. */
  resources?: string[];
  /** `-f/--force` — re-send an already existing template. */
  force?: boolean;
  /** `-i/--interval <DURATION>` — status sheet send. */
  intervalDuration?: string | null;
  /** `--hideresource <EXPR>` — status sheet send. */
  hideResource?: string | null;
  /** `--sheet <EMAIL>` — recipients of the individual sheets (time summary). */
  sheetRecipients?: string[];
  /** `--digest <EMAIL>` — recipients of the digest (time summary). */
  digestRecipients?: string[];
}

/**
 * Echo of `appOptions`: the read closure comes back as **paths**, never as
 * content — the envelope does not return files.
 */
export interface ExecutionSheetAppOptionsEcho
  extends Omit<ExecutionSheetAppOptions, "files"> {
  /** Paths seeded into the app (without their contents). */
  files?: string[];
}

/** Execution request — mirrors the v1 flag map (plan §5.2). */
export interface ExecutionRequest {
  /**
   * Full closure: the master file plus every `.smx`/include referenced by
   * `include`. Absent or empty means a `tj3_tjp_file_missing` error.
   */
  files?: ExecutionInputFile[];
  /** `path` of the master file to parse (defaults to `files[0].path`). */
  entry?: string;
  /** YAML configuration already read by the consumer (no FS in the core). */
  configContent?: string;
  /**
   * Parsed YAML root of `configContent` (RuntimeConfig's dotted-section walk).
   * When present, `execute` applies the `_global` and `_global._log` sections
   * onto `MessageHandlerInstance` after the per-call reset (F24 24.3.11 —
   * faithful to Ruby's `Tj3Daemon#initialize`). The CLI fills this; PWA/HTTP
   * consumers may pass `null` when they don't have a YAML config.
   */
  configObject?: Record<string, unknown> | null;
  /** `--check-syntax`: parse only, do not schedule. */
  checkSyntax?: boolean;
  /** `--list-reports <RE>`: report id or regular expression. */
  listReports?: string;
  /** Interpret `listReports` as a regular expression (default: `true`). */
  listReportsIsRegex?: boolean;
  /** `--report <R>` / `--reports <RE>`: report id or pattern. */
  report?: string;
  /** Interpret `report` as a regular expression. */
  reportsIsRegex?: boolean;
  /** `--report -A "<attrs>"`: raw attribute snippet. */
  dynamicAttributes?: string;
  /** `--output-dir <DIR>`: echoed in the `reports` section when present. */
  outputDir?: string;
  /** `--no-reports`: schedule and stop (no `reports` section). */
  noReports?: boolean;
  /** `--force-reports`: bypass the pipeline's error gate. */
  forceReports?: boolean;
  /** `--abort-on-warnings`: count warnings as errors. */
  abortOnWarnings?: boolean;
  /** `--warn-ts-deltas`: report time-sheet deltas. */
  warnTsDeltas?: boolean;
  /** `--add-trace`: enable trace reports. */
  addTrace?: boolean;
  /** `--freeze` / `--freeze-by-task`. */
  freeze?: ExecutionFreezeRequest;
  /** `--help`: without `files`, answer only the `help` section. */
  help?: boolean;
  /** `--version`: without `files`, answer only the `version` section. */
  version?: boolean;
  /** Syntax documentation request (`man` section). */
  man?: ExecutionManRequest;
  /** Sheet app to run (`sheet` section). */
  app?: SheetAppName;
  /** Options of the sheet app. */
  appOptions?: ExecutionSheetAppOptions;
}

/** Specification of one execution option (single source: `help` + CLI). */
export interface OptionSpec {
  /** Long name, without the leading `--` (`report`). */
  name: string;
  /** Short name, without the leading `-` (`R`); `null` when only long exists. */
  short: string | null;
  /** Type of the expected value. */
  type: "boolean" | "string" | "number" | "string[]";
  /** Argument placeholder for the help text (`<id>`, `<attrs>`), if any. */
  argument: string | null;
  /** Description shown to users (English-first). */
  description: string;
  /** Flag consciously deferred, with the reason recorded in the plan. */
  deferred?: string;
}

/** Structured message produced by the message handler. */
export interface ExecutionMessage {
  /** Severity level of the message. */
  severity: MessageType;
  /** Stable message id (`tj3_tjp_file_missing`, …). */
  id: string;
  /** Rendered message text. */
  text: string;
  /** Source file, when the message carries `SourceFileInfo`. */
  file: string | null;
  /** Source line, when known. */
  line: number | null;
}

/**
 * Echo of the request with defaults applied.
 *
 * Files are represented by **paths only** — `entry` plus `files[]` as a list
 * of `path`s. Text is never returned.
 */
export interface ExecutionOptionsEcho {
  /** Resolved master path (defaults to `files[0].path`). */
  entry: string;
  /** Paths of the closed input set — contents are not echoed. */
  files: string[];
  /** Raw YAML configuration, or `null`. */
  configContent: string | null;
  /** Parse-only mode. */
  checkSyntax: boolean;
  /** Report id or pattern requested for listing, or `null`. */
  listReports: string | null;
  /** Whether `listReports` is a regular expression. */
  listReportsIsRegex: boolean;
  /** Report id or pattern requested for generation, or `null`. */
  report: string | null;
  /** Whether `report` is a regular expression. */
  reportsIsRegex: boolean;
  /** Raw `-A` attribute snippet, or `null`. */
  dynamicAttributes: string | null;
  /** Destination directory echoed back, or `null`. */
  outputDir: string | null;
  /** Scheduling without report generation. */
  noReports: boolean;
  /** Report generation despite pipeline errors. */
  forceReports: boolean;
  /** Whether warnings are promoted to errors. */
  abortOnWarnings: boolean;
  /** Whether time-sheet deltas are reported. */
  warnTsDeltas: boolean;
  /** Whether trace reports are enabled. */
  addTrace: boolean;
  /** Freeze settings in effect, or `null`. */
  freeze: ExecutionFreezeRequest | null;
  /** Whether only the `help` section was requested. */
  help: boolean;
  /** Whether only the `version` section was requested. */
  version: boolean;
  /** Syntax documentation request in effect, or `null`. */
  man: ExecutionManRequest | null;
  /** Sheet app in effect, or `null`. */
  app: SheetAppName | null;
  /** Sheet app options in effect (paths only), or `null`. */
  appOptions: ExecutionSheetAppOptionsEcho | null;
}

/** `results.listReports[]`. */
export interface ListReportsEntry {
  /** Report id as declared in the project. */
  name: string;
  /** Report type (`taskreport`, `resourcereport`, `export`, …). */
  type: string;
}

/**
 * One file produced by freeze.
 *
 * Freezing emits **two** artefacts: the header include carrying the new `now`
 * and the export of the bookings. Both come back as data; writing them is the
 * consumer's job.
 */
export interface FreezeFile {
  /** Logical file name (derived from the master file). */
  fileName: string;
  /** Full contents to write. */
  contents: string;
}

/**
 * `results.freeze` — freeze artefacts; writing them is the consumer's job.
 *
 * Two files are produced next to the master (`-header.tji` and
 * `-bookings.tji`); the envelope returns both so the caller can write them
 * without reopening the pipeline.
 */
export interface FreezeSection {
  /** Artefacts in write order (header first). */
  files: FreezeFile[];
}

/**
 * One message produced by a sheet app.
 *
 * `text` is the complete RFC 822 message (the same form receivers consume):
 * the consumer prints it, writes `outbox/*.eml` or hands it to a mail client.
 * There is never any SMTP transport.
 */
export interface SheetEmail {
  /** Recipient address. */
  to: string;
  /** Message subject. */
  subject: string;
  /** Complete RFC 822 message. */
  text: string;
}

/** `results.sheet` — sheet apps as **data** (no SMTP, no FS). */
export interface SheetSection {
  /** Bundle that produced this section. */
  app: SheetAppName;
  /** Exit code the app would report, when it has one. */
  exitCode?: number;
  /** First message (`emails[0].text`) — shortcut for single-email apps. */
  emailText?: string;
  /** Every generated message, in emission order. */
  emails?: SheetEmail[];
  /** Files attached by the app. */
  attachments?: Array<{ name: string; contents: string }>;
  /** Summary body, when the app produces one. */
  summaryText?: string;
  /** Report body, when the app produces one. */
  reportText?: string;
  /**
   * Files the app **created or changed** in its ephemeral store.
   *
   * This is the delta against the seed (`appOptions.files`): the consumer
   * writes only what was actually produced, without rewriting inputs that were
   * merely read.
   */
  files?: Array<{ name: string; contents: string }>;
}

/** `results.man` — syntax documentation in the requested format. */
export interface ManSection {
  /** Format that produced the section. */
  format: "html" | "text" | "smx";
  /** Resolved keywords (empty means the whole document). */
  keywords: string[];
  /** Rendered content (`text`/`smx`); empty in the `html` format. */
  content: string;
  /**
   * Manual files, relative to the output directory (only in the `html`
   * format).
   *
   * The core returns `name → contents`; writing them is the caller's job.
   */
  files: Array<{ name: string; contents: string }>;
}

/** Result sections: **only** the requested ones are present. */
export interface ExecutionResults {
  /** Syntax check outcome (`--check-syntax`). */
  check?: { valid: boolean };
  /** Reports enumerated by `--list-reports`. */
  listReports?: ListReportsEntry[];
  /** Generated report contents and per-report errors. */
  reports?: ReportsJson;
  /** Freeze artefacts to be written by the consumer. */
  freeze?: FreezeSection;
  /** Sheet app outcome. */
  sheet?: SheetSection;
  /** Syntax documentation. */
  man?: ManSection;
  /** Option table for the `help` section. */
  help?: OptionSpec[];
  /** Package name and version. */
  version?: { name: string; version: string };
}

/** Envelope returned by `execute` (public contract). */
export interface ExecutionResult {
  /** `false` when an error prevented the requested result. */
  ok: boolean;
  /** `0` success · `1` error. **Data**, not an action. */
  exitCode: number;
  /** Request echoed with defaults applied. */
  options: ExecutionOptionsEcho;
  /** Messages produced while handling the request. */
  messages: ExecutionMessage[];
  /** Result sections, one per requested feature. */
  results: ExecutionResults;
}
