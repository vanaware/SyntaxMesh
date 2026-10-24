import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Account, } from "../../src/model/account.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Task, } from "../../src/model/task.ts";
import { Material, } from "../../src/model/material.ts";
import { ChargeSet, } from "../../src/finance/charge-set.ts";
import { CostLine, resolveAccount, } from "../../src/accounting/attribution.ts";

function makeAccount(project: Project, id: string, name: string,): Account {
  return new Account(project, id, name, null,);
}

function makeChargeset(project: Project, account: Account,): ChargeSet {
  const cs = new ChargeSet();
  cs.addAccount(account, 1.0,);
  return cs;
}

describe("Attribution Engine", () => {
  const project = createTestProject();

  it("Regra 1: explicitAccount presente → 'explicit'", () => {
    const account = makeAccount(project, "acc1", "Account 1",);
    const line: CostLine = {
      type: "task_charge",
      amount: 100,
      explicitAccount: account,
    };
    const result = resolveAccount(line,);
    assertEquals(result.account, account,);
    assertEquals(result.rule, "explicit",);
    assert(result.explicit,);
  });

  it("Regra 2: resource_effort → resource.chargeset → 'origin_chargeset'", () => {
    const resource = new Resource(project, "res1", "Resource 1", null,);
    const account = makeAccount(project, "acc1", "Account 1",);
    resource.chargeset.add(makeChargeset(project, account,),);

    const line: CostLine = {
      type: "resource_effort",
      amount: 200,
      resource: resource,
    };
    const result = resolveAccount(line,);
    assertEquals(result.account, account,);
    assertEquals(result.rule, "origin_chargeset",);
    assert(result.originChargeset,);
  });

  it("Regra 2: material_usage → material.chargeset → 'origin_chargeset'", () => {
    const material = new Material(project, "mat1", "Material 1", 10.0,);
    const account = makeAccount(project, "acc1", "Account 1",);
    material.chargeset.add(makeChargeset(project, account,),);

    const line: CostLine = {
      type: "material_usage",
      amount: 150,
      material: material,
    };
    const result = resolveAccount(line,);
    assertEquals(result.account, account,);
    assertEquals(result.rule, "origin_chargeset",);
    assert(result.originChargeset,);
  });

  it("Regra 2: task_charge → pula (não há origem separada)", () => {
    const task = new Task(project, "task1", "Task 1", null,);
    const line: CostLine = {
      type: "task_charge",
      amount: 100,
      task: task,
    };
    // task_charge sem chargeset cai em regra 4 (project_default) em vez de erro,
    // permitindo que charges sejam emitidas como CostEvents mesmo sem chargeset.
    const result = resolveAccount(line,);
    assertEquals(result.rule, "project_default",);
    assertEquals(result.account, null,);
    assert(result.projectDefault,);
  });

  it("Regra 3: task.chargeset.forType(type) → 'task_chargeset_fallback'", () => {
    const task = new Task(project, "task1", "Task 1", null,);
    const account = makeAccount(project, "acc1", "Account 1",);
    task.chargeset.add(makeChargeset(project, account,),);

    const line: CostLine = {
      type: "task_charge",
      amount: 100,
      task: task,
    };
    const result = resolveAccount(line,);
    assertEquals(result.account, account,);
    assertEquals(result.rule, "task_chargeset_fallback",);
    assert(result.taskChargeset,);
  });

  it("Regra 4: sem task → 'project_default'", () => {
    const line: CostLine = {
      type: "task_charge",
      amount: 100,
    };
    const result = resolveAccount(line,);
    assertEquals(result.account, null,);
    assertEquals(result.rule, "project_default",);
    assert(result.projectDefault,);
  });

  it("task.chargesetMode === 'force' → regra 2 ignorada", () => {
    const task = new Task(project, "task1", "Task 1", null,);
    const account = makeAccount(project, "acc1", "Account 1",);
    task.chargeset.add(makeChargeset(project, account,),);

    const line: CostLine = {
      type: "resource_effort",
      amount: 200,
      task: task,
    };
    const result = resolveAccount(line,);
    assertEquals(result.rule, "task_chargeset_fallback",);
    assertEquals(result.account, account,);
  });

  it("force + task sem chargeset do tipo → cai em regra 2 (fallback natural)", () => {
    const task = new Task(project, "task1", "Task 1", null,);
    task.chargesetMode = "force";
    const resource = new Resource(project, "res1", "Resource 1", null,);
    const account = makeAccount(project, "acc1", "Account 1",);
    resource.chargeset.add(makeChargeset(project, account,),);

    const line: CostLine = {
      type: "resource_effort",
      amount: 200,
      task: task,
      resource: resource,
    };
    const result = resolveAccount(line,);
    assertEquals(result.rule, "origin_chargeset",);
    assertEquals(result.account, account,);
  });

  it("Sem conta em nenhum nível → project_default para task_charge", () => {
    const task = new Task(project, "task1", "Task 1", null,);
    const line: CostLine = {
      type: "task_charge",
      amount: 100,
      task: task,
    };
    // task_charge sem chargeset cai em regra 4 (project_default) em vez de erro,
    // permitindo que charges sejam emitidos como CostEvents mesmo sem chargeset.
    const result = resolveAccount(line,);
    assertEquals(result.rule, "project_default",);
    assertEquals(result.account, null,);
    assert(result.projectDefault,);
  });

  it("Teste agregado: task force + resource com chargeset próprio → task domina", () => {
    const task = new Task(project, "task1", "Task 1", null,);
    task.chargesetMode = "force";
    const resource = new Resource(project, "res1", "Resource 1", null,);
    const taskAccount = makeAccount(project, "acc1", "Task Account",);
    const resourceAccount = makeAccount(project, "acc2", "Resource Account",);

    task.chargeset.add(makeChargeset(project, taskAccount,),);
    resource.chargeset.add(makeChargeset(project, resourceAccount,),);

    const line: CostLine = {
      type: "resource_effort",
      amount: 200,
      task: task,
      resource: resource,
    };
    const result = resolveAccount(line,);
    assertEquals(result.account, taskAccount,);
    assertEquals(result.rule, "task_chargeset_fallback",);
  });
});
