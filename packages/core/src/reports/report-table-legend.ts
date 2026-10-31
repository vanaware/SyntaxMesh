/**
 * ReportTableLegend (Fase 14.10) — legenda independente de formato para o
 * ReportTable, listando símbolos gráficos usados na tabela.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/ReportTableLegend.rb`.
 * Os símbolos fixos de Gantt (`showGanttItems`) são placeholders até a Fase
 * 14.22 (ChartPlotter/Painter); a estrutura HTML já é a definitiva.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.10)
 */
import type { XMLElementLike, } from "../richtext/xml-like.ts";
import { SimpleXMLElement, } from "../richtext/xml-like.ts";

/** Par [texto, cor] armazenado para itens de Gantt/calendário. */
type LegendItem = [string, string,];

/** Símbolo fixo de Gantt; fornece sua representação HTML. */
interface LegendSymbol {
  to_html(): XMLElementLike;
}

/** Anexa cada nó (ou array de nós) pulando `null`. */
function appendNodes(
  parent: XMLElementLike,
  nodes: XMLElementLike | XMLElementLike[] | null,
): void {
  if (nodes === null) return;
  if (Array.isArray(nodes,)) {
    for (const n of nodes) parent.append(n,);
  } else {
    parent.append(nodes,);
  }
}

export class ReportTableLegend {
  showGanttItems = false;
  protected ganttItems: LegendItem[] = [];
  protected calendarItems: LegendItem[] = [];

  /** Adiciona um item de Gantt, sem duplicatas. */
  addGanttItem(text: string, color: string,): void {
    if (!this.ganttItems.some(([t, c,],) => t === text && c === color)) {
      this.ganttItems.push([text, color,],);
    }
  }

  /** Adiciona um item de calendário, sem duplicatas. */
  addCalendarItem(text: string, color: string,): void {
    if (!this.calendarItems.some(([t, c,],) => t === text && c === color)) {
      this.calendarItems.push([text, color,],);
    }
  }

  /** Converte a descrição abstrata em elementos HTML; `null` se vazia. */
  to_html(): XMLElementLike | null {
    if (
      !this.showGanttItems && this.ganttItems.length === 0 &&
      this.calendarItems.length === 0
    ) {
      return null;
    }

    const frame = new SimpleXMLElement("div", {
      class: "tj_table_legend_frame",
    },);
    const legend = new SimpleXMLElement("table", {
      class: "tj_table_legend",
      cellspacing: "1",
    },);
    frame.append(legend,);

    appendNodes(legend, this.headlineToHTML("Gantt Chart Symbols:",),);

    if (this.showGanttItems) {
      const row = new SimpleXMLElement("tr", { class: "tj_legend_row", },);
      appendNodes(
        row,
        this.ganttItemToHTML(
          placeholderSymbol("tj_gantt_container",),
          "Container Task",
          40,
        ),
      );
      appendNodes(
        row,
        this.ganttItemToHTML(
          placeholderSymbol("tj_gantt_taskbar",),
          "Normal Task",
          40,
        ),
      );
      appendNodes(
        row,
        this.ganttItemToHTML(
          placeholderSymbol("tj_gantt_milestone",),
          "Milestone",
          20,
        ),
      );
      row.append(new SimpleXMLElement("td", { class: "tj_legend_spacer", },),);
      legend.append(row,);
    }

    appendNodes(legend, this.itemsToHTML(this.ganttItems,),);

    appendNodes(legend, this.headlineToHTML("Calendar Symbols:",),);
    appendNodes(legend, this.itemsToHTML(this.calendarItems,),);

    return frame;
  }

  /**
   * Headline só quando Gantt e calendário coexistem (mesmas cores, significados
   * diferentes). Caso contrário, `null`.
   */
  protected headlineToHTML(text: string,): XMLElementLike | null {
    if (this.calendarItems.length === 0 || this.ganttItems.length === 0) {
      return null;
    }
    const tr = new SimpleXMLElement("tr", { class: "tj_legend_headline", },);
    const td = new SimpleXMLElement("td", { colspan: "10", },);
    td.append(text,);
    tr.append(td,);
    return tr;
  }

  /** Símbolo fixo de Gantt → células [espaçador, símbolo, rótulo]. */
  protected ganttItemToHTML(
    itemRef: LegendSymbol,
    name: string,
    _width: number,
  ): XMLElementLike[] {
    const cells: XMLElementLike[] = [];
    cells.push(new SimpleXMLElement("td", { class: "tj_legend_spacer", },),);

    const symbolTd = new SimpleXMLElement("td", { class: "tj_legend_item", },);
    const symbol = new SimpleXMLElement("div", {
      class: "tj_legend_symbol",
      style: "top:3px",
    },);
    symbol.append(itemRef.to_html(),);
    symbolTd.append(symbol,);
    cells.push(symbolTd,);

    const labelTd = new SimpleXMLElement("td", { class: "tj_legend_item", },);
    const label = new SimpleXMLElement("div", { class: "tj_legend_label", },);
    label.append(name,);
    labelTd.append(label,);
    cells.push(labelTd,);

    return cells;
  }

  /** Item colorido [texto, cor] → células [espaçador, símbolo, rótulo]. */
  protected itemToHTML(itemRef: LegendItem,): XMLElementLike[] {
    const cells: XMLElementLike[] = [];
    cells.push(new SimpleXMLElement("td", { class: "tj_legend_spacer", },),);

    const symbolTd = new SimpleXMLElement("td", { class: "tj_legend_item", },);
    const symbol = new SimpleXMLElement("div", { class: "tj_legend_symbol", },);
    const box = new SimpleXMLElement("div", {
      style: "position:relative; top:2px;width:20px; height:15px",
    },);
    const frame = new SimpleXMLElement("div", {
      class: "loadstackframe",
      style: "position:absolute; left:5px; width:16px; height:15px;",
    },);
    frame.append(
      new SimpleXMLElement("div", {
        class: itemRef[1],
        style: "position:absolute; left:1px; top:1px; width:14px; height:13px;",
      },),
    );
    box.append(frame,);
    symbol.append(box,);
    symbolTd.append(symbol,);
    cells.push(symbolTd,);

    const labelTd = new SimpleXMLElement("td", { class: "tj_legend_item", },);
    const label = new SimpleXMLElement("div", { class: "tj_legend_label", },);
    label.append(itemRef[0],);
    labelTd.append(label,);
    cells.push(labelTd,);

    return cells;
  }

  /** Organiza itens em linhas de no máximo 3 colunas. */
  protected itemsToHTML(items: LegendItem[],): XMLElementLike[] {
    const rows: XMLElementLike[] = [];
    let row: XMLElementLike | null = null;
    const gridCells =
      (Math.floor(items.length / 3,) + (items.length % 3 !== 0 ? 1 : 0)) * 3;

    for (let i = 0; i < gridCells; i++) {
      if (i % 3 === 0) {
        row = new SimpleXMLElement("tr", { class: "tj_legend_row", },);
        rows.push(row,);
      }
      if (!row) continue;
      if (i < items.length) {
        appendNodes(row, this.itemToHTML(items[i]!,),);
      } else {
        row.append(
          new SimpleXMLElement("td", {
            class: "tj_legend_item",
            colspan: "3",
          },),
        );
      }
      if ((i + 1) % 3 === 0) {
        row.append(
          new SimpleXMLElement("td", { class: "tj_legend_spacer", },),
        );
      }
    }
    return rows;
  }
}

/** Símbolo placeholder (substituído pelo Painter na Fase 14.22). */
function placeholderSymbol(cls: string,): LegendSymbol {
  return { to_html: () => new SimpleXMLElement("div", { class: cls, },), };
}
