/**
 * `MemoryFileStore` — an in-memory implementation of `FileStore` (ADR 037).
 *
 * It exists for the phase 24 **data path** (group 5, 24.2.32): the sheet apps
 * and the sheet checks keep using the `FileStore` interface (demoted, not
 * revoked), but `execute` injects this implementation seeded with
 * `request.files` — nothing touches the disk or the terminal, and the result
 * comes out as **data** (`snapshot()`).
 *
 * The semantics mirror what the handlers expect from a disk (the same as the
 * `fakeOpfs()` of the phase 18 tests), with one deliberate difference: `write`
 * **creates missing parent directories**, because here there is no OS permission
 * to validate and the only effect of rejecting would be noise on the data path.
 * - `mkdir` is idempotent and creates the ancestors;
 * - `list` returns the **basenames** of the entries (files and subdirectories);
 * - `delete` rejects when the file does not exist.
 *
 * This is not the PWA storage: phase 19 (ADR 030) brings the persistent provider
 * (`@vanaware/workerdb`). This store is ephemeral by definition.
 *
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.5
 */
import type { FileStore, } from "./file-store.ts";

/** Prompt file of the store (same shape as `request.files`). */
export interface MemoryStoreFile {
  /** Normalized path of the file inside the store. */
  path: string;
  /** Full content seeded into the store. */
  content: string;
}

/**
 * Seed of the store: a `path → content` map. Keys ending in `/` create the empty
 * directory (the sheet folder of a period, for example).
 */
export type MemoryStoreSeed = Record<string, string>;

/** Normalises a relative path (no `./`, no trailing slash, no `//`). */
export function normalizeStorePath(path: string,): string {
  const trimmed = path.replace(/^\.\//u, "",).replace(/\/+$/u, "",);
  return trimmed.replace(/\/{2,}/gu, "/",);
}

/** Parent directory of a path (`""` at the root level). */
function parentOf(path: string,): string {
  const idx = path.lastIndexOf("/",);
  return idx < 0 ? "" : path.slice(0, idx,);
}

/** First segment of a relative path — the direct entry of the directory. */
function firstSegment(path: string,): string {
  const idx = path.indexOf("/",);
  return idx < 0 ? path : path.slice(0, idx,);
}

/**
 * In-memory store compatible with `FileStore`.
 *
 * Typical use on the data path:
 *
 * ```ts
 * const store = new MemoryFileStore({ "templates/x.tji": template, });
 * await app.run({ project, fileStore: store, rawEmail, },);
 * const files = store.toFiles(); // data, not disk
 * ```
 */
export class MemoryFileStore implements FileStore {
  /** Content by normalised path. */
  private readonly files = new Map<string, string>();
  /** Existing directories (includes the `""` root). */
  private readonly dirs = new Set<string>(["",],);

  /**
   * Builds the store from a seed (map or list of files).
   *
   * @param seed Initial paths and contents; a trailing `/` creates an empty
   *   directory.
   */
  constructor(seed: MemoryStoreSeed | MemoryStoreFile[] = {},) {
    const entries: [string, string,][] = Array.isArray(seed,)
      ? seed.map((file,) => [file.path, file.content,] as [string, string,])
      : Object.entries(seed,);
    for (const [path, content,] of entries) {
      if (path.endsWith("/",)) {
        this.mkdirSync(path,);
      } else {
        this.writeSync(path, content,);
      }
    }
  }

  /** UTF-8 content of the file; rejects when it does not exist. */
  // Synchronous inside: the `async` matches the `FileStore` signature (ADR 037).
  // deno-lint-ignore require-await
  async read(path: string,): Promise<string> {
    const key = normalizeStorePath(path,);
    const content = this.files.get(key,);
    if (content === undefined) {
      throw new Error(`ENOENT: ${path}`,);
    }
    return content;
  }

  /** Writes (creates or overwrites) the file, creating the ancestors. */
  // deno-lint-ignore require-await
  async write(path: string, content: string,): Promise<void> {
    this.writeSync(path, content,);
  }

  /** Removes the file; rejects when it does not exist. */
  // deno-lint-ignore require-await
  async delete(path: string,): Promise<void> {
    const key = normalizeStorePath(path,);
    if (!this.files.delete(key,)) {
      throw new Error(`ENOENT: ${path}`,);
    }
  }

  /** Basenames of the directory entries (files and subdirectories). */
  // deno-lint-ignore require-await
  async list(dir: string,): Promise<string[]> {
    const key = normalizeStorePath(dir,);
    if (!this.dirs.has(key,)) {
      throw new Error(`ENOENT: directory ${dir} does not exist`,);
    }
    const prefix = key === "" ? "" : `${key}/`;
    const names = new Set<string>();
    for (const path of this.files.keys()) {
      if (!path.startsWith(prefix,)) continue;
      names.add(firstSegment(path.slice(prefix.length,),),);
    }
    for (const path of this.dirs) {
      if (path === "" || path === key || !path.startsWith(prefix,)) continue;
      names.add(firstSegment(path.slice(prefix.length,),),);
    }
    return [...names,].sort();
  }

  /** `true` when the path exists (file or directory). */
  // deno-lint-ignore require-await
  async exists(path: string,): Promise<boolean> {
    const key = normalizeStorePath(path,);
    return this.files.has(key,) || this.dirs.has(key,);
  }

  /** Creates the directory (idempotent, with the ancestors). */
  // deno-lint-ignore require-await
  async mkdir(path: string,): Promise<void> {
    this.mkdirSync(path,);
  }

  /** Copy of the files as an ordered list — the **data** output of the store. */
  toFiles(): MemoryStoreFile[] {
    return [...this.files.entries(),]
      .sort(([a,], [b,],) => a < b ? -1 : a > b ? 1 : 0)
      .map(([path, content,],) => ({ path, content, }));
  }

  /** `path → content` snapshot (pure data, no instances). */
  snapshot(): MemoryStoreSeed {
    return Object.fromEntries(this.files,);
  }

  /** Writes creating the parent directories (used by the seed). */
  private writeSync(path: string, content: string,): void {
    const key = normalizeStorePath(path,);
    const parent = parentOf(key,);
    if (!this.dirs.has(parent,)) this.mkdirSync(parent,);
    this.files.set(key, content,);
  }

  /** Creates the directory and all its ancestors. */
  private mkdirSync(path: string,): void {
    const key = normalizeStorePath(path,);
    if (key === "") return;
    const parts = key.split("/",);
    for (let i = 1; i <= parts.length; i++) {
      this.dirs.add(parts.slice(0, i,).join("/",),);
    }
  }
}
