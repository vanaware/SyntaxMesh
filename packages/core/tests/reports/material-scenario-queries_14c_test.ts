/**
 * Onda C (14-C) — paridade `MaterialScenario#query_*` ⇄ colunas do
 * materialreport.
 *
 * Sem oracle Ruby (Material é entidade nova), o BDD é a fonte de verdade: cada
 * consulta deve devolver exatamente o número da célula correspondente, no mesmo
 * período fechado `[start, end]`. Ambos os caminhos delegam à mesma fonte única
 * de verdade (`Material.*InPeriod`), então a paridade é estrutural — este teste
 * a prova ponta-a-ponta (gera a tabela E dispara a `Query`).
 *
 * Cenário (sem `CostEvent` — sem conta `aggregate materials`, para exercitar a
 * rota de alocações/bookings):
 *  - material `steel`, unitprice 10;
 *  - tarefa t1 (2026-02-01..2026-02-10, dentro do período): aloca 100, consome
 *    (booking com tarefa) 30;
 *  - estoque: +500 (2026-03-01) e -100 (2026-06-01).
 *  Esperado: alocado 100, consumido 30, restante 70; planejado 1000, realizado
 *  300, total 1300, restante-custo 1000; estoque 400 / 4000; unitprice 10.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Material, } from "../../src/model/material.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { MaterialBooking, } from "../../src/model/material-booking.ts";
import { Task, } from "../../src/model/task.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { MaterialListRE, } from "../../src/reports/material-list-re.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { Query, } from "../../src/query/query.ts";

const D = (s: string,) => TjTime.fromString(s,);

function fixture(): {
  project: Project;
  steel: Material;
  start: TjTime;
  end: TjTime;
} {
  const project = createTestProject(1,);
  const steel = new Material(project, "steel", "kg", 10,);
  const task = new Task(project, "t1", "T1", null,);
  task.setForScenario("start", D("2026-02-01",), 0,);
  task.setForScenario("end", D("2026-02-10",), 0,);
  task.setForScenario(
    "materialallocations",
    [new MaterialAllocation(steel, 100, "onstart",),],
    0,
  );
  task.setForScenario(
    "materialbookings",
    [new MaterialBooking(steel, "t1", 30, D("2026-02-05",), undefined, task,),],
    0,
  );
  steel.setForScenario(
    "stockbookings",
    [
      new MaterialBooking(steel, null, 500, D("2026-03-01",),),
      new MaterialBooking(steel, null, -100, D("2026-06-01",),),
    ],
    0,
  );
  return { project, steel, start: D("2026-01-01",), end: D("2026-12-31",), };
}

/** Gera o materialreport e devolve a primeira linha (sem cabeçalho). */
function reportRow(
  project: Project,
  steel: Material,
  columns: Array<[string, string,]>,
): unknown[] {
  const report = new Report(project, "mr", "mr", null,);
  report.typeSpec = "materialreport" as never;
  report.set("start", D("2026-01-01",),);
  report.set("end", D("2026-12-31",),);
  report.set("scenarios", [0,],);
  project.reportContexts.push(new ReportContext(project, report,),);
  report.set("columns", [
    new TableColumnDefinition("no", "No.",),
    ...columns.map(([id, title,],) => new TableColumnDefinition(id, title,)),
  ],);
  const re = new MaterialListRE(report,);
  re.generateIntermediateFormat();
  return (re.to_csv() as unknown[][])[1]!;
}

/** Dispara `query_<attributeId>` sobre o material no período dado. */
function queryNum(
  project: Project,
  steel: Material,
  attributeId: string,
  start: TjTime,
  end: TjTime,
): number | null {
  const q = new Query({
    project,
    property: steel,
    attributeId,
    scenarioIdx: 0,
    start,
    end,
  },);
  if (!q.process()) throw new Error(`${attributeId}: ${q.errorMessage}`,);
  return q.to_num();
}

describe("Onda C — paridade query_* ⇄ coluna do materialreport", () => {
  const cases: Array<
    { column: [string, string,]; query: string; expected: number }
  > = [
    { column: ["unitprice", "Unit Price",], query: "unitprice", expected: 10, },
    {
      column: ["totalquantity", "Total Quantity",],
      query: "effort",
      expected: 100,
    },
    {
      column: ["scheduledcost", "Scheduled Cost",],
      query: "scheduledcost",
      expected: 1000,
    },
    {
      column: ["actualcost", "Actual Cost",],
      query: "actualcost",
      expected: 300,
    },
    { column: ["totalcost", "Total Cost",], query: "cost", expected: 1300, },
    {
      column: ["stockquantity", "Stock Quantity",],
      query: "stockquantity",
      expected: 400,
    },
    {
      column: ["stockcost", "Stock Cost",],
      query: "stockcost",
      expected: 4000,
    },
  ];

  for (const { column, query, expected, } of cases) {
    it(`${query} == célula '${column[0]}' == ${expected}`, () => {
      const { project, steel, start, end, } = fixture();
      const row = reportRow(project, steel, [column,],);
      const cell = row[1]; // [no, <coluna>]
      assertEquals(Number(cell,), expected, `${column[0]} na tabela`,);
      assertEquals(
        queryNum(project, steel, query, start, end,),
        expected,
        `${query} na consulta`,
      );
    });
  }

  it("query_remaining / query_remainingcost (definição BDD, sem coluna)", () => {
    const { project, steel, start, end, } = fixture();
    // alocado 100 − consumido 30 = 70;  total 1300 − realizado 300 = 1000.
    assertEquals(queryNum(project, steel, "remaining", start, end,), 70,);
    assertEquals(queryNum(project, steel, "remainingcost", start, end,), 1000,);
  });

  it("recorte de período: consultas fora do intervalo devolvem 0", () => {
    const { project, steel, } = fixture();
    // Período anterior a todo movimento/alocação.
    const earlyStart = D("2025-01-01",);
    const earlyEnd = D("2025-12-31",);
    assertEquals(
      queryNum(project, steel, "stockquantity", earlyStart, earlyEnd,),
      0,
    );
    assertEquals(queryNum(project, steel, "effort", earlyStart, earlyEnd,), 0,);
  });
});
