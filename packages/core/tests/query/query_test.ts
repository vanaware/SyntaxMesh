/**
 * Testes BDD de `Query` — estrutura, process, accessors, scale, resolve (11.6-11.10).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Query.rb
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Account, } from "../../src/model/account.ts";
import { Query, } from "../../src/query/query.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { RealFormat, } from "../../src/format/real-format.ts";

describe("Query — estrutura (11.6)", () => {
  let project: Project;
  beforeEach(() => {
    project = createTestProject(1,);
  },);

  it("constructor aplica params e defaults", () => {
    const task = new Task(project, "t1", "T1", null,);
    const q = new Query({ project, property: task, attributeId: "effort", },);
    assertEquals(q.project, project,);
    assertEquals(q.property, task,);
    assertEquals(q.attributeId, "effort",);
    assertEquals(q.ok, true,);
    assertEquals(q.errorMessage, null,);
    assertEquals(q.selfContained, false,);
  });

  it("start sincroniza startIdx via project.dateToIdx (11.6.2.1)", () => {
    const q = new Query({ project, },);
    const date = TjTime.fromString("2026-01-01",);
    q.start = date;
    assertEquals(q.start, date,);
    assertEquals(q.startIdx, project.dateToIdx(date,),);
  });

  it("end sincroniza endIdx (11.6.2.2)", () => {
    const q = new Query({ project, },);
    const date = TjTime.fromString("2026-01-02",);
    q.end = date;
    assertEquals(q.end, date,);
    assertEquals(q.endIdx, project.dateToIdx(date,),);
  });

  it("startIdx sincroniza start via idxToDate (11.6.2.3)", () => {
    const q = new Query({ project, },);
    q.startIdx = 0;
    assertEquals(q.startIdx, 0,);
    assertEquals(q.start?.toString(), project.idxToDate(0,)?.toString(),);
  });

  it("set start com tipo errado lança (11.6.2)", () => {
    const q = new Query({ project, },);
    assertThrows(() => {
      q.start = "2026-01-01" as unknown as TjTime;
    },);
  });

  it("dup copia campos e cria novo Map de customData (11.6.3.3)", () => {
    const task = new Task(project, "t1", "T1", null,);
    const q = new Query({ project, property: task, attributeId: "x", },);
    q.setCustomData("x", { numerical: 1, },);
    const c = q.dup();
    assertEquals(c.project, project,);
    assertEquals(c.property, task,);
    assertEquals(c.attributeId, "x",);
    assertEquals(c.customData.size, 1,);
    assert(c.customData !== q.customData,);
  });

  it("process resetta resultados antes de reavaliar (11.6.3.4/11.7.1.1)", () => {
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("effort", 5, 0,);
    const q = new Query(
      { project, property: task, attributeId: "effort", scenarioIdx: 0, },
    );
    q.process();
    assertEquals(q.to_num(), 5,);
    // Atributo inexistente: process resetta numerical/ok.
    q.attributeId = "bogus_attr";
    assertEquals(q.process(), false,);
    assertEquals(q.ok, false,);
  });
});

describe("Query — process (11.7)", () => {
  let project: Project;
  let task: Task;
  beforeEach(() => {
    project = createTestProject(1,);
    task = new Task(project, "t1", "T1", null,);
    task.setForScenario("effort", 5, 0,);
  },);

  it("customData tem prioridade sobre atributo (11.7.2.2)", () => {
    const q = new Query({ project, property: task, attributeId: "effort", },);
    q.setCustomData("effort", {
      numerical: 99,
      string: "custom",
      sortable: 99,
    },);
    assert(q.process(),);
    assertEquals(q.to_num(), 99,);
    assertEquals(q.to_s(), "custom",);
  });

  it("fallback para atributo base (11.7.2.5-9)", () => {
    const q = new Query(
      { project, property: task, attributeId: "effort", scenarioIdx: 0, },
    );
    assert(q.process(),);
    assertEquals(q.to_num(), 5,);
  });

  it("propriedade desconhecida falha (11.7.1.3)", () => {
    const q = new Query({
      project,
      propertyType: "Task",
      propertyId: "nope",
      attributeId: "effort",
    },);
    assertEquals(q.process(), false,);
    assertEquals(q.ok, false,);
    assert(q.errorMessage?.includes("Unknown property",),);
  });

  it("atributo de projeto suportado (11.7.1.4)", () => {
    project.set("name", "Meu Projeto",);
    const q = new Query({ project, attributeId: "name", },);
    assert(q.process(),);
    assertEquals(q.to_s(), "Meu Projeto",);
  });

  it("atributo de projeto não suportado falha (11.7.1.5)", () => {
    const q = new Query({ project, attributeId: "bogus", },);
    assertEquals(q.process(), false,);
  });
});

describe("Query — accessors (11.8)", () => {
  it("to_num/to_s/to_sort/result a partir de customData", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "T1", null,);
    const q = new Query({ project, property: task, attributeId: "x", },);
    q.setCustomData("x", {
      numerical: 10,
      string: "ten",
      sortable: 10,
    },);
    q.process();
    assertEquals(q.to_num(), 10,);
    assertEquals(q.to_s(), "ten",);
    assertEquals(q.to_sort(), 10,);
    assertEquals(q.result(), 10,);
  });
});

describe("Query — scale + assignList (11.9)", () => {
  it("scaleDuration com unidade fixa (days)", () => {
    const q = new Query({ loadUnit: "days", },);
    assertEquals(q.scaleDuration(2,), "2.00",);
  });
  it("scaleDuration com unidade fixa (hours, factor 24)", () => {
    const q = new Query({ loadUnit: "hours", },);
    assertEquals(q.scaleDuration(2,), "48.00",);
  });
  it("numberFormat custom aplicado", () => {
    const q = new Query({
      loadUnit: "days",
      numberFormat: new RealFormat(["-", "", "", ",", 1,],),
    },);
    assertEquals(q.scaleDuration(2,), "2,0",);
  });
  it("scaleValue auto produz sufixo de unidade", () => {
    const q = new Query({ loadUnit: "shortauto", },);
    const out = q.scaleDuration(3600,);
    assert(/[dhwmqy]$/.test(out,), `unexpected: ${out}`,);
  });

  it("assignList comma (default)", () => {
    const q = new Query({ listType: "comma", },);
    q.assignList(["a", "b",],);
    assertEquals(q.string, "a, b",);
    assertEquals(q.sortable, "a, b",);
    assertEquals(q.rti, null,);
  });
  it("assignList bullets", () => {
    const q = new Query({ listType: "bullets", },);
    q.assignList(["a", "b",],);
    assertEquals(q.string, "* a\n* b\n",);
  });
  it("assignList numbered", () => {
    const q = new Query({ listType: "numbered", },);
    q.assignList(["a", "b",],);
    assertEquals(q.string, "# a\n# b\n",);
  });
});

describe("Query — resolvePropertyId + setCustomData (11.10)", () => {
  let project: Project;
  beforeEach(() => {
    project = createTestProject(1,);
  },);

  it("sem project lança (11.10.1)", () => {
    const q = new Query();
    assertThrows(() => q.resolvePropertyId("Task", "t1",));
  });

  it("dispatch por tipo Task/Resource/Account (11.10.4)", () => {
    const task = new Task(project, "t1", "T1", null,);
    const res = new Resource(project, "r1", "R1", null,);
    const acc = new Account(project, "a1", "A1", null,);
    const q = new Query({ project, },);
    assertEquals(q.resolvePropertyId("Task", "t1",), task,);
    assertEquals(q.resolvePropertyId("Resource", "r1",), res,);
    assertEquals(q.resolvePropertyId("Account", "a1",), acc,);
  });

  it("tipo desconhecido lança (11.10.5)", () => {
    const q = new Query({ project, },);
    assertThrows(() => q.resolvePropertyId("Bogus", "x",));
  });

  it("'!' sobe níveis na árvore (11.10.2/11.10.7)", () => {
    const parent = new Task(project, "p", "P", null,);
    const child = new Task(project, "c", "C", parent,);
    const q = new Query({ project, property: child, },);
    assertEquals(q.resolvePropertyId(null, "!",), parent,);
    assertEquals(q.resolvePropertyId(null, "!!",), null,);
  });

  it("setCustomData registra no map (11.10.9)", () => {
    const q = new Query({ project, },);
    q.setCustomData("k", { string: "v", },);
    assertEquals(q.customData.get("k",), { string: "v", },);
  });
});
