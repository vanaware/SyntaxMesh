/**
 * TableColumnSorter (Fase 14.5) — reordena colunas de uma tabela segundo novos
 * cabeçalhos.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/TableColumnSorter.rb`. A
 * tabela é um array de linhas (cada linha um array); a primeira linha contém os
 * cabeçalhos. Colunas antigas ausentes dos novos cabeçalhos vão para o fim
 * (colunas descontinuadas); colunas novas são preenchidas com `null`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.5)
 */
export class TableColumnSorter {
  private readonly oldTable: unknown[][];
  /** Número de colunas descontinuadas; `null` até `sort` ser chamado. */
  discontinuedColumns: number | null;

  constructor(table: unknown[][],) {
    this.oldTable = table;
    this.discontinuedColumns = null;
  }

  /**
   * Reorganiza a tabela registrada. A tabela antiga não é modificada. Retorna a
   * nova tabela; as colunas antigas que não estão em `newHeaders` são anexadas
   * ao final.
   */
  sort(newHeaders: string[],): unknown[][] {
    // Mapeia índice antigo → índice novo.
    const columnIdxMap = new Map<number, number>();
    let newHeaderIndex = newHeaders.length;
    const oldHeaders = this.oldTable[0] as unknown[];
    const discontinuedHeaders: unknown[] = [];
    for (let i = 0; i < oldHeaders.length; i++) {
      const ni = newHeaders.findIndex((h,) => h === oldHeaders[i]);
      if (ni >= 0) {
        // Coluna antiga ainda presente nos novos cabeçalhos.
        columnIdxMap.set(i, ni,);
      } else {
        // Coluna descontinuada: anexada ao final.
        columnIdxMap.set(i, newHeaderIndex,);
        discontinuedHeaders.push(oldHeaders[i],);
        newHeaderIndex += 1;
      }
    }

    // Constrói uma nova tabela do zero, preenchendo com null.
    const newTable: unknown[][] = [];
    for (let lineIdx = 0; lineIdx < this.oldTable.length; lineIdx++) {
      const oldLine = this.oldTable[lineIdx]!;
      if (lineIdx === 0) {
        newTable[0] = [...newHeaders,];
      } else {
        newTable[lineIdx] = new Array(newHeaderIndex,).fill(null,);
      }
      const newLine = newTable[lineIdx]!;
      // Copia cada coluna antiga para a nova posição.
      for (const [oldColIdx, newColIdx,] of columnIdxMap) {
        newLine[newColIdx] = oldLine[oldColIdx];
      }
    }

    this.discontinuedColumns = discontinuedHeaders.length;
    return newTable;
  }
}
