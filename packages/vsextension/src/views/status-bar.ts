/**
 * `views/status-bar.ts` — pure aggregate/busy status-bar projection (22.12.18).
 *
 * The status bar summarizes every cached project, the explicit active project's
 * locale/reports/intent and overlapping execution activity. Text, aggregate state
 * and the pending-execution counter are computed here as plain data so they are
 * testable in Deno; the host only maps them to a `vscode.StatusBarItem`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §8.1/P8.4
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.12.18
 */
import { resolveLocale, } from "@vanaware/syntaxmesh/lsp-core";
import type { ProjectIntent, ProjectModel, } from "../daemon/types.ts";

/** Canonical command invoked by the status-bar item. */
export const STATUS_BAR_COMMAND = "syntaxmesh.console.open";

/** Daemon/parser state shown in the status bar. */
export type StatusBarStatus = "idle" | "ok" | "error";

/** Inputs of the status-bar projection — pure data, no `vscode` runtime. */
export interface StatusBarState {
  /** `"idle"` when no project is loaded; otherwise the aggregate load outcome. */
  status: StatusBarStatus;
  /** Detected locale of the active master (`en`/`pt-br`/`es`), when known. */
  locale?: string;
  /** Report count of the active project's cached inventory, when known. */
  reportCount?: number;
  /** Number of cached projects. */
  projectCount: number;
  /** Registry's explicit active master URI, or `null`. */
  activeUri: string | null;
  /** Whether at least one execution is pending. */
  busy: boolean;
  /** Active project's last semantic operation, defaulting to `inventory`. */
  lastIntent: ProjectIntent;
  /** Sum of error counts from every cached project's last execution. */
  errorCount: number;
}

/** Tracks overlapping executions and keeps busy state until the last settles. */
export class ExecutionActivity {
  private pending = 0;

  /** Whether at least one tracked execution is still running. */
  get busy(): boolean {
    return this.pending > 0;
  }

  /**
   * Runs one action, notifying the host after the pending count changes.
   *
   * @param action asynchronous execution to track.
   * @param onChange receives `true` on start and the remaining busy state on end.
   * @returns the action's value, preserving thrown failures.
   */
  async run<T,>(
    action: () => Promise<T>,
    onChange: (busy: boolean,) => void = () => {},
  ): Promise<T> {
    this.pending += 1;
    onChange(true,);
    try {
      return await action();
    } finally {
      this.pending -= 1;
      onChange(this.busy,);
    }
  }
}

/**
 * Projects cached models and activity into aggregate status-bar state.
 *
 * @param models every cached project in registry order.
 * @param activeUri the registry's explicit active master, or `null`.
 * @param busy whether at least one execution is pending.
 * @returns aggregate counts plus the active project's locale/reports/intent.
 */
export function projectStatusState(
  models: ProjectModel[],
  activeUri: string | null,
  busy: boolean,
): StatusBarState {
  const errorCount = models.reduce(
    (total, model,) => total + (model.lastExecution?.errorCount ?? 0),
    0,
  );
  if (models.length === 0) {
    return {
      status: "idle",
      projectCount: 0,
      activeUri,
      busy,
      lastIntent: "inventory",
      errorCount: 0,
    };
  }
  const active = models.find((model,) => model.uri === activeUri);
  const master = active?.files.find((file,) => file.path === active.entry) ??
    active?.files[0];
  const status = models.some((model,) => model.status === "error") ||
      errorCount > 0
    ? "error"
    : "ok";
  const state: StatusBarState = {
    status,
    projectCount: models.length,
    activeUri,
    busy,
    lastIntent: active?.lastExecution?.intent ?? "inventory",
    errorCount,
  };
  if (active !== undefined) {
    state.reportCount = active.envelope?.results.listReports?.length ?? 0;
  }
  if (active !== undefined && master !== undefined) {
    state.locale = resolveLocale(active.uri, master.content,);
  }
  return state;
}

/**
 * Renders the status-bar text: status/busy, active locale, aggregate project and
 * error counts, successful active report count and last intent, joined by ` · `.
 *
 * @param state the current aggregate daemon/execution state.
 * @returns the compact status-bar label.
 */
export function statusText(state: StatusBarState,): string {
  const parts = [`SyntaxMesh: ${state.busy ? "busy" : state.status}`,];
  if (state.locale !== undefined && state.locale.length > 0) {
    parts.push(state.locale,);
  }
  parts.push(`${state.projectCount} projects`,);
  if (state.status === "ok" && state.reportCount !== undefined) {
    parts.push(`${state.reportCount} reports`,);
  }
  parts.push(`${state.errorCount} errors`, state.lastIntent,);
  return parts.join(" · ",);
}
