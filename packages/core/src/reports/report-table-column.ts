/**
 * ReportTableColumn (phase 14.7) — header column of a `ReportTable`.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/ReportTableColumn.rb`. The header of
 * each column has up to two cells (`cell1` on top, mandatory; `cell2` below,
 * optional). The column registers itself in the table and in its
 * `TableColumnDefinition`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.7)
 */
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { ReportTableCell, } from "./report-table-cell.ts";
import type { TableColumnDefinition, } from "./table-column-definition.ts";

/** Subset of `ReportTable` used by the column. */
export interface ColumnHost {
  /**
   * Registers a column in this table.
   *
   * @param column Column to append.
   */
  addColumn(column: ReportTableColumn,): void;
}

/** One header column of a report table. */
export class ReportTableColumn {
  /** Table the column belongs to. */
  readonly table: ColumnHost;
  /** Column definition behind the column, or `null` for an extra column. */
  readonly definition: TableColumnDefinition | null;
  /** Top header cell (always present). */
  readonly cell1: ReportTableCell;
  /** Bottom header cell (may stay empty). */
  readonly cell2: ReportTableCell;
  /** Whether the column needs a scrollable area. */
  scrollbar = false;

  /**
   * Creates a column and registers it in the owning table.
   *
   * @param table Table the column belongs to.
   * @param definition Column definition behind it, or `null` for an extra
   *   column.
   * @param title Title shown in the top header cell.
   */
  constructor(
    table: ColumnHost,
    definition: TableColumnDefinition | null,
    title: string,
  ) {
    this.table = table;
    // Registers the new column in the ReportTable.
    this.table.addColumn(this,);
    this.definition = definition;
    // Registers the column in the TableColumnDefinition.
    if (definition) definition.column = this;

    // The two header cells.
    this.cell1 = new ReportTableCell(null, null, title, true,);
    this.cell1.padding = 5;
    this.cell2 = new ReportTableCell(null, null, "", true,);
    // Header text is always bold.
    this.cell1.bold = true;
    this.cell2.bold = true;
  }

  /** Minimum width required (the largest of the two cells; `null` if neither). */
  minWidth(): number | null {
    let width = this.cell1.width;
    if (width === null) {
      width = this.cell2.width;
    } else if (this.cell2.width !== null && this.cell2.width > width) {
      width = this.cell2.width;
    }
    return width;
  }

  /**
   * Header cell of the given row.
   *
   * @param row `1` for the top header, `2` for the bottom one.
   */
  to_html(row: 1 | 2,): XMLElementLike | null {
    return row === 1 ? this.cell1.to_html() : this.cell2.to_html();
  }

  /**
   * Writes the column header into the CSV grid (only the first header row).
   *
   * @param csv Grid being filled.
   * @param startColumn Column the header starts at.
   * @returns Number of columns consumed.
   */
  to_csv(csv: unknown[][], startColumn: number,): number {
    return this.cell1.to_csv(csv, startColumn, 0,);
  }

  /** JSON descriptor of the column (SyntaxMesh extension — 14C.0.3). */
  toJSON(): { id: string; title: string } {
    return {
      id: this.definition?.id ?? "",
      title: String(this.cell1.text,),
    };
  }
}
