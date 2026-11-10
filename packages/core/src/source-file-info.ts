/**
 * SourceFileInfo — reference to a position inside a file, used by error and
 * warning messages.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/SourceFileInfo.rb
 */
export class SourceFileInfo {
  /** Name of the file the position refers to. */
  readonly fileName: string;
  /** One-based line number. */
  readonly lineNo: number;
  /** One-based column number. */
  readonly columnNo: number;

  /**
   * Creates a position reference.
   *
   * @param fileName Name of the file the position refers to.
   * @param lineNo One-based line number.
   * @param columnNo One-based column number.
   */
  constructor(fileName: string, lineNo: number, columnNo: number,) {
    this.fileName = fileName;
    this.lineNo = lineNo;
    this.columnNo = columnNo;
  }

  /**
   * Formats the position as `file:line:` (Ruby `to_s`).
   *
   * @returns The `fileName:lineNo:` form used in messages.
   */
  to_s(): string {
    return `${this.fileName}:${this.lineNo}:`;
  }
}
