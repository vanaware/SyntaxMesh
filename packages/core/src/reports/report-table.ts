/**
 * ReportTable (Fase 14.6) — formato intermediário de todas as tabelas de
 * relatório.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/ReportTable.rb`.
 * Colunas e linhas se auto-registram aqui via seus construtores. `to_html`
 * aplica a regra de cabeçalho: se **todas** as colunas têm `cell1.rows === 2`
 * (ou `special`), funde em um único cabeçalho; caso contrário, gera dois.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.6)
 */
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { markdownTable, markdownText, } from "./markdown.ts";
import type { ReportTableColumn, } from "./report-table-column.ts";
import type { ReportTableLine, } from "./report-table-line.ts";

export class ReportTable {
  /** Altura (px) de uma barra de rolagem horizontal em HTML. */
  static readonly SCROLLBARHEIGHT = 20;

  readonly headerLineHeight = 19;
  headerFontSize = 15;
  maxIndent = 0;
  equiLines = false;
  embedded = false;
  selfcontained = false;
  auxDir = "";

  protected columns: ReportTableColumn[] = [];
  protected lines: ReportTableLine[] = [];

  /** Deve ser chamado apenas pelo construtor de ReportTableColumn. */
  addColumn(col: ReportTableColumn,): void {
    this.columns.push(col,);
  }

  /** Deve ser chamado apenas pelo construtor de ReportTableLine. */
  addLine(line: ReportTableLine,): void {
    this.lines.push(line,);
  }

  /** Número de linhas registradas. */
  linesCount(): number {
    return this.lines.length;
  }

  /** Colunas registradas (leitura). */
  getColumns(): ReportTableColumn[] {
    return this.columns;
  }

  /** Linhas registradas (leitura). */
  getLines(): ReportTableLine[] {
    return this.lines;
  }

  /** Largura mínima exigida; sempre ≥ 1. */
  minWidth(): number {
    let width = 1;
    for (const column of this.columns) {
      const cw = column.minWidth();
      if (cw !== null) width += cw + 1;
    }
    return width;
  }

  /** Tabela em HTML. */
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

    // Regra de cabeçalho: todas as colunas têm 2 linhas (ou special)?
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

    // Restante da tabela.
    for (const line of this.lines) tbody.append(line.to_html(),);

    // Linha extra para colunas sem barra de rolagem.
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

  /** Tabela em Array-of-Arrays. Retorna `csv` ou contagem de colunas (embed). */
  to_csv(csv: unknown[][] = [[],], startColumn = 0,): unknown[][] | number {
    // Linha de cabeçalho.
    let columnIdx = startColumn;
    for (const col of this.columns) {
      columnIdx += col.to_csv(csv, columnIdx,);
    }

    if (this.embedded) {
      return columnIdx - startColumn;
    }

    // Conteúdo de tabelas embutidas é inserido ao gerar a Linha respectiva.
    let lineIdx = 1;
    for (const line of this.lines) {
      csv[lineIdx] = [];
      line.to_csv(csv, startColumn, lineIdx,);
      lineIdx++;
    }
    return csv;
  }

  /** Forma JSON intermediária (extensão SyntaxMesh — 14C.0.3): colunas + linhas. */
  toJSON(): { columns: unknown[]; lines: unknown[] } {
    return {
      columns: this.columns.map((col,) => col.toJSON()),
      lines: this.lines.map((line,) => line.toJSON()),
    };
  }

  /**
   * Tabela em Markdown (GFM) — extensão SyntaxMesh (adendo §10).
   *
   * O cabeçalho de uma coluna tem até duas células; como o Markdown só aceita
   * uma linha de cabeçalho, elas são unidas (`celula1 celula2`). A grade de
   * dados é a mesma do CSV (`to_csv`), que já resolve `colspan`/tabelas
   * embutidas.
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

  /** Maior indentação entre todas as linhas (modo árvore). */
  protected determineMaxIndents(): void {
    this.maxIndent = 0;
    for (const line of this.lines) {
      if (line.indentation > this.maxIndent) this.maxIndent = line.indentation;
    }
  }

  /** Alguma coluna possui barra de rolagem? */
  protected hasScrollbar(): boolean {
    for (const col of this.columns) {
      if (col.scrollbar) return true;
    }
    return false;
  }
}
