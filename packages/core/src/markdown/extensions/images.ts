/**
 * Resolution of image references in Markdown (Addendum 13.14, #5 RDO).
 *
 * `![alt](ref)` tells **external URLs** (`http(s)://`, `//`, `data:` — passed
 * through untouched) apart from **relative paths**. Relative paths resolve
 * **OPFS first** through an injected `ImageStore` (phase 19 `image-store`);
 * when it is absent (or the image is not in the store), they fall back to the
 * project `dataDirs`. The core is DOM-independent (ADR 001): this module
 * returns a **resolution descriptor**; turning it into a `Blob`/`objectURL`
 * offline is the responsibility of the render layer (UI / phase 19).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown-tarefas.md (13.14)
 * @see docs/syntaxmesh/fases/fase-19-storage.md (image-store)
 */

/**
 * Minimal contract of the image store (implemented in phase 19 over OPFS).
 * Deliberately kept small so the core does not depend on storage.
 */
export interface ImageStore {
  /** `true` when the image exists in the store under the relative `path`. */
  has(path: string,): Promise<boolean>;
  /**
   * Returns an offline-usable `src` (data URI or objectURL) for `path`, or
   * `null` when unavailable. The UI is free to ignore it and use `dataDirs`.
   */
  resolve(path: string,): Promise<string | null>;
}

/** Origin determined for an image reference. */
export type ImageOrigin = "external" | "opfs" | "dataDir" | "unresolved";

/** Result of resolving an image reference. */
export interface ResolvedImage {
  /** Original reference (for diagnostics). */
  readonly ref: string;
  /** Alternative text (`![alt](...)`), preserved. */
  readonly alt: string | null;
  /** Where the image was resolved. */
  readonly origin: ImageOrigin;
  /** Ready-to-use `src` (external URL, store objectURL/data URI or path). */
  readonly src: string;
}

/** External-reference regex: http(s) scheme, data:, or protocol-relative. */
const EXTERNAL_RE = /^(?:[a-zA-Z][a-zA-Z0-9+.-]*:)?\/\//;
const DATA_RE = /^data:/i;

/**
 * `true` when `ref` is an external URL (explicit scheme, protocol-relative
 * `//` or `data:`). Such references pass through untouched, with no OPFS or
 * `dataDirs` resolution.
 */
export function isExternalImageRef(ref: string,): boolean {
  return EXTERNAL_RE.test(ref,) || DATA_RE.test(ref,);
}

/** Options for relative-path resolution. */
export interface ResolveOptions {
  /** Injected OPFS store (phase 19). Optional. */
  store?: ImageStore | null;
  /** Project data directories (fallback). Paths are relative to them. */
  dataDirs?: readonly string[];
  /** Alternative text of the image (`alt`). */
  alt?: string | null;
}

/**
 * Resolves an image reference (`![alt](ref)`).
 *
 * - External → `origin: "external"`, `src === ref` (untouched).
 * - Relative with a `store` holding the image → `origin: "opfs"`, store `src`.
 * - Relative missing from the store (or no store) with `dataDirs` → tries the
 *   first directory; `origin: "dataDir"`.
 * - No store and no `dataDirs` → `origin: "unresolved"`, raw `src === ref`.
 */
export async function resolveImageRef(
  ref: string,
  options: ResolveOptions = {},
): Promise<ResolvedImage> {
  const alt = options.alt ?? null;

  if (isExternalImageRef(ref,)) {
    return { ref, alt, origin: "external", src: ref, };
  }

  // OPFS first when a store is injected.
  const store = options.store;
  if (store) {
    if (await store.has(ref,)) {
      const resolved = await store.resolve(ref,);
      if (resolved !== null) {
        return { ref, alt, origin: "opfs", src: resolved, };
      }
    }
  }

  // Fallback: project dataDirs.
  const dirs = options.dataDirs ?? [];
  if (dirs.length > 0) {
    return { ref, alt, origin: "dataDir", src: joinDir(dirs[0]!, ref,), };
  }

  return { ref, alt, origin: "unresolved", src: ref, };
}

/** Joins directory and path without duplicating separators. */
function joinDir(dir: string, path: string,): string {
  const cleanDir = dir.endsWith("/",) ? dir.slice(0, -1,) : dir;
  const cleanPath = path.startsWith("/",) ? path.slice(1,) : path;
  return `${cleanDir}/${cleanPath}`;
}
