/**
 * 14C.0.3 — `TableReport.toJSON()`: serialização estável do formato
 * intermediário (colunas + linhas; calendário vira descritor; legenda fora).
 *
 * Estrutura documentada:
 * ```json
 * { "format": "table",
 *   "columns": [{ "id": "...", "title": "..." }],
 *   "lines":   [{ "indent": 0, "cells": [_descriptor | null] }] }
 * ```
 * Descritor de célula de texto: `{ text, indent, alignment, bold }`;
 * célula especial (calendário): `{ type: "calendar" }`; célula embutida
 * (PlaceHolderCell): `{ type: "embedded", indent, cells }`; oculta: `null`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Task, } from "../../src/model/task.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { ReportTable, } from "../../src/reports/report-table.ts";
import { ReportTableColumn, } from "../../src/reports/report-table-column.ts";
import { ReportTableLine, } from "../../src/reports/report-table-line.ts";
import { ReportTableCell, } from "../../src/reports/report-table-cell.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { TableReport, } from "../../src/reports/table-report.ts";

/** Subclasse que injeta a tabela (mesmo padrão de table-report_test.ts). */
class TestTableReport extends TableReport {
  setTable(t: ReportTable,): void {
    this.table = t;
  }
}

interface JsonCell {
  text?: string;
  type?: string;
  indent?: number;
  alignment?: string;
  bold?: boolean;
}
interface JsonOut {
  format: string;
  columns: Array<{ id: string; title: string }>;
  lines: Array<{ indent: number; cells: JsonCell[] }>;
}

describe("TableReport.toJSON (14C.0.3)", () => {
  let project: Project;
  let report: Report;
  let tr: TestTableReport;
  let table: ReportTable;
  let line: ReportTableLine;

  beforeEach(() => {
    project = createTestProject(2,);
    report = new Report(project, "r1", "r1.json", null,);
    project.reportContexts.push(new ReportContext(project, report,),);
    tr = new TestTableReport(report,);
    table = new ReportTable();
    // Coluna com id + título e linha com célula de texto.
    new ReportTableColumn(
      table,
      new TableColumnDefinition("name", undefined,),
      "Name",
    );
    line = new ReportTableLine(
      table,
      new Task(project, "t1", "T1", null,),
      null,
    );
    const cell = new ReportTableCell(line, null, "Alpha",);
    cell.alignment = "left";
  },);

  it("serializa colunas + linhas com célula de texto normalizado", () => {
    tr.setTable(table,);
    const out = JSON.parse(tr.toJSON(),) as JsonOut;
    assertEquals(out.format, "table",);
    assertEquals(out.columns, [{ id: "name", title: "Name", },],);
    assertEquals(out.lines.length, 1,);
    assertEquals(out.lines[0]!.cells[0], {
      text: "Alpha",
      indent: 0,
      alignment: "left",
      bold: false,
    },);
  });

  it("célula especial (calendário) vira descritor {type:'calendar'}", () => {
    tr.setTable(table,);
    const cal = new ReportTableCell(line, null, "",);
    cal.special = { to_html: () => null, to_csv: () => 0, };
    const out = JSON.parse(tr.toJSON(),) as JsonOut;
    assertEquals(out.lines[0]!.cells[1], { type: "calendar", },);
  });

  it("legenda não entra no JSON e célula oculta vira null", () => {
    tr.legend.addCalendarItem("My Legend Item", "legend_key",);
    const hidden = new ReportTableCell(line, null, "Secret",);
    hidden.hidden = true;
    tr.setTable(table,);
    const json = tr.toJSON();
    assertEquals(json.includes("legend_key",), false, json,);
    assertEquals(json.includes("My Legend Item",), false, json,);
    const out = JSON.parse(json,) as JsonOut;
    assertEquals(out.lines[0]!.cells[1], null,);
  });
});
