/**
 * `daemon/daemon-core.ts` — pure project daemon orchestration (22.5.6).
 *
 * The execute-based daemon (P4.1): it owns a {@link ProjectCache} and drives
 * the core's single stateless entry point `execute`, injected here so the logic
 * is testable with a fake and free of any `vscode`/core runtime import. The
 * host bootstrap (22.5.8) wires the real `execute`, the file reader and the
 * persistence; this module only orchestrates data.
 *
 * Lifecycle (plan §3.2/§3.3):
 * - **add/reload** run `execute` with `listReports: ""` — the core parses and
 *   lists every report (no schedule); the envelope's `ok` becomes the status;
 * - **executeProject** maps any project-backed F24 request over the cached
 *   closure and returns the fresh envelope to the host. It updates status and
 *   execution metadata but never overwrites the cached inventory envelope, so
 *   the report listing stays available for the next pick.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.2/§3.3
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.5.6/§22.12.4
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §5.1 (P4.1 decision)
 */
import type {
  ExecutionRequest,
  ExecutionResult,
  ListReportsEntry,
} from "@vanaware/syntaxmesh";
import { ProjectCache, summarize, } from "./project-cache.ts";
import {
  buildExecuteRequest,
  type BuildRequestOptions,
} from "./request-builder.ts";
import type { InputClosure, } from "./include-closure.ts";
import type {
  DaemonStatus,
  ProjectExecutionState,
  ProjectIntent,
  ProjectModel,
  ProjectSummary,
} from "./types.ts";

/** The core entry point, injected by the host (real `execute` or a fake). */
export type ExecuteFn = (
  request: ExecutionRequest,
) => Promise<ExecutionResult>;

/** Injectable clock (epoch milliseconds) so timestamps are deterministic. */
export type Clock = () => number;

/** Projects the daemon status from an envelope's `ok` flag. */
function statusFromEnvelope(envelope: ExecutionResult,): DaemonStatus {
  return envelope.ok ? "ok" : "error";
}

/** Counts error-severity messages in one execution envelope. */
function errorCount(envelope: ExecutionResult,): number {
  return envelope.messages.filter((message,) => message.severity === "error")
    .length;
}

/** Projects the semantic intent using the deterministic P8 precedence. */
function intentFromOptions(options: BuildRequestOptions,): ProjectIntent {
  if (options.man !== undefined) return "man";
  if (options.checkSyntax === true) return "checkSyntax";
  if (options.noReports === true) return "scheduleOnly";
  if (options.freeze !== undefined) return "freeze";
  if (options.app === "check-ts") return "checkTimeSheet";
  if (options.app === "check-ss") return "checkStatusSheet";
  if (options.app !== undefined) return "sheet";
  if (options.report !== undefined) return "report";
  return "compile";
}

/** Builds immutable execution metadata for a completed envelope. */
function executionState(
  intent: ProjectIntent,
  envelope: ExecutionResult,
  startedAt: number,
  finishedAt: number,
): ProjectExecutionState {
  return { intent, startedAt, finishedAt, errorCount: errorCount(envelope,), };
}

/**
 * Orchestrates the cached projects over the injected `execute`. Every public
 * method is data-in/data-out; the only effects are on the internal cache.
 */
export class DaemonCore {
  /** The cached projects (exposed for host persistence/restore). */
  readonly cache = new ProjectCache();
  private readonly execute: ExecuteFn;
  private readonly clock: Clock;

  /**
   * @param execute the core entry point (host injects the real `execute`).
   * @param clock epoch-milliseconds source; defaults to `Date.now`.
   */
  constructor(execute: ExecuteFn, clock: Clock = () => Date.now(),) {
    this.execute = execute;
    this.clock = clock;
  }

  /**
   * Executes one project-free request through the injected engine.
   *
   * No project is resolved, no files are read and the cache is left untouched.
   *
   * @param request the complete plain-data execution request.
   * @returns the unmodified execution envelope.
   */
  executeRequest(request: ExecutionRequest,): Promise<ExecutionResult> {
    return this.execute(request,);
  }

  /**
   * Replaces the cache with persisted models and restores valid selection.
   *
   * Legacy payloads and stale active URIs use the first URI in sorted order.
   *
   * @param projects the persisted project models.
   * @param activeUri the persisted active master URI, if any.
   */
  restore(projects: ProjectModel[], activeUri: string | null,): void {
    this.cache.clear();
    for (const model of projects) this.cache.set(model,);
    if (activeUri !== null && this.cache.setActive(activeUri,)) return;
    const first = this.cache.list()[0];
    if (first !== undefined) this.cache.setActive(first.uri,);
  }

  /**
   * Adds a project: closes over the given files, lists its reports and caches
   * the resulting model. Re-adding a URI replaces the previous model.
   *
   * @param uri the master document URI (cache key).
   * @param closure the closed input set read by the host.
   * @returns the cached model, with status projected from the envelope.
   */
  async addProject(uri: string, closure: InputClosure,): Promise<ProjectModel> {
    const now = this.clock();
    const request = buildExecuteRequest(closure, { listReports: "", },);
    const envelope = await this.execute(request,);
    const model: ProjectModel = {
      uri,
      entry: request.entry ?? "",
      files: closure.files,
      envelope,
      status: statusFromEnvelope(envelope,),
      addedAt: now,
      reloadedAt: now,
      lastExecution: executionState("inventory", envelope, now, now,),
    };
    this.cache.set(model,);
    return model;
  }

  /**
   * Reloads a project from a freshly read closure, preserving `addedAt` and
   * stamping `reloadedAt`. A URI that was not added behaves like an add.
   *
   * @param uri the master document URI (cache key).
   * @param closure the re-read closed input set.
   * @returns the refreshed cached model.
   */
  async reloadProject(
    uri: string,
    closure: InputClosure,
  ): Promise<ProjectModel> {
    const previous = this.cache.get(uri,);
    const now = this.clock();
    const request = buildExecuteRequest(closure, { listReports: "", },);
    const envelope = await this.execute(request,);
    const model: ProjectModel = {
      uri,
      entry: request.entry ?? "",
      files: closure.files,
      envelope,
      status: statusFromEnvelope(envelope,),
      addedAt: previous?.addedAt ?? now,
      reloadedAt: now,
      lastExecution: executionState("inventory", envelope, now, now,),
    };
    this.cache.set(model,);
    return model;
  }

  /**
   * Forgets a project.
   *
   * @param uri the master document URI.
   * @returns `false` when the URI was not cached.
   */
  removeProject(uri: string,): boolean {
    return this.cache.remove(uri,);
  }

  /**
   * Every cached project as a lightweight summary, sorted by URI.
   *
   * @returns the summaries used by the list command and the project tree.
   */
  listProjects(): ProjectSummary[] {
    const activeUri = this.cache.active();
    return this.cache.list().map((model,) => summarize(model, activeUri,));
  }

  /**
   * Selects a cached project explicitly.
   *
   * @param uri the master document URI.
   * @returns the selected model, or `undefined` when the URI is not cached.
   */
  setActiveProject(uri: string,): ProjectModel | undefined {
    return this.cache.setActive(uri,) ? this.cache.get(uri,) : undefined;
  }

  /** @returns the explicitly active cached project, if any. */
  activeProject(): ProjectModel | undefined {
    const uri = this.cache.active();
    return uri === null ? undefined : this.cache.get(uri,);
  }

  /**
   * Reports listed by the last add/reload envelope of a project.
   *
   * @param uri the master document URI.
   * @returns the `listReports` entries, or `[]` when unknown/not run.
   */
  listReports(uri: string,): ListReportsEntry[] {
    return this.cache.get(uri,)?.envelope?.results.listReports ?? [];
  }

  /**
   * Executes any project-backed F24 request over the cached closure.
   *
   * The fresh envelope is returned to the caller, while the cache keeps the
   * original inventory envelope and updates only status/execution metadata.
   *
   * @param uri the cached master document URI.
   * @param options the complete F24 request options.
   * @returns the fresh execution envelope.
   * @throws when the project was not added.
   */
  async executeProject(
    uri: string,
    options: BuildRequestOptions,
  ): Promise<ExecutionResult> {
    const model = this.cache.get(uri,);
    if (model === undefined) {
      throw new Error(`project not loaded: ${uri}`,);
    }
    const startedAt = this.clock();
    const request = buildExecuteRequest(
      { files: model.files, missing: [], },
      { ...options, entry: model.entry, },
    );
    const envelope = await this.execute(request,);
    const finishedAt = this.clock();
    this.cache.set({
      ...model,
      status: statusFromEnvelope(envelope,),
      lastExecution: executionState(
        intentFromOptions(options,),
        envelope,
        startedAt,
        finishedAt,
      ),
    },);
    return envelope;
  }

  /**
   * Generates one report by re-parsing + re-scheduling the cached closure.
   *
   * The returned envelope is consumed immediately by the host (Webview/save);
   * the cached load envelope is left untouched so the report listing survives.
   *
   * @param uri the master document URI.
   * @param report the exact report id to render.
   * @param outputDir optional destination echoed into the `reports` section.
   * @returns the fresh `execute` envelope (with the `reports` section).
   * @throws when the project was not added.
   */
  async generateReport(
    uri: string,
    report: string,
    outputDir?: string,
  ): Promise<ExecutionResult> {
    return await this.executeProject(uri, {
      report,
      reportsIsRegex: false,
      outputDir,
    },);
  }
}
