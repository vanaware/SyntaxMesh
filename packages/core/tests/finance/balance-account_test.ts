import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Account, } from "../../src/model/account.ts";
import { AccountCredit, } from "../../src/finance/account-credit.ts";
import { balanceAccount, } from "../../src/finance/balance-account.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("BalanceAccount", () => {
  let project: Project;
  let costAccount: Account;
  let revenueAccount: Account;
  let metaAccount: Account;

  beforeEach(() => {
    project = createTestProject(1,);
    // Granularidade diária para que os índices correspondam a datas previsíveis.
    project.set("start", TjTime.fromString("2026-01-01",));
    project.set("end", TjTime.fromString("2026-12-31",));
    project.set("scheduleGranularity", 86400,);

    costAccount = new Account(project, "cost", "Cost", null,);
    revenueAccount = new Account(project, "revenue", "Revenue", null,);
    metaAccount = new Account(project, "meta", "Meta Account", null,);
    metaAccount.adoptees.push(costAccount, revenueAccount,);
  },);

  describe("balanceAccount — básico", () => {
    it("calcula -cost + revenue quando ambos têm valores", () => {
      costAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "C", 100,)], 0,);
      revenueAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "R", 300,)], 0,);
      const result = balanceAccount(metaAccount, 0, 365,);
      assertEquals(result, 200.0,); // -100 + 300 = 200
    });

    it("calcula -cost + revenue quando cost é 0", () => {
      costAccount.setForScenario("credits", [], 0,);
      revenueAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "R", 500,)], 0,);
      const result = balanceAccount(metaAccount, 0, 365,);
      assertEquals(result, 500.0,); // -0 + 500 = 500
    });

    it("calcula -cost + revenue quando revenue é 0", () => {
      costAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "C", 200,)], 0,);
      revenueAccount.setForScenario("credits", [], 0,);
      const result = balanceAccount(metaAccount, 0, 365,);
      assertEquals(result, -200.0,); // -200 + 0 = -200
    });

    it("calcula -cost + revenue quando ambos são 0", () => {
      costAccount.setForScenario("credits", [], 0,);
      revenueAccount.setForScenario("credits", [], 0,);
      const result = balanceAccount(metaAccount, 0, 365,);
      assertEquals(result, 0.0,); // -0 + 0 = 0
    });

    it("calcula -cost + revenue com valores negativos", () => {
      costAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "C", -100,)], 0,);
      revenueAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "R", -200,)], 0,);
      const result = balanceAccount(metaAccount, 0, 365,);
      assertEquals(result, -100.0,); // -(-100) + (-200) = 100 - 200 = -100
    });
  });

  describe("balanceAccount — intervalo de tempo", () => {
    it("exclui cost antes do intervalo", () => {
      costAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2025-12-31",), "C", 100,)], 0,);
      revenueAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "R", 300,)], 0,);
      const result = balanceAccount(metaAccount, 0, 365,);
      assertEquals(result, 300.0,); // -0 + 300 = 300
    });

    it("exclui cost no fim exato (intervalo [start, end))", () => {
      costAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-12-31",), "C", 100,)], 0,);
      revenueAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "R", 300,)], 0,);
      const result = balanceAccount(metaAccount, 0, 364,); // Intervalo [0, 364) exclui índice 364
      assertEquals(result, 300.0,); // -0 + 300 = 300
    });

    it("exclui revenue antes do intervalo", () => {
      costAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "C", 100,)], 0,);
      revenueAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2025-12-31",), "R", 300,)], 0,);
      const result = balanceAccount(metaAccount, 0, 365,);
      assertEquals(result, -100.0,); // -100 + 0 = -100
    });

    it("exclui revenue no fim exato (intervalo [start, end))", () => {
      costAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "C", 100,)], 0,);
      revenueAccount.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-12-31",), "R", 300,)], 0,);
      const result = balanceAccount(metaAccount, 0, 364,); // Intervalo [0, 364) exclui índice 364
      assertEquals(result, -100.0,); // -100 + 0 = -100
    });
  });

  describe("balanceAccount — container (adoptees)", () => {
    it("soma turnover dos filhos diretos", () => {
      const meta = new Account(project, "meta2", "Meta 2", null,);
      const costChild = new Account(project, "cost2", "Cost Child", null,);
      const revChild = new Account(project, "rev2", "Revenue Child", null,);
      meta.adopt(costChild,);
      meta.adopt(revChild,);
      costChild.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "C1", 100,)], 0,);
      revChild.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "R1", 200,)], 0,);
      const result = balanceAccount(meta, 0, 365,);
      assertEquals(result, 100.0,); // -100 + 200 = 100
    });

    it("recursão: hierarquia 3 níveis soma tudo", () => {
      const meta = new Account(project, "meta3", "Meta 3", null,);
      const costChild = new Account(project, "cost3", "Cost Child", null,);
      const grandchild = new Account(project, "gc", "Grandchild", costChild,);
      const revChild = new Account(project, "rev3", "Revenue Child", null,);
      meta.adopt(costChild,);
      meta.adopt(revChild,);
      costChild.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "C1", 100,)], 0,);
      grandchild.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "GC", 50,)], 0,);
      revChild.setForScenario("credits", [new AccountCredit(TjTime.fromString("2026-06-15",), "R1", 200,)], 0,);
      const result = balanceAccount(meta, 0, 365,);
      assertEquals(result, 50.0,); // -(100 + 50) + 200 = 50
    });
  });

  describe("balanceAccount — erro", () => {
    it("lança erro quando meta-account não tem filhos", () => {
      const emptyMetaAccount = new Account(project, "empty", "Empty Meta", null,);
      assertThrows(() => balanceAccount(emptyMetaAccount, 0, 365,), Error,);
    });

    it("lança erro quando meta-account tem apenas um filho", () => {
      const singleChild = new Account(project, "single", "Single", null,);
      const singleMetaAccount = new Account(project, "singleMeta", "Single Meta", null,);
      singleMetaAccount.adopt(singleChild,);
      assertThrows(() => balanceAccount(singleMetaAccount, 0, 365,), Error,);
    });

    it("lança erro quando meta-account tem três filhos", () => {
      const child1 = new Account(project, "child1", "Child 1", null,);
      const child2 = new Account(project, "child2", "Child 2", null,);
      const child3 = new Account(project, "child3", "Child 3", null,);
      const tripleMetaAccount = new Account(project, "tripleMeta", "Triple Meta", null,);
      tripleMetaAccount.adopt(child1,);
      tripleMetaAccount.adopt(child2,);
      tripleMetaAccount.adopt(child3,);
      assertThrows(() => balanceAccount(tripleMetaAccount, 0, 365,), Error,);
    });
  });
});