/**
 * `daemon/request-builder.ts` — pure `ExecutionRequest` builder (22.5.5).
 *
 * Turns a cached file closure plus the complete F24 option surface into the
 * plain-data request handed to `execute` (ADR 034). This includes inventory,
 * report generation, parse/schedule controls, freeze, manual and sheet-app
 * requests without introducing a second execution entry point.
 *
 * Only fields the caller specifies are copied; explicit `false`, `null` and
 * empty values are preserved, while the core's `echoOptions` applies the
 * remaining defaults. Renderer-only options such as `silent`/`noColor` are not
 * part of this boundary. No `vscode` runtime, no I/O.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.2/§3.3
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.5.5/§22.12.4
 * @see packages/core/src/execution/execute.ts (section ordering)
 */
import type {
  ExecutionFreezeRequest,
  ExecutionManRequest,
  ExecutionRequest,
  ExecutionSheetAppOptions,
  SheetAppName,
} from "@vanaware/syntaxmesh";
import type { InputClosure, } from "./include-closure.ts";

/** The complete F24 request surface accepted by the extension daemon. */
export interface BuildRequestOptions {
  /** Master path; defaults to the first file of the closure. */
  entry?: string;
  /** YAML configuration already read by the host. */
  configContent?: string;
  /** Parsed YAML root, or `null` when configuration is unavailable. */
  configObject?: Record<string, unknown> | null;
  /** Parse only, without scheduling. */
  checkSyntax?: boolean;
  /** Report id/regex to list; `""` lists every report (add/reload). */
  listReports?: string;
  /** Whether {@link BuildRequestOptions.listReports} is a regex (core default true). */
  listReportsIsRegex?: boolean;
  /** Report id/regex to generate (re-parse + re-schedule + render). */
  report?: string;
  /** Whether {@link BuildRequestOptions.report} is a regex (core default false). */
  reportsIsRegex?: boolean;
  /** Destination directory echoed in the `reports` section. */
  outputDir?: string;
  /** Raw `-A` attribute snippet applied to the generated reports. */
  dynamicAttributes?: string;
  /** Schedule without generating reports. */
  noReports?: boolean;
  /** Render reports even when the pipeline reports errors. */
  forceReports?: boolean;
  /** Treat warnings as errors. */
  abortOnWarnings?: boolean;
  /** Report time-sheet deltas. */
  warnTsDeltas?: boolean;
  /** Enable trace reports. */
  addTrace?: boolean;
  /** Freeze date and grouping mode. */
  freeze?: ExecutionFreezeRequest;
  /** Project-free help output. */
  help?: boolean;
  /** Project-free version output. */
  version?: boolean;
  /** Project-free syntax manual output. */
  man?: ExecutionManRequest;
  /** Sheet app to execute over the cached project. */
  app?: SheetAppName;
  /** Data options for the selected sheet app. */
  appOptions?: ExecutionSheetAppOptions;
}

/**
 * Builds the `execute` request for a cached closure.
 *
 * The closure's files travel inline (the core never opens disk); `entry`
 * defaults to the master (first file). Optional fields are copied only when
 * present, so the request stays minimal and the core applies its own defaults.
 *
 * @param closure the closed input set (master + transitive includes).
 * @param opts the daemon intent (list reports, generate a report, …).
 * @returns the plain-data request ready for `execute`.
 */
export function buildExecuteRequest(
  closure: InputClosure,
  opts: BuildRequestOptions = {},
): ExecutionRequest {
  const request: ExecutionRequest = {
    files: closure.files,
    entry: opts.entry ?? closure.files[0]?.path ?? "",
  };
  if (opts.configContent !== undefined) {
    request.configContent = opts.configContent;
  }
  if (opts.configObject !== undefined) request.configObject = opts.configObject;
  if (opts.checkSyntax !== undefined) request.checkSyntax = opts.checkSyntax;
  if (opts.listReports !== undefined) request.listReports = opts.listReports;
  if (opts.listReportsIsRegex !== undefined) {
    request.listReportsIsRegex = opts.listReportsIsRegex;
  }
  if (opts.report !== undefined) request.report = opts.report;
  if (opts.reportsIsRegex !== undefined) {
    request.reportsIsRegex = opts.reportsIsRegex;
  }
  if (opts.outputDir !== undefined) request.outputDir = opts.outputDir;
  if (opts.dynamicAttributes !== undefined) {
    request.dynamicAttributes = opts.dynamicAttributes;
  }
  if (opts.noReports !== undefined) request.noReports = opts.noReports;
  if (opts.forceReports !== undefined) request.forceReports = opts.forceReports;
  if (opts.abortOnWarnings !== undefined) {
    request.abortOnWarnings = opts.abortOnWarnings;
  }
  if (opts.warnTsDeltas !== undefined) request.warnTsDeltas = opts.warnTsDeltas;
  if (opts.addTrace !== undefined) request.addTrace = opts.addTrace;
  if (opts.freeze !== undefined) request.freeze = opts.freeze;
  if (opts.help !== undefined) request.help = opts.help;
  if (opts.version !== undefined) request.version = opts.version;
  if (opts.man !== undefined) request.man = opts.man;
  if (opts.app !== undefined) request.app = opts.app;
  if (opts.appOptions !== undefined) request.appOptions = opts.appOptions;
  return request;
}
