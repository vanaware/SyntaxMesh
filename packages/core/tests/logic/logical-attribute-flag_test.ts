/**
 * Testes BDD de `LogicalAttribute` + `LogicalFlag` + type-guards (Fase 11.2).
 *
 * Usa um `Project`/`Task` real para exercitar o pipeline `Query.process`.
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { LogicalAttribute, } from "../../src/logic/logical-attribute.ts";
import { LogicalFlag, } from "../../src/logic/logical-flag.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { isQuery, } from "../../src/logic/type-guards.ts";
import { Query, } from "../../src/query/query.ts";
import { NotYetImplementedError, TjError, } from "../../src/model/errors.ts";

describe("type-guards isQuery (11.2.3.1)", () => {
  it("true para Query", () => {
    assertEquals(isQuery(new Query(),), true,);
  });
  it("false para objeto comum", () => {
    assertEquals(isQuery({ start: null, },), false,);
  });
  it("false para null", () => {
    assertEquals(isQuery(null,), false,);
  });
  it("false para número", () => {
    assertEquals(isQuery(5,), false,);
  });
});

describe("LogicalAttribute (11.2.1)", () => {
  let project: Project;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    task = new Task(project, "t1", "T1", null,);
    task.setForScenario("effort", 5, 0,);
  },);

  it("constructor armazena attributeId em operand1 e scenario", () => {
    const scenario = project.scenario(0,)!;
    const attr = new LogicalAttribute("effort", scenario,);
    assertEquals(attr.operand1, "effort",);
    assertEquals(attr.scenario, scenario,);
  });

  it("to_s sem query usa scenario.fullId.attribute", () => {
    const scenario = project.scenario(0,)!;
    const attr = new LogicalAttribute("effort", scenario,);
    assertEquals(attr.to_s(null,), `${scenario.fullId}.effort`,);
  });

  it("eval lê valor de atributo via Query", () => {
    const scenario = project.scenario(0,)!;
    const attr = new LogicalAttribute("effort", scenario,);
    const expr = new LogicalExpression(attr,);
    expr.query = new Query({ project, property: task, },);
    assertEquals(attr.eval(expr,), 5,);
  });

  it("eval sem query dispara expr.error", () => {
    const scenario = project.scenario(0,)!;
    const attr = new LogicalAttribute("effort", scenario,);
    const expr = new LogicalExpression(attr,);
    // expr.query permanece null
    assertThrows(() => attr.eval(expr,), TjError,);
  });

  it("eval em atributo desconhecido dispara expr.error", () => {
    const scenario = project.scenario(0,)!;
    const attr = new LogicalAttribute("bogus_attr", scenario,);
    const expr = new LogicalExpression(attr,);
    expr.query = new Query({ project, property: task, },);
    assertThrows(() => attr.eval(expr,), TjError,);
  });
});

describe("LogicalFlag (11.2.2)", () => {
  let project: Project;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    task = new Task(project, "t1", "T1", null,);
    task.setForScenario("flags", ["alpha", "beta",], 0,);
  },);

  it("constructor armazena nome da flag em operand1", () => {
    assertEquals(new LogicalFlag("alpha",).operand1, "alpha",);
  });

  it("eval true quando a flag está atribuída", () => {
    const flag = new LogicalFlag("alpha",);
    const expr = new LogicalExpression(flag,);
    expr.query = new Query({ project, property: task, },);
    assertEquals(flag.eval(expr,), true,);
  });

  it("eval false quando a flag não está atribuída", () => {
    const flag = new LogicalFlag("gamma",);
    const expr = new LogicalExpression(flag,);
    expr.query = new Query({ project, property: task, },);
    assertEquals(flag.eval(expr,), false,);
  });

  it("to_s sem query retorna o nome da flag", () => {
    assertEquals(new LogicalFlag("alpha",).to_s(null,), "alpha",);
  });

  it("to_s com query reflete presença da flag", () => {
    const flag = new LogicalFlag("alpha",);
    const query = new Query({ project, property: task, },);
    assertEquals(flag.to_s(query,), "true",);
    assertEquals(new LogicalFlag("gamma",).to_s(query,), "false",);
  });

  it("contexto não-Query (Journal) lança NotYetImplementedError", () => {
    const flag = new LogicalFlag("alpha",);
    const expr = new LogicalExpression(flag,);
    // Journal (Fase 16): expr.query é um objeto não-Query.
    expr.query = { flags: ["alpha",], } as unknown as Query;
    assertThrows(() => flag.eval(expr,), NotYetImplementedError,);
  });

  it(" LogicalFlag é subclass de LogicalOperation", () => {
    const flag = new LogicalFlag("alpha",);
    assertEquals(flag instanceof LogicalOperation, true,);
  });
});
