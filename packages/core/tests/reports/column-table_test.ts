/**
 * Testes de ColumnTable (Fase 14.13).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.13)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { ColumnTable, } from "../../src/reports/column-table.ts";
import { ReportTableColumn, } from "../../src/reports/report-table-column.ts";
import { ReportTableLine, } from "../../src/reports/report-table-line.ts";
import { ReportTableCell, } from "../../src/reports/report-table-cell.ts";

describe("ColumnTable (14.13)", () => {
  it("construtor define fonte menor e embedded", () => {
    const t = new ColumnTable();
    assertEquals(t.headerFontSize, 10,);
    assertEquals(t.embedded, true,);
    assertEquals(t.viewWidth, null,);
  });

  it("é uma ReportTable (herda minWidth/addColumn)", () => {
    const t = new ColumnTable();
    assertEquals(t.minWidth(), 1,);
    new ReportTableColumn(t, null, "A",);
    assertEquals(t.minWidth(), 1,);
  });

  it("to_html: td com rowspan = 2 + linhas + 1", () => {
    const t = new ColumnTable();
    new ReportTableLine(t, null, null,);
    new ReportTableLine(t, null, null,);
    const html = t.to_html().toHTML();
    assert(html.includes('rowspan="5"',), html,);
  });

  it("to_html: usa viewWidth quando definido", () => {
    const t = new ColumnTable();
    t.viewWidth = 500;
    const html = t.to_html().toHTML();
    assert(html.includes("width:500px",), html,);
  });

  it("to_html: embute a tabela interna (super.to_html)", () => {
    const t = new ColumnTable();
    const line = new ReportTableLine(t, null, null,);
    new ReportTableCell(line, null, "cel",);
    const html = t.to_html().toHTML();
    // Moldura tabback + tabela aninhada tj_table.
    assert(html.includes("tabback",), html,);
    assert(html.includes("cel",), html,);
  });

  it("embedded é true (herança de comportamento de CSV embed)", () => {
    const t = new ColumnTable();
    new ReportTableColumn(t, null, "A",);
    const cols = t.to_csv([[],], 0,);
    assertEquals(cols, 1,);
  });
});
