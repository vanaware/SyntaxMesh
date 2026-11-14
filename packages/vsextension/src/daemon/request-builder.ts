/**
 * `daemon/request-builder.ts` — pure `ExecutionRequest` builder (22.5.5).
 *
 * Turns a cached file closure plus the daemon's intent into the plain-data
 * request handed to `execute` (ADR 034). Two intents drive v1 (P4.1):
 *
 * - **add/reload** — `listReports: ""` lists every report of the parsed tree
 *   (the core returns the `listReports` section without scheduling);
 * - **generate** — `report: <id>` re-parses, re-schedules and renders, returning
 *   the `reports` section.
 *
 * Only the fields the caller specifies are set; the core's `echoOptions`
 * applies the remaining defaults (`listReportsIsRegex` true, `reportsIsRegex`
 * false). No `vscode` runtime, no I/O.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.2/§3.3
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.5.5
 * @see packages/core/src/execution/execute.ts (section ordering)
 */
import type { ExecutionRequest, } from "@vanaware/syntaxmesh";
import type { InputClosure, } from "./include-closure.ts";

/** The daemon intent translated into request fields. */
export interface BuildRequestOptions {
  /** Master path; defaults to the first file of the closure. */
  entry?: string;
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
  if (opts.listReports !== undefined) {
    request.listReports = opts.listReports;
    if (opts.listReportsIsRegex !== undefined) {
      request.listReportsIsRegex = opts.listReportsIsRegex;
    }
  }
  if (opts.report !== undefined) {
    request.report = opts.report;
    if (opts.reportsIsRegex !== undefined) {
      request.reportsIsRegex = opts.reportsIsRegex;
    }
  }
  if (opts.outputDir !== undefined) request.outputDir = opts.outputDir;
  if (opts.dynamicAttributes !== undefined) {
    request.dynamicAttributes = opts.dynamicAttributes;
  }
  return request;
}
