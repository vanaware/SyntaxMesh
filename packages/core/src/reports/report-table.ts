/**
 * ReportTable (phase 14.6) — the intermediate format of every report table.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/ReportTable.rb`. Columns and lines
 * register themselves here through their constructors. `to_html` applies the
 * header rule: when **all** columns have `cell1.rows === 2` (or a `special`),
 * they are merged into a single header; otherwise two header rows are emitted.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.6)
 */
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { markdownTable, markdownText, } from "./markdown.ts";
import type { ReportTableColumn, } from "./report-table-column.ts";
import type { ReportTableLine, } from "./report-table-line.ts";

/** The intermediate representation of a report table. */
export class ReportTable {
  /** Height (px) of a horizontal scrollbar in HTML. */
  static readonly SCROLLBARHEIGHT = 20;

  /** Height (px) of a header line. */
  readonly headerLineHeight = 19;
  /** Font size (px) of the header text. */
  headerFontSize = 15;
  /** Deepest indentation level among the lines (tree reports). */
  maxIndent = 0;
  /** When `true`, every line is forced to the same height. */
  equiLines = false;
  /** When `true`, the table is rendered inside a cell of another table. */
  embedded = false;
  /** When `true`, icons and tooltips are inlined instead of linked. */
  selfcontained = false;
  /** Directory prefix for auxiliary files (icons, scripts, css). */
  auxDir = "";

  /** Columns of the table, in insertion order. */
  protected columns: ReportTableColumn[] = [];
  /** Lines of the table, in insertion order. */
  protected lines: ReportTableLine[] = [];

  /**
   * Registers a column; only the `ReportTableColumn` constructor should call it.
   *
   * @param col Column to register.
   */
  addColumn(col: ReportTableColumn,): void {
    this.columns.push(col,);
  }

  /**
   * Registers a line; only the `ReportTableLine` constructor should call it.
   *
   * @param line Line to register.
   */
  addLine(line: ReportTableLine,): void {
    this.lines.push(line,);
  }

  /** Number of registered lines. */
  linesCount(): number {
    return this.lines.length;
  }

  /** Registered columns (read access). */
  getColumns(): ReportTableColumn[] {
    return this.columns;
  }

  /** Registered lines (read access). */
  getLines(): ReportTableLine[] {
    return this.lines;
  }

  /** Minimum width required by the table; always >= 1. */
  minWidth(): number {
    let width = 1;
    for (const column of this.columns) {
      const cw = column.minWidth();
      if (cw !== null) width += cw + 1;
    }
    return width;
  }

  /** Renders the table as HTML. */
  to_html(): XMLElementLike {
    this.determineMaxIndents();

    const attr: Record<string, string> = {
      class: "tj_table",
      cellspacing: "1",
    };
    if (this.embedded) attr["style"] = "width:100%; ";
    const table = new XMLElement("table", attr,);
    const tbody = new XMLElement("tbody",);
    table.append(tbody,);

    // Header rule: do all columns have 2 rows (or a special)?
    let allCellsHave2Rows = true;
    let lineHeight = this.headerLineHeight;
    for (const col of this.columns) {
      if (col.cell1.rows !== 2 && !col.cell1.special) {
        allCellsHave2Rows = false;
        break;
      }
    }
    if (allCellsHave2Rows) {
      for (const col of this.columns) col.cell1.rows = 1;
      lineHeight = this.headerLineHeight * 2 + 1;
    }

    const tr1 = new XMLElement("tr", {
      class: "tabhead",
      style: `height:${lineHeight}px; font-size:${this.headerFontSize}px;`,
    },);
    tbody.append(tr1,);
    for (const col of this.columns) {
      const el = col.to_html(1,);
      if (el) tr1.append(el,);
    }

    if (!allCellsHave2Rows) {
      const tr2 = new XMLElement("tr", {
        class: "tabhead",
        style:
          `height:${this.headerLineHeight}px; font-size:${this.headerFontSize}px;`,
      },);
      tbody.append(tr2,);
      for (const col of this.columns) {
        const el = col.to_html(2,);
        if (el) tr2.append(el,);
      }
    }

    // Remaining rows of the table.
    for (const line of this.lines) tbody.append(line.to_html(),);

    // Extra row for the columns without a scrollbar.
    if (this.hasScrollbar()) {
      const tr = new XMLElement("tr", {
        style: `height:${ReportTable.SCROLLBARHEIGHT}px`,
      },);
      for (const column of this.columns) {
        if (!column.scrollbar) tr.append(new XMLElement("td",),);
      }
      tbody.append(tr,);
    }

    return table;
  }

  /**
   * Renders the table as an array of arrays. Returns `csv` or, when embedded,
   * the number of columns consumed.
   *
   * @param csv Grid being filled.
   * @param startColumn Column the table starts at.
   * @returns The filled grid, or the column count when the table is embedded.
   */
  to_csv(csv: unknown[][] = [[],], startColumn = 0,): unknown[][] | number {
    // Header row.
    let columnIdx = startColumn;
    for (const col of this.columns) {
      columnIdx += col.to_csv(csv, columnIdx,);
    }

    if (this.embedded) {
      return columnIdx - startColumn;
    }

    // The content of embedded tables is inserted when the line is generated.
    let lineIdx = 1;
    for (const line of this.lines) {
      csv[lineIdx] = [];
      line.to_csv(csv, startColumn, lineIdx,);
      lineIdx++;
    }
    return csv;
  }

  /** Intermediate JSON form (SyntaxMesh extension — 14C.0.3): columns plus lines. */
  toJSON(): { columns: unknown[]; lines: unknown[] } {
    return {
      columns: this.columns.map((col,) => col.toJSON()),
      lines: this.lines.map((line,) => line.toJSON()),
    };
  }

  /**
   * Markdown (GFM) table — SyntaxMesh extension (addendum §10).
   *
   * A column header has up to two cells; as Markdown accepts a single header row
   * they are joined (`cell1 cell2`). The data grid is the same as the CSV one
   * (`to_csv`), which already resolves `colspan` and embedded tables.
   */
  to_markdown(): string {
    const headers = this.columns.map((col,) => {
      const top = markdownText(col.cell1.text,);
      const bottom = markdownText(col.cell2.text,);
      if (top === "") return bottom;
      if (bottom === "") return top;
      return `${top} ${bottom}`;
    },);
    const csv = this.to_csv();
    const rows = Array.isArray(csv,) ? csv.slice(1,) : [];
    return markdownTable(headers, rows,);
  }

  /** Deepest indentation among the lines (tree mode). */
  protected determineMaxIndents(): void {
    this.maxIndent = 0;
    for (const line of this.lines) {
      if (line.indentation > this.maxIndent) this.maxIndent = line.indentation;
    }
  }

  /** Does any column carry a scrollbar? */
  protected hasScrollbar(): boolean {
    for (const col of this.columns) {
      if (col.scrollbar) return true;
    }
    return false;
  }
}
