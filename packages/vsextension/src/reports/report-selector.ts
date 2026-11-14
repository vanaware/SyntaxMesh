/**
 * `reports/report-selector.ts` — pure report/format selection (22.6.2).
 *
 * Projects the envelope's report listing into quick-pick items and picks the
 * format to present for a generated report. The data shapes are structural
 * (compatible with `vscode.QuickPickItem`) so the host passes them straight to
 * the UI; no `vscode` runtime here, unit-testable in Deno.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.3 (reports)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.6.2
 */
import type { ListReportsEntry, ReportJsonEntry, } from "@vanaware/syntaxmesh";

/**
 * One report quick-pick item. Structurally a `vscode.QuickPickItem` (`label` +
 * `description`) plus the report id used to generate it.
 */
export interface ReportPickItem {
  /** Displayed report name. */
  label: string;
  /** Displayed report type (`taskreport`, `export`, …). */
  description: string;
  /** Report id passed to `generateReport`. */
  report: string;
}

/**
 * Projects the `listReports` entries into quick-pick items.
 *
 * @param listReports the entries of the last load envelope.
 * @returns one item per report, in listing order.
 */
export function quickPickItems(
  listReports: ListReportsEntry[],
): ReportPickItem[] {
  return listReports.map((entry,) => ({
    label: entry.name,
    description: entry.type,
    report: entry.name,
  }));
}

/**
 * Picks the format to present for a generated report.
 *
 * Prefers the user's default format when the report produced it; otherwise
 * falls back to the first produced format (a single-format report thus always
 * uses its only format). When the report produced nothing, the default stands.
 *
 * @param report the generated report entry (with its rendered formats).
 * @param defaultFormat the preferred format (`syntaxmesh.report.defaultFormat`).
 * @returns the format id to present.
 */
export function chooseFormat(
  report: ReportJsonEntry,
  defaultFormat: string,
): string {
  const formats = report.formats.map((f,) => f.format);
  if (formats.includes(defaultFormat,)) return defaultFormat;
  return formats[0] ?? defaultFormat;
}
