/**
 * ReportTableLine (phase 14.8) — one line of a `ReportTable`.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/ReportTableLine.rb`. A line
 * registers itself in the table, accumulates cells (`ReportTableCell` /
 * `PlaceHolderCell`) and renders a `<tr>` or CSV rows.
 *
 * `LineTable` is a structural interface (a subset of `ReportTable`, 14.6) that
 * breaks the import cycle.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.8)
 */
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { AnyTableCell, TableCellTable, } from "./report-table-cell.ts";

/** Subset of `ReportTable` used by the line. */
export interface LineTable extends TableCellTable {
  /**
   * Registers a line in this table.
   *
   * @param line Line to append.
   */
  addLine(line: ReportTableLine,): void;
}

/** One line (row) of a report table. */
export class ReportTableLine {
  /** Table the line belongs to. */
  readonly table: LineTable;
  /** Property the line describes, or `null` for a non-entity line. */
  readonly property: PropertyTreeNode | null;
  /** Line providing the scope property, when this is a sub-line. */
  readonly scopeLine: ReportTableLine | null;
  /** Cells of the line, in insertion order. */
  readonly cells: AnyTableCell[] = [];

  /** Height of the line in pixels. */
  height = 21;
  /** Indentation level of the line (tree reports). */
  indentation = 0;
  /** Font size in pixels. */
  fontSize = 12;
  /** Whether the line is rendered in bold. */
  bold = false;
  /** Line number within its level, or `null` when not numbered. */
  no: number | null = null;
  /** Absolute line number, or `null` when not numbered. */
  lineNo: number | null = null;
  /** Number of the sub-line, or `null` for a primary line. */
  subLineNo: number | null = null;

  /**
   * Creates a line and registers it in the owning table.
   *
   * @param table Table the line belongs to.
   * @param property Property the line describes, or `null`.
   * @param scopeLine Line providing the scope property, or `null` for a
   *   primary line.
   */
  constructor(
    table: LineTable,
    property: PropertyTreeNode | null,
    scopeLine: ReportTableLine | null,
  ) {
    this.table = table;
    this.property = property;
    this.scopeLine = scopeLine;
    // Registers the new line in the table it belongs to.
    this.table.addLine(this,);
  }

  /**
   * Last visible cell, skipping `count` cells from the end.
   *
   * A `PlaceHolderCell` never has `hidden`, so it counts as visible.
   *
   * @param count Number of trailing cells to skip.
   * @returns The last visible cell, or `null` when there is none.
   */
  last(count = 0,): AnyTableCell | null {
    for (let i = 1 + count; i <= this.cells.length; i++) {
      const cell = this.cells[this.cells.length - i];
      if (!cell) break;
      const isHidden = (cell as { hidden?: boolean }).hidden === true;
      if (!isHidden) return cell;
    }
    return null;
  }

  /**
   * Appends a cell to the line.
   *
   * @param cell Cell to append.
   */
  addCell(cell: AnyTableCell,): void {
    this.cells.push(cell,);
  }

  /** Scope property (taken from `scopeLine`), or `null` for a primary line. */
  scopeProperty(): PropertyTreeNode | null {
    return this.scopeLine ? this.scopeLine.property : null;
  }

  /** Renders the line as a `<tr>` holding the visible cells. */
  to_html(): XMLElementLike {
    let style = "";
    if (this.table.equiLines) style += `height:${this.height}px; `;
    if (this.fontSize) style += `font-size:${this.fontSize}px; `;
    const tr = new XMLElement("tr", { class: "tabline", style, },);
    for (const cell of this.cells) {
      const el = cell.to_html();
      if (el) tr.append(el,);
    }
    return tr;
  }

  /**
   * Writes the line into the array-of-arrays form of the table.
   *
   * @param csv Grid being filled.
   * @param startColumn Column the line starts at.
   * @param lineIdx Row index of the line.
   * @returns Number of columns consumed.
   */
  to_csv(csv: unknown[][], startColumn: number, lineIdx: number,): number {
    let columnIdx = startColumn;
    for (const cell of this.cells) {
      columnIdx += cell.to_csv(csv, columnIdx, lineIdx,);
    }
    return columnIdx - startColumn;
  }

  /** JSON descriptor of the line (SyntaxMesh extension — 14C.0.3). */
  toJSON(): { indent: number; cells: unknown[] } {
    return {
      indent: this.indentation,
      cells: this.cells.map((cell,) => cell.toJSON()),
    };
  }
}
