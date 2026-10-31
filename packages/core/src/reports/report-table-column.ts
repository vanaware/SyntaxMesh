/**
 * ReportTableColumn (Fase 14.7) — coluna de cabeçalho de uma ReportTable.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/ReportTableColumn.rb`.
 * O cabeçalho de cada coluna tem até duas células (`cell1` topo, obrigatória;
 * `cell2` base, opcional). Registra-se na tabela e na sua
 * `TableColumnDefinition`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.7)
 */
import type { XMLElementLike, } from "../richtext/xml-like.ts";
import { ReportTableCell, } from "./report-table-cell.ts";
import type { TableColumnDefinition, } from "./table-column-definition.ts";

/** Subconjunto de ReportTable usado pela coluna. */
export interface ColumnHost {
  addColumn(column: ReportTableColumn,): void;
}

export class ReportTableColumn {
  readonly table: ColumnHost;
  readonly definition: TableColumnDefinition | null;
  readonly cell1: ReportTableCell;
  readonly cell2: ReportTableCell;
  scrollbar = false;

  constructor(
    table: ColumnHost,
    definition: TableColumnDefinition | null,
    title: string,
  ) {
    this.table = table;
    // Registra a nova coluna na ReportTable.
    this.table.addColumn(this,);
    this.definition = definition;
    // Registra a coluna na TableColumnDefinition.
    if (definition) definition.column = this;

    // As duas células do cabeçalho.
    this.cell1 = new ReportTableCell(null, null, title, true,);
    this.cell1.padding = 5;
    this.cell2 = new ReportTableCell(null, null, "", true,);
    // Texto do cabeçalho é sempre negrito.
    this.cell1.bold = true;
    this.cell2.bold = true;
  }

  /** Largura mínima exigida (máxima das duas células; `null` se nenhuma). */
  minWidth(): number | null {
    let width = this.cell1.width;
    if (width === null) {
      width = this.cell2.width;
    } else if (this.cell2.width !== null && this.cell2.width > width) {
      width = this.cell2.width;
    }
    return width;
  }

  /** Célula de cabeçalho da linha `row` (1 = topo, 2 = base). */
  to_html(row: 1 | 2,): XMLElementLike | null {
    return row === 1 ? this.cell1.to_html() : this.cell2.to_html();
  }

  /** Apenas a primeira linha do cabeçalho entra no CSV. */
  to_csv(csv: unknown[][], startColumn: number,): number {
    return this.cell1.to_csv(csv, startColumn, 0,);
  }
}
