/**
 * C18 (Adendo Extra §13.7) — colunas `stockquantity`/`stockcost`.
 *
 * Σ algébrico dos bookings de **estoque** do material (movimentos **sem**
 * tarefa, 14C.13.1) recortados pelo período do relatório: entrada positiva,
 * saída/estorno negativa. Mesma família do 14C.1.19 (material nos conteúdos
 * de relatório), resolvida em `TableReport.genMaterialCell` — portanto
 * disponível a todo conteúdo de tabela que lista materiais.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §13.1, §14
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { Report, } from "../../src/model/report.ts";
import type { Project, } from "../../src/model/project.ts";
import { Material, } from "../../src/model/material.ts";
import { MaterialBooking, } from "../../src/model/material-booking.ts";
import { Task, } from "../../src/model/task.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { MaterialListRE, } from "../../src/reports/material-list-re.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { parseProject, PROJECT_HEADER, } from "../parser/parse-helper.ts";

/** Parseia um `materialreport` com as colunas dadas; falha se houver msgs. */
function parseReport(columns: string, stock: string,): Project {
  const outcome = parseProject(
    `${PROJECT_HEADER}` +
      'account mats "Materials" {\n  aggregate materials\n}\n' +
      `material steel "Steel" {\n  unit "kg"\n  unitprice 10\n` +
      `  chargeset mats 100%\n${stock}}\n` +
      `materialreport mr "Estoque" {\n  period 2026-01-01 - 2026-12-31\n` +
      `  columns ${columns}\n}\n`,
  );
  assertEquals(
    outcome.messageIds,
    [],
    `msgs=${outcome.messageIds.join(",",)}: ${
      outcome.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)
    }`,
  );
  assert(outcome.result !== false, "parse falhou",);
  return outcome.result as Project;
}

/** Colunas do relatório parseado (ids e títulos na ordem declarada). */
function parsedColumns(project: Project,): TableColumnDefinition[] {
  return (project.report("mr",) as Report).get(
    "columns",
  ) as TableColumnDefinition[];
}

/** Gera o materialreport e devolve a primeira linha de dados como CSV. */
function firstDataRow(
  project: Project,
  columns: Array<[string, string,]>,
): unknown[] {
  const report = project.report("mr",) as Report;
  report.set(
    "columns",
    [
      new TableColumnDefinition("no", "No.",),
      new TableColumnDefinition("name", "Name",),
      ...columns.map(([id, title,],) => new TableColumnDefinition(id, title,)),
    ],
  );
  project.reportContexts.push(new ReportContext(project, report,),);
  const re = new MaterialListRE(report,);
  re.generateIntermediateFormat();
  return (re.to_csv() as unknown[][])[1]!;
}

describe("C18.1 parser aceita as colunas de estoque", () => {
  it("columns stockquantity, stockcost com títulos próprios", () => {
    const project = parseReport("stockquantity, stockcost", "",);
    const cols = parsedColumns(project,);
    assertEquals(cols.map((c,) => c.id), ["stockquantity", "stockcost",],);
    assertEquals(cols.map((c,) => c.title), [
      "Stock Quantity",
      "Stock Cost",
    ],);
  });

  it("keyword desconhecida continua rejeitada pelo FSM", () => {
    const { messageIds, result, } = parseProject(
      PROJECT_HEADER +
        'materialreport mr "X" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns stockqtd\n}\n",
    );
    assert(
      result === false || messageIds.length > 0,
      "esperava erro para coluna desconhecida",
    );
  });
});

describe("C18.2 células de estoque no materialreport", () => {
  it("entrada e estorno se somam algebricamente (14C.13.1)", () => {
    const project = parseReport(
      "no, name",
      "  booking quantity 500 on 2026-03-01\n" +
        "  booking quantity -100 on 2026-06-01\n",
    );
    // [no, name, stockquantity, stockcost] — unitprice 10 do material.
    assertEquals(
      firstDataRow(project, [
        ["stockquantity", "Stock Quantity",],
        ["stockcost", "Stock Cost",],
      ],),
      [1, "steel", 400, 4000,],
    );
  });

  it("preço do booking precede o do material no stockcost", () => {
    const project = parseReport(
      "no, name",
      "  booking quantity 100 unitprice 12 on 2026-03-01\n" +
        "  booking quantity -50 on 2026-06-01\n",
    );
    // 100 × 12 = 1200; −50 × 10 (material) = −500 → líquido 700.
    assertEquals(
      firstDataRow(project, [
        ["stockquantity", "Stock Quantity",],
        ["stockcost", "Stock Cost",],
      ],),
      [1, "steel", 50, 700,],
    );
  });

  it("movimento fora do período do relatório não conta", () => {
    const project = parseReport(
      "no, name",
      "  booking quantity 500 on 2026-03-01\n" +
        "  booking quantity 300 on 2027-02-01\n",
    );
    // O relatório é 2026-01-01 – 2026-12-31; o movemento de 2027 fica fora.
    assertEquals(
      firstDataRow(project, [
        ["stockquantity", "Stock Quantity",],
        ["stockcost", "Stock Cost",],
      ],),
      [1, "steel", 500, 5000,],
    );
  });

  it("material sem movimentos de estoque soma zero", () => {
    const project = parseReport("no, name", "",);
    assertEquals(
      firstDataRow(project, [
        ["stockquantity", "Stock Quantity",],
        ["stockcost", "Stock Cost",],
      ],),
      [1, "steel", 0, 0,],
    );
  });

  it("booking COM tarefa (consumo) não entra no estoque", () => {
    // Âncora de separação (14C.16.4): `booking <tarefa> …` vive em
    // `materialbookings` da tarefa, não em `stockbookings` do material —
    // monta-se direto o modelo para isolar a separação dos dois papéis.
    const project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 10,);
    const task = new Task(project, "t4", "T4", null,);
    task.setForScenario(
      "materialbookings",
      [
        new MaterialBooking(
          steel,
          "t4",
          80,
          TjTime.fromString("2026-05-01",),
          undefined,
          task,
        ),
      ],
      0,
    );
    const report = new Report(project, "mr", "mr", null,);
    report.typeSpec = "materialreport" as never;
    report.set("start", TjTime.fromString("2026-01-01",),);
    report.set("end", TjTime.fromString("2026-12-31",),);
    report.set("scenarios", [0,],);
    project.reportContexts.push(new ReportContext(project, report,),);
    report.set("columns", [
      new TableColumnDefinition("no", "No.",),
      new TableColumnDefinition("stockquantity", "Stock Quantity",),
      new TableColumnDefinition("stockcost", "Stock Cost",),
    ],);
    const re = new MaterialListRE(report,);
    re.generateIntermediateFormat();
    assertEquals(re.to_csv()[1], [1, 0, 0,],);
    assertEquals(steel.stockBookings(0,).length, 0, "stockbookings vazio",);
  });
});
