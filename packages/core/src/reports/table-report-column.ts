/**
 * TableReportColumn (phase 14.12) — computed data of one table column.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/TableReportColumn.rb`. It holds the
 * (possibly adjusted) dates of each column, indexed by `TableColumnDefinition`
 * in the `@columns` map of `TableReport`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.12.1.2)
 */
import type { TjTime, } from "../time/tj-time.ts";

/** The date interval covered by one column of a table report. */
export class TableReportColumn {
  /** First instant of the column, or `null` when unbounded. */
  start: TjTime | null;
  /** Last instant of the column, or `null` when unbounded. */
  end: TjTime | null;

  /**
   * Creates the interval of a column.
   *
   * @param startDate First instant of the column, or `null`.
   * @param endDate Last instant of the column, or `null`.
   */
  constructor(startDate: TjTime | null, endDate: TjTime | null,) {
    this.start = startDate;
    this.end = endDate;
  }
}
