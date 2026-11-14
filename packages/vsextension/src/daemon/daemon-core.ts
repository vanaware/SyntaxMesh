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
 * - **generate** re-parses + re-schedules + renders one report and returns the
 *   envelope to the host. It does **not** overwrite the cached load envelope,
 *   so the report listing stays available for the next pick (v1 has no
 *   cached-model reporting — that is a deferred F24 delta).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.2/§3.3
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.5.6
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §5.1 (P4.1 decision)
 */
import type {
  ExecutionRequest,
  ExecutionResult,
  ListReportsEntry,
} from "@vanaware/syntaxmesh";
import { ProjectCache, summarize, } from "./project-cache.ts";
import { buildExecuteRequest, } from "./request-builder.ts";
import type { InputClosure, } from "./include-closure.ts";
import type { DaemonStatus, ProjectModel, ProjectSummary, } from "./types.ts";

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
    return this.cache.list().map(summarize,);
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
    const model = this.cache.get(uri,);
    if (model === undefined) {
      throw new Error(`project not loaded: ${uri}`,);
    }
    const request = buildExecuteRequest(
      { files: model.files, missing: [], },
      { entry: model.entry, report, reportsIsRegex: false, outputDir, },
    );
    return await this.execute(request,);
  }
}
