/**
 * Testes do `BreakdownReport` (Fase 14 Complemento 14C.2).
 *
 * Cobre o registro na fábrica de conteúdo (substituindo o NYI de 14C.0.10), o
 * agrupamento por conta (default) e por tarefa, a contribuição de recursos,
 * materiais e charges (via `CostEvent` e via modelo), e as saídas HTML, CSV e
 * JSON — todas derivadas da mesma estrutura de grupos (ADR 027: nenhuma
 * escrita a disco).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.2)
 * @see docs/syntaxmesh/fases/fase-10-complemento1.md §5
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { Account, } from "../../src/model/account.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Material, } from "../../src/model/material.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { CostEvent, } from "../../src/model/cost-event.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { BreakdownReport, } from "../../src/reports/breakdown-report.ts";
import { contentFactories, } from "../../src/model/report-content.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import type { LogicalOperation, } from "../../src/logic/logical-operation.ts";

const D = (s: string,) => TjTime.fromString(s,);

/** Relatório de breakdown pronto para gerar (project.start/end do fixture). */
function makeReport(
  project: Project,
  typeSpec: ReportType | string,
  extra: Record<string, unknown> = {},
): Report {
  const report = new Report(project, "bd", "bd.html", null,);
  report.typeSpec = typeSpec as never;
  report.set("start", D("2026-01-01",),);
  report.set("end", D("2026-12-31",),);
  report.set("scenarios", [0,],);
  report.set("columns", [
    new TableColumnDefinition("name", "Name",),
    new TableColumnDefinition("resources", "Resources",),
    new TableColumnDefinition("materials", "Materials",),
    new TableColumnDefinition("charges", "Charges",),
    new TableColumnDefinition("total", "Total",),
  ],);
  for (const [key, value,] of Object.entries(extra,)) report.set(key, value,);
  project.reportContexts.push(new ReportContext(project, report,),);
  return report;
}

/** Gera o breakdown e devolve o conteúdo. */
function generate(
  project: Project,
  extra: Record<string, unknown> = {},
): BreakdownReport {
  const re = new BreakdownReport(
    makeReport(project, ReportType.BreakdownReport, extra,),
  );
  re.generateIntermediateFormat();
  return re;
}

describe("BreakdownReport — registro e agrupamento (14C.2.1)", () => {
  it("está registrado na fábrica de conteúdo sob breakdownreport", () => {
    assert(contentFactories.has("breakdownreport",),);
  });

  it("groupby default é account", () => {
    const project = createTestProject(1,);
    assertEquals(generate(project,).groupby(), "account",);
  });

  it("groupby task é respeitado", () => {
    const project = createTestProject(1,);
    assertEquals(generate(project, { groupby: "task", },).groupby(), "task",);
  });
});

describe("BreakdownReport — groupby account (14C.2.2)", () => {
  let project: Project;
  let account: Account;
  let task: Task;
  let resource: Resource;
  let steel: Material;

  beforeEach(() => {
    project = createTestProject(1,);
    account = new Account(project, "c1", "Custo", null,);
    task = new Task(project, "t1", "T1", null,);
    resource = new Resource(project, "dev", "Dev", null,);
    steel = new Material(project, "steel", "kg", 2.5,);
    steel.set("unit", "kg",);
    steel.set("cost", 2.5,);
  },);

  it("agrega recursos, materiais e charges da conta", () => {
    project.costEvents.push(
      new CostEvent(
        "resource_effort",
        800,
        account,
        "explicit",
        0,
        "planned",
        task,
        resource,
      ),
      new CostEvent(
        "material_usage",
        250,
        account,
        "explicit",
        0,
        "planned",
        task,
        undefined,
        steel,
      ),
      new CostEvent(
        "task_charge",
        100,
        account,
        "explicit",
        0,
        "planned",
        task,
      ),
    );

    const re = generate(project,);
    const groups = re.getGroups();
    assertEquals(groups.length, 1,);
    const group = groups[0]!;
    assertEquals(group.id, "c1",);
    assertEquals(group.totals.resources, 800,);
    assertEquals(group.totals.materials, 250,);
    assertEquals(group.totals.charges, 100,);
    assertEquals(group.totals.total, 1150,);

    const kinds = group.contributors.map((c,) => c.kind).sort();
    assertEquals(kinds, ["charge", "material", "resource",],);
  });

  it("contas sem contribuintes não viram grupo", () => {
    const re = generate(project,);
    assertEquals(re.getGroups().length, 0,);
  });
});

describe("BreakdownReport — groupby task (14C.2.3)", () => {
  let project: Project;
  let task: Task;
  let steel: Material;

  beforeEach(() => {
    project = createTestProject(1,);
    task = new Task(project, "t1", "T1", null,);
    steel = new Material(project, "steel", "kg", 2.5,);
    steel.set("unit", "kg",);
    steel.set("cost", 2.5,);
  },);

  it("lista materiais alocados com custo quantidade × preço", () => {
    task.setForScenario(
      "materialallocations",
      [new MaterialAllocation(steel, 40, "distributed",),],
      0,
    );

    const re = generate(project, { groupby: "task", },);
    const groups = re.getGroups();
    assertEquals(groups.length, 1,);
    const group = groups[0]!;
    assertEquals(group.id, "t1",);
    assertEquals(group.totals.materials, 100,);
    assertEquals(group.totals.total, 100,);
    const material = group.contributors[0]!;
    assertEquals(material.kind, "material",);
    assertEquals(material.quantity, 40,);
    assertEquals(material.unit, "kg",);
    assertEquals(material.cost, 100,);
  });

  it("CostEvent de material substitui a estimativa", () => {
    task.setForScenario(
      "materialallocations",
      [new MaterialAllocation(steel, 40, "distributed",),],
      0,
    );
    project.costEvents.push(
      new CostEvent(
        "material_usage",
        125,
        null,
        "explicit",
        0,
        "actual",
        task,
        undefined,
        steel,
      ),
    );

    const group = generate(project, { groupby: "task", },).getGroups()[0]!;
    assertEquals(group.totals.materials, 125,);
    assertEquals(group.contributors[0]!.mode, "actual",);
  });

  it("charge declarada sem CostEvent entra como contribuinte", () => {
    task.setForScenario("charge", [{ amount: 300, },], 0,);

    const group = generate(project, { groupby: "task", },).getGroups()[0]!;
    assertEquals(group.totals.charges, 300,);
    assertEquals(group.contributors[0]!.kind, "charge",);
    assertEquals(group.contributors[0]!.mode, "declared",);
  });
});

describe("BreakdownReport — colunas e sortby (14C.2.5)", () => {
  it("sortby total reordena os grupos pelo total", () => {
    const project = createTestProject(1,);
    const small = new Account(project, "a-small", "Small", null,);
    const big = new Account(project, "a-big", "Big", null,);
    project.costEvents.push(
      new CostEvent("task_charge", 10, small, "explicit", 0, "planned",),
      new CostEvent("task_charge", 900, big, "explicit", 0, "planned",),
    );

    const asc = generate(project, { sortBy: [["total", true, -1,],], },)
      .getGroups();
    assertEquals(asc.map((g,) => g.id), ["a-small", "a-big",],);

    const desc = generate(project, { sortBy: [["total", false, -1,],], },)
      .getGroups();
    assertEquals(desc.map((g,) => g.id), ["a-big", "a-small",],);
  });

  it("columns declaradas controlam a tabela HTML", () => {
    const project = createTestProject(1,);
    const account = new Account(project, "c1", "Custo", null,);
    project.costEvents.push(
      new CostEvent("task_charge", 100, account, "explicit", 0, "planned",),
    );
    const report = makeReport(project, ReportType.BreakdownReport, {
      columns: [
        new TableColumnDefinition("name", "Name",),
        new TableColumnDefinition("total", "Total",),
      ],
    },);
    const re = new BreakdownReport(report,);
    re.generateIntermediateFormat();
    const ids = re.getTable()!.getColumns().map((c,) => c.toJSON().id);
    assertEquals(ids, ["", "",],); // colunas sintéticas (sem definition)
    const titles = re.getTable()!.getColumns().map((c,) => c.toJSON().title);
    assertEquals(titles, ["Name", "Total",],);
  });
});

describe("BreakdownReport — filtros (14C.2.4)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(1,);
    const t1 = new Task(project, "keep", "Keep", null,);
    const t2 = new Task(project, "drop", "Drop", null,);
    const steel = new Material(project, "steel", "kg", 2,);
    steel.set("cost", 2,);
    for (const task of [t1, t2,]) {
      task.setForScenario(
        "materialallocations",
        [new MaterialAllocation(steel, 10, "distributed",),],
        0,
      );
    }
  },);

  it("sem filtro lista as duas tarefas", () => {
    assertEquals(
      generate(project, { groupby: "task", },).getGroups().length,
      2,
    );
  });

  it("hideTask remove a tarefa da lista", () => {
    // Expressão sempre-verdadeira: cada tarefa é ocultada pelo filtro.
    const hide = new LogicalExpression(
      { eval: () => true, } as unknown as LogicalOperation,
    );
    const re = new BreakdownReport(
      makeReport(project, ReportType.BreakdownReport, {
        groupby: "task",
        hideTask: hide,
      },),
    );
    re.generateIntermediateFormat();
    assertEquals(re.getGroups().length, 0,);
  });
});

describe("BreakdownReport — saídas html/csv/json (14C.2.6–14C.2.8)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(1,);
    const account = new Account(project, "c1", "Custo", null,);
    const task = new Task(project, "t1", "T1", null,);
    project.costEvents.push(
      new CostEvent(
        "task_charge",
        100,
        account,
        "explicit",
        0,
        "planned",
        task,
      ),
    );
  },);

  it("HTML traz o grupo e o contribuinte como linhas hierárquicas", () => {
    const html = generate(project,).to_html();
    assertEquals(html.length, 1,);
    const dump = (html[0] as { toHTML(): string }).toHTML();
    assert(dump.includes("tj_table",), `html:\n${dump}`,);
    assert(dump.includes("Custo",), `html:\n${dump}`,);
    assert(dump.includes("planned",), `html:\n${dump}`,);
  });

  it("CSV traz linhas planas de grupo e contribuinte", () => {
    const csv = generate(project,).to_csv();
    assertEquals(csv[0], [
      "Entity",
      "Type",
      "Effort/Quantity",
      "Cost",
      "Total",
    ],);
    assertEquals(csv[1], ["Custo", "total", "", 100, 100,],);
    assertEquals(csv[2], ["Custo", "charge", "planned", 100, "",],);
  });

  it("JSON é aninhado por groupby", () => {
    const parsed = JSON.parse(generate(project,).toJSON(),) as {
      groupby: string;
      groups: Array<{ id: string; totals: { total: number } }>;
    };
    assertEquals(parsed.groupby, "account",);
    assertEquals(parsed.groups.length, 1,);
    assertEquals(parsed.groups[0]!.id, "c1",);
    assertEquals(parsed.groups[0]!.totals.total, 100,);
  });
});
