/**
 * Testes das colunas de material em tarefas (Fase 14 Complemento 14C.1.11).
 *
 * Um `taskreport` passa a expor `materials` (alocações da tarefa, no formato
 * `material (quantidade)`) e `materialcost` (soma dos `CostEvent` de material
 * da tarefa, com queda para `quantidade × preço`). O custo de material não é
 * booking de recurso, então nada muda em `resourcereport` (14C.1.15).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.11)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { Task, } from "../../src/model/task.ts";
import { Material, } from "../../src/model/material.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { CostEvent, } from "../../src/model/cost-event.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { TaskListRE, } from "../../src/reports/task-list-re.ts";
import type { ReportTableLine, } from "../../src/reports/report-table-line.ts";

const D = (s: string,) => TjTime.fromString(s,);

/** Relatório de tarefas com as colunas pedidas. */
function makeReport(
  project: Project,
  columns: TableColumnDefinition[],
): Report {
  const report = new Report(project, "tr", "tr.html", null,);
  report.typeSpec = ReportType.TaskReport;
  report.set("start", D("2026-01-01",),);
  report.set("end", D("2026-12-31",),);
  report.set("scenarios", [0,],);
  report.set("columns", columns,);
  project.reportContexts.push(new ReportContext(project, report,),);
  return report;
}

/** Texto plano de uma célula. */
function textOf(line: ReportTableLine, index: number,): string {
  const cell = line.cells[index] as unknown as { text?: unknown } | null;
  const text = cell?.text;
  if (text === null || text === undefined) return "";
  if (typeof text === "string") return text;
  const rti = text as { to_s?: () => string };
  return typeof rti.to_s === "function" ? rti.to_s() : String(text,);
}

/** Gera o taskreport e devolve a linha da tarefa `task`. */
function rowOf(project: Project, task: Task,): ReportTableLine {
  const re = new TaskListRE(
    makeReport(project, [
      new TableColumnDefinition("name", "Name",),
      new TableColumnDefinition("materials", "Materials",),
      new TableColumnDefinition("materialcost", "Material Cost",),
    ],),
  );
  re.generateIntermediateFormat();
  const line = re.getTable()!.getLines().find((l,) => l.property === task);
  assert(line, "linha da tarefa ausente",);
  return line!;
}

describe("colunas de material no taskreport (14C.1.11)", () => {
  let project: Project;
  let task: Task;
  let steel: Material;

  beforeEach(() => {
    project = createTestProject(1,);
    task = new Task(project, "t1", "T1", null,);
    steel = new Material(project, "steel", "kg", 2.5,);
    steel.set("unit", "kg",);
    steel.set("cost", 2.5,);
    steel.set("totalquantity", 100,);
  },);

  it("lista as alocações da tarefa no formato 'material (quantidade)'", () => {
    task.setForScenario(
      "materialallocations",
      [new MaterialAllocation(steel, 200, "distributed",),],
      0,
    );
    const line = rowOf(project, task,);
    assertEquals(textOf(line, 1,), "steel (200)",);
  });

  it("soma os CostEvent de material da tarefa", () => {
    task.setForScenario(
      "materialallocations",
      [new MaterialAllocation(steel, 200, "distributed",),],
      0,
    );
    project.costEvents.push(
      new CostEvent(
        "material_usage",
        125,
        null,
        "explicit",
        0,
        "planned",
        task,
        undefined,
        steel,
      ),
    );
    const line = rowOf(project, task,);
    assertEquals(textOf(line, 2,), "125",);
  });

  it("sem CostEvent, calcula quantidade × preço e tolera tarefa sem material", () => {
    task.setForScenario(
      "materialallocations",
      [new MaterialAllocation(steel, 40, "distributed",),],
      0,
    );
    const line = rowOf(project, task,);
    assertEquals(textOf(line, 2,), "100",);

    const empty = new Task(project, "t2", "T2", null,);
    const emptyLine = rowOf(project, empty,);
    assertEquals(textOf(emptyLine, 1,), "",);
    assertEquals(textOf(emptyLine, 2,), "0",);
  });
});
