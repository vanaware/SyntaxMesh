/**
 * 14C.11.6 / 14C.11.7 — preço unitário efetivo e custo realizado nos
 * relatórios.
 *
 * Precedência (do mais específico ao mais geral): booking → alocação →
 * material. O `materialreport` expõe as três visões de custo:
 * `scheduledcost` (alocações), `actualcost` (bookings) e `totalcost`
 * (planejado + realizado / `CostEvent`).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §11.4
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Material, } from "../../src/model/material.ts";
import { Task, } from "../../src/model/task.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { MaterialBooking, } from "../../src/model/material-booking.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { MaterialListRE, } from "../../src/reports/material-list-re.ts";

const D = (s: string,): TjTime => TjTime.fromString(s,);

/** `materialreport` com as colunas de custo/quantidade. */
function makeReport(project: Project,): Report {
  const report = new Report(project, "mr", "mr.html", null,);
  report.typeSpec = "materialreport" as never;
  report.set("start", D("2026-01-01",),);
  report.set("end", D("2026-12-31",),);
  report.set("scenarios", [0,],);
  report.set("columns", [
    new TableColumnDefinition("no", "No.",),
    new TableColumnDefinition("totalquantity", "Total Quantity",),
    new TableColumnDefinition("scheduledcost", "Scheduled Cost",),
    new TableColumnDefinition("actualcost", "Actual Cost",),
    new TableColumnDefinition("totalcost", "Total Cost",),
  ],);
  project.reportContexts.push(new ReportContext(project, report,),);
  return report;
}

/** Primeira (e única) linha de dados do relatório. */
function firstRow(project: Project,): unknown[] {
  const re = new MaterialListRE(makeReport(project,),);
  re.generateIntermediateFormat();
  const csv = re.to_csv() as unknown[][];
  return csv[1]!;
}

describe("14C.11.6/11.7 custo de material nos relatórios", () => {
  let project: Project;
  let steel: Material;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    steel = new Material(project, "steel", "kg", 2,);
    steel.set("unit", "kg",);
    // O atributo canônico do bloque `unitprice` é `cost`.
    steel.set("cost", 2,);
    task = new Task(project, "t1", "T1", null,);
  },);

  it("14C.11.6: o preço da alocação precede o do material", () => {
    task.setForScenario(
      "materialallocations",
      [new MaterialAllocation(steel, 100, "distributed", undefined, 3.5,),],
      0,
    );
    // [no, totalquantity, scheduledcost, actualcost, totalcost]
    assertEquals(firstRow(project,), [1, 100, 350, 0, 350,],);
  });

  it("14C.11.7: o booking alimenta o custo realizado com o preço próprio", () => {
    // Sem alocação: a quantidade planejada é 0 e o custo planejado também.
    task.setForScenario(
      "materialbookings",
      [new MaterialBooking(steel, "t1", 40, D("2026-02-10",), 4.25, task,),],
      0,
    );
    assertEquals(firstRow(project,), [1, 0, 0, 170, 170,],);
  });

  it("14C.11.7: booking sem preço cai para a alocação, depois o material", () => {
    task.setForScenario(
      "materialallocations",
      [new MaterialAllocation(steel, 10, "distributed", undefined, 5,),],
      0,
    );
    task.setForScenario(
      "materialbookings",
      [
        // Sem preço próprio: herda 5 da alocação.
        new MaterialBooking(steel, "t1", 2, D("2026-02-10",), undefined, task,),
        // Sem alocação do material correspondente? Há uma, então herda 5.
        new MaterialBooking(steel, "t1", 4, D("2026-02-11",), undefined, task,),
      ],
      0,
    );
    // Planejado 10 × 5 = 50; realizado (2 + 4) × 5 = 30.
    assertEquals(firstRow(project,), [1, 10, 50, 30, 80,],);
  });
});
