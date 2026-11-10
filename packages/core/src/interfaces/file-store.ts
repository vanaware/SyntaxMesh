/**
 * `FileStore` — the core's asynchronous filesystem contract (ADR 037).
 *
 * The core is free of DOM/Storage (ADR 001/003): it knows nothing about OPFS,
 * IndexedDB, `Deno.*` or `node:fs`. Whoever needs to read/write files — the
 * sheet handlers (phase 18), the PWA storage (phase 19) and the CLI (phase 24)
 * — receives an implementation of this interface by injection.
 *
 * The interface is **structural**: any object with the shape below satisfies
 * it (no `implements`). Every method is asynchronous because OPFS offers no
 * synchronous write.
 *
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 */
export interface FileStore {
  /** UTF-8 contents of the file; rejects when it does not exist. */
  read(path: string,): Promise<string>;
  /** Writes (creates or overwrites) the file with UTF-8 content. */
  write(path: string, content: string,): Promise<void>;
  /** Removes the file; rejects when it does not exist. */
  delete(path: string,): Promise<void>;
  /**
   * Names of the **entries** of a directory (files **and** subdirectories),
   * non-recursive — like `readdir`.
   *
   * The shape of the names is up to the provider (basename or full path); the
   * core consumers only compare suffixes and basenames. Returning the
   * subdirectories too is what lets `StatusSheetSender` discover the
   * `TimeSheets/<date>` period folders (18.10).
   */
  list(dir: string,): Promise<string[]>;
  /** `true` when the path exists (file or directory). */
  exists(path: string,): Promise<boolean>;
  /** Creates the directory (idempotent). */
  mkdir(path: string,): Promise<void>;
}
