/**
 * ColumnTable (Fase 14.13) — ReportTable embutível como coluna de outra tabela.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/ColumnTable.rb`. É um
 * wrapper sobre `ReportTable` que permite aninhar uma tabela dentro de uma
 * coluna de outra (as colunas de calendário `hourly`/`daily`/…). Ambas devem
 * ter o mesmo número de linhas.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.13)
 */
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { ReportTable, } from "./report-table.ts";

export class ColumnTable extends ReportTable {
  /** Largura (px) pedida pelo usuário para a coluna (gráfico/calendário). */
  viewWidth: number | null = null;

  constructor() {
    super();
    // O cabeçalho tem 2 linhas: usamos fonte menor (casa com GanttChart).
    this.headerFontSize = 10;
    // Esta é uma tabela embutida.
    this.embedded = true;
  }

  /**
   * `td` com `rowspan` que envolve uma `div` rolável contendo a tabela
   * aninhada (`super.to_html`).
   */
  override to_html(): XMLElementLike {
    let height = 2 * this.headerLineHeight + 1;
    for (const line of this.lines) {
      // Altura da linha + 1px de padding.
      height += line.height + 1;
    }

    // Não sabemos a largura final: sempre reservamos espaço para scrollbar.
    const td = new XMLElement("td", {
      rowspan: `${2 + this.lines.length + 1}`,
      style: "padding:0px; vertical-align:top;",
    },);

    const width = this.viewWidth !== null ? this.viewWidth : this.minWidth();
    const scrollDiv = new XMLElement("div", {
      class: "tabback",
      style: "position:relative; overflow:auto; " +
        `width:${width}px; ` +
        "margin-top:-1px; margin-bottom:-1px; " +
        `height:${height + ReportTable.SCROLLBARHEIGHT + 2}px;`,
    },);
    td.append(scrollDiv,);

    const contentDiv = new XMLElement("div", {
      style: "margin: 0px; padding: 0px; position: absolute; top: 0px;" +
        "left: 0px; " + `width: ${this.viewWidth}px; height: ${height}px; `,
    },);
    scrollDiv.append(contentDiv,);
    contentDiv.append(super.to_html(),);

    return td;
  }
}
