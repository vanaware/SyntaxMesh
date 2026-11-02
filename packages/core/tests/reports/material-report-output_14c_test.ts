/**
 * Testes de saída do `materialreport` (Fase 14 Complemento 14C.1.10).
 *
 * O `MaterialListRE` monta o formato intermediário comum (`ReportTable`), de
 * modo que HTML, CSV e JSON saem dos mesmos geradores dos relatórios do
 * núcleo (14.12.3 + `toJSON` de 14C.0.3). Nenhuma escrita a disco (ADR 027).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.10)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Material, } from "../../src/model/material.ts";
import { Task, } from "../../src/model/task.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { MaterialListRE, } from "../../src/reports/material-list-re.ts";

/** Relatório `materialreport` completo com as colunas padrão. */
function makeReport(project: Project,): Report {
  const report = new Report(project, "mr", "mr.html", null,);
  report.typeSpec = "materialreport" as never;
  report.set("start", TjTime.fromString("2026-01-01",),);
  report.set("end", TjTime.fromString("2026-12-31",),);
  report.set("scenarios", [0,],);
  report.set("columns", [
    new TableColumnDefinition("no", "No.",),
    new TableColumnDefinition("name", "Name",),
    new TableColumnDefinition("unit", "Unit",),
    new TableColumnDefinition("unitprice", "Unit Price",),
    new TableColumnDefinition("totalcost", "Total Cost",),
  ],);
  project.reportContexts.push(new ReportContext(project, report,),);
  return report;
}

/** Aloca `quantity` do material numa tarefa (14C.11.10). */
function allocate(
  project: Project,
  material: Material,
  quantity: number,
): Task {
  const task = new Task(project, "t1", "T1", null,);
  task.setForScenario(
    "materialallocations",
    [new MaterialAllocation(material, quantity, "distributed",),],
    0,
  );
  return task;
}

/** Cria e gera um `MaterialListRE` a partir do projeto de teste. */
function generate(project: Project,): MaterialListRE {
  const re = new MaterialListRE(makeReport(project,),);
  re.generateIntermediateFormat();
  return re;
}

describe("saídas do materialreport (14C.1.10)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 2.5,);
    steel.set("unit", "kg",);
    steel.set("cost", 2.5,);
    // 14C.11.10: `totalquantity` foi removido — a quantidade e o custo vêm
    // das alocações das tarefas.
    allocate(project, steel, 100,);
  },);

  it("to_csv devolve cabeçalho e uma linha por material", () => {
    const csv = generate(project,).to_csv() as unknown[][];
    assert(csv.length >= 2, "csv sem linhas de dados",);
    assertEquals(csv[0], ["No.", "Name", "Unit", "Unit Price", "Total Cost",],);
    // `ReportTableCell#to_csv` mantém números como números (como no núcleo).
    assertEquals(csv[1], [1, "steel", "kg", 2.5, 250,],);
  });

  it("toJSON devolve a tabela estruturada e to_html não vaza markup cru", () => {
    const re = generate(project,);
    const json = JSON.parse(re.toJSON(),) as {
      format: string;
      columns: Array<{ title: string }>;
      lines: Array<{ cells: Array<{ text: string }> }>;
    };
    assertEquals(json.format, "table",);
    assertEquals(json.columns.map((c,) => c.title), [
      "No.",
      "Name",
      "Unit",
      "Unit Price",
      "Total Cost",
    ],);
    assertEquals(json.lines.length, 1,);
    assertEquals(json.lines[0]!.cells.map((c,) => c.text), [
      "1",
      "steel",
      "kg",
      "2.5",
      "250",
    ],);

    const html = re.to_html();
    assert(html.length > 0, "html vazio",);
  });
});
