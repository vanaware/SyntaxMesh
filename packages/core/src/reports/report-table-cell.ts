/**
 * ReportTableCell + PlaceHolderCell (phase 14.9).
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/ReportTableCell.rb`.
 * A cell is the format-independent representation of a table cell: text on a
 * colored background, with icon, tooltip, indentation and alignment. Through
 * `special` it can delegate rendering to an external object (nested tables —
 * `ColumnTable`, phase 14.13).
 *
 * ⚠️ Browser (ADR 027): `to_html` builds an `XMLElementLike` tree; the tooltip
 * uses `TagToTip(...)` as in Ruby. Nothing is written to disk.
 *
 * The structural interfaces (`TableCellLine`/`TableCellTable`/`SpecialCell`)
 * break the cycle with ReportTable/ReportTableLine, allowing the leaf to be
 * built first.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.9)
 */
import { XMLElement, XMLText, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import type { Query, } from "../query/query.ts";
import { CSVFile, } from "./csv-file.ts";

/** Horizontal alignment of a table cell. */
export type CellAlignment = "left" | "center" | "right";

/** Subset of `ReportTable` used by the cell (avoids an import cycle). */
export interface TableCellTable {
  /** Deepest indentation level in the table, used to right-align cells. */
  maxIndent: number;
  /** When `true`, every row is forced to the same height. */
  equiLines: boolean;
  /** When `true`, icons and tooltips are inlined instead of linked. */
  selfcontained: boolean;
  /** Directory prefix for auxiliary files (icons, scripts, css). */
  auxDir: string;
}

/** Subset of `ReportTableLine` used by the cell. */
export interface TableCellLine {
  /**
   * Registers a cell in this line.
   *
   * @param cell Cell to append.
   */
  addCell(cell: ReportTableCell | PlaceHolderCell,): void;
  /** Height of the line in pixels. */
  height: number;
  /** Table the line belongs to. */
  table: TableCellTable;
}

/** The `special` object: render delegation (nested tables). */
export interface SpecialCell {
  /** Renders the nested content as HTML, or `null` when there is none. */
  to_html(): XMLElementLike | null;
  /**
   * Writes the nested content into the CSV grid.
   *
   * @param csv Grid being filled.
   * @param startColumn Column index the nested table starts at.
   * @returns Number of columns consumed.
   */
  to_csv(csv: unknown[][], startColumn: number,): number;
}

/** Embedded line referenced by a `PlaceHolderCell`. */
export interface EmbeddedLine {
  /**
   * Writes the embedded line into the CSV grid.
   *
   * @param csv Grid being filled.
   * @param columnIdx Column the line starts at.
   * @param lineIdx Row index of the line.
   * @returns Number of columns consumed.
   */
  to_csv(csv: unknown[][], columnIdx: number, lineIdx: number,): number;
}

/** Text object of the cell: a plain string or a `RichTextIntermediate`. */
export type CellText = string | RichTextIntermediate;

let idCounter = 0;
const idMap = new WeakMap<object, number>();
/** Unique, stable id per object (the equivalent of Ruby's `object_id`). */
function objectId(obj: object,): number {
  let id = idMap.get(obj,);
  if (id === undefined) {
    id = ++idCounter;
    idMap.set(obj, id,);
  }
  return id;
}

/** Ruby's `nil? || empty?` over a string or a rich text. */
function isEmptyText(value: unknown,): boolean {
  if (value === null || value === undefined) return true;
  if (typeof value === "string") return value.length === 0;
  const s = (value as RichTextIntermediate).to_s?.();
  return s === undefined ? false : s.length === 0;
}

/**
 * One cell of a report table.
 *
 * The cell holds presentation state only; the value it displays comes from
 * `text` (a string or a rich text) and, for cells bound to a query, from the
 * `query` it keeps a private copy of.
 */
export class ReportTableCell {
  /** Line the cell was appended to, when it has one. */
  readonly line: TableCellLine | null;
  /** Whether this is a header cell (changes the CSS class and truncation). */
  readonly headerCell: boolean;
  /** Private copy of the query behind the cell, or `null` for literal cells. */
  readonly query: Query | null;
  /** Content of the cell. */
  text: CellText;
  /** Tooltip shown next to the cell, or `null` for none. */
  tooltip: CellText | null = null;
  /** Whether to render the small tooltip icon. */
  showTooltipHint = true;
  /** Raw value behind the cell, when it differs from `text`. */
  data: unknown = null;
  /** CSS class override. */
  category: string | null = null;
  /** When `true`, the cell is not rendered at all. */
  hidden = false;
  /** Horizontal alignment. */
  alignment: CellAlignment = "center";
  /** Horizontal padding in pixels. */
  padding = 3;
  /** Keeps the value as text even when it looks numeric (CSV output). */
  force_string = false;
  /** Indentation level, or `null` when the cell is not in tree mode. */
  indent: number | null = null;
  /** Icon name (file stem under `icons/`), or `null` for none. */
  icon: string | null = null;
  /** Tooltip attached to the icon. */
  iconTooltip: CellText | null = null;
  /** Font size override in pixels. */
  fontSize: number | null = null;
  /** Background color. */
  cellColor: string | null = null;
  /** Font color. */
  fontColor: string | null = null;
  /** Whether the content is rendered in bold. */
  bold = false;
  /** Fixed width in pixels, or `null` for auto sizing. */
  width: number | null = null;
  /** Number of rows spanned. */
  rows = 1;
  /** Number of columns spanned. */
  columns = 1;
  /** Delegated renderer (nested tables), or `null`. */
  special: SpecialCell | null = null;

  /** Width of the left indentation padding, in pixels. */
  protected leftIndent = 0;
  /** Width of the right indentation padding, in pixels. */
  protected rightIndent = 0;

  /**
   * Creates a cell.
   *
   * Creating a cell appends it to `line` and takes a private copy of `query`, so
   * later reuse of the caller's query does not disturb the cell.
   *
   * @param line Line to append the cell to, or `null` for a detached cell.
   * @param query Query the cell reads from, or `null` for a literal cell.
   * @param text Initial content.
   * @param headerCell Whether the cell is part of the table header.
   */
  constructor(
    line: TableCellLine | null,
    query: Query | null,
    text: CellText | null = null,
    headerCell = false,
  ) {
    this.line = line;
    if (line) line.addCell(this,);
    this.headerCell = headerCell;
    this.query = query ? query.dup() : null;
    this.text = text ?? "";
  }

  /** Two cells may be merged when text and styling match. */
  equals(c: ReportTableCell,): boolean {
    return (
      this.text === c.text &&
      this.tooltip === c.tooltip &&
      this.alignment === c.alignment &&
      this.padding === c.padding &&
      this.indent === c.indent &&
      this.cellColor === c.cellColor &&
      this.category === c.category
    );
  }

  /** Converts the cell into an HTML tree; `null` when hidden. */
  to_html(): XMLElementLike | null {
    if (this.hidden) return null;
    if (this.special) return this.special.to_html();

    const attribs: Record<string, string> = {};
    if (this.rows > 1) attribs["rowspan"] = `${this.rows}`;
    if (this.columns > 1) attribs["colspan"] = `${this.columns}`;
    attribs["class"] = this.category ?? "tabcell";
    let style = "";
    if (this.cellColor) style += `background-color: ${this.cellColor}; `;
    if (style) attribs["style"] = style;
    const cell = new XMLElement("td", attribs,);

    const table = new XMLElement("table", {
      class: this.category ? "tj_table_cell" : "tj_table_header_cell",
      cellspacing: "0",
      style: this.cellStyle(),
    },);
    cell.append(table,);
    const row = new XMLElement("tr",);
    table.append(row,);

    this.calculateIndentation();

    // Padding cell for the left indentation.
    if (this.leftIndent > 0) {
      row.append(
        new XMLElement("td", { style: `width:${this.leftIndent}px; `, },),
      );
    }
    const icon = this.cellIcon(cell,);
    if (icon) row.append(icon,);

    const [labelDiv, rawTooltip,] = this.cellLabel();
    if (labelDiv) row.append(labelDiv,);

    // Overrides the tooltip when the user supplied a custom one.
    const tooltip = this.tooltip ?? rawTooltip;
    if (tooltip && !isEmptyText(tooltip,) && !this.selfcontained()) {
      if (this.showTooltipHint) {
        const td = new XMLElement("td",);
        td.append(
          new XMLElement("img", {
            src: `${this.auxDir()}icons/details.png`,
            class: "tj_table_cell_tooltip",
          },),
        );
        this.addHtmlTooltip(tooltip, td, cell,);
        row.append(td,);
      } else {
        this.addHtmlTooltip(tooltip, cell,);
      }
    }

    // Padding cell for the right indentation.
    if (this.rightIndent > 0) {
      row.append(
        new XMLElement("td", {
          style: `width:${this.rightIndent}px; `,
        },),
      );
    }

    return cell;
  }

  /**
   * Appends the cell text to the array-of-arrays form of the table.
   *
   * @param csv Grid being filled.
   * @param columnIdx Column index of the cell.
   * @param lineIdx Row index of the cell.
   * @returns Number of columns consumed.
   */
  to_csv(csv: unknown[][], columnIdx: number, lineIdx: number,): number {
    // Only the left indentation is supported in CSV.
    const indent = this.indent !== null && this.alignment === "left"
      ? "  ".repeat(this.indent,)
      : "";
    let columns = 1;
    if (this.special) {
      csv[lineIdx]![columnIdx] = null;
      columns = this.special.to_csv(csv, columnIdx,);
    } else {
      let cell: string | null;
      if (this.data !== null && typeof this.data === "string") {
        cell = this.data;
      } else if (this.text) {
        if (
          typeof (this.text as RichTextIntermediate).functionHandler ===
            "function"
        ) {
          (this.text as RichTextIntermediate).setQuery(this.query!,);
        }
        let str = this.text.toString();
        // Drops trailing line breaks (meaningless in CSV).
        while (str.endsWith("\n",)) str = str.slice(0, -1,);
        cell = str;
      } else {
        cell = null;
      }

      const native = this.force_string ? cell : CSVFile.strToNative(cell,);
      csv[lineIdx]![columnIdx] =
        typeof native === "string" && !this.force_string
          ? indent + native
          : native;
    }
    return columns;
  }

  /** JSON descriptor of the cell (SyntaxMesh extension — 14C.0.3). */
  toJSON(): unknown {
    if (this.hidden) return null;
    // Special cells (ColumnTable calendars) become a fixed descriptor.
    if (this.special) return { type: "calendar", };
    let text: string;
    if (typeof this.text === "string") {
      text = this.text;
    } else {
      text = (this.text as RichTextIntermediate).to_s();
    }
    return {
      text,
      indent: this.indent ?? 0,
      alignment: this.alignment,
      bold: this.bold,
    };
  }

  /** Whether the owning table requests self-contained output. */
  private selfcontained(): boolean {
    return !!this.line?.table.selfcontained;
  }

  /** Directory prefix for auxiliary files (icons, scripts, css). */
  private auxDir(): string {
    return this.line ? this.line.table.auxDir : "";
  }

  /**
   * In tree mode, left/right cells get their indentation from padding cells,
   * following the alignment.
   */
  protected calculateIndentation(): void {
    this.leftIndent = 0;
    this.rightIndent = 0;
    if (this.indent !== null && this.alignment !== "center") {
      if (this.alignment === "left") {
        this.leftIndent = this.indent * 8;
      } else if (this.alignment === "right") {
        this.rightIndent = ((this.line?.table.maxIndent ?? 0) - this.indent) *
          8;
      }
    }
  }

  /** Inline CSS of the outer `<td>` of the cell. */
  protected cellStyle(): string {
    let style = `text-align:${this.alignment}; `;
    if (this.line && this.line.table.equiLines) {
      style += `height:${this.line.height - 7}px; `;
    }
    return style;
  }

  /**
   * Icon column of the cell, or `null` when there is no icon to show.
   *
   * @param cell Cell the tooltip hook is attached to.
   */
  protected cellIcon(cell: XMLElementLike,): XMLElementLike | null {
    if (this.icon && !this.selfcontained()) {
      const td = new XMLElement("td", { class: "tj_table_cell_icon", },);
      td.append(
        new XMLElement("img", {
          src: `${this.auxDir()}icons/${this.icon}.png`,
          alt: "Icon",
        },),
      );
      this.addHtmlTooltip(this.iconTooltip, td, cell,);
      return td;
    }
    return null;
  }

  /** Builds the label cell and returns `[td, tooltip]`. */
  protected cellLabel(): [XMLElementLike | null, CellText | null,] {
    const fixedHeight = !!(this.line && this.line.table.equiLines);
    const fixedWidth = this.width !== null;
    let style = "";
    if (fixedHeight || fixedWidth) style += "overflow:hidden; ";
    style += `white-space:${
      fixedWidth && !fixedHeight ? "normal" : "nowrap"
    }; `;
    if (fixedHeight && !fixedWidth && this.line) {
      style += `height:${this.line.height - 3}px; `;
    }
    if (this.bold) style += "font-weight:bold; ";
    if (this.fontSize) style += `font-size: ${this.fontSize}px; `;
    if (this.fontColor) style += `color:${this.fontColor}; `;

    if (isEmptyText(this.text,)) return [null, null,];

    let tooltip: CellText | null = null;

    const textAsString = this.textToString();
    if (textAsString === null || textAsString.length === 0) {
      return [null, null,];
    }

    let labelWidth: number | null;
    if (this.width !== null) {
      labelWidth = this.width - 8;
      labelWidth -= this.leftIndent;
      labelWidth -= this.rightIndent;
      if (!this.selfcontained()) {
        if (this.icon) labelWidth -= 20;
        if (tooltip || this.tooltip) labelWidth -= 20;
      }
    } else {
      labelWidth = null;
    }
    const [shortText, singleLine,] = this.shortVersion(
      textAsString,
      labelWidth,
    );

    let tl: XMLElementLike | string;
    if (
      this.line && this.line.table.equiLines && (!singleLine || this.width) &&
      !this.headerCell
    ) {
      // Size-limited cell: short text plus the full content in the tooltip.
      if (shortText !== textAsString) tooltip = this.text;
      tl = shortText;
    } else {
      tl = this.isRichText(this.text,)
        ? (this.text as RichTextIntermediate).to_html() ??
          new XMLText("",)
        : this.text as string;
    }

    if (labelWidth !== null) {
      style += `min-width: ${labelWidth}px; max-width: ${labelWidth}px; `;
    }

    const td = new XMLElement("td", {
      class: "tj_table_cell_label",
      style,
    },);
    td.append(tl,);
    return [td, tooltip,];
  }

  /**
   * Whether the value is a rich text (it can render itself as HTML).
   *
   * @param value Text object to test.
   */
  private isRichText(value: CellText,): boolean {
    return typeof (value as RichTextIntermediate).to_html === "function";
  }

  /** Plain-text form of the cell content, or `null` when there is none. */
  private textToString(): string | null {
    if (typeof this.text === "string") return this.text;
    if (
      typeof (this.text as RichTextIntermediate).functionHandler === "function"
    ) {
      (this.text as RichTextIntermediate).setQuery(this.query!,);
    }
    return (this.text as RichTextIntermediate).to_s();
  }

  /**
   * Single-line version, truncated to the width with an ellipsis when cut.
   *
   * @param itext Text to shorten.
   * @param width Available width in pixels, or `null` for no limit.
   * @returns The shortened text and whether it stayed on a single line.
   */
  protected shortVersion(
    itext: string,
    width: number | null,
  ): [string, boolean,] {
    let text = itext;
    let singleLine = true;
    let modified = false;
    const nl = text.indexOf("\n",);
    if (nl >= 0) {
      text = text.slice(0, nl,);
      singleLine = false;
      modified = true;
    }
    if (width !== null) {
      const widthWithoutIcon = width - 20;
      const maxChars = Math.floor(widthWithoutIcon / 7,);
      if (text.length > maxChars) {
        text = maxChars > 0 ? text.slice(0, maxChars,) : "";
        modified = true;
      }
    }
    if (modified) text += "...";
    return [text, singleLine,];
  }

  /**
   * Turns `trigger` into a `TagToTip` tooltip anchor and appends the tooltip
   * box to `hook`.
   *
   * @param tooltip Content of the tooltip, or `null` for none.
   * @param trigger Element that shows the tooltip when clicked.
   * @param hook Element that receives the tooltip box; defaults to `trigger`.
   */
  protected addHtmlTooltip(
    tooltip: CellText | null,
    trigger: XMLElement,
    hook: XMLElementLike | null = null,
  ): void {
    if (!tooltip || isEmptyText(tooltip,) || this.selfcontained()) return;

    const hookEl = hook ?? trigger;
    if (
      typeof (tooltip as RichTextIntermediate).functionHandler === "function"
    ) {
      (tooltip as RichTextIntermediate).setQuery(this.query!,);
    }
    let title = "";
    if (this.query) {
      this.query.attributeId = "name";
      this.query.process();
      title = this.query.to_s();
    }
    const id = objectId(trigger,);
    trigger.attrs["onclick"] = `TagToTip('ID${id}', TITLE, '${
      title.replace(/'/g, "&apos;",)
    }')`;
    trigger.attrs["style"] = trigger.attrs["style"] ?? "cursor:help; ";
    const ltDiv = new XMLElement("div", {
      class: "tj_tooltip_box",
      style: "cursor:help",
      id: `ID${id}`,
    },);
    ltDiv.append(
      typeof (tooltip as RichTextIntermediate).to_html === "function"
        ? (tooltip as RichTextIntermediate).to_html() ??
          new XMLText("",)
        : tooltip as string,
    );
    hookEl.append(ltDiv,);
  }
}

/** Placeholder cell: stands for one line of an embedded `ReportTable`. */
export class PlaceHolderCell {
  /** Line the placeholder was appended to, when it has one. */
  readonly line: TableCellLine | null;
  /** Embedded line this placeholder delegates to. */
  readonly embeddedLine: EmbeddedLine;

  /**
   * Creates a placeholder cell for an embedded line.
   *
   * @param line Line to append the placeholder to, or `null` for a detached
   *   cell.
   * @param embeddedLine Line whose content is rendered in its place.
   */
  constructor(line: TableCellLine | null, embeddedLine: EmbeddedLine,) {
    this.line = line;
    if (line) line.addCell(this,);
    this.embeddedLine = embeddedLine;
  }

  /**
   * Writes the embedded line into the CSV grid.
   *
   * @param csv Grid being filled.
   * @param columnIdx Column the line starts at.
   * @param lineIdx Row index of the line.
   * @returns Number of columns consumed.
   */
  to_csv(csv: unknown[][], columnIdx: number, lineIdx: number,): number {
    return this.embeddedLine.to_csv(csv, columnIdx, lineIdx,);
  }

  /** A placeholder renders nothing on its own; the embedded line does. */
  to_html(): null {
    return null;
  }

  /** JSON descriptor: an embedded (calendar) line becomes type + cells. */
  toJSON(): unknown {
    const line = this.embeddedLine as unknown as {
      indentation: number;
      cells: Array<{ toJSON(): unknown }>;
    };
    return {
      type: "embedded",
      indent: line.indentation,
      cells: line.cells.map((c,) => c.toJSON()),
    };
  }
}

/** Union type of the two cell variants used by the table lines. */
export type AnyTableCell = ReportTableCell | PlaceHolderCell;
