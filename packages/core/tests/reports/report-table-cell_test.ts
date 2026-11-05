/**
 * Testes de ReportTableCell + PlaceHolderCell (Fase 14.9).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.9)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  type AnyTableCell,
  PlaceHolderCell,
  ReportTableCell,
  type SpecialCell,
  type TableCellLine,
} from "../../src/reports/report-table-cell.ts";
import { XMLElement, } from "../../src/xml/xml-element.ts";
import type { XMLElementLike, } from "../../src/xml/xml-element-like.ts";
import { Query, } from "../../src/query/query.ts";

class TestCell extends ReportTableCell {
  calc(): { left: number; right: number } {
    this.calculateIndentation();
    return { left: this.leftIndent, right: this.rightIndent, };
  }
  style(): string {
    return this.cellStyle();
  }
  iconCell(cell: XMLElementLike,): XMLElementLike | null {
    return this.cellIcon(cell,);
  }
  label(): [XMLElementLike | null, unknown,] {
    return this.cellLabel();
  }
  short(t: string, w: number | null,): [string, boolean,] {
    return this.shortVersion(t, w,);
  }
  tip(tt: string, trig: XMLElement, hook?: XMLElementLike,): void {
    this.addHtmlTooltip(tt, trig, hook,);
  }
}

function fakeLine(
  table: Partial<TableCellLine["table"]> = {},
): TableCellLine & { cells: AnyTableCell[] } {
  const cells: AnyTableCell[] = [];
  return {
    cells,
    addCell(c: AnyTableCell,) {
      cells.push(c,);
    },
    height: 21,
    table: {
      maxIndent: 5,
      equiLines: false,
      selfcontained: false,
      auxDir: "./",
      ...table,
    },
  };
}

describe("ReportTableCell (14.9)", () => {
  describe("constructor", () => {
    it("defaults fiéis ao Ruby", () => {
      const c = new TestCell(null, null,);
      assertEquals(c.rows, 1,);
      assertEquals(c.columns, 1,);
      assertEquals(c.alignment, "center",);
      assertEquals(c.padding, 3,);
      assertEquals(c.category, null,);
      assertEquals(c.hidden, false,);
      assertEquals(c.bold, false,);
      assertEquals(c.text, "",);
      assertEquals(c.query, null,);
    });

    it("registra-se na linha (addCell)", () => {
      const line = fakeLine();
      const c = new TestCell(line, null, "X",);
      assertEquals(line.cells.length, 1,);
      assertEquals(line.cells[0], c,);
    });

    it("guarda headerCell", () => {
      const c = new TestCell(null, null, "X", true,);
      assertEquals(c.headerCell, true,);
    });

    it("dup do query quando fornecido", () => {
      const q = new Query({},);
      const c = new TestCell(null, q,);
      assert(c.query !== null,);
      assert(c.query !== q, "deve ser uma cópia",);
    });

    it("atribui texto string", () => {
      const c = new TestCell(null, null, "Olá",);
      assertEquals(c.text, "Olá",);
    });
  });

  describe("equals", () => {
    it("células idênticas são iguais", () => {
      const a = new TestCell(null, null, "X",);
      const b = new TestCell(null, null, "X",);
      assert(a.equals(b,),);
    });

    it("texto diferente → não iguais", () => {
      const a = new TestCell(null, null, "X",);
      const b = new TestCell(null, null, "Y",);
      assert(!a.equals(b,),);
    });

    it("alignment diferente → não iguais", () => {
      const a = new TestCell(null, null, "X",);
      const b = new TestCell(null, null, "X",);
      b.alignment = "left";
      assert(!a.equals(b,),);
    });

    it("cellColor diferente → não iguais", () => {
      const a = new TestCell(null, null, "X",);
      const b = new TestCell(null, null, "X",);
      b.cellColor = "red";
      assert(!a.equals(b,),);
    });

    it("category diferente → não iguais", () => {
      const a = new TestCell(null, null, "X",);
      const b = new TestCell(null, null, "X",);
      b.category = "foo";
      assert(!a.equals(b,),);
    });
  });

  describe("to_html", () => {
    it("hidden → null", () => {
      const c = new TestCell(null, null, "X",);
      c.hidden = true;
      assertEquals(c.to_html(), null,);
    });

    it("special → delega a renderização", () => {
      const special: SpecialCell = {
        to_html: () => new XMLElement("div", { class: "sp", },),
        to_csv: () => 1,
      };
      const c = new TestCell(null, null, "X",);
      c.special = special;
      const el = c.to_html() as XMLElementLike;
      assertEquals(el.attrs.class, "sp",);
    });

    it("classe default tabcell", () => {
      const c = new TestCell(null, null, "Oi",);
      const el = c.to_html() as XMLElementLike;
      assertEquals(el.attrs.class, "tabcell",);
      assert(el.toHTML().includes("Oi",),);
    });

    it("cellColor vira background-color no style", () => {
      const c = new TestCell(null, null, "Oi",);
      c.cellColor = "#ff0000";
      const el = c.to_html() as XMLElementLike;
      assert((el.attrs.style ?? "").includes("background-color: #ff0000",),);
    });

    it("rowspan/colspan quando > 1", () => {
      const c = new TestCell(null, null, "Oi",);
      c.rows = 2;
      c.columns = 3;
      const el = c.to_html() as XMLElementLike;
      assertEquals(el.attrs.rowspan, "2",);
      assertEquals(el.attrs.colspan, "3",);
    });

    it("indent à esquerda gera célula de padding", () => {
      const line = fakeLine();
      const c = new TestCell(line, null, "Oi",);
      c.alignment = "left";
      c.indent = 2;
      const html = (c.to_html() as XMLElementLike).toHTML();
      assert(html.includes("width:16px",), html,);
    });

    it("ícone gera img icons/<icon>.png", () => {
      const line = fakeLine();
      const c = new TestCell(line, null, "Oi",);
      c.icon = "flag-green";
      const html = (c.to_html() as XMLElementLike).toHTML();
      assert(html.includes("icons/flag-green.png",), html,);
    });

    it("tooltip adiciona hint details.png", () => {
      const line = fakeLine();
      const c = new TestCell(line, null, "Oi",);
      c.tooltip = "Detalhe";
      const html = (c.to_html() as XMLElementLike).toHTML();
      assert(html.includes("icons/details.png",), html,);
      assert(html.includes("tj_tooltip_box",), html,);
    });
  });

  describe("to_csv", () => {
    it("texto simples vai para a célula", () => {
      const c = new TestCell(null, null, "Oi",);
      const csv: unknown[][] = [["", "",], ["", "",],];
      const cols = c.to_csv(csv, 0, 1,);
      assertEquals(cols, 1,);
      assertEquals(csv[1]![0], "Oi",);
    });

    it("strToNative converte número", () => {
      const c = new TestCell(null, null, "42",);
      const csv: unknown[][] = [["",],];
      c.to_csv(csv, 0, 0,);
      assertEquals(csv[0]![0], 42,);
    });

    it("force_string preserva string", () => {
      const c = new TestCell(null, null, "42",);
      c.force_string = true;
      const csv: unknown[][] = [["",],];
      c.to_csv(csv, 0, 0,);
      assertEquals(csv[0]![0], "42",);
    });

    it("indentação esquerda prefixa espaços", () => {
      const c = new TestCell(null, null, "x",);
      c.alignment = "left";
      c.indent = 2;
      const csv: unknown[][] = [["",],];
      c.to_csv(csv, 0, 0,);
      assertEquals(csv[0]![0], "    x",);
    });

    it("special delega colunas", () => {
      const special: SpecialCell = {
        to_html: () => null,
        to_csv: (csv,) => {
          csv[0]![1] = "inner";
          return 2;
        },
      };
      const c = new TestCell(null, null, "X",);
      c.special = special;
      const csv: unknown[][] = [["", "",],];
      const cols = c.to_csv(csv, 0, 0,);
      assertEquals(cols, 2,);
      assertEquals(csv[0]![0], null,);
      assertEquals(csv[0]![1], "inner",);
    });
  });

  describe("helpers protegidos", () => {
    it("calculateIndentation à esquerda", () => {
      const c = new TestCell(fakeLine(), null,);
      c.alignment = "left";
      c.indent = 3;
      assertEquals(c.calc(), { left: 24, right: 0, },);
    });

    it("calculateIndentation à direita usa maxIndent", () => {
      const c = new TestCell(fakeLine({ maxIndent: 5, },), null,);
      c.alignment = "right";
      c.indent = 2;
      assertEquals(c.calc(), { left: 0, right: 24, },);
    });

    it("calculateIndentation central não indenta", () => {
      const c = new TestCell(fakeLine(), null,);
      c.alignment = "center";
      c.indent = 3;
      assertEquals(c.calc(), { left: 0, right: 0, },);
    });

    it("cellStyle inclui alinhamento", () => {
      const c = new TestCell(null, null,);
      c.alignment = "left";
      assertEquals(c.style(), "text-align:left; ",);
    });

    it("cellStyle com equiLines adiciona height", () => {
      const c = new TestCell(fakeLine({ equiLines: true, },), null,);
      c.alignment = "center";
      assert(c.style().includes("height:14px",),);
    });

    it("cellIcon null sem ícone", () => {
      const c = new TestCell(fakeLine(), null,);
      assertEquals(c.iconCell(new XMLElement("td",),), null,);
    });

    it("cellLabel null para texto vazio", () => {
      const c = new TestCell(null, null, "",);
      assertEquals(c.label()[0], null,);
    });

    it("shortVersion trunca multilinha", () => {
      const c = new TestCell(null, null,);
      assertEquals(c.short("abc\ndef", null,), ["abc...", false,],);
    });

    it("shortVersion limita por largura", () => {
      const c = new TestCell(null, null,);
      const [text, single,] = c.short("hello world", 30,);
      assertEquals(single, true,);
      assert(text.endsWith("...",),);
    });

    it("shortVersion mantém texto curto", () => {
      const c = new TestCell(null, null,);
      assertEquals(c.short("ok", null,), ["ok", true,],);
    });

    it("addHtmlTooltip seta onclick e box", () => {
      const c = new TestCell(null, null,);
      const trigger = new XMLElement("td",);
      c.tip("Tooltip", trigger,);
      assert((trigger.attrs.onclick ?? "").includes("TagToTip",),);
      assert(trigger.children.length >= 1,);
    });
  });

  describe("PlaceHolderCell", () => {
    it("registra-se na linha", () => {
      const line = fakeLine();
      const embedded = { to_csv: () => 1, };
      const p = new PlaceHolderCell(line, embedded,);
      assertEquals(line.cells.length, 1,);
      assertEquals(line.cells[0], p,);
    });

    it("to_html retorna null", () => {
      const p = new PlaceHolderCell(null, { to_csv: () => 0, },);
      assertEquals(p.to_html(), null,);
    });

    it("to_csv delega para embeddedLine", () => {
      let called = 0;
      const embedded = {
        to_csv(_csv: unknown[][], _c: number, _l: number,) {
          called++;
          return 7;
        },
      };
      const p = new PlaceHolderCell(null, embedded,);
      const cols = p.to_csv([["",],], 0, 0,);
      assertEquals(cols, 7,);
      assertEquals(called, 1,);
    });
  });
});
