/**
 * `daemon/types.ts` — pure data model of the project daemon (22.5.2).
 *
 * The daemon is **execute-based** (P4.1 decision): the core keeps no state
 * between calls, so the extension caches the *data* of the last envelope plus
 * the file closure that produced it — never a live `Project` instance. Every
 * type here is plain, structured-cloneable data (no `vscode` runtime, no class
 * instances), which is what lets the cache be persisted to `storageUri`
 * (Desktop) or held in memory (Web) and unit-tested in pure Deno.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.2 (daemon)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.5.2
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §5.1 (P4.1 decision)
 */
import type {
  ExecutionInputFile,
  ExecutionResult,
} from "@vanaware/syntaxmesh";

/** Semantic operation most recently requested for a project. */
export type ProjectIntent =
  | "inventory"
  | "checkSyntax"
  | "scheduleOnly"
  | "compile"
  | "freeze"
  | "checkTimeSheet"
  | "checkStatusSheet"
  | "report"
  | "man"
  | "sheet"
  | "run";

/** Execution metadata projected into project summaries and status views. */
export interface ProjectExecutionState {
  /** Semantic operation performed by the execution. */
  intent: ProjectIntent;
  /** Epoch milliseconds when execution started. */
  startedAt: number;
  /** Epoch milliseconds when execution finished, when complete. */
  finishedAt?: number;
  /** Number of error-severity messages in the execution envelope. */
  errorCount: number;
}

/**
 * Lifecycle status of a cached project, projected from the last envelope.
 *
 * - `loading` — an `execute` call is in flight (no envelope yet);
 * - `ok` — the last envelope succeeded (`ok === true`);
 * - `error` — the last envelope failed (`ok === false`).
 */
export type DaemonStatus = "loading" | "ok" | "error";

/**
 * One cached project: the file closure plus the data of the last execution.
 *
 * `files` is the complete `include` closure handed to `execute` (master first,
 * canonical paths); `envelope` is the last {@link ExecutionResult} or `null`
 * before the first run. The timestamps come from the injected clock so the
 * model is deterministic in tests.
 */
export interface ProjectModel {
  /** Stable key of the project (the master document URI). */
  uri: string;
  /** Canonical path of the master file within {@link ProjectModel.files}. */
  entry: string;
  /** Complete input closure (master + transitive `include`s). */
  files: ExecutionInputFile[];
  /** Data of the last `execute` envelope, or `null` before the first run. */
  envelope: ExecutionResult | null;
  /** Status projected from the last envelope (or `loading`). */
  status: DaemonStatus;
  /** Epoch milliseconds when the project was added (injected clock). */
  addedAt: number;
  /** Epoch milliseconds of the last reload (equals `addedAt` until reloaded). */
  reloadedAt: number;
  /** Last semantic execution, absent until execution metadata is recorded. */
  lastExecution?: ProjectExecutionState;
}

/**
 * Lightweight projection of a {@link ProjectModel} for lists and the tree.
 *
 * Carries no file contents and no envelope — only what a quick pick or a tree
 * root needs to label the project and badge its status.
 */
export interface ProjectSummary {
  /** Stable key of the project (the master document URI). */
  uri: string;
  /** Canonical path of the master file. */
  entry: string;
  /** Status projected from the last envelope. */
  status: DaemonStatus;
  /** Number of reports listed by the last envelope (`listReports` section). */
  reportCount: number;
  /** Epoch milliseconds when the project was added. */
  addedAt: number;
  /** Epoch milliseconds of the last reload. */
  reloadedAt: number;
  /** Whether this project is the registry's explicit active selection. */
  active: boolean;
  /** Last semantic intent, defaulting to `inventory` before execution metadata. */
  lastIntent: ProjectIntent;
}
