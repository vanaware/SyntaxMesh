/**
 * Testes do `accountreport` com materiais (Fase 14 Complemento 14C.1.19).
 *
 * Confirma que `AccountScenario.turnover`/`turnoverByType` já agregam
 * `CostEvent` do tipo `material_usage` no total da conta e no bucket
 * `material` — e que a agregação `aggregate materials` percorre
 * `project.materials` (e não `project.resources`, como antes).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.19)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Account, } from "../../src/model/account.ts";
import { Material, } from "../../src/model/material.ts";
import { CostEvent, } from "../../src/model/cost-event.ts";
import { Task, } from "../../src/model/task.ts";
import type { AccountScenario, } from "../../src/model/account-scenario.ts";

describe("materiais no accountreport (14C.1.19)", () => {
  let project: Project;
  let account: Account;
  let steel: Material;

  beforeEach(() => {
    project = createTestProject(1,);
    account = new Account(project, "cost", "Cost", null,);
    steel = new Material(project, "steel", "kg", 2.5,);
    steel.set("unit", "kg",);
    steel.set("cost", 2.5,);
    steel.set("totalquantity", 100,);
    const task = new Task(project, "t1", "T1", null,);
    project.costEvents.push(
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
    );
  },);

  it("turnoverByType('material') soma os CostEvent de material da conta", () => {
    const scenarioData = account.scenarioData(0,) as AccountScenario;
    const end = project.dateToIdx(
      project.get("end",) as never,
    );
    assertEquals(scenarioData.turnoverByType(0, end, "material",), 250,);
    assertEquals(scenarioData.turnoverByType(0, end, "task",), 0,);
  });

  it("aggregate materials soma Material#totalCost() de project.materials", () => {
    // Projeto limpo (sem CostEvent) para isolar a agregação por material: a
    // invariante 8.2 `sum(buckets) === total` não admite a soma dupla.
    const clean = createTestProject(1,);
    const costAccount = new Account(clean, "cost", "Cost", null,);
    costAccount.set("aggregate", "materials",);
    const steel = new Material(clean, "steel", "kg", 2.5,);
    steel.set("unit", "kg",);
    steel.set("cost", 2.5,);
    steel.set("totalquantity", 100,);
    const cement = new Material(clean, "cement", "bag", 10,);
    cement.set("cost", 10,);
    cement.set("totalquantity", 5,);

    const scenarioData = costAccount.scenarioData(0,) as AccountScenario;
    const end = clean.dateToIdx(
      clean.get("end",) as never,
    );
    // `aggregate materials` percorre `project.materials` (e não
    // `project.resources`, como antes): 100 × 2.5 + 5 × 10 = 300.
    assertEquals(scenarioData.turnover(0, end,), 300,);
    assertEquals(scenarioData.getBuckets().material, 300,);
    assertEquals(scenarioData.getBuckets().task, 0,);
  });
});
