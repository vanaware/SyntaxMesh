/**
 * The `results.reports` section of the execution envelope (phase 24 — ADR 034).
 *
 * Builds the `ReportsJson` contract from the in-memory `Project`, never touching
 * the disk or the terminal: each report becomes an entry with the displayed
 * name, the `stdout` intent from the DSL, the already rendered content of every
 * declared format and the errors it produced. A failing report does **not**
 * prevent the others from being generated; the global `ok` reflects whether any
 * error occurred.
 *
 * The destination policy (print to the terminal, write `{name}.{ext}`) belongs
 * exclusively to the consumer (the CLI `output-policy.ts`).
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.2/§3.3
 */
import type { Project, } from "../model/project.ts";
import type { Report, } from "../model/report.ts";
import { ReportContext, } from "./report-context.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";

/** Content of one report format, already rendered as text. */
export interface FormatContent {
  /** Id of the format declared in the `.tjp` (`csv`, `html`, `markdown`, ...). */
  format: string;
  /** Full content of the report in that format. */
  content: string;
}

/** One entry of `results.reports`. */
export interface ReportJsonEntry {
  /** Reported name of the report (`reportName` in the DSL; unique). */
  name: string;
  /** `stdout` intent declared on the report (`false` when absent). */
  stdout: boolean;
  /**
   * The report's `selfcontained` attribute (default `false`).
   *
   * A **rendering intent**, like `stdout`: when `false`, the HTML references
   * `css/`, `scripts/` and `icons/` and the consumer must copy those assets to
   * the output directory (CLI policy, 24.5.16).
   */
  selfcontained: boolean;
  /** Formats in declaration order, each with its rendered content. */
  formats: FormatContent[];
  /** Error/fatal messages produced by this report. */
  errors: string[];
}

/** The `results.reports` section of the envelope. */
export interface ReportsJson {
  /** `false` when any requested report failed. */
  ok: boolean;
  /** Output directory — present **only** when the request supplied it. */
  outputDir?: string;
  /** Reports in declaration order (filtered by the selection, if any). */
  reports: ReportJsonEntry[];
}

/** Options of `renderReports` (mirror `report`/`reportsIsRegex`). */
export interface RenderReportsOptions {
  /** Exact id or regex of the report to generate; absent generates all. */
  report?: string | null;
  /** Interpret `report` as a regular expression. */
  reportsIsRegex?: boolean;
  /** Output directory echoed into the section (only when set). */
  outputDir?: string | null;
  /**
   * Raw snippet of dynamic attributes (`--report -A "<attrs>"`).
   *
   * When present, generation goes through `Project#generateReport` — which
   * applies the 18.19 pipeline (attribute parsing, `interactive`,
   * backup/restore) — instead of calling `Report#generate()` directly. The
   * consumer does **not** re-examine the option: the section is already
   * processed.
   */
  dynamicAttributes?: string | null;
}

/**
 * Generates one report and returns its section entry. Errors never escape: the
 * exceptions (unknown format, sheet anchor) and the `error`/`fatal` messages of
 * the `MessageHandler` become `errors[]` of the entry itself.
 */
function renderEntry(
  project: Project,
  report: Report,
  dynamicAttributes?: string | null,
): ReportJsonEntry {
  const handler = MessageHandlerInstance.instance;
  const messageMark = handler.messages.length;
  const errorCountMark = handler.errors;
  const errors: string[] = [];
  // Initial depth: an exception must not leave a dangling context nor remove
  // the context of whoever called `renderReports`.
  const contextMark = project.reportContexts.length;

  try {
    if (dynamicAttributes !== undefined && dynamicAttributes !== null) {
      // Dynamic-attributes path: `Project#generateReport` already does the
      // `ReportContext` push/pop and the attribute backup/restore.
      project.generateReport(report.id, false, null, dynamicAttributes,);
    } else {
      project.reportContexts.push(new ReportContext(project, report,),);
      try {
        report.generate();
      } finally {
        project.reportContexts.pop();
      }
    }
  } catch (error) {
    errors.push(error instanceof Error ? error.message : String(error,),);
  } finally {
    if (project.reportContexts.length > contextMark) {
      project.reportContexts.length = contextMark;
    }
  }

  // Error/fatal messages produced while generating this report.
  for (const message of handler.messages.slice(messageMark,)) {
    if (message.type === "error" || message.type === "fatal") {
      const text = message.message || message.id;
      if (!errors.includes(text,)) errors.push(text,);
    }
  }
  // Counted errors without an associated message must not disappear.
  if (errors.length === 0 && handler.errors > errorCountMark) {
    errors.push(`Report ${report.fullId} failed.`,);
  }

  const formats: FormatContent[] = [];
  if (errors.length === 0) {
    // `outputs` is filled in the `generate()` dispatch — the key order is the
    // order in which the formats were rendered (declared in the DSL or rewritten
    // by `dynamicAttributes`), which is exactly what the report **produced**.
    // Reading it after generation avoids diverging from the `-A` snippet.
    for (const [format, content,] of report.outputs) {
      formats.push({ format, content, },);
    }
  }

  return {
    name: report.name,
    stdout: report.get("stdout",) === true,
    selfcontained: report.get("selfcontained",) === true,
    formats,
    errors,
  };
}

/**
 * Assembles the `results.reports` section from the in-memory project.
 *
 * @param project Project already parsed (and scheduled when necessary).
 * @param options Report selection and the `outputDir` to echo.
 */
export function renderReports(
  project: Project,
  options: RenderReportsOptions = {},
): ReportsJson {
  const selection = options.report ?? null;
  let selectedIds: Set<string> | null = null;
  if (selection !== null && selection !== "") {
    selectedIds = new Set(
      options.reportsIsRegex
        ? project.matchingReports(selection,)
        : (project.report(selection,) ? [selection,] : []),
    );
  }

  const reports: ReportJsonEntry[] = [];
  let ok = true;
  for (const item of project.reports.toArray()) {
    const report = item as Report;
    if (selectedIds !== null && !selectedIds.has(report.id,)) continue;
    const entry = renderEntry(project, report, options.dynamicAttributes,);
    if (entry.errors.length > 0) ok = false;
    reports.push(entry,);
  }

  const json: ReportsJson = { ok, reports, };
  if (options.outputDir !== undefined && options.outputDir !== null) {
    json.outputDir = options.outputDir;
  }
  return json;
}
