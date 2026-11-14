/**
 * `reports/output-policy.ts` — pure report destination policy (22.6.1).
 *
 * The core returns report content as data and never decides where it goes
 * (addendum §3.5). This module is the extension's symmetric counterpart to the
 * CLI `output-policy.ts`: HTML renders in a Webview, every other format is
 * saved to the workspace. It also derives the on-disk file name (sanitisation +
 * the same extension table as the CLI, so `markdown`→`.md`, `iCal`→`.ics`).
 * No `vscode` runtime, no I/O — unit-testable in Deno.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.3 (reports)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.6.1
 * @see packages/cli/src/output-policy.ts (symmetric policy)
 */

/** Where a rendered report is presented. */
export type ReportDestination = "webview" | "save";

/**
 * Suffix per format — mirrors the CLI table (plan §5.5 point 1).
 *
 * Only formats whose suffix differs from the id are listed; the others use the
 * id itself. `ctags` has no suffix (the plain name is written).
 */
const FORMAT_EXTENSIONS: Record<string, string> = {
  csv: "csv",
  html: "html",
  json: "json",
  markdown: "md",
  iCal: "ics",
  mspxml: "xml",
  niku: "xml",
  tjp: "tjp",
  ctags: "",
};

/** Characters that are invalid in a file name (addendum §4.3). */
const INVALID_NAME_CHARS = /[\\?%*:|"<>]/g;

/**
 * Destination of a format: HTML in a Webview, everything else saved to disk.
 *
 * @param format the report format id (`html`, `csv`, `markdown`, …).
 * @returns `"webview"` for HTML, `"save"` otherwise.
 */
export function destinationFor(format: string,): ReportDestination {
  return format === "html" ? "webview" : "save";
}

/**
 * File extension of a format (the id itself when not in the table).
 *
 * @param format the report format id.
 * @returns the extension without the dot (`""` for `ctags`).
 */
export function extensionOf(format: string,): string {
  return Object.hasOwn(FORMAT_EXTENSIONS, format,)
    ? FORMAT_EXTENSIONS[format]!
    : format;
}

/**
 * Sanitises a report name for use as a file name.
 *
 * Drops path components (a simple defence against `../`), replaces invalid
 * characters with `_` and trims the edges. An empty name falls back to
 * `report`, exactly like the CLI.
 *
 * @param name the reported name.
 * @returns a safe, non-empty base name.
 */
export function sanitizeFileName(name: string,): string {
  const segments = name.split("/",).filter((part,) =>
    part !== "" && part !== "." && part !== ".."
  );
  const last = segments.length === 0 ? "" : segments[segments.length - 1]!;
  const trimmed = last.replace(INVALID_NAME_CHARS, "_",).trim();
  return trimmed === "" ? "report" : trimmed;
}

/**
 * On-disk file name of a report: `{name}.{ext}` (plain name for `ctags`).
 *
 * @param name the reported name.
 * @param format the report format id.
 * @returns the sanitised file name with the format's extension.
 */
export function reportFileName(name: string, format: string,): string {
  const base = sanitizeFileName(name,);
  const ext = extensionOf(format,);
  return ext === "" ? base : `${base}.${ext}`;
}
