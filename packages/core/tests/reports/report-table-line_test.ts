/**
 * Testes de ReportTableLine (Fase 14.8).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.8)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  type LineTable,
  ReportTableLine,
} from "../../src/reports/report-table-line.ts";
import { ReportTableCell, } from "../../src/reports/report-table-cell.ts";
import { type XMLElementLike, } from "../../src/richtext/xml-like.ts";

function fakeTable(
  overrides: Partial<LineTable> = {},
): LineTable & { lines: ReportTableLine[] } {
  const lines: ReportTableLine[] = [];
  return {
    lines,
    addLine(l: ReportTableLine,) {
      lines.push(l,);
    },
    maxIndent: 5,
    equiLines: false,
    selfcontained: false,
    auxDir: "./",
    ...overrides,
  };
}

describe("ReportTableLine (14.8)", () => {
  it("constructor registra na tabela com defaults", () => {
    const table = fakeTable();
    const line = new ReportTableLine(table, null, null,);
    assertEquals(table.lines.length, 1,);
    assertEquals(table.lines[0], line,);
    assertEquals(line.height, 21,);
    assertEquals(line.indentation, 0,);
    assertEquals(line.fontSize, 12,);
    assertEquals(line.bold, false,);
    assertEquals(line.no, null,);
    assertEquals(line.lineNo, null,);
    assertEquals(line.subLineNo, null,);
  });

  it("addCell acumula células", () => {
    const line = new ReportTableLine(fakeTable(), null, null,);
    new ReportTableCell(line, null, "A",);
    new ReportTableCell(line, null, "B",);
    assertEquals(line.cells.length, 2,);
  });

  it("last retorna última célula não oculta", () => {
    const line = new ReportTableLine(fakeTable(), null, null,);
    const a = new ReportTableCell(line, null, "A",);
    const b = new ReportTableCell(line, null, "B",);
    assertEquals(line.last(), b,);
    assertEquals(line.last(1,), a,);
  });

  it("last ignora células ocultas", () => {
    const line = new ReportTableLine(fakeTable(), null, null,);
    const a = new ReportTableCell(line, null, "A",);
    const b = new ReportTableCell(line, null, "B",);
    b.hidden = true;
    assertEquals(line.last(), a,);
  });

  it("last retorna null quando todas ocultas", () => {
    const line = new ReportTableLine(fakeTable(), null, null,);
    new ReportTableCell(line, null, "A",).hidden = true;
    assertEquals(line.last(), null,);
  });

  it("scopeProperty vem da scopeLine", () => {
    const table = fakeTable();
    const scope = new ReportTableLine(table, { name: "P", } as never, null,);
    const line = new ReportTableLine(table, null, scope,);
    assertEquals(line.scopeProperty(), scope.property,);
  });

  it("scopeProperty null em linha primária", () => {
    const line = new ReportTableLine(fakeTable(), null, null,);
    assertEquals(line.scopeProperty(), null,);
  });

  it("to_html gera tr.tabline com células", () => {
    const line = new ReportTableLine(fakeTable(), null, null,);
    new ReportTableCell(line, null, "Oi",);
    const tr = line.to_html() as XMLElementLike;
    assertEquals(tr.tag, "tr",);
    assertEquals(tr.attrs.class, "tabline",);
    assert(tr.toHTML().includes("Oi",),);
  });

  it("to_html com equiLines adiciona height", () => {
    const line = new ReportTableLine(
      fakeTable({ equiLines: true, },),
      null,
      null,
    );
    const tr = line.to_html() as XMLElementLike;
    assert(tr.attrs.style!.includes("height:21px",),);
  });

  it("to_csv preenche colunas e retorna contagem", () => {
    const line = new ReportTableLine(fakeTable(), null, null,);
    new ReportTableCell(line, null, "A",);
    new ReportTableCell(line, null, "B",);
    const csv: unknown[][] = [["", "", "",],];
    const cols = line.to_csv(csv, 1, 0,);
    assertEquals(cols, 2,);
    assertEquals(csv[0], ["", "A", "B",],);
  });
});
