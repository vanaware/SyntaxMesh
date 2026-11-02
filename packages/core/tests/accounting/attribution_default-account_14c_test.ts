/**
 * 14C.9.2 — Regra 4 de `resolveAccount` usando a conta default do projeto.
 *
 * Sem `defaultaccount`, o resultado continua `account: null` (comportamento
 * anterior preservado). Com conta default, a linha passa a ser atribuída e o
 * `projectDefault` carrega a conta resolvida.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §11.2
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { Account, } from "../../src/model/account.ts";
import { Task, } from "../../src/model/task.ts";
import { CostLine, resolveAccount, } from "../../src/accounting/attribution.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";

describe("resolveAccount — regra 4 com defaultaccount (14C.9.2)", () => {
  it("sem conta default preserva account: null", () => {
    const project = createTestProject();
    const line: CostLine = {
      type: "resource_effort",
      amount: 100,
      project: project,
    };
    const result = resolveAccount(line,);
    assertEquals(result.rule, "project_default",);
    assertEquals(result.account, null,);
    assert(result.projectDefault,);
  });

  it("conta universal atribui a linha de material", () => {
    const project = createTestProject();
    const account = new Account(project, "custos", "Custos", null,);
    project.defaultAccountId = "custos";
    const line: CostLine = {
      type: "material_usage",
      amount: 100,
      project: project,
    };
    const result = resolveAccount(line,);
    assertEquals(result.rule, "project_default",);
    assertEquals(result.account, account,);
    assertEquals(result.projectDefault, account,);
  });

  it("variante por tipo vence a universal", () => {
    const project = createTestProject();
    new Account(project, "custos", "Custos", null,);
    const materiais = new Account(project, "materiais", "Materiais", null,);
    project.defaultAccountId = "custos";
    project.defaultAccountIds.set("material", "materiais",);
    const line: CostLine = {
      type: "material_usage",
      amount: 100,
      project: project,
    };
    assertEquals(resolveAccount(line,).account, materiais,);
  });

  it("fallback da tarefa sem chargeset também usa a conta default", () => {
    const project = createTestProject();
    project.defaultAccountId = "custos";
    const account = new Account(project, "custos", "Custos", null,);
    const task = new Task(project, "t1", "Task 1", null,);
    const line: CostLine = {
      type: "resource_effort",
      amount: 100,
      task: task,
      project: project,
    };
    const result = resolveAccount(line,);
    assertEquals(result.rule, "project_default",);
    assertEquals(result.account, account,);
  });

  it("conta explícita continua vencendo a default", () => {
    const project = createTestProject();
    project.defaultAccountId = "custos";
    new Account(project, "custos", "Custos", null,);
    const explicit = new Account(project, "outra", "Outra", null,);
    const line: CostLine = {
      type: "resource_effort",
      amount: 100,
      explicitAccount: explicit,
      project: project,
    };
    const result = resolveAccount(line,);
    assertEquals(result.rule, "explicit",);
    assertEquals(result.account, explicit,);
  });
});
