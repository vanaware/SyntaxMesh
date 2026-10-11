import { beforeEach, describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { MockProject, } from "./mock-project.ts";
import { Account, } from "../../src/model/account.ts";
import { AccountScenario, Query, } from "../../src/model/account-scenario.ts";
import { AccountCredit, } from "../../src/finance/account-credit.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("AccountScenario", () => {
  let project: MockProject;
  let root: Account;
  let child1: Account;
  let child2: Account;

  beforeEach(() => {
    project = new MockProject(1,);
    // Range de um ano inteiro, granularity diária (86400s), para que os
    // índices dos testes correspondam a datas previsíveis.
    project.set("start", TjTime.fromString("2026-01-01"));
    project.set("end", TjTime.fromString("2026-12-31"));
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
      const credit = new AccountCredit(TjTime.fromString("2026-06-15"), "Bonus", 5000,);
      root.setForScenario("credits", [credit], 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 5000.0,);
    });

    it("exclui credit antes do intervalo", () => {
      const credit = new AccountCredit(TjTime.fromString("2025-01-01"), "Old", 5000,);
      root.setForScenario("credits", [credit], 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 0.0,);
    });

    it("exclui credit no fim exato (intervalo [start, end))", () => {
      const credit = new AccountCredit(TjTime.fromString("2026-12-31"), "End", 5000,);
      root.setForScenario("credits", [credit], 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 364,), 0.0,);
    });

    it("soma múltiplos credits dentro do intervalo", () => {
      const credits = [
        new AccountCredit(TjTime.fromString("2026-03-15"), "A", 1000,),
        new AccountCredit(TjTime.fromString("2026-06-15"), "B", 2000,),
        new AccountCredit(TjTime.fromString("2026-09-15"), "C", 3000,),
      ];
      root.setForScenario("credits", credits, 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 6000.0,);
    });

    it("soma apenas credits dentro de sub-intervalo", () => {
      const credits = [
        new AccountCredit(TjTime.fromString("2026-03-15"), "A", 1000,),
        new AccountCredit(TjTime.fromString("2026-06-15"), "B", 2000,),
        new AccountCredit(TjTime.fromString("2026-09-15"), "C", 3000,),
      ];
      root.setForScenario("credits", credits, 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(100, 200,), 2000.0,);
    });
  });

  describe("turnover — container (filhos)", () => {
    it("soma turnover dos filhos diretos", () => {
      child1.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15"), "A", 1000,)], 0,);
      child2.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15"), "B", 2000,)], 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 3000.0,);
    });

    it("recursão: hierarquia 3 níveis soma tudo", () => {
      const grandchild = new Account(project, "gc", "Grandchild", child1,);
      grandchild.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15"), "GC", 500,)], 0,);
      child2.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15"), "B", 2000,)], 0,);
      const scenario = root.scenarioData(0,);
      assertEquals(scenario.turnover(0, 365,), 2500.0,);
    });
  });

  describe("turnover — meta-account", () => {
    it("calcula -cost + revenue", () => {
      const cost = new Account(project, "cost", "Cost", null,);
      const revenue = new Account(project, "rev", "Revenue", null,);
      cost.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15"), "C", 100,)], 0,);
      revenue.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15"), "R", 300,)], 0,);
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
      root.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15"), "A", 5000,)], 0,);
      const scenario = root.scenarioData(0,);
      const query: Query = {
        start: TjTime.fromString("2026-07-01"),
        end: TjTime.fromString("2026-12-31"),
        sortable: 0,
        numerical: 0,
        string: "",
        currencyFormat: { format: (amount: number,) => `$${amount.toFixed(2)}`, },
      };
      scenario.query_balance(query,);
      assertEquals(query.sortable, 5000.0,);
      assertEquals(query.numerical, 5000.0,);
      assertEquals(query.string, "$5000.00",);
    });
  });

  describe("query_turnover", () => {
    it("popula sortable, numerical e string", () => {
      root.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15"), "A", 5000,)], 0,);
      const scenario = root.scenarioData(0,);
      const query: Query = {
        start: TjTime.fromString("2026-01-01"),
        end: TjTime.fromString("2026-12-31"),
        sortable: 0,
        numerical: 0,
        string: "",
        currencyFormat: { format: (amount: number,) => `$${amount.toFixed(2)}`, },
      };
      scenario.query_turnover(query,);
      assertEquals(query.sortable, 5000.0,);
      assertEquals(query.numerical, 5000.0,);
      assertEquals(query.string, "$5000.00",);
    });
  });
});
