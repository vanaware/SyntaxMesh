/**
 * StreamHandle — low-level operations over the input stream.
 *
 * Port of `TextParser/Scanner.rb` (l.51-204): `StreamHandle`,
 * `FileStreamHandle`, `BufferStreamHandle` and `MacroStackEntry`, including
 * equivalents of Ruby's stdlib `StringIO` (`TextStream`) and `StringScanner`
 * (`LineScanner`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/Scanner.rb
 */
import { Log, } from "../log.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { Macro, } from "./macro-table.ts";

/** Minimal host (the Scanner) used to forward errors. Avoids a circular import. */
export interface ScannerHostLike {
  /**
   * Reports an error through the owning scanner.
   *
   * @param id Message id used for deduplication.
   * @param text Error text.
   * @param sfi Source location of the error.
   * @param data Extra data attached to the message.
   */
  error(
    id: string,
    text: string,
    sfi?: SourceFileInfo | null,
    data?: unknown,
  ): void;
}

/** Structural log: satisfies `typeof Log` (static methods) or an instance. */
export interface LogLike {
  /**
   * Emits a lazily built message.
   *
   * @param block Callback that builds the message text.
   */
  msg(block: () => string,): void;
  /** Marks progress activity on the progress meter. */
  activity(): void;
  /**
   * Starts a progress meter with the given label.
   *
   * @param text Label shown to the user.
   */
  startProgressMeter(text: string,): void;
  /** Stops the current progress meter. */
  stopProgressMeter(): void;
}

/**
 * Equivalent of Ruby's `File.dirname`.
 *
 * @param path Path whose directory is requested.
 * @returns The directory part, or `"."`.
 */
export function dirnameOf(path: string,): string {
  if (path === "" || path === ".") return ".";
  const idx = path.lastIndexOf("/",);
  if (idx < 0) return ".";
  if (idx === 0) return "/";
  return path.slice(0, idx,);
}

/**
 * TextStream — port of `StringIO` for line-by-line reading.
 * `gets()` returns the line including the `\n`; `lineno` counts the reads.
 */
export class TextStream {
  private content: string;
  private ptr = 0;
  /** Ruby `IO#lineno`: number of lines already read by `gets()`. */
  lineno = 0;

  /**
   * Wraps a string as a readable stream.
   *
   * @param content Text to expose through `gets()`.
   */
  constructor(content: string,) {
    this.content = content;
  }

  /**
   * Reads the next line, including its `\n`.
   *
   * @returns The line, or `null` at end of stream.
   */
  gets(): string | null {
    if (this.ptr >= this.content.length) return null;
    const nl = this.content.indexOf("\n", this.ptr,);
    const line = nl < 0
      ? this.content.slice(this.ptr,)
      : this.content.slice(this.ptr, nl + 1,);
    this.ptr = nl < 0 ? this.content.length : nl + 1;
    this.lineno++;
    return line;
  }

  /**
   * Whether the whole content has been consumed.
   *
   * @returns `true` at end of stream.
   */
  eof(): boolean {
    return this.ptr >= this.content.length;
  }

  /** Ruby `close` — drops the content and resets the cursor. */
  close(): void {
    this.content = "";
    this.ptr = 0;
  }
}

const stickyCache = new WeakMap<RegExp, RegExp>();

/**
 * LineScanner — port of Ruby's `StringScanner` (strscan).
 * `scan(re)` anchors at the current position; nothing advances when it does not
 * match.
 */
export class LineScanner {
  private _string: string;
  /** Cursor of the next scan, in characters. */
  pos = 0;
  /** Text matched by the last successful scan. */
  matched: string | null = null;

  /**
   * Creates a scanner positioned at the start of a string.
   *
   * @param string Initial string to scan.
   */
  constructor(string = "",) {
    this._string = string;
  }

  /** String currently scanned. */
  get string(): string {
    return this._string;
  }

  /**
   * Replaces the string and rewinds the cursor.
   *
   * @param value New string to scan.
   */
  set string(value: string,) {
    this._string = value;
    this.pos = 0;
    this.matched = null;
  }

  /**
   * Anchored match at the current position (Ruby `StringScanner#scan`).
   *
   * @param re Pattern to match.
   * @returns The matched text, or `null` when the pattern does not match.
   */
  scan(re: RegExp,): string | null {
    let sticky = stickyCache.get(re,);
    if (!sticky) {
      const flags = new Set(re.flags.split("",),);
      flags.add("y",);
      flags.delete("g",);
      sticky = new RegExp(re.source, [...flags,].join("",),);
      stickyCache.set(re, sticky,);
    }
    sticky.lastIndex = this.pos;
    const m = sticky.exec(this._string,);
    if (!m) {
      sticky.lastIndex = 0;
      // Ruby: a failed scan clears the record of the last match.
      this.matched = null;
      return null;
    }
    this.matched = m[0];
    this.pos = sticky.lastIndex;
    return m[0];
  }

  /**
   * Context to the left of the LAST match (Ruby strscan semantics): excludes
   * the match and returns null when there is no successful pending match.
   *
   * @returns The text before the last match, or `null`.
   */
  preMatch(): string | null {
    if (this.matched === null) return null;
    return this._string.slice(0, this.pos - this.matched.length,);
  }

  /**
   * Remainder to the right of the current position (Ruby `post_match`).
   *
   * @returns The text after the cursor, or `null` without a pending match.
   */
  postMatch(): string | null {
    if (this.matched === null) return null;
    return this._string.slice(this.pos,);
  }

  /**
   * Whether the cursor reached the end of the string.
   *
   * @returns `true` at end of string.
   */
  eos(): boolean {
    return this.pos >= this._string.length;
  }

  /**
   * Looks ahead without advancing.
   *
   * @param n Number of characters to peek.
   * @returns The next `n` characters.
   */
  peek(n: number,): string {
    return this._string.slice(this.pos, this.pos + n,);
  }
}

/** Entry of the macro stack (recursion detection plus history). */
export class MacroStackEntry {
  /**
   * Records one macro expansion for recursion detection and history.
   *
   * @param macro Macro that was expanded, or `null` when unknown.
   * @param args Arguments the macro was called with.
   * @param text Text injected in place of the call.
   * @param endPos End position of the injected text in the line.
   */
  constructor(
    readonly macro: Macro | null,
    readonly args: string[],
    readonly text: string,
    readonly endPos: number,
  ) {}
}

/**
 * StreamHandle — abstracts buffer vs file for the Scanner.
 * One handle per nested file; the Scanner keeps the stack.
 */
export class StreamHandle {
  /** Name of the file being read, or `null` for an anonymous buffer. */
  fileName: string | null = null;
  /** Log used for progress and diagnostics. */
  protected log: LogLike;
  /** Scanner that owns this handle and receives the errors. */
  protected textScanner: ScannerHostLike;
  /** Stream that yields the lines. */
  stream: TextStream | null = null;
  /** Current line, including its `\n`. */
  line: string | null = null;
  /** Scanner anchored on the current line. */
  scanner: LineScanner | null = null;
  /** true when the current line ended with an LF that was already consumed. */
  wrapped = false;
  /** Stack of the macros being expanded. */
  readonly macroStack: MacroStackEntry[] = [];
  /** End position of the text injected by the current macro, if any. */
  nextMacroEnd: number | null = null;

  /**
   * Creates a handle bound to the scanner that owns it.
   *
   * @param log Log used for progress and diagnostics.
   * @param textScanner Scanner that owns the handle.
   */
  constructor(log: LogLike, textScanner: ScannerHostLike,) {
    this.log = log;
    this.textScanner = textScanner;
  }

  /**
   * Forwards an error to the owning scanner.
   *
   * @param id Message id used for deduplication.
   * @param message Error text.
   */
  error(id: string, message: string,): void {
    this.textScanner.error(id, message,);
  }

  /** Drops the underlying stream. */
  close(): void {
    this.stream = null;
  }

  /**
   * Injects _text_ into the stream at the current cursor position, removing the
   * macro call (_callLength_ characters) from the end of the input.
   *
   * Note (Category B, fixed): Ruby mixes `bytesize` with character indexes here;
   * this port uses character positions, consistent with `LineScanner`.
   *
   * @param text Text to inject.
   * @param callLength Length of the macro call being replaced.
   */
  injectText(text: string, callLength: number,): void {
    if (!this.scanner) return;
    // Ruby: `preCall = @scanner.pre_match[0..-(callLength + 1)]` — clamps to 0
    // when the left context is shorter than the call (str[0..-n] → "").
    const preMatchStr = this.scanner.preMatch() ?? "";
    const preCall = preMatchStr.slice(
      0,
      Math.max(0, preMatchStr.length - callLength,),
    );
    this.nextMacroEnd = preCall.length + text.length;
    this.line = preCall + text + (this.scanner.postMatch() ?? "");
    this.scanner.string = this.line;
    this.scanner.pos = preCall.length;
  }

  /**
   * Injects an expanded macro and records it in the history.
   *
   * @param macro Macro that was expanded.
   * @param args Arguments the macro was called with.
   * @param text Text injected in place of the call.
   * @param callLength Length of the macro call being replaced.
   * @returns `false` when recursion is detected.
   */
  injectMacro(
    macro: Macro | null,
    args: string[],
    text: string,
    callLength: number,
  ): boolean {
    this.injectText(text, callLength,);

    // Simple detection of recursive macro calls.
    if (this.macroStack.length > 20) return false;

    this.macroStack.push(
      new MacroStackEntry(macro, args, text, this.nextMacroEnd ?? 0,),
    );
    return true;
  }

  /**
   * Makes sure there is a line to scan.
   *
   * @returns `false` at the end of the stream.
   */
  readyNextLine(): boolean {
    if (this.scanner === null || this.scanner.eos()) {
      const line = this.stream ? this.stream.gets() : null;
      if (line === null) {
        // We reached the end of the current file.
        this.scanner = null;
        return false;
      }
      this.line = line;
      // Update the activity meter roughly every 1024 lines.
      if ((this.stream!.lineno & 0x3FF) === 0) this.log.activity();
      this.scanner = new LineScanner(this.line,);
      this.wrapped = this.line.length > 0 &&
        this.line[this.line.length - 1] === "\n";
    }
    return true;
  }

  /**
   * Anchored scan on the current line.
   *
   * @param re Pattern to match.
   * @returns The matched text, or `null`.
   */
  scan(re: RegExp,): string | null {
    return this.scanner ? this.scanner.scan(re,) : null;
  }

  /** Removes from the stack the macros entirely consumed by the cursor. */
  cleanupMacroStack(): void {
    if (this.nextMacroEnd !== null && this.scanner) {
      const pos = this.scanner.pos;
      while (this.nextMacroEnd !== null && this.nextMacroEnd < pos) {
        this.macroStack.pop();
        this.nextMacroEnd = this.macroStack.length > 0
          ? this.macroStack[this.macroStack.length - 1]!.endPos
          : null;
      }
    }
  }

  /**
   * Looks ahead on the current line.
   *
   * @param n Number of characters to peek.
   * @returns The next `n` characters, or `null` without a scanner.
   */
  peek(n: number,): string | null {
    return this.scanner ? this.scanner.peek(n,) : null;
  }

  /**
   * Whether the whole input has been consumed.
   *
   * @returns `true` at end of input.
   */
  eof(): boolean {
    if (!this.stream || !this.scanner) return true;
    return this.stream.eof() && this.scanner.eos();
  }

  /**
   * Directory of the file being read.
   *
   * @returns The directory part of `fileName`, or an empty string.
   */
  dirname(): string {
    return this.fileName ? dirnameOf(this.fileName,) : "";
  }

  /**
   * Number of the line being processed (Ruby keeps it in `IO#lineno`).
   *
   * @returns The 1-based line number.
   */
  lineNo(): number {
    let currentLine = this.stream && this.scanner ? this.stream.lineno : 1;
    // If we just read the LF, add 1 — the LF can only be the last character.
    if (this.wrapped && this.line && this.scanner && this.scanner.eos()) {
      currentLine += 1;
    }
    return currentLine;
  }

  /**
   * Part of the current line already processed (for error messages).
   *
   * @returns The consumed prefix of the line.
   */
  currentLine(): string {
    if (!this.line || !this.scanner) return "";
    return (this.scanner.preMatch() ?? "") + (this.scanner.matched ?? "");
  }
}

/** Injectable reader for environments without a filesystem (browser/PWA). */
export type FileTextLoader = (fileName: string,) => string;

/**
 * FileStreamHandle — StreamHandle for files.
 *
 * Browser (phase 19/20): the whole file is loaded at once; here
 * `Deno.readTextFileSync` or an injected `FileTextLoader` is used.
 */
export class FileStreamHandle extends StreamHandle {
  /** Loading hook (tests/browser); defaults to the Deno filesystem. */
  static fileLoader: FileTextLoader | null = null;

  /**
   * Opens a file (or stdin, for `"."`) as a stream handle.
   *
   * @param fileName Path of the file to read.
   * @param log Log used for progress and diagnostics.
   * @param textScanner Scanner that owns the handle.
   * @param loader Reader injected per instance (phase 24): it takes precedence
   *   over the static hook and over the environment's `Deno`. This is how
   *   `TaskJuggler.parse` delivers the content without touching the disk.
   */
  constructor(
    fileName: string,
    log: LogLike,
    textScanner: ScannerHostLike,
    loader: FileTextLoader | null = null,
  ) {
    super(log, textScanner,);
    this.fileName = fileName;
    const data = fileName === "."
      ? readStdin()
      : (loader ?? loadFileText)(fileName,);
    this.stream = new TextStream(data,);
    this.log.msg(() => `Parsing file ${this.fileName} ...`);
    this.log.startProgressMeter(`Reading file ${fileName}`,);
  }

  /** Closes the stream and releases the handle. */
  override close(): void {
    if (this.stream) this.stream.close();
    super.close();
  }
}

/** StreamHandle over an in-memory string (buffer). */
export class BufferStreamHandle extends StreamHandle {
  /**
   * Wraps a buffer as a stream handle.
   *
   * @param buffer Text to read line by line.
   * @param log Log used for progress and diagnostics.
   * @param textScanner Scanner that owns the handle.
   */
  constructor(buffer: string, log: LogLike, textScanner: ScannerHostLike,) {
    super(log, textScanner,);
    this.stream = new TextStream(buffer,);
  }
}

/**
 * Minimal shape of the `Deno` global, read in a runtime-agnostic way (the core
 * may run without Deno, e.g. in the browser). It replaces
 * `Record<string, any>` to satisfy `no-explicit-any` without losing the checks
 * on the methods used.
 */
interface DenoGlobal {
  Deno?: {
    readTextFileSync?: (fileName: string,) => string;
    readFileSync?: (rid: number,) => Uint8Array;
    stdin?: { rid?: number };
  };
}

/**
 * Reads the text of a file through the injected hook or the Deno filesystem.
 *
 * @param fileName Path of the file to read.
 * @returns The file content.
 * @throws Error When the runtime has no filesystem.
 */
export function loadFileText(fileName: string,): string {
  if (FileStreamHandle.fileLoader) {
    return FileStreamHandle.fileLoader(fileName,);
  }
  const g = globalThis as unknown as DenoGlobal;
  if (g.Deno?.readTextFileSync) {
    return g.Deno.readTextFileSync(fileName,);
  }
  throw new Error(
    `Cannot read file ${fileName}: no filesystem in this runtime`,
  );
}

/**
 * Reads the whole standard input.
 *
 * @returns The stdin content decoded as UTF-8.
 * @throws Error When stdin is not available in the runtime.
 */
function readStdin(): string {
  const g = globalThis as unknown as DenoGlobal;
  if (g.Deno?.stdin && g.Deno.readFileSync) {
    const bytes: Uint8Array = g.Deno.readFileSync(g.Deno.stdin.rid ?? 0,);
    return new TextDecoder().decode(bytes,);
  }
  throw new Error("Cannot read stdin: not available in this runtime",);
}
