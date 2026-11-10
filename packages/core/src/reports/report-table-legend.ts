/**
 * ReportTableLegend (phase 14.10) — format-independent legend for `ReportTable`,
 * listing the graphical symbols used by the table.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/ReportTableLegend.rb`. The fixed
 * Gantt symbols (`showGanttItems`) are placeholders until phase 14.22
 * (ChartPlotter/Painter); the HTML structure is already final.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.10)
 */
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { XMLElement, } from "../xml/xml-element.ts";

/** `[text, color]` pair stored for Gantt/calendar items. */
export type LegendItem = [string, string,];

/** Fixed Gantt symbol; provides its HTML representation. */
export interface LegendSymbol {
  /** Renders the symbol as an HTML fragment reference. */
  to_html(): XMLElementLike;
}

/** Appends each node (or array of nodes), skipping `null`. */
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

/**
 * The symbol legend shown under a report table.
 *
 * Gantt items are the fixed symbols of the chart, calendar items are the
 * `[text, color]` pairs collected while the table is built.
 */
export class ReportTableLegend {
  /** Shows the three fixed Gantt symbols (container, task bar, milestone). */
  showGanttItems = false;
  /** Gantt symbols collected by the report. */
  protected ganttItems: LegendItem[] = [];
  /** Calendar symbols collected by the report. */
  protected calendarItems: LegendItem[] = [];

  /**
   * Adds a Gantt item, ignoring duplicates.
   *
   * @param text Label shown next to the symbol.
   * @param color CSS class of the colored box.
   */
  addGanttItem(text: string, color: string,): void {
    if (!this.ganttItems.some(([t, c,],) => t === text && c === color)) {
      this.ganttItems.push([text, color,],);
    }
  }

  /**
   * Adds a calendar item, ignoring duplicates.
   *
   * @param text Label shown next to the symbol.
   * @param color CSS class of the colored box.
   */
  addCalendarItem(text: string, color: string,): void {
    if (!this.calendarItems.some(([t, c,],) => t === text && c === color)) {
      this.calendarItems.push([text, color,],);
    }
  }

  /** Renders the abstract description as HTML; `null` when it is empty. */
  to_html(): XMLElementLike | null {
    if (
      !this.showGanttItems && this.ganttItems.length === 0 &&
      this.calendarItems.length === 0
    ) {
      return null;
    }

    const frame = new XMLElement("div", {
      class: "tj_table_legend_frame",
    },);
    const legend = new XMLElement("table", {
      class: "tj_table_legend",
      cellspacing: "1",
    },);
    frame.append(legend,);

    appendNodes(legend, this.headlineToHTML("Gantt Chart Symbols:",),);

    if (this.showGanttItems) {
      const row = new XMLElement("tr", { class: "tj_legend_row", },);
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
      row.append(new XMLElement("td", { class: "tj_legend_spacer", },),);
      legend.append(row,);
    }

    appendNodes(legend, this.itemsToHTML(this.ganttItems,),);

    appendNodes(legend, this.headlineToHTML("Calendar Symbols:",),);
    appendNodes(legend, this.itemsToHTML(this.calendarItems,),);

    return frame;
  }

  /**
   * Headline emitted only when Gantt and calendar items coexist (same colors,
   * different meanings). Otherwise `null`.
   *
   * @param text Headline text.
   */
  protected headlineToHTML(text: string,): XMLElementLike | null {
    if (this.calendarItems.length === 0 || this.ganttItems.length === 0) {
      return null;
    }
    const tr = new XMLElement("tr", { class: "tj_legend_headline", },);
    const td = new XMLElement("td", { colspan: "10", },);
    td.append(text,);
    tr.append(td,);
    return tr;
  }

  /** Fixed Gantt symbol → cells [spacer, symbol, label]. */
  protected ganttItemToHTML(
    itemRef: LegendSymbol,
    name: string,
    _width: number,
  ): XMLElementLike[] {
    const cells: XMLElementLike[] = [];
    cells.push(new XMLElement("td", { class: "tj_legend_spacer", },),);

    const symbolTd = new XMLElement("td", { class: "tj_legend_item", },);
    const symbol = new XMLElement("div", {
      class: "tj_legend_symbol",
      style: "top:3px",
    },);
    symbol.append(itemRef.to_html(),);
    symbolTd.append(symbol,);
    cells.push(symbolTd,);

    const labelTd = new XMLElement("td", { class: "tj_legend_item", },);
    const label = new XMLElement("div", { class: "tj_legend_label", },);
    label.append(name,);
    labelTd.append(label,);
    cells.push(labelTd,);

    return cells;
  }

  /** Colored item [text, color] → cells [spacer, symbol, label]. */
  protected itemToHTML(itemRef: LegendItem,): XMLElementLike[] {
    const cells: XMLElementLike[] = [];
    cells.push(new XMLElement("td", { class: "tj_legend_spacer", },),);

    const symbolTd = new XMLElement("td", { class: "tj_legend_item", },);
    const symbol = new XMLElement("div", { class: "tj_legend_symbol", },);
    const box = new XMLElement("div", {
      style: "position:relative; top:2px;width:20px; height:15px",
    },);
    const frame = new XMLElement("div", {
      class: "loadstackframe",
      style: "position:absolute; left:5px; width:16px; height:15px;",
    },);
    frame.append(
      new XMLElement("div", {
        class: itemRef[1],
        style: "position:absolute; left:1px; top:1px; width:14px; height:13px;",
      },),
    );
    box.append(frame,);
    symbol.append(box,);
    symbolTd.append(symbol,);
    cells.push(symbolTd,);

    const labelTd = new XMLElement("td", { class: "tj_legend_item", },);
    const label = new XMLElement("div", { class: "tj_legend_label", },);
    label.append(itemRef[0],);
    labelTd.append(label,);
    cells.push(labelTd,);

    return cells;
  }

  /** Arranges items into rows of at most 3 columns. */
  protected itemsToHTML(items: LegendItem[],): XMLElementLike[] {
    const rows: XMLElementLike[] = [];
    let row: XMLElementLike | null = null;
    const gridCells =
      (Math.floor(items.length / 3,) + (items.length % 3 !== 0 ? 1 : 0)) * 3;

    for (let i = 0; i < gridCells; i++) {
      if (i % 3 === 0) {
        row = new XMLElement("tr", { class: "tj_legend_row", },);
        rows.push(row,);
      }
      if (!row) continue;
      if (i < items.length) {
        appendNodes(row, this.itemToHTML(items[i]!,),);
      } else {
        row.append(
          new XMLElement("td", {
            class: "tj_legend_item",
            colspan: "3",
          },),
        );
      }
      if ((i + 1) % 3 === 0) {
        row.append(
          new XMLElement("td", { class: "tj_legend_spacer", },),
        );
      }
    }
    return rows;
  }
}

/** Placeholder symbol (replaced by the Painter in phase 14.22). */
function placeholderSymbol(cls: string,): LegendSymbol {
  return { to_html: () => new XMLElement("div", { class: cls, },), };
}
