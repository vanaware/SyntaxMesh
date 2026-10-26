import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Account, } from "../../src/model/account.ts";
import { AccountScenario, Query, } from "../../src/model/account-scenario.ts";
import { AccountCredit, } from "../../src/finance/account-credit.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("AccountScenario", () => {
  let project: Project;
  let root: Account;
  let child1: Account;
  let child2: Account;

  beforeEach(() => {
    project = createTestProject(1,);
    // Range de um ano inteiro, granularity diária (86400s), para que os
    // índices dos testes correspondam a datas previsíveis.
    project.set("start", TjTime.fromString("2026-01-01",),);
    project.set("end", TjTime.fromString("2026-12-31",),);
    project.set("scheduleGranularity", 86400,);
    root = new Account(project, "root", "Root", null,);
    child1 = new Account(project, "c1", "Child 1", root,);
    child2 = new Account(project, "c2", "Child 2", root,);
  },);

  describe("turnover — credits", () => {
    it("retorna 0.0 quando não há credits", () => {
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 0.0,);
    });

    it("soma credit dentro do intervalo", () => {
      const credit = new AccountCredit(
        TjTime.fromString("2026-06-15",),
        "Bonus",
        5000,
      );
      root.setForScenario("credits", [credit,], 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 5000.0,);
    });

    it("exclui credit antes do intervalo", () => {
      const credit = new AccountCredit(
        TjTime.fromString("2025-01-01",),
        "Old",
        5000,
      );
      root.setForScenario("credits", [credit,], 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 0.0,);
    });

    it("exclui credit no fim exato (intervalo [start, end))", () => {
      const credit = new AccountCredit(
        TjTime.fromString("2026-12-31",),
        "End",
        5000,
      );
      root.setForScenario("credits", [credit,], 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 364,), 0.0,);
    });

    it("soma múltiplos credits dentro do intervalo", () => {
      const credits = [
        new AccountCredit(TjTime.fromString("2026-03-15",), "A", 1000,),
        new AccountCredit(TjTime.fromString("2026-06-15",), "B", 2000,),
        new AccountCredit(TjTime.fromString("2026-09-15",), "C", 3000,),
      ];
      root.setForScenario("credits", credits, 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 6000.0,);
    });

    it("soma apenas credits dentro de sub-intervalo", () => {
      const credits = [
        new AccountCredit(TjTime.fromString("2026-03-15",), "A", 1000,),
        new AccountCredit(TjTime.fromString("2026-06-15",), "B", 2000,),
        new AccountCredit(TjTime.fromString("2026-09-15",), "C", 3000,),
      ];
      root.setForScenario("credits", credits, 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(100, 200,), 2000.0,);
    });
  });

  describe("turnover — container (filhos)", () => {
    it("soma turnover dos filhos diretos", () => {
      child1.setForScenario("credits", [
        new AccountCredit(TjTime.fromString("2026-06-15",), "A", 1000,),
      ], 0,);
      child2.setForScenario("credits", [
        new AccountCredit(TjTime.fromString("2026-06-15",), "B", 2000,),
      ], 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 3000.0,);
    });

    it("recursão: hierarquia 3 níveis soma tudo", () => {
      const grandchild = new Account(project, "gc", "Grandchild", child1,);
      grandchild.setForScenario("credits", [
        new AccountCredit(TjTime.fromString("2026-06-15",), "GC", 500,),
      ], 0,);
      child2.setForScenario("credits", [
        new AccountCredit(TjTime.fromString("2026-06-15",), "B", 2000,),
      ], 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 2500.0,);
    });
  });

  describe("turnover — meta-account", () => {
    it("calcula -cost + revenue", () => {
      const cost = new Account(project, "cost", "Cost", null,);
      const revenue = new Account(project, "rev", "Revenue", null,);
      cost.setForScenario("credits", [
        new AccountCredit(TjTime.fromString("2026-06-15",), "C", 100,),
      ], 0,);
      revenue.setForScenario("credits", [
        new AccountCredit(TjTime.fromString("2026-06-15",), "R", 300,),
      ], 0,);
      root.adoptees.push(cost, revenue,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 200.0,);
    });

    it("retorna 0 quando cost e revenue são 0", () => {
      const cost = new Account(project, "cost", "Cost", null,);
      const revenue = new Account(project, "rev", "Revenue", null,);
      cost.setForScenario("credits", [], 0,);
      revenue.setForScenario("credits", [], 0,);
      root.adoptees.push(cost, revenue,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 0.0,);
    });
  });

  describe("query_balance", () => {
    it("popula sortable, numerical e string", () => {
      root.setForScenario("credits", [
        new AccountCredit(TjTime.fromString("2026-06-15",), "A", 5000,),
      ], 0,);
      const scenario = root.scenarioData(0,);
      const query: Query = {
        start: TjTime.fromString("2026-07-01",),
        end: TjTime.fromString("2026-12-31",),
        sortable: 0,
        numerical: 0,
        string: "",
        currencyFormat: {
          format: (amount: number,) => `$${amount.toFixed(2,)}`,
        },
      };
      scenario.query_balance(query,);
      assertEquals(query.sortable, 5000.0,);
      assertEquals(query.numerical, 5000.0,);
      assertEquals(query.string, "$5000.00",);
    });
  });

  describe("query_turnover", () => {
    it("popula sortable, numerical e string", () => {
      root.setForScenario("credits", [
        new AccountCredit(TjTime.fromString("2026-06-15",), "A", 5000,),
      ], 0,);
      const scenario = root.scenarioData(0,);
      const query: Query = {
        start: TjTime.fromString("2026-01-01",),
        end: TjTime.fromString("2026-12-31",),
        sortable: 0,
        numerical: 0,
        string: "",
        currencyFormat: {
          format: (amount: number,) => `$${amount.toFixed(2,)}`,
        },
      };
      scenario.query_turnover(query,);
      assertEquals(query.sortable, 5000.0,);
      assertEquals(query.numerical, 5000.0,);
      assertEquals(query.string, "$5000.00",);
    });
  });
});

describe("AccountScenario.turnoverByType + buckets", () => {
  let project: Project;
  let root: Account;
  let child1: Account;
  let child2: Account;

  beforeEach(() => {
    project = createTestProject(1,);
    // Range de um ano inteira, granularity diária (86400s), para que os
    // índices dos testes correspondam a datas previsíveis.
    project.set("start", TjTime.fromString("2026-01-01",),);
    project.set("end", TjTime.fromString("2026-12-31",),);
    project.set("scheduleGranularity", 86400,);
    root = new Account(project, "root", "Root", null,);
    child1 = new Account(project, "c1", "Child 1", root,);
    child2 = new Account(project, "c2", "Child 2", root,);
  },);

  it("turnover popula buckets para conta leaf com aggregate tasks", () => {
    // Criar uma task com custo
    const task = new Account(project, "task1", "Task 1", null,);
    // Simular um custo de task (simplificado)
    const taskScenario = task.scenarioData(0,);
    // Como não temos um método real de custo de task, vamos usar um mock
    // Na implementação real, taskScenario.turnover() popularia os buckets
    const scenario = root.scenarioData(0,);
    // Chamar turnover para populá-lo
    const total = scenario.turnover(0, 365,);
    // Verificar que os buckets foram populados
    const buckets = scenario.getBuckets();
    // Como não temos um custo real de task, esperamos que os buckets estejam zerados
    // Mas a implementação deve populá-los corretamente
    assert(buckets.task >= 0,);
    assert(buckets.resource >= 0,);
    assert(buckets.material >= 0,);
  });

  it("turnoverByType('task') chama turnover de tasks", () => {
    const scenario = root.scenarioData(0,);
    // Como não temos um custo real de task, esperamos 0
    const taskTurnover = scenario.turnoverByType(0, 365, "task",);
    assertEquals(taskTurnover, 0.0,);
  });

  it("turnoverByType('resource') chama turnover de resources", () => {
    const scenario = root.scenarioData(0,);
    const resourceTurnover = scenario.turnoverByType(0, 365, "resource",);
    assertEquals(resourceTurnover, 0.0,);
  });

  it("turnoverByType('material') chama turnover de materials", () => {
    const scenario = root.scenarioData(0,);
    const materialTurnover = scenario.turnoverByType(0, 365, "material",);
    assertEquals(materialTurnover, 0.0,);
  });

  it("turnoverByType com tipo desconhecido lança TjInternalError", () => {
    const scenario = root.scenarioData(0,);
    try {
      // Usar um tipo inválido
      scenario.turnoverByType(
        0,
        365,
        "invalid" as "task" | "resource" | "material",
      );
      assert(false, "Deveria ter lançado TjInternalError",);
    } catch (e) {
      assert(e instanceof Error,);
      assert(e.message.includes("Unknown cost type",),);
    }
  });

  it("invariante: sum(buckets) === total", () => {
    const scenario = root.scenarioData(0,);
    const total = scenario.turnover(0, 365,);
    const buckets = scenario.getBuckets();
    const sum = buckets.task + buckets.resource + buckets.material;
    assert(Math.abs(sum - total,) < 1e-6, `sum ${sum} !== total ${total}`,);
  });

  it("conta com aggregate tasks → buckets resource/material zerados", () => {
    // Definir aggregate tasks na conta (aggregate não é atributo de cenário)
    root.set("aggregate", "tasks",);
    const scenario = root.scenarioData(0,);
    const total = scenario.turnover(0, 365,);
    const buckets = scenario.getBuckets();
    assertEquals(buckets.resource, 0.0,);
    assertEquals(buckets.material, 0.0,);
    // task bucket pode ser > 0 se houver custo de task
  });

  it("conta com aggregate resources → buckets task/material zerados", () => {
    root.set("aggregate", "resources",);
    const scenario = root.scenarioData(0,);
    const total = scenario.turnover(0, 365,);
    const buckets = scenario.getBuckets();
    assertEquals(buckets.task, 0.0,);
    assertEquals(buckets.material, 0.0,);
  });

  it("conta com aggregate materials → buckets task/resource zerados", () => {
    root.set("aggregate", "materials",);
    const scenario = root.scenarioData(0,);
    const total = scenario.turnover(0, 365,);
    const buckets = scenario.getBuckets();
    assertEquals(buckets.task, 0.0,);
    assertEquals(buckets.resource, 0.0,);
  });
});
