/**
 * 11.14.6 — Smoke test pós-Fase 11.
 *
 * Liga o motor de expressões lógicas + Query (Fase 11) ao modelo (Fases 4–5)
 * e ao shim do parser (Fase 10):
 *  1. As classes `Logical*` exportadas pelo shim `src/logical/` são as MESMAS
 *     do `src/logic/` (o parser e o motor compartilham identidade de classe).
 *  2. Uma `Query` com `attributeId='priority'` resolve via `process()`.
 *  3. Uma `LogicalExpression` real (`priority > 0`) avalia contra uma `Task`.
 *
 * Obs.: usa `priority` (atributo de cenário numérico sem `query_*`) em vez de
 * `effort`, pois desde a Onda B2 `query_effort` existe e devolve 0 para uma
 * tarefa não agendada — aqui o objetivo é a ponte Query↔atributo base.
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Task, } from "../../src/model/task.ts";

// Via shim do parser (Fase 10).
import {
  LogicalExpression as ShimExpr,
  LogicalOperation as ShimOp,
} from "../../src/logical/logical-expression.ts";
// Via implementação plena (Fase 11).
import { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { LogicalAttribute, } from "../../src/logic/logical-attribute.ts";
import { Query, } from "../../src/query/query.ts";

describe("Smoke test after Phase 11 (logical engine + Query)", () => {
  it("shim do parser e motor compartilham as mesmas classes", () => {
    assertEquals(ShimOp, LogicalOperation,);
    assertEquals(ShimExpr, LogicalExpression,);
  });

  it("Query resolve attributeId='priority' via process()", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("priority", 8, 0,);
    const q = new Query({
      project,
      property: task,
      attributeId: "priority",
      scenarioIdx: 0,
    },);
    assert(q.process(), q.errorMessage ?? "process falhou",);
    assertEquals(q.to_num(), 8,);
  });

  it("LogicalExpression 'priority > 0' avalia contra uma Task real", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "T1", null,);
    task.setForScenario("priority", 8, 0,);
    const attr = new LogicalAttribute("priority", project.scenario(0,)!,);
    const op = new LogicalOperation(attr, ">", new LogicalOperation(0,),);
    const expr = new LogicalExpression(op,);
    const query = new Query({ project, property: task, },);
    assertEquals(expr.eval(query,), true,);
  });
});
