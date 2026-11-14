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

/** The persisted payload: a version tag plus the cached models. */
export interface SerializedCache {
  /** Schema version ({@link CACHE_VERSION}). */
  version: number;
  /** Cached projects, as plain data (no class instances). */
  projects: ProjectModel[];
}

/**
 * Serialises the cached models to a JSON string with the current version tag.
 *
 * @param models the cached projects (e.g. `daemon.cache.list()`).
 * @returns the JSON payload to store.
 */
export function serializeCache(models: ProjectModel[],): string {
  const payload: SerializedCache = {
    version: CACHE_VERSION,
    projects: models,
  };
  return JSON.stringify(payload,);
}

/**
 * Restores the cached models from a JSON string.
 *
 * Returns `[]` when the payload is not valid JSON, is not an object, carries a
 * different {@link CACHE_VERSION}, or has no `projects` array. The models are
 * trusted as written by {@link serializeCache} (same schema version); no
 * per-field validation is performed.
 *
 * @param json the stored payload.
 * @returns the restored models, or `[]` when the payload is unusable.
 */
export function deserializeCache(json: string,): ProjectModel[] {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json,);
  } catch {
    return [];
  }
  if (typeof parsed !== "object" || parsed === null) return [];
  const candidate = parsed as Partial<SerializedCache>;
  if (candidate.version !== CACHE_VERSION) return [];
  if (!Array.isArray(candidate.projects,)) return [];
  return candidate.projects;
}
