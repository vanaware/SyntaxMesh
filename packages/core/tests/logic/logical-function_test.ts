/**
 * Testes BDD de `LogicalFunction` (Fase 11.3).
 *
 * Cobre estrutura, aridade, sufixo `_` (inverte property/scopeProperty) e as
 * funções avaliáveis contra o modelo real. `hasalert` é stub (Fase 16).
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import {
  FUNCTIONS,
  FUNCTIONS_RUBY,
  LogicalFunction,
} from "../../src/logic/logical-function.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { Query, } from "../../src/query/query.ts";
import { NotYetImplementedError, } from "../../src/model/errors.ts";

/** Avalia uma função contra um `Query` com property/scopeProperty dados. */
function evalFn(
  fn: LogicalFunction,
  project: Project,
  opts: { property?: Task | Resource | null; scope?: Task | Resource | null },
): unknown {
  const expr = new LogicalExpression(new LogicalOperation(fn,),);
  expr.query = new Query({
    project,
    property: opts.property ?? null,
    scopeProperty: opts.scope ?? null,
  },);
  return fn.eval(expr,);
}

describe("LogicalFunction", () => {
  describe("estrutura e aridade (11.3.1)", () => {
    it("FUNCTIONS_RUBY tem as 14 fiéis do TaskJuggler 3.8.4", () => {
      assertEquals(FUNCTIONS_RUBY.size, 14,);
    });

    it("FUNCTIONS unificado é superconjunto das fiéis (port + extensões)", () => {
      // Toda função Ruby está no map unificado com a mesma aridade.
      for (const [name, arity,] of FUNCTIONS_RUBY) {
        assertEquals(FUNCTIONS.get(name,), arity,);
      }
      // E inclui as extensões do Complemento Fase 11.
      assert(FUNCTIONS.size > FUNCTIONS_RUBY.size,);
      assertEquals(FUNCTIONS.get("isparentof",), 1,);
    });

    it("sem sufixo: name = opnd, invertProperties false", () => {
      const fn = new LogicalFunction("isleaf",);
      assertEquals(fn.name, "isleaf",);
      assertEquals(fn.invertProperties, false,);
    });

    it("com sufixo _: name sem _, invertProperties true", () => {
      const fn = new LogicalFunction("isleaf_",);
      assertEquals(fn.name, "isleaf",);
      assertEquals(fn.invertProperties, true,);
    });

    it("setArguments registra sem validação", () => {
      const fn = new LogicalFunction("ischildof",);
      fn.setArguments(["p",],);
      assertEquals(fn.arguments, ["p",],);
    });

    it("setArgumentsAndCheck aceita aridade correta", () => {
      const fn = new LogicalFunction("isleaf",);
      assertEquals(fn.setArgumentsAndCheck([],), null,);
    });

    it("setArgumentsAndCheck rejeita função desconhecida", () => {
      const fn = new LogicalFunction("bogus",);
      const res = fn.setArgumentsAndCheck([],);
      assertEquals(res?.[0], "unknown_function",);
    });

    it("setArgumentsAndCheck rejeita aridade errada", () => {
      const fn = new LogicalFunction("ischildof",);
      const res = fn.setArgumentsAndCheck([],);
      assertEquals(res?.[0], "wrong_no_func_arguments",);
    });

    it("to_s/toString mostra nome e args", () => {
      const fn = new LogicalFunction("ischildof",);
      fn.setArguments(["p",],);
      assertEquals(fn.to_s(), "ischildof(p)",);
      assertEquals(fn.toString(), "ischildof(p)",);
    });
  });

  describe("funções contra o modelo (11.3.3)", () => {
    let project: Project;
    let task: Task;
    let resource: Resource;

    beforeEach(() => {
      project = createTestProject(1,);
      task = new Task(project, "t1", "T1", null,);
      resource = new Resource(project, "r1", "R1", null,);
    },);

    it("istask: true para Task", () => {
      const fn = new LogicalFunction("istask",);
      fn.setArguments([],);
      assertEquals(evalFn(fn, project, { property: task, },), true,);
    });
    it("istask: false para Resource", () => {
      const fn = new LogicalFunction("istask",);
      fn.setArguments([],);
      assertEquals(evalFn(fn, project, { property: resource, },), false,);
    });

    it("isresource: true para Resource", () => {
      const fn = new LogicalFunction("isresource",);
      fn.setArguments([],);
      assertEquals(evalFn(fn, project, { property: resource, },), true,);
    });

    it("isleaf: true para folha, false com filho", () => {
      const fn = new LogicalFunction("isleaf",);
      fn.setArguments([],);
      assertEquals(evalFn(fn, project, { property: task, },), true,);
      new Task(project, "child", "Child", task,);
      assertEquals(evalFn(fn, project, { property: task, },), false,);
    });

    it("treelevel: raiz = 1, filho = 2", () => {
      const child = new Task(project, "c1", "C1", task,);
      const fn = new LogicalFunction("treelevel",);
      fn.setArguments([],);
      assertEquals(evalFn(fn, project, { property: task, },), 1,);
      assertEquals(evalFn(fn, project, { property: child, },), 2,);
    });

    it("ischildof: verdadeiro quando ancestor é o pai", () => {
      const child = new Task(project, "c1", "C1", task,);
      const fn = new LogicalFunction("ischildof",);
      fn.setArguments(["t1",],);
      assertEquals(evalFn(fn, project, { property: child, },), true,);
    });
    it("ischildof: falso para id inexistente", () => {
      const fn = new LogicalFunction("ischildof",);
      fn.setArguments(["nope",],);
      assertEquals(evalFn(fn, project, { property: task, },), false,);
    });

    it("sufixo _ usa scopeProperty (istask_)", () => {
      const fn = new LogicalFunction("istask_",);
      fn.setArguments([],);
      // property null, scope = task → com inversão, property efetivo é scope.
      assertEquals(
        evalFn(fn, project, { property: resource, scope: task, },),
        true,
      );
    });

    it("hasalert é stub (NotYetImplementedError)", () => {
      const fn = new LogicalFunction("hasalert",);
      fn.setArguments([1,],);
      assertThrows(
        () => evalFn(fn, project, { property: task, },),
        NotYetImplementedError,
      );
    });
  });
});
