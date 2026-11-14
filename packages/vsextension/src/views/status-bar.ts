/**
 * `views/status-bar.ts` — pure projection of the status-bar text (22.7.3).
 *
 * The status bar summarizes the parser/daemon state, the detected locale and
 * the last execution (report count of the cached load). The text is computed
 * here as a plain string so it is testable in Deno; the host wires it to a
 * `vscode.StatusBarItem` and picks the codicon from the status (22.7.6).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §8.1 (Status Bar)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.7.3
 */

/** Daemon/parser state shown in the status bar. */
export type StatusBarStatus = "idle" | "ok" | "error";

/** Inputs of the status-bar projection — pure data, no `vscode` runtime. */
export interface StatusBarState {
  /** `"idle"` when no project is loaded; otherwise the last load outcome. */
  status: StatusBarStatus;
  /** Detected locale of the active document (`en`/`pt-br`/`es`), when known. */
  locale?: string;
  /** Report count of the last load (the "last execution" summary), when known. */
  reportCount?: number;
}

/**
 * Renders the status-bar text: `SyntaxMesh: <status>` followed by the locale
 * and, on a successful load, the report count — joined by ` · `. The locale is
 * omitted when blank; the report count only appears on `"ok"`.
 *
 * @param state the current daemon/parser state.
 * @returns the compact status-bar label.
 */
export function statusText(state: StatusBarState,): string {
  const parts = [`SyntaxMesh: ${state.status}`,];
  if (state.locale !== undefined && state.locale.length > 0) {
    parts.push(state.locale,);
  }
  if (state.status === "ok" && state.reportCount !== undefined) {
    parts.push(`${state.reportCount} reports`,);
  }
  return parts.join(" · ",);
}
