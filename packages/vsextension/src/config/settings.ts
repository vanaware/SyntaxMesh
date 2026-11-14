/**
 * `config/settings.ts` — pure reader of the `syntaxmesh.*` settings (22.2.3).
 *
 * The extension reads its configuration through the VS Code
 * `workspace.getConfiguration("syntaxmesh")` API, but the **logic** lives here
 * over a structural interface ({@link WorkspaceConfigLike}) so it is testable
 * in pure Deno without the `vscode` runtime (ADR 035: intelligence outside the
 * bootstrap; plan §11 extension unit coverage).
 *
 * P3 exposed the editor-foundation settings (LSP trace level, diagnostics cap);
 * P4 (22.7.1) adds the report/locale settings: `syntaxmesh.locale` (a default
 * used only when the file has no `language "..."` directive — the directive is
 * sovereign, plan §12) and `syntaxmesh.report.defaultFormat`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §8 (configuration)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.7.1
 */

/** Trace verbosity of the LSP channel (`syntaxmesh.trace.server`). */
export type TraceLevel = "off" | "messages" | "verbose";

/**
 * Locale default for documents without a `language "..."` directive. `"auto"`
 * defers entirely to the file; the explicit codes only apply as a fallback.
 */
export type LocaleSetting = "auto" | "en" | "pt-BR" | "es";

/** Resolved, validated extension settings. */
export interface SyntaxMeshSettings {
  /** Trace level of the language-server channel. */
  traceServer: TraceLevel;
  /** Upper bound of diagnostics reported per document (clamped to 1..1000). */
  maxNumberOfProblems: number;
  /** Default locale when the file has no `language` directive (22.7.1). */
  locale: LocaleSetting;
  /** Preferred report format in the Generate Report command (22.7.1). */
  reportDefaultFormat: string;
}

/** Defaults applied when a setting is absent or invalid. */
export const DEFAULT_SETTINGS: SyntaxMeshSettings = {
  traceServer: "off",
  maxNumberOfProblems: 100,
  locale: "auto",
  reportDefaultFormat: "html",
};

/**
 * Structural subset of `vscode.WorkspaceConfiguration` used by the reader.
 * The real configuration object satisfies it (the two-argument `get`
 * overload), and a mock satisfies it in the tests.
 */
export interface WorkspaceConfigLike {
  /**
   * Reads a setting, falling back to `defaultValue` when absent.
   *
   * @param section dotted key relative to the `syntaxmesh` namespace.
   * @param defaultValue value returned when the key is not set.
   * @returns the configured value or the default.
   */
  get<T,>(section: string, defaultValue: T,): T;
}

/** Clamps an integer to the inclusive `[min, max]` range. */
function clamp(value: number, min: number, max: number,): number {
  return Math.min(max, Math.max(min, value,),);
}

/** Narrows an arbitrary trace string to a known {@link TraceLevel}. */
function toTraceLevel(value: string,): TraceLevel {
  return value === "messages" || value === "verbose" ? value : "off";
}

/** Narrows an arbitrary locale string to a known {@link LocaleSetting}. */
function toLocaleSetting(value: string,): LocaleSetting {
  return value === "en" || value === "pt-BR" || value === "es" ? value : "auto";
}

/** Narrows a report-format setting to a non-empty id, defaulting to `html`. */
function toReportFormat(value: string,): string {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : DEFAULT_SETTINGS.reportDefaultFormat;
}

/**
 * Reads and validates the `syntaxmesh.*` settings.
 *
 * Invalid trace values fall back to `"off"`; a non-finite or out-of-range
 * problem cap falls back to the default and is clamped to `1..1000`; an unknown
 * locale falls back to `"auto"`; a blank report format falls back to `"html"`.
 *
 * @param config the `syntaxmesh` configuration namespace (real or mock).
 * @returns the resolved settings, never throwing.
 */
export function readSettings(config: WorkspaceConfigLike,): SyntaxMeshSettings {
  const trace = config.get<string>(
    "trace.server",
    DEFAULT_SETTINGS.traceServer,
  );
  const rawCap = config.get<number>(
    "maxNumberOfProblems",
    DEFAULT_SETTINGS.maxNumberOfProblems,
  );
  const cap = Number.isFinite(rawCap,)
    ? Math.trunc(rawCap,)
    : DEFAULT_SETTINGS.maxNumberOfProblems;
  return {
    traceServer: toTraceLevel(trace,),
    maxNumberOfProblems: clamp(cap, 1, 1000,),
    locale: toLocaleSetting(
      config.get<string>("locale", DEFAULT_SETTINGS.locale,),
    ),
    reportDefaultFormat: toReportFormat(
      config.get<string>(
        "report.defaultFormat",
        DEFAULT_SETTINGS.reportDefaultFormat,
      ),
    ),
  };
}
