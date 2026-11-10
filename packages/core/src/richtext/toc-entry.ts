/**
 * TOCEntry — one entry of a `TableOfContents` (Phase 12.7).
 *
 * Holds the section number, the title, the file and an optional tag inside that
 * file; it renders itself as HTML elements. Faithful port of
 * `RichText/TOCEntry.rb:29-80`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/TOCEntry.rb
 * @see ADR 025 (RichText e function handlers)
 */

import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { XMLElement, } from "../xml/xml-element.ts";

/** Font sizes per section level (Ruby: `[20, 17, 15, 14, 14]`). */
const FONT_SIZES = [20, 17, 15, 14, 14,] as const;

/**
 * One line of a table of contents.
 */
export class TOCEntry {
  /** Section number as a string (e.g. `1.2.3`). */
  readonly number: string;
  /** Section title. */
  readonly title: string;
  /** File name (without extension). */
  readonly file: string;
  /** Optional tag (anchor) inside the file. */
  readonly tag: string | null;

  /**
   * Creates an entry.
   *
   * @param number Section number, e.g. `1.2.3`.
   * @param title Section title.
   * @param file File name (without extension) the entry points to.
   * @param tag Optional anchor inside the file.
   */
  constructor(
    number: string,
    title: string,
    file: string,
    tag?: string | null,
  ) {
    this.number = number;
    this.title = title;
    this.file = file;
    this.tag = tag ?? null;
  }

  /**
   * HTML rows of this TOC entry (two rows at level 0, with extra spacing above
   * top-level chapters).
   */
  to_html(): XMLElementLike[] {
    const html: XMLElementLike[] = [];
    const lev = this.level();

    if (lev === 0) {
      // Extra row to leave room above top-level chapters.
      const spacer = new XMLElement("tr", {},);
      const td = new XMLElement("td", {},);
      td.append(new XMLElement("div", { style: "height:10px", },),);
      spacer.append(td,);
      html.push(spacer,);
    }

    const tr = new XMLElement("tr", {
      style: `font-size:${
        FONT_SIZES[Math.min(lev, FONT_SIZES.length - 1,)]
      }px;`,
    },);
    const tdNum = new XMLElement("td", { style: "width:30px;", },);
    // Level 0 chapters put the number in the left column.
    if (lev === 0) tdNum.append(this.number,);
    tr.append(tdNum,);

    const td = new XMLElement("td", {},);
    if (lev > 0) {
      // Lower levels put the number on the right, next to the title.
      const span = new XMLElement("span", {
        style: "padding-right:15px;",
      },);
      span.append(this.number,);
      td.append(span,);
    }
    const anchor = this.tag ? `#${this.tag}` : "";
    const a = new XMLElement("a", {
      href: `${this.file}.html${anchor}`,
    },);
    a.append(this.title,);
    td.append(a,);
    tr.append(td,);
    html.push(tr,);

    return html;
  }

  /**
   * Level of the section — counts the dots in the number (`1` → 0, `1.2` → 1,
   * ...). Equivalent to Ruby: only `.` is character-acceptable; the real
   * version uses the number formatted with dots between digits.
   */
  private level(): number {
    let lev = 0;
    for (const c of [...this.number,]) {
      if (c === ".") lev += 1;
    }
    return lev;
  }
}
