/**
 * Integração Query ↔ modelo e dispatch do `process` (Fase 11.12).
 *
 * Nota de escopo: os métodos `query_*` de scheduling/financeiro em Task e
 * Resource (query_effort/query_duration/...) AINDA não existem no core — a
 * premissa da tarefa ("Fase 7 implementou os query_*") não se confirma no
 * código (só `query_balance`/`query_turnover` existem). Portanto aqui
 * validamos a PONTE: a ordem de dispatch do `Query.process`
 * (customData → property.query_X → data[scIdx].query_X → atributo base) e o
 * fato de `LogicalAttribute.eval` disparar `query.process`. A integração com
 * os `query_*` concretos será finalizada quando as fases de scheduling/
 * financeiro os implementarem.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { Query, } from "../../src/query/query.ts";
import { LogicalAttribute, } from "../../src/logic/logical-attribute.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import type { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";

/** Helper: Query mínima para um atributo de uma Task (11.12.2). */
function makeQuery(
  project: Project,
  task: Task,
  attributeId: string,
  start: TjTime,
  end: TjTime,
): Query {
  return new Query({
    project,
    property: task,
    attributeId,
    scenarioIdx: 0,
    start,
    end,
  },);
}

describe("Query integração (11.12)", () => {
  it("makeQuery monta Query com janela temporal", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "T1", null,);
    const q = makeQuery(
      project,
      task,
      "effort",
      TjTime.fromString("2026-01-01",),
      TjTime.fromString("2026-01-02",),
    );
    assertEquals(q.property, task,);
    assertEquals(q.attributeId, "effort",);
    assertEquals(q.scenarioIdx, 0,);
  });

  it("LogicalAttribute.eval dispara query.process (11.12.20)", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("effort", 7, 0,);
    const attr = new LogicalAttribute("effort", project.scenario(0,)!,);
    const expr = new LogicalExpression(attr,);
    expr.query = new Query({ project, property: task, },);
    assertEquals(attr.eval(expr,), 7,);
  });

  it("process passo h: chama property.query_X quando existe", () => {
    const project = createTestProject(1,);
    let called = false;
    const fakeProperty = {
      project,
      data: [],
      query_foo(q: Query,) {
        called = true;
        q.numerical = 123;
        q.string = "from-h";
      },
    } as unknown as PropertyTreeNode;
    const q = new Query({
      project,
      property: fakeProperty,
      attributeId: "foo",
      scenarioIdx: 0,
    },);
    assert(q.process(),);
    assert(called,);
    assertEquals(q.to_num(), 123,);
    assertEquals(q.to_s(), "from-h",);
  });

  it("process passo i: chama data[scIdx].query_X quando existe", () => {
    const project = createTestProject(1,);
    let called = false;
    const scenarioData = {
      query_foo(q: Query,) {
        called = true;
        q.numerical = 55;
      },
    };
    const fakeProperty = {
      project,
      data: [scenarioData,],
    } as unknown as PropertyTreeNode;
    const q = new Query({
      project,
      property: fakeProperty,
      attributeId: "foo",
      scenarioIdx: 0,
    },);
    assert(q.process(),);
    assert(called,);
    assertEquals(q.to_num(), 55,);
  });
});
