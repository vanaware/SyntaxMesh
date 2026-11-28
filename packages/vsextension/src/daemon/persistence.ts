/**
 * `daemon/persistence.ts` — pure cache (de)serialisation (22.5.7).
 *
 * The daemon cache is plain data (P4.1), so persisting it is a JSON round-trip
 * with a version tag. The host writes the string to `context.storageUri`
 * (Desktop) or keeps it in memory (Web); this module never touches I/O. An
 * incompatible or corrupt payload deserialises to an empty cache rather than
 * throwing — a stale store must never break activation.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.2 (daemon)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.5.7
 */
import type { ProjectModel, } from "./types.ts";

/** Schema version of the persisted cache; bump on a breaking shape change. */
export const CACHE_VERSION = 1;

/** The persisted payload: a version tag, cached models and active selection. */
export interface SerializedCache {
  /** Schema version ({@link CACHE_VERSION}). */
  version: number;
  /** Cached projects, as plain data (no class instances). */
  projects: ProjectModel[];
  /** Explicit active master URI; absent in legacy version-1 payloads. */
  activeUri?: string | null;
}

/** Models and selection restored from one persisted cache payload. */
export interface RestoredCache {
  /** Cached projects in their persisted order. */
  projects: ProjectModel[];
  /** Persisted active URI when it still names a cached project. */
  activeUri: string | null;
}

/**
 * Serialises the cached models to a JSON string with the current version tag.
 *
 * @param models the cached projects (e.g. `daemon.cache.list()`).
 * @param activeUri the explicit active master URI, if any.
 * @returns the JSON payload to store.
 */
export function serializeCache(
  models: ProjectModel[],
  activeUri: string | null = null,
): string {
  const payload: SerializedCache = {
    version: CACHE_VERSION,
    projects: models,
    activeUri,
  };
  return JSON.stringify(payload,);
}

/**
 * Restores cached models and a still-valid active selection from a JSON string.
 *
 * Returns an empty cache when the payload is not valid JSON, is not an object,
 * carries a different {@link CACHE_VERSION}, or has no `projects` array. Legacy
 * payloads without `activeUri` restore with no explicit selection. The models
 * are trusted as written by {@link serializeCache}; no per-field validation is
 * performed.
 *
 * @param json the stored payload.
 * @returns the restored cache, or an empty cache when the payload is unusable.
 */
export function restoreCache(json: string,): RestoredCache {
  const empty: RestoredCache = { projects: [], activeUri: null, };
  let parsed: unknown;
  try {
    parsed = JSON.parse(json,);
  } catch {
    return empty;
  }
  if (typeof parsed !== "object" || parsed === null) return empty;
  const candidate = parsed as Partial<SerializedCache>;
  if (candidate.version !== CACHE_VERSION) return empty;
  if (!Array.isArray(candidate.projects,)) return empty;
  const activeUri = typeof candidate.activeUri === "string" &&
      candidate.projects.some((project,) =>
        project?.uri === candidate.activeUri
      )
    ? candidate.activeUri
    : null;
  return { projects: candidate.projects, activeUri, };
}

/**
 * Compatibility projection of {@link restoreCache} returning only the models.
 *
 * @param json the stored payload.
 * @returns the restored models, or `[]` when the payload is unusable.
 */
export function deserializeCache(json: string,): ProjectModel[] {
  return restoreCache(json,).projects;
}
