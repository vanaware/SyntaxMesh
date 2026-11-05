/**
 * Testes de ReportTableColumn (Fase 14.7).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.7)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  type ColumnHost,
  ReportTableColumn,
} from "../../src/reports/report-table-column.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import type { XMLElementLike, } from "../../src/xml/xml-element-like.ts";

function fakeTable(): ColumnHost & { columns: ReportTableColumn[] } {
  const columns: ReportTableColumn[] = [];
  return {
    columns,
    addColumn(c: ReportTableColumn,) {
      columns.push(c,);
    },
  };
}

describe("ReportTableColumn (14.7)", () => {
  it("constructor registra na tabela e cria cabeçalho", () => {
    const table = fakeTable();
    const col = new ReportTableColumn(table, null, "Title",);
    assertEquals(table.columns.length, 1,);
    assertEquals(table.columns[0], col,);
    assertEquals(col.definition, null,);
    assertEquals(col.scrollbar, false,);
  });

  it("cell1 tem título, padding 5 e bold", () => {
    const col = new ReportTableColumn(fakeTable(), null, "Title",);
    assertEquals(col.cell1.text, "Title",);
    assertEquals(col.cell1.padding, 5,);
    assertEquals(col.cell1.bold, true,);
    assertEquals(col.cell1.headerCell, true,);
  });

  it("cell2 é vazio e bold, padding default", () => {
    const col = new ReportTableColumn(fakeTable(), null, "Title",);
    assertEquals(col.cell2.text, "",);
    assertEquals(col.cell2.bold, true,);
    assertEquals(col.cell2.padding, 3,);
  });

  it("registra coluna na definition", () => {
    const def = new TableColumnDefinition("c1", "T",);
    const col = new ReportTableColumn(fakeTable(), def, "T",);
    assertEquals(def.column, col,);
  });

  it("minWidth null quando nenhuma largura", () => {
    const col = new ReportTableColumn(fakeTable(), null, "T",);
    assertEquals(col.minWidth(), null,);
  });

  it("minWidth pega maior das duas", () => {
    const col = new ReportTableColumn(fakeTable(), null, "T",);
    col.cell1.width = 10;
    col.cell2.width = 20;
    assertEquals(col.minWidth(), 20,);
  });

  it("minWidth usa cell2 se cell1 nulo", () => {
    const col = new ReportTableColumn(fakeTable(), null, "T",);
    col.cell2.width = 8;
    assertEquals(col.minWidth(), 8,);
  });

  it("to_html(1) retorna célula de topo com título", () => {
    const col = new ReportTableColumn(fakeTable(), null, "Topo",);
    const el = col.to_html(1,) as XMLElementLike;
    assert(el.toHTML().includes("Topo",),);
  });

  it("to_html(2) retorna célula de base sem título", () => {
    const col = new ReportTableColumn(fakeTable(), null, "Topo",);
    const el = col.to_html(2,) as XMLElementLike;
    assert(!el.toHTML().includes("Topo",),);
  });

  it("to_csv escreve cabeçalho na linha 0", () => {
    const col = new ReportTableColumn(fakeTable(), null, "H",);
    const csv: unknown[][] = [["",],];
    const cols = col.to_csv(csv, 0,);
    assertEquals(cols, 1,);
    assertEquals(csv[0]![0], "H",);
  });
});
