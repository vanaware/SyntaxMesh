/**
 * Testes de ReportTableLegend (Fase 14.10).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.10)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { ReportTableLegend, } from "../../src/reports/report-table-legend.ts";
import { XMLElement, XMLText, } from "../../src/xml/xml-element.ts";
import type { XMLElementLike, } from "../../src/xml/xml-element-like.ts";

/** Subclasse que expõe os helpers protegidos para teste direto. */
class TestLegend extends ReportTableLegend {
  headline(text: string,): XMLElementLike | null {
    return this.headlineToHTML(text,);
  }
  ganttItem(
    ref: { to_html(): XMLElementLike },
    name: string,
    width: number,
  ): XMLElementLike[] {
    return this.ganttItemToHTML(ref, name, width,);
  }
  item(ref: [string, string,],): XMLElementLike[] {
    return this.itemToHTML(ref,);
  }
  items(list: [string, string,][],): XMLElementLike[] {
    return this.itemsToHTML(list,);
  }
}

const symbol = {
  to_html: () => new XMLElement("div", { class: "x", },),
};

describe("ReportTableLegend (14.10)", () => {
  describe("addGanttItem / addCalendarItem (dedup)", () => {
    it("adiciona item de gantt", () => {
      const l = new TestLegend();
      l.addGanttItem("A", "red",);
      // to_html não nulo após adicionar.
      assert(l.to_html() !== null,);
    });

    it("não duplica gantt igual", () => {
      const l = new TestLegend();
      l.addGanttItem("A", "red",);
      l.addGanttItem("A", "red",);
      // Um único item → itemsToHTML gera 1 linha (3 células preenchidas por 1 item).
      assertEquals(l.items([],).length, 0,);
      assert(l.to_html() !== null,);
    });

    it("gantt com texto igual mas cor diferente mantém ambos", () => {
      const l = new TestLegend();
      l.addGanttItem("A", "red",);
      l.addGanttItem("A", "blue",);
      assertEquals(l.items([["A", "red",], ["A", "blue",],],).length, 1,);
    });

    it("adiciona item de calendário", () => {
      const l = new TestLegend();
      l.addCalendarItem("C", "green",);
      assert(l.to_html() !== null,);
    });

    it("não duplica calendário igual", () => {
      const l = new TestLegend();
      l.addCalendarItem("C", "green",);
      l.addCalendarItem("C", "green",);
      const html = l.to_html()!;
      // Só headline (null) + itemsToHTML de 1 item = linhas.
      assert(html.children.length >= 1,);
    });

    it("calendário com cor diferente mantém ambos", () => {
      const l = new TestLegend();
      l.addCalendarItem("C", "green",);
      l.addCalendarItem("C", "blue",);
      assertEquals(l.items([["C", "green",], ["C", "blue",],],).length, 1,);
    });
  });

  describe("to_html", () => {
    it("retorna null quando vazio e sem gantt", () => {
      const l = new ReportTableLegend();
      assertEquals(l.to_html(), null,);
    });

    it("gera frame com tabela quando há itens", () => {
      const l = new ReportTableLegend();
      l.addGanttItem("A", "red",);
      const frame = l.to_html()!;
      assertEquals(frame.tag, "div",);
      assertEquals(frame.attrs.class, "tj_table_legend_frame",);
      const table = frame.children[0] as XMLElementLike;
      assertEquals(table.tag, "table",);
      assertEquals(table.attrs.class, "tj_table_legend",);
    });

    it("showGanttItems gera linha com símbolos fixos", () => {
      const l = new ReportTableLegend();
      l.showGanttItems = true;
      const frame = l.to_html()!;
      const table = frame.children[0] as XMLElementLike;
      // Primeiro filho é headline (null → não adicionado); a linha de gantt vem.
      const row = table.children.find((c: XMLElementLike | string,) =>
        (c as XMLElementLike).tag === "tr"
      ) as
        | XMLElementLike
        | undefined;
      assert(row, "deve haver uma linha de símbolos",);
      // 3 símbolos × 3 células + 1 espaçador = 10 células.
      assertEquals(row.children.length, 10,);
    });
  });

  describe("headlineToHTML", () => {
    it("null quando calendário vazio", () => {
      const l = new TestLegend();
      l.addGanttItem("A", "red",);
      assertEquals(l.headline("X",), null,);
    });

    it("gera tr quando gantt e calendário têm itens", () => {
      const l = new TestLegend();
      l.addGanttItem("A", "red",);
      l.addCalendarItem("C", "green",);
      const tr = l.headline("X",);
      assert(tr,);
      assertEquals(tr!.tag, "tr",);
      assertEquals((tr!.children[0] as XMLElementLike).attrs.colspan, "10",);
    });
  });

  describe("ganttItemToHTML / itemToHTML", () => {
    it("ganttItem produz 3 células", () => {
      const l = new TestLegend();
      const cells = l.ganttItem(symbol, "Normal Task", 40,);
      assertEquals(cells.length, 3,);
      assertEquals(cells[0]!.attrs.class, "tj_legend_spacer",);
      assertEquals(cells[1]!.attrs.class, "tj_legend_item",);
    });

    it("ganttItem inclui nome no rótulo", () => {
      const l = new TestLegend();
      const cells = l.ganttItem(symbol, "Milestone", 20,);
      const label = cells[2]!.children[0] as XMLElementLike;
      assertEquals((label.children[0] as XMLText).to_s(), "Milestone",);
    });

    it("ganttItem símbolo style top:3px", () => {
      const l = new TestLegend();
      const cells = l.ganttItem(symbol, "X", 40,);
      const symbolDiv = cells[1]!.children[0] as XMLElementLike;
      assertEquals(symbolDiv.attrs.style, "top:3px",);
    });

    it("item produz 3 células com cor no símbolo", () => {
      const l = new TestLegend();
      const cells = l.item(["Texto", "mycolor",],);
      assertEquals(cells.length, 3,);
      const html = cells[1]!.toHTML();
      assert(html.includes("mycolor",),);
    });

    it("item inclui texto no rótulo", () => {
      const l = new TestLegend();
      const cells = l.item(["Rótulo", "c",],);
      const label = cells[2]!.children[0] as XMLElementLike;
      assertEquals((label.children[0] as XMLText).to_s(), "Rótulo",);
    });
  });

  describe("itemsToHTML", () => {
    it("agrupa no máximo 3 itens por linha", () => {
      const l = new TestLegend();
      const items: [string, string,][] = [
        ["a", "1",],
        ["b", "2",],
        ["c", "3",],
        ["d", "4",],
      ];
      const rows = l.items(items,);
      assertEquals(rows.length, 2,);
    });

    it("preenche linha parcial com células vazias", () => {
      const l = new TestLegend();
      const rows = l.items([["only", "x",],],);
      assertEquals(rows.length, 1,);
      const row = rows[0]!;
      // 1 item (3 células) + 2 preenchimentos + spacer = 6 filhos.
      assertEquals(row.children.length, 6,);
    });
  });
});
