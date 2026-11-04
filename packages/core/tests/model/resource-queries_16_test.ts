/**
 * 16.17 — consultas de licença de `ResourceScenario` e `Resource#query_dashboard`.
 *
 * Fonte Ruby: `ResourceScenario.rb:277-309` (férias), `:467-495` (demais tipos)
 * e `Resource.rb:45-99` (dashboard).
 *
 * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb
 * @see docs/taskjuggler/lib/taskjuggler/Resource.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.17)
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Task, } from "../../src/model/task.ts";
import {
  Leave,
  LeaveAllowance,
  LeaveAllowanceList,
  LeaveList,
} from "../../src/model/leave.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { Query, } from "../../src/query/query.ts";

const D = (s: string,) => TjTime.fromString(s,);

const START = "2026-01-01";
const END = "2026-01-31";

/** Projeto de 1 cenário com um recurso folha pronto para receber licenças. */
function fixture(): { project: Project; resource: Resource } {
  const project = createTestProject(1,);
  const resource = new Resource(project, "r1", "R1", null,);
  return { project, resource, };
}

/** Define `leaves` no cenário 0 e reconstrói o scoreboard. */
function setLeaves(resource: Resource, ...leaves: Leave[]): void {
  const list = new LeaveList();
  for (const leave of leaves) list.push(leave,);
  resource.setForScenario("leaves", list, 0,);
  resource.scenarioData(0,).initScoreboard();
}

function dayInterval(day: string,): TimeInterval {
  const start = D(day,);
  return new TimeInterval(start, start.addSeconds(24 * 3600,),);
}

/**
 * Query real (não `process`) sobre o cenário 0 — o construtor sincroniza
 * `start`/`end` com `startIdx`/`endIdx`, que é o que os `query_*` leem.
 */
function queryFor(
  project: Project,
  property: Resource | Task,
  attributeId: string,
): Query {
  return new Query({
    project,
    property,
    attributeId,
    scenarioIdx: 0,
    start: D(START,),
    end: D(END,),
  },);
}

describe("ResourceScenario#query_annualleave (16.17)", () => {
  let project: Project;
  let resource: Resource;

  beforeEach(() => {
    ({ project, resource, } = fixture());
  },);

  it("conta os dias de férias no período", () => {
    setLeaves(resource, new Leave("annual", dayInterval("2026-01-05",),),);
    const q = queryFor(project, resource, "annualleave",);
    resource.scenarioData(0,).query_annualleave(q,);
    // 24 slots de 1h / 8h por dia = 3 dias (o Ruby usa `convertToDailyLoad`).
    assertEquals(q.numerical, 3,);
    assertEquals(q.sortable, 3,);
  });

  it("ignora licenças de outro tipo", () => {
    setLeaves(resource, new Leave("sick", dayInterval("2026-01-05",),),);
    const q = queryFor(project, resource, "annualleave",);
    resource.scenarioData(0,).query_annualleave(q,);
    assertEquals(q.numerical, 0,);
  });

  it("soma licenças de dias distintos", () => {
    setLeaves(
      resource,
      new Leave("annual", dayInterval("2026-01-05",),),
      new Leave("annual", dayInterval("2026-01-07",),),
    );
    const q = queryFor(project, resource, "annualleave",);
    resource.scenarioData(0,).query_annualleave(q,);
    assertEquals(q.numerical, 6,);
  });

  it("preenche query.string via scaleLoad", () => {
    setLeaves(resource, new Leave("annual", dayInterval("2026-01-05",),),);
    const q = queryFor(project, resource, "annualleave",);
    resource.scenarioData(0,).query_annualleave(q,);
    assert((q.string ?? "").includes("3",), `string: ${q.string}`,);
  });

  it("respeita o intervalo da query (licença fora do período)", () => {
    setLeaves(resource, new Leave("annual", dayInterval("2026-03-05",),),);
    const q = queryFor(project, resource, "annualleave",);
    resource.scenarioData(0,).query_annualleave(q,);
    assertEquals(q.numerical, 0,);
  });
});

describe("ResourceScenario#query_sickleave/special/unpaid (16.17)", () => {
  let project: Project;
  let resource: Resource;

  beforeEach(() => {
    ({ project, resource, } = fixture());
  },);

  for (
    const [type, attribute,] of [
      ["sick", "sickleave",],
      ["special", "specialleave",],
      ["unpaid", "unpaidleave",],
    ] as const
  ) {
    it(`query_${attribute} conta apenas '${type}'`, () => {
      setLeaves(
        resource,
        new Leave(type, dayInterval("2026-01-05",),),
        new Leave("annual", dayInterval("2026-01-06",),),
      );
      const rs = resource.scenarioData(0,);
      const q = queryFor(project, resource, attribute,);
      if (type === "sick") rs.query_sickleave(q,);
      else if (type === "special") rs.query_specialleave(q,);
      else rs.query_unpaidleave(q,);
      assertEquals(q.numerical, 3,);
    });
  }

  it("query_timeoffdays soma qualquer tipo", () => {
    setLeaves(
      resource,
      new Leave("annual", dayInterval("2026-01-05",),),
      new Leave("sick", dayInterval("2026-01-06",),),
    );
    const q = queryFor(project, resource, "timeoffdays",);
    resource.scenarioData(0,).query_timeoffdays(q,);
    assertEquals(q.numerical, 6,);
  });
});

describe("ResourceScenario#query_annualleavelist (16.17)", () => {
  it("lista data e fração do dia por intervalo", () => {
    const { project, resource, } = fixture();
    setLeaves(resource, new Leave("annual", dayInterval("2026-01-05",),),);
    const q = queryFor(project, resource, "annualleavelist",);
    resource.scenarioData(0,).query_annualleavelist(q,);
    const text = q.string ?? "";
    assert(text.startsWith("2026-01-05",), `string: ${text}`,);
    assert(text.endsWith("(3.0)",), `string: ${text}`,);
  });

  it("devolve string vazia sem licenças", () => {
    const { project, resource, } = fixture();
    const q = queryFor(project, resource, "annualleavelist",);
    resource.scenarioData(0,).query_annualleavelist(q,);
    assertEquals(q.string, "",);
  });
});

describe("ResourceScenario#collectLeaveIntervals (16.17)", () => {
  it("devolve os intervalos do tipo informado", () => {
    const { project, resource, } = fixture();
    setLeaves(resource, new Leave("annual", dayInterval("2026-01-05",),),);
    const rs = resource.scenarioData(0,);
    const list = rs.collectLeaveIntervals(
      new TimeInterval(D(START,), D(END,),),
      "annual",
    );
    assertEquals(list.length, 1,);
    assertEquals(list[0]!.start.to_s(), D("2026-01-05",).to_s(),);
  });

  it("recurso container não tem intervalos de licença", () => {
    const { project, resource, } = fixture();
    new Resource(project, "r2", "R2", resource,);
    const list = resource.scenarioData(0,).collectLeaveIntervals(
      new TimeInterval(D(START,), D(END,),),
      "annual",
    );
    assertEquals(list.length, 0,);
  });

  it("rejeita tipo de licença desconhecido", () => {
    const { resource, } = fixture();
    let threw = false;
    try {
      resource.scenarioData(0,).collectLeaveIntervals(
        new TimeInterval(D(START,), D(END,),),
        "vacation",
      );
    } catch {
      threw = true;
    }
    assertEquals(threw, true,);
  });
});

describe("ResourceScenario#query_annualleavebalance (16.17)", () => {
  it("desconta os dias tomados da provisão", () => {
    const { project, resource, } = fixture();
    setLeaves(resource, new Leave("annual", dayInterval("2026-01-05",),),);
    const allowances = new LeaveAllowanceList();
    // 40 slots de 1h = 5 dias de provisão.
    allowances.push(new LeaveAllowance("annual", D("2026-01-01",), 40,),);
    resource.setForScenario("leaveallowances", allowances, 0,);

    const q = queryFor(project, resource, "annualleavebalance",);
    resource.scenarioData(0,).query_annualleavebalance(q,);
    assertEquals(q.numerical, 2,);
  });

  it("saldo é negativo quando se tomou mais do que a provisão", () => {
    const { project, resource, } = fixture();
    setLeaves(resource, new Leave("annual", dayInterval("2026-01-05",),),);
    const allowances = new LeaveAllowanceList();
    allowances.push(new LeaveAllowance("annual", D("2026-01-01",), 8,),);
    resource.setForScenario("leaveallowances", allowances, 0,);

    const q = queryFor(project, resource, "annualleavebalance",);
    resource.scenarioData(0,).query_annualleavebalance(q,);
    assertEquals(q.numerical, -2,);
  });

  it("recurso container fica com query intocada", () => {
    const { project, resource, } = fixture();
    new Resource(project, "r2", "R2", resource,);
    const q = queryFor(project, resource, "annualleavebalance",);
    resource.scenarioData(0,).query_annualleavebalance(q,);
    assertEquals(q.numerical, null,);
  });
});

describe("Resource#query_dashboard (16.17)", () => {
  let project: Project;
  let resource: Resource;

  beforeEach(() => {
    ({ project, resource, } = fixture());
  },);

  it("sem trackingscenario avisa a ausência do cenário", () => {
    project.set("trackingScenarioIdx", null,);
    const q = queryFor(project, resource, "dashboard",);
    resource.query_dashboard(q,);
    const markup = dashboardMarkup(q,);
    assert(markup.includes("No 'trackingscenario' defined.",), markup,);
  });

  it("com trackingscenario e sem entradas devolve 'no current status'", () => {
    project.set("trackingScenarioIdx", 0,);
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("responsible", [resource,], 0,);
    const q = queryFor(project, resource, "dashboard",);
    resource.query_dashboard(q,);
    const markup = dashboardMarkup(q,);
    assert(markup.includes("We have no current status",), markup,);
    assert(markup.includes("R1",), markup,);
  });

  it("lista a tarefa responsável que tem status atual", () => {
    project.set("trackingScenarioIdx", 0,);
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("responsible", [resource,], 0,);
    new JournalEntry(project.journal, D("2026-01-10",), "andamento", task,);

    const q = queryFor(project, resource, "dashboard",);
    resource.query_dashboard(q,);
    const markup = dashboardMarkup(q,);
    assert(markup.includes("Task: T1",), markup,);
    assert(markup.includes("(t1)",), markup,);
    assert(markup.includes("andamento",), markup,);
  });

  it("ignora tarefa cujo responsável é outro recurso", () => {
    project.set("trackingScenarioIdx", 0,);
    const other = new Resource(project, "r2", "R2", null,);
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("responsible", [other,], 0,);
    new JournalEntry(project.journal, D("2026-01-10",), "andamento", task,);

    const q = queryFor(project, resource, "dashboard",);
    resource.query_dashboard(q,);
    const markup = dashboardMarkup(q,);
    assert(markup.includes("We have no current status",), markup,);
  });

  it("produz RTI sem numeração de seção e com cssClass de journal", () => {
    project.set("trackingScenarioIdx", 0,);
    const q = queryFor(project, resource, "dashboard",);
    resource.query_dashboard(q,);
    const rti = q.rti as { sectionNumbers?: boolean; cssClass?: string } | null;
    assertEquals(rti?.sectionNumbers, false,);
    assertEquals(rti?.cssClass, "tj_journal",);
  });
});

/** Markup de entrada do RTI produzido pelo dashboard. */
function dashboardMarkup(q: Query,): string {
  const rti = q.rti as { richText?: { inputText?: string } } | null;
  return rti?.richText?.inputText ?? "";
}
