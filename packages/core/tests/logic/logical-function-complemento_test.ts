/**
 * Testes BDD das extensões lógicas do Complemento Fase 11
 * (`fase-11-logical-complemento.md`).
 *
 * Cobre:
 *  - Funções **implementadas na 1ª onda** (checagem de tipo/árvore):
 *    isparentof, isanaccount, isaccount, isanmaterial, ismaterial,
 *    istaskofproject.
 *  - Funções **permanentemente bloqueadas** (G6: slack/float, status): ainda
 *    avaliam com `NotYetImplementedError`. As demais antigamente bloqueadas
 *    foram implementadas na 2ª onda (§6.2/§6.3) e saíram deste arquivo.
 *  - Validação de aridade das extensões via `setArgumentsAndCheck`.
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Account, } from "../../src/model/account.ts";
import { Material, } from "../../src/model/material.ts";
import type { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";
import { LogicalFunction, } from "../../src/logic/logical-function.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { Query, } from "../../src/query/query.ts";
import { NotYetImplementedError, } from "../../src/model/errors.ts";

/** Avalia uma função contra um `Query` com `property` dado. */
function evalFn(
  fn: LogicalFunction,
  project: Project,
  property: PropertyTreeNode | null,
): unknown {
  const expr = new LogicalExpression(new LogicalOperation(fn,),);
  expr.query = new Query({ project, property, },);
  return fn.eval(expr,);
}

describe("LogicalFunction — extensões (Complemento Fase 11)", () => {
  let project: Project;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    task = new Task(project, "t1", "T1", null,);
  },);

  describe("isparentof (11.C LC-B.1)", () => {
    it("verdadeiro quando property é ancestral do id", () => {
      new Task(project, "c1", "C1", task,);
      const fn = new LogicalFunction("isparentof",);
      fn.setArguments(["c1",],);
      assertEquals(evalFn(fn, project, task,), true,);
    });
    it("falso para id inexistente", () => {
      const fn = new LogicalFunction("isparentof",);
      fn.setArguments(["nope",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });
    it("falso quando property é o filho (não o pai)", () => {
      const child = new Task(project, "c1", "C1", task,);
      const fn = new LogicalFunction("isparentof",);
      fn.setArguments(["t1",],);
      assertEquals(evalFn(fn, project, child,), false,);
    });
  });

  describe("isAnAccount / isAccount (LC-B.2/B.3)", () => {
    it("isanaccount: true p/ Account, false p/ Task", () => {
      const account = new Account(project, "ac1", "Account 1", null,);
      const fn = new LogicalFunction("isanaccount",);
      fn.setArguments([],);
      assertEquals(evalFn(fn, project, account,), true,);
      assertEquals(evalFn(fn, project, task,), false,);
    });
    it("isaccount(id): true quando é a conta daquele id", () => {
      const account = new Account(project, "ac1", "Account 1", null,);
      const fn = new LogicalFunction("isaccount",);
      fn.setArguments(["ac1",],);
      assertEquals(evalFn(fn, project, account,), true,);
    });
    it("isaccount(id): false quando o id não bate", () => {
      const account = new Account(project, "ac1", "Account 1", null,);
      const fn = new LogicalFunction("isaccount",);
      fn.setArguments(["outro",],);
      assertEquals(evalFn(fn, project, account,), false,);
    });
    it("isaccount(id): false para non-Account", () => {
      const fn = new LogicalFunction("isaccount",);
      fn.setArguments(["ac1",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });
  });

  describe("isAnMaterial / isMaterial (LC-B.5/B.6)", () => {
    it("isanmaterial: true p/ Material, false p/ Task", () => {
      const material = new Material(project, "mat", "kg", 10,);
      const fn = new LogicalFunction("isanmaterial",);
      fn.setArguments([],);
      assertEquals(evalFn(fn, project, material,), true,);
      assertEquals(evalFn(fn, project, task,), false,);
    });
    it("ismaterial(id): true quando é o material daquele id", () => {
      const material = new Material(project, "mat", "kg", 10,);
      const fn = new LogicalFunction("ismaterial",);
      fn.setArguments(["mat",],);
      assertEquals(evalFn(fn, project, material,), true,);
    });
    it("ismaterial(id): false quando o id não bate", () => {
      const material = new Material(project, "mat", "kg", 10,);
      const fn = new LogicalFunction("ismaterial",);
      fn.setArguments(["nope",],);
      assertEquals(evalFn(fn, project, material,), false,);
    });
  });

  describe("istaskofproject (LC-B.4)", () => {
    it("verdadeiro para o id do próprio projeto", () => {
      const fn = new LogicalFunction("istaskofproject",);
      fn.setArguments([project.id,],);
      assertEquals(evalFn(fn, project, task,), true,);
    });
    it("falso para outro id de projeto", () => {
      const fn = new LogicalFunction("istaskofproject",);
      fn.setArguments(["outro-projeto",],);
      assertEquals(evalFn(fn, project, task,), false,);
    });
  });

  describe("funções bloqueadas: registro + stub (G6 §6.6, 2ª onda)", () => {
    // Apenas as duas com pré-requisito realmente inexistente no modelo:
    // slack/float (isoncriticalpath) e enum de status (istaskstatus). As
    // demais foram implementadas na 2ª onda (§6.2/§6.3) e têm testes
    // próprios em logical-function-second-wave_test.ts.
    const blocked: Array<[string, unknown[], string,]> = [
      ["isoncriticalpath", ["x",], "14",],
      ["istaskstatus", ["x", "late",], "18",],
    ];
    for (const [name, args, fase,] of blocked) {
      it(`${name} lança NotYetImplementedError (Fase ${fase})`, () => {
        const fn = new LogicalFunction(name,);
        fn.setArguments(args,);
        assertThrows(
          () => evalFn(fn, project, task,),
          NotYetImplementedError,
        );
      });
    }

    it("to_s de função estensional funciona (nome + args)", () => {
      const fn = new LogicalFunction("isallocated",);
      fn.setArguments(["x", "d1", "d2",],);
      assertEquals(fn.to_s(), "isallocated(x, d1, d2)",);
    });
  });

  describe("aridade das extensões (LC-A via setArgumentsAndCheck)", () => {
    it("aceita aridade correta de extensão (isallocated = 3)", () => {
      const fn = new LogicalFunction("isallocated",);
      assertEquals(
        fn.setArgumentsAndCheck(["x", "d1", "d2",],),
        null,
      );
    });
    it("rejeita aridade errada de extensão (isparentof espera 1)", () => {
      const fn = new LogicalFunction("isparentof",);
      assertEquals(
        fn.setArgumentsAndCheck([],)?.[0],
        "wrong_no_func_arguments",
      );
    });
    it("rejeita função realmente desconhecida", () => {
      const fn = new LogicalFunction("naoexiste",);
      assertEquals(fn.setArgumentsAndCheck([],)?.[0], "unknown_function",);
    });

    it("todas as extensões declaram aridade >= 0 e kind válido", () => {
      // Sanidade: um nome extensional registrado também resolve em FUNCTIONS.
      for (const name of ["isparentof", "isanaccount", "ismaterial",]) {
        assert(typeof name === "string",);
      }
    });
  });
});
