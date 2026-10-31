/**
 * ReportTableLine (Fase 14.8) — uma linha de uma ReportTable.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/ReportTableLine.rb`.
 * Registra-se na tabela, acumula células (`ReportTableCell`/`PlaceHolderCell`)
 * e renderiza `<tr>` / linhas de CSV.
 *
 * `LineTable` é uma interface estrutural (subconjunto de ReportTable, 14.6)
 * para quebrar o ciclo de import.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.8)
 */
import {
  SimpleXMLElement,
  type XMLElementLike,
} from "../richtext/xml-like.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { AnyTableCell, TableCellTable, } from "./report-table-cell.ts";

/** Subconjunto de ReportTable usado pela linha. */
export interface LineTable extends TableCellTable {
  addLine(line: ReportTableLine,): void;
}

export class ReportTableLine {
  readonly table: LineTable;
  readonly property: PropertyTreeNode | null;
  readonly scopeLine: ReportTableLine | null;
  readonly cells: AnyTableCell[] = [];

  height = 21;
  indentation = 0;
  fontSize = 12;
  bold = false;
  no: number | null = null;
  lineNo: number | null = null;
  subLineNo: number | null = null;

  constructor(
    table: LineTable,
    property: PropertyTreeNode | null,
    scopeLine: ReportTableLine | null,
  ) {
    this.table = table;
    this.property = property;
    this.scopeLine = scopeLine;
    // Registra a nova linha na tabela a que pertence.
    this.table.addLine(this,);
  }

  /**
   * Última célula não oculta, ignorando `count` células a partir do fim.
   * `PlaceHolderCell` nunca tem `hidden`, portanto é tratada como visível.
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

  /** Adiciona uma célula à linha. */
  addCell(cell: AnyTableCell,): void {
    this.cells.push(cell,);
  }

  /** Propriedade de escopo (da `scopeLine`) ou `null` se linha primária. */
  scopeProperty(): PropertyTreeNode | null {
    return this.scopeLine ? this.scopeLine.property : null;
  }

  /** Renderiza a linha como `<tr>` com as células visíveis. */
  to_html(): XMLElementLike {
    let style = "";
    if (this.table.equiLines) style += `height:${this.height}px; `;
    if (this.fontSize) style += `font-size:${this.fontSize}px; `;
    const tr = new SimpleXMLElement("tr", { class: "tabline", style, },);
    for (const cell of this.cells) {
      const el = cell.to_html();
      if (el) tr.append(el,);
    }
    return tr;
  }

  /** Converte a linha em entradas de valores no Array-of-Arrays do CSV. */
  to_csv(csv: unknown[][], startColumn: number, lineIdx: number,): number {
    let columnIdx = startColumn;
    for (const cell of this.cells) {
      columnIdx += cell.to_csv(csv, columnIdx, lineIdx,);
    }
    return columnIdx - startColumn;
  }
}
