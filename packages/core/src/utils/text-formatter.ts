/**
 * TextFormatter — simple formatting of plain text blocks (indentation and line
 * width), used by `RichTextElement.to_s` (phase 12.3).
 *
 * Task 16.6 of phase 16 was **brought forward** into phase 12: it is a pure
 * dependency of `Element.rb#to_s`, unrelated to the rest of phase 16.
 *
 * Faithful port of `TextFormatter.rb:21-184`:
 *   - `indent(str)` — inserts `firstLineIndent`/`indentation` spaces at the
 *     beginning of each line and drops characters beyond `width`; always ends
 *     with `\n`.
 *   - `format(str)` — line-breaking FSM (states `beginOfParagraph`, `inWord`,
 *     `betweenWords`, `betweenWordsOrLines`); `\r` forces a new line without a
 *     new paragraph; a blank line ends the paragraph.
 *   - iteration by **code point** (`each_utf8_char` → `[...str]`), as required
 *     by the UTF-8 note of phase 16.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TextFormatter.rb
 */

/** Indents and wraps plain text blocks at a fixed line width. */
export class TextFormatter {
  /** Maximum line width, counting the indentation. */
  width: number;
  /** Indentation of every line after the first. */
  indentation: number;
  /** Indentation of the first line (defaults to `indentation`). */
  firstLineIndent: number;

  /**
   * Ruby `initialize(width = 80, indentation = 0, firstLineIndent = nil)`.
   *
   * @param width Maximum line width, counting the indentation.
   * @param indentation Indentation of the lines after the first.
   * @param firstLineIndent Indentation of the first line; defaults to
   *   `indentation`.
   */
  constructor(width = 80, indentation = 0, firstLineIndent?: number,) {
    this.width = width;
    this.indentation = indentation;
    this.firstLineIndent = firstLineIndent ?? indentation;
  }

  /**
   * Indents each line of `str` (`firstLineIndent` on the first, `indentation`
   * on the rest) and cuts whatever exceeds `width`. Always ends with `\n`.
   *
   * @param str Text to indent.
   * @returns The indented text, terminated by a newline.
   */
  indent(str: string,): string {
    let out = "";
    // Pending indentation of the current line; null once it is written.
    let indentBuf: string | null = " ".repeat(this.firstLineIndent,);
    let linePos = 0;
    for (const c of [...str,]) {
      if (c === "\n") {
        // No trailing whitespace: replace the buffer by a bare break.
        if (indentBuf !== null) out += "\n";
        indentBuf = "\n" + " ".repeat(this.indentation,);
      } else {
        if (indentBuf !== null) {
          out += indentBuf;
          linePos = indentBuf.replace(/\n/g, "",).length;
          indentBuf = null;
        }
        // Drop characters beyond the requested width.
        if (linePos < this.width) {
          out += c;
          linePos += 1;
        }
      }
    }
    // Always ends with a line break.
    if (!out.endsWith("\n",)) out += "\n";
    return out;
  }

  /**
   * Formats `str` (word wrapping at the `width` boundary).
   *
   * @param str Text to wrap.
   * @returns The wrapped text, terminated by a newline.
   */
  format(str: string,): string {
    let out = "";
    // Column of the last character of the current line.
    let linePos = 0;
    // Buffer of the word being processed.
    let wordBuf = "";
    // True when we are at the beginning of a line.
    let beginOfLine = true;
    // Indentation buffer of the next line.
    let indentBuf = " ".repeat(this.firstLineIndent,);
    type State =
      | "beginOfParagraph"
      | "inWord"
      | "betweenWords"
      | "betweenWordsOrLines";
    let state: State = "beginOfParagraph";

    const appendWord = (): void => {
      const wordLength = [...wordBuf,].length;
      if (wordLength === 0) return;

      // If the word does not fit on the line, start a new one.
      if (linePos + 1 + wordLength > this.width) beginOfLine = true;

      if (beginOfLine) {
        out += indentBuf;
        linePos = indentBuf.replace(/\n/g, "",).length;
        indentBuf = "\n" + " ".repeat(this.indentation,);
      } else {
        // Space separating words.
        out += " ";
        linePos += 1;
      }
      out += wordBuf;
      wordBuf = "";
      linePos += wordLength;
      if (beginOfLine) beginOfLine = false;
    };

    for (const c of [...str,]) {
      switch (state) {
        case "beginOfParagraph":
          if (c === " " || c === "\n") {
            // ignore
          } else {
            wordBuf += c;
            state = "inWord";
          }
          break;
        case "inWord":
          if (c === " " || c === "\n") {
            appendWord();
            state = c === " " ? "betweenWords" : "betweenWordsOrLines";
          } else if (c === "\r") {
            // CR breaks the line without closing the paragraph.
            appendWord();
            indentBuf = "\n" + " ".repeat(this.firstLineIndent,);
            beginOfLine = true;
            state = "betweenWords";
          } else {
            wordBuf += c;
          }
          break;
        case "betweenWords":
          if (c === " ") {
            // ignore
          } else if (c === "\n") {
            state = "betweenWordsOrLines";
          } else {
            wordBuf += c;
            state = "inWord";
          }
          break;
        case "betweenWordsOrLines":
          if (c === "\n") {
            // Double break = end of paragraph.
            indentBuf = "\n\n" + " ".repeat(this.firstLineIndent,);
            beginOfLine = true;
            state = "beginOfParagraph";
          } else if (c === " ") {
            state = "betweenWords";
          } else {
            wordBuf += c;
            state = "inWord";
          }
          break;
        default:
          throw new Error(`Unknown state in state machine: ${state}`,);
      }
    }
    appendWord();

    // Always ends with a line break.
    if (!out.endsWith("\n",)) out += "\n";
    return out;
  }
}
