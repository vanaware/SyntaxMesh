/**
 * `FileList` and `FileRecord` — registry of the files read by the parser.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/FileList.rb`. In Ruby the registry
 * detects whether any `.tjp` changed since it was read (project reload). In the
 * browser there is no `File.mtime`, so `modified?` is always `false`
 * (Category B — see `cheat-sheet-ruby-ts.md` §12): the file arrives through
 * `<input type=file>` and its content has already been consumed.
 *
 * @see docs/taskjuggler/lib/taskjuggler/FileList.rb
 * @see docs/syntaxmesh/decisoes/029-journal-alertlevel.md
 */

/** Name of a file that was read and the instant it entered the list. */
export class FileRecord {
  /** File name as reported by `FileList` (relative to the project). */
  readonly name: string;

  /** Creation instant of the record (ms since the epoch). */
  readonly mtime: number;

  /**
   * Ruby `initialize(fileName)` — stores the name and the current time.
   *
   * @param fileName File name as reported by `FileList`.
   */
  constructor(fileName: string,) {
    this.name = fileName;
    this.mtime = Date.now();
  }

  /**
   * `true` if the file changed after it was registered.
   *
   * Always `false` in the browser: there is no way to query the mtime of the
   * file chosen by the user (Category B, faithful to the contract the caller
   * expects — Ruby returns `File.mtime(@name) > @mtime`).
   *
   * @returns Whether the file was modified after being registered.
   */
  modified(): boolean {
    return false;
  }
}

/** Unique list of file names, with the registry of each one. */
export class FileList {
  private readonly files = new Map<string, FileRecord>();

  /** Records in insertion order. */
  get records(): FileRecord[] {
    return [...this.files.values(),];
  }

  /** Number of unique files. */
  get length(): number {
    return this.files.size;
  }

  /**
   * Registers `fileName` (Ruby `FileList#<<`): ignores `.` and duplicates.
   *
   * @param fileName Name to register.
   */
  add(fileName: string,): void {
    if (fileName === "." || this.files.has(fileName,)) return;
    this.files.set(fileName, new FileRecord(fileName,),);
  }

  /**
   * Same operation as {@link add} (Ruby `<<` syntax).
   *
   * @param fileName Name to register.
   */
  push(fileName: string,): void {
    this.add(fileName,);
  }

  /**
   * `true` when the name is registered.
   *
   * @param fileName Name to look up.
   * @returns Whether the file is in the list.
   */
  has(fileName: string,): boolean {
    return this.files.has(fileName,);
  }

  /**
   * Record of the file; `null` when absent.
   *
   * @param fileName Name to look up.
   * @returns The matching record, or `null`.
   */
  get(fileName: string,): FileRecord | null {
    return this.files.get(fileName,) ?? null;
  }

  /**
   * First file with the `.tjp` extension (Ruby `masterFile`).
   *
   * Ruby compares `file[-4, 4] == '.tjp'`, so in practice it is "ends with
   * `.tjp`" for names of 4+ characters; shorter names return `nil` because
   * they do not reach 4 characters.
   */
  get masterFile(): string | null {
    return this.masterFileWith([".tjp",],);
  }

  /**
   * First file with one of the given extensions.
   *
   * Ruby's scan is the same (`file[-4, 4] == '.tjp'`); the port also accepts
   * `.smx` (native extension, ADR 033/24.2.36), so the suffixes come in as a
   * parameter instead of being repeated through the code.
   *
   * @param extensions Accepted extensions, including the leading dot.
   * @returns The first matching name, or `null`.
   */
  masterFileWith(extensions: readonly string[],): string | null {
    for (const file of this.files.keys()) {
      for (const extension of extensions) {
        if (file.length >= extension.length && file.endsWith(extension,)) {
          return file;
        }
      }
    }
    return null;
  }

  /**
   * `true` if any file changed (always `false` in the browser).
   *
   * @returns Whether any registered file reports a modification.
   */
  modified(): boolean {
    for (const record of this.files.values()) {
      if (record.modified()) return true;
    }
    return false;
  }

  /**
   * Names in insertion order (Ruby `each_key`).
   *
   * @returns An iterator over the registered file names.
   */
  [Symbol.iterator](): IterableIterator<string> {
    return this.files.keys();
  }
}
