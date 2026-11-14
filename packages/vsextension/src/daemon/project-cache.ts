/**
 * `daemon/project-cache.ts` — pure multi-project cache (22.5.3).
 *
 * A thin, synchronous wrapper over `Map<uri, ProjectModel>` with no `vscode`
 * runtime and no I/O: the daemon's state lives here as plain data (P4.1). The
 * shape mirrors the core's `DocumentStore` (one entry per URI, overwrite on
 * re-add). `list` is sorted by URI so projections are deterministic regardless
 * of insertion order.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.2 (daemon)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.5.3
 */
import type { ProjectModel, ProjectSummary, } from "./types.ts";

/**
 * The cached projects of one daemon instance. Every method is synchronous and
 * side-effect-free outside the internal map.
 */
export class ProjectCache {
  private readonly models = new Map<string, ProjectModel>();

  /** Number of cached projects. */
  get size(): number {
    return this.models.size;
  }

  /**
   * Stores a project, keyed by its URI. Re-adding a URI replaces the previous
   * model (the daemon keeps a single closure per master document).
   *
   * @param model the project model to cache.
   */
  set(model: ProjectModel,): void {
    this.models.set(model.uri, model,);
  }

  /**
   * Reads a cached project.
   *
   * @param uri the master document URI.
   * @returns the model, or `undefined` when the URI is not cached.
   */
  get(uri: string,): ProjectModel | undefined {
    return this.models.get(uri,);
  }

  /**
   * Whether a project is cached.
   *
   * @param uri the master document URI.
   * @returns `true` when the URI is present.
   */
  has(uri: string,): boolean {
    return this.models.has(uri,);
  }

  /**
   * Forgets a project (cache invalidation).
   *
   * @param uri the master document URI.
   * @returns `false` when the URI was not cached.
   */
  remove(uri: string,): boolean {
    return this.models.delete(uri,);
  }

  /** Drops every cached project (cache invalidation). */
  clear(): void {
    this.models.clear();
  }

  /**
   * Every cached project, sorted by URI for deterministic projections.
   *
   * @returns a fresh array of models (the cache is not exposed directly).
   */
  list(): ProjectModel[] {
    return [...this.models.values(),].sort((a, b,) =>
      a.uri < b.uri ? -1 : a.uri > b.uri ? 1 : 0
    );
  }
}

/**
 * Projects a {@link ProjectModel} to its lightweight {@link ProjectSummary}.
 *
 * The report count comes from the `listReports` section of the last envelope;
 * a project that has not run yet (or listed no reports) reports `0`.
 *
 * @param model the cached project.
 * @returns the summary used by lists and the project tree.
 */
export function summarize(model: ProjectModel,): ProjectSummary {
  return {
    uri: model.uri,
    entry: model.entry,
    status: model.status,
    reportCount: model.envelope?.results.listReports?.length ?? 0,
    addedAt: model.addedAt,
    reloadedAt: model.reloadedAt,
  };
}
