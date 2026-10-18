/**
 * SourceFileInfo — referência a posição em arquivo para mensagens de erro.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextParser/SourceFileInfo.rb
 */
export class SourceFileInfo {
  readonly fileName: string;
  readonly lineNo: number;
  readonly columnNo: number;

  constructor(fileName: string, lineNo: number, columnNo: number) {
    this.fileName = fileName;
    this.lineNo = lineNo;
    this.columnNo = columnNo;
  }

  to_s(): string {
    return `${this.fileName}:${this.lineNo}:`;
  }
}
