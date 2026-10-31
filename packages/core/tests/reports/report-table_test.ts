/**
 * Testes de ReportTable (Fase 14.6).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.6)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { ReportTable, } from "../../src/reports/report-table.ts";
import { ReportTableColumn, } from "../../src/reports/report-table-column.ts";
import { ReportTableLine, } from "../../src/reports/report-table-line.ts";
import { ReportTableCell, } from "../../src/reports/report-table-cell.ts";
import { SimpleXMLElement, } from "../../src/richtext/xml-like.ts";

/** Subclasse de teste: expõe membros privados/protegidos de ReportTable. */
class TestTable extends ReportTable {
  override determineMaxIndents(): void {
    super.determineMaxIndents();
  }

  override hasScrollbar(): boolean {
    return super.hasScrollbar();
  }

  /** Acesso aos arrays privados (mesma classe base da subclasse TS). */
  colList(): ReportTableColumn[] {
    return (this as unknown as { columns: ReportTableColumn[] }).columns;
  }

  lineList(): ReportTableLine[] {
    return (this as unknown as { lines: ReportTableLine[] }).lines;
  }
}

describe("ReportTable (14.6)", () => {
  it("defaults da tabela", () => {
    const t = new TestTable();
    assertEquals(t.headerLineHeight, 19,);
    assertEquals(t.headerFontSize, 15,);
    assertEquals(t.maxIndent, 0,);
    assertEquals(t.equiLines, false,);
    assertEquals(t.embedded, false,);
    assertEquals(t.selfcontained, false,);
    assertEquals(t.auxDir, "",);
    assertEquals(ReportTable.SCROLLBARHEIGHT, 20,);
  });

  it("addColumn registra coluna vinda do construtor", () => {
    const t = new TestTable();
    const col = new ReportTableColumn(t, null, "A",);
    assertEquals(t.colList().length, 1,);
    assertEquals(t.colList()[0], col,);
  });

  it("addLine registra linha vinda do construtor", () => {
    const t = new TestTable();
    const line = new ReportTableLine(t, null, null,);
    assertEquals(t.lineList().length, 1,);
    assertEquals(t.linesCount(), 1,);
    assertEquals(t.lineList()[0], line,);
  });

  it("minWidth: 1 sem colunas", () => {
    assertEquals(new TestTable().minWidth(), 1,);
  });

  it("minWidth: soma (cw + 1) das colunas com largura", () => {
    const t = new TestTable();
    const c1 = new ReportTableColumn(t, null, "A",);
    c1.cell1.width = 10;
    const c2 = new ReportTableColumn(t, null, "B",);
    c2.cell2.width = 20;
    // Sem largura: não contribui.
    new ReportTableColumn(t, null, "C",);
    // 1 + (10+1) + (20+1)
    assertEquals(t.minWidth(), 33,);
  });

  it("determineMaxIndents pega maior indentação", () => {
    const t = new TestTable();
    const l1 = new ReportTableLine(t, null, null,);
    l1.indentation = 2;
    const l2 = new ReportTableLine(t, null, null,);
    l2.indentation = 5;
    t.determineMaxIndents();
    assertEquals(t.maxIndent, 5,);
  });

  it("hasScrollbar detecta colunas com scrollbar", () => {
    const t = new TestTable();
    assertEquals(t.hasScrollbar(), false,);
    const col = new ReportTableColumn(t, null, "A",);
    assertEquals(t.hasScrollbar(), false,);
    col.scrollbar = true;
    assertEquals(t.hasScrollbar(), true,);
  });

  it("to_html: cabeçalho de duas linhas por padrão", () => {
    const t = new TestTable();
    new ReportTableColumn(t, null, "Top",);
    const html = t.to_html().toHTML();
    assert(html.includes("tj_table",), html,);
    assertEquals(html.split("tabhead",).length - 1, 2,);
    assert(html.includes("Top",), html,);
  });

  it("to_html: funde cabeçalho quando todas as colunas têm 2 rows", () => {
    const t = new TestTable();
    const c1 = new ReportTableColumn(t, null, "A",);
    c1.cell1.rows = 2;
    const c2 = new ReportTableColumn(t, null, "B",);
    c2.cell1.rows = 2;
    const html = t.to_html().toHTML();
    assertEquals(html.split("tabhead",).length - 1, 1,);
    // lineHeight = 19*2+1 e rows reiniciado para 1.
    assert(html.includes("height:39px",), html,);
    assertEquals(c1.cell1.rows, 1,);
  });

  it("to_html: coluna special conta para fusão do cabeçalho", () => {
    const t = new TestTable();
    const c1 = new ReportTableColumn(t, null, "A",);
    c1.cell1.rows = 2;
    const c2 = new ReportTableColumn(t, null, "B",);
    c2.cell1.special = {
      to_html: () => new SimpleXMLElement("td",),
      to_csv: () => 1,
    };
    const html = t.to_html().toHTML();
    assertEquals(html.split("tabhead",).length - 1, 1,);
  });

  it("to_html: linha extra de scrollbar com td vazio", () => {
    const t = new TestTable();
    const c1 = new ReportTableColumn(t, null, "A",);
    const c2 = new ReportTableColumn(t, null, "B",);
    c2.scrollbar = true;
    const html = t.to_html().toHTML();
    assert(html.includes(`height:${ReportTable.SCROLLBARHEIGHT}px`,), html,);
    // Apenas a coluna sem scrollbar ganha td vazio na linha extra.
    const emptyTds = html.match(/<td><\/td>/g,) ?? [];
    assertEquals(emptyTds.length, 1,);
  });

  it("to_html: estilo width:100% quando embedded", () => {
    const t = new TestTable();
    t.embedded = true;
    const html = t.to_html().toHTML();
    assert(html.includes("width:100%",), html,);
  });

  it("to_html: renderiza linhas do corpo", () => {
    const t = new TestTable();
    const line = new ReportTableLine(t, null, null,);
    new ReportTableCell(line, null, "celula",);
    const html = t.to_html().toHTML();
    assert(html.includes("tabline",), html,);
    assert(html.includes("celula",), html,);
  });

  it("to_csv: cabeçalho + linhas do corpo", () => {
    const t = new TestTable();
    new ReportTableColumn(t, null, "H1",);
    new ReportTableColumn(t, null, "H2",);
    const line = new ReportTableLine(t, null, null,);
    new ReportTableCell(line, null, "abc",);
    new ReportTableCell(line, null, "def",);
    const csv = t.to_csv() as unknown[][];
    assertEquals(csv[0], ["H1", "H2",],);
    assertEquals(csv[1], ["abc", "def",],);
  });

  it("to_csv: startColumn desloca escrita", () => {
    const t = new TestTable();
    new ReportTableColumn(t, null, "H",);
    const line = new ReportTableLine(t, null, null,);
    new ReportTableCell(line, null, "v",);
    const csv: unknown[][] = [["pre",],];
    const out = t.to_csv(csv, 1,) as unknown[][];
    assertEquals(out[0], ["pre", "H",],);
    assertEquals(out[1]?.length, 2,);
    assertEquals(out[1]![1], "v",);
  });

  it("to_csv: embedded retorna contagem de colunas", () => {
    const t = new TestTable();
    new ReportTableColumn(t, null, "A",);
    new ReportTableColumn(t, null, "B",);
    t.embedded = true;
    const count = t.to_csv([[],], 2,);
    assertEquals(count, 2,);
  });
});
