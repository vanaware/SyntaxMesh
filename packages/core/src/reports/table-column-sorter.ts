/**
 * TableColumnSorter (phase 14.5) — reorders the columns of a table according to
 * new headers.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/TableColumnSorter.rb`. The table is an array
 * of rows (each row an array); the first row holds the headers. Old columns
 * missing from the new headers are moved to the end (discontinued columns); new
 * columns are filled with `null`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.5)
 */
export class TableColumnSorter {
  /** Table registered for sorting (never mutated). */
  private readonly oldTable: unknown[][];
  /** Number of discontinued columns; `null` until `sort` is called. */
  discontinuedColumns: number | null;

  /**
   * Registers the table to be reordered.
   *
   * @param table Table whose first row holds the old headers.
   */
  constructor(table: unknown[][],) {
    this.oldTable = table;
    this.discontinuedColumns = null;
  }

  /**
   * Reorders the registered table. The old table is not modified: a new table is
   * returned, with the old columns absent from `newHeaders` appended at the end.
   *
   * @param newHeaders Headers of the new column order.
   * @returns A new table in the requested column order.
   */
  sort(newHeaders: string[],): unknown[][] {
    // Maps the old index -> new index.
    const columnIdxMap = new Map<number, number>();
    let newHeaderIndex = newHeaders.length;
    const oldHeaders = this.oldTable[0] as unknown[];
    const discontinuedHeaders: unknown[] = [];
    for (let i = 0; i < oldHeaders.length; i++) {
      const ni = newHeaders.findIndex((h,) => h === oldHeaders[i]);
      if (ni >= 0) {
        // The old column is still present in the new headers.
        columnIdxMap.set(i, ni,);
      } else {
        // Discontinued column: appended at the end.
        columnIdxMap.set(i, newHeaderIndex,);
        discontinuedHeaders.push(oldHeaders[i],);
        newHeaderIndex += 1;
      }
    }

    // Builds a new table from scratch, filling it with null.
    const newTable: unknown[][] = [];
    for (let lineIdx = 0; lineIdx < this.oldTable.length; lineIdx++) {
      const oldLine = this.oldTable[lineIdx]!;
      if (lineIdx === 0) {
        newTable[0] = [...newHeaders,];
      } else {
        newTable[lineIdx] = new Array(newHeaderIndex,).fill(null,);
      }
      const newLine = newTable[lineIdx]!;
      // Copies every old column into its new position.
      for (const [oldColIdx, newColIdx,] of columnIdxMap) {
        newLine[newColIdx] = oldLine[oldColIdx];
      }
    }

    this.discontinuedColumns = discontinuedHeaders.length;
    return newTable;
  }
}
