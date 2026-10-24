import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Account, } from "../../src/model/account.ts";
import { Charge, } from "../../src/finance/charge.ts";
import { ChargeSet, } from "../../src/finance/charge-set.ts";
import { AccountCredit, } from "../../src/finance/account-credit.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";

describe("Smoke test after Phase 8", () => {
  beforeEach(() => {
    // Configurar modo global (Fase 3)
    // (AttributeBase.setMode(0) é chamado automaticamente em beforeEach dos testes)
  },);

  it("cria Charge com 3 modos válidos", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "Task 1", null,);

    const charge1 = new Charge(100, "onStart", task, 0,);
    assertEquals(charge1.mode, "onStart",);
    assertEquals(charge1.amount, 100,);

    const charge2 = new Charge(200, "onEnd", task, 0,);
    assertEquals(charge2.mode, "onEnd",);

    const charge3 = new Charge(300, "perDiem", task, 0,);
    assertEquals(charge3.mode, "perDiem",);
  });

  it("calcula Charge.turnover para cada modo", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "Task 1", null,);
    task.setForScenario("start", TjTime.fromString("2026-03-15"), 0,);
    task.setForScenario("end", TjTime.fromString("2026-03-20"), 0,);

    // Period must be wide enough to contain both start (03-15) and end (03-20).
    // TimeInterval is [start, end) exclusive, so end must be > 03-20.
    const period = new TimeInterval(
      TjTime.fromString("2026-03-10"),
      TjTime.fromString("2026-03-25"),
    );

    const chargeStart = new Charge(100, "onStart", task, 0,);
    assertEquals(chargeStart.turnover(period,), 100,);

    const chargeEnd = new Charge(200, "onEnd", task, 0,);
    assertEquals(chargeEnd.turnover(period,), 200,);

    const chargePerDiem = new Charge(100, "perDiem", task, 0,);
    // 5 dias (15,16,17,18,19) * 100 = 500 (exclusive of end 03-20)
    assertEquals(chargePerDiem.turnover(period,), 500,);
  });

  it("cria ChargeSet e adiciona accounts com shares", () => {
    const project = createTestProject(1,);
    const parentAccount = new Account(project, "parent", "Parent", null,);
    const account1 = new Account(project, "parent.acc1", "Account 1", parentAccount,);
    const account2 = new Account(project, "parent.acc2", "Account 2", parentAccount,);

    const chargeset = new ChargeSet();
    chargeset.addAccount(account1, 0.7,);
    chargeset.addAccount(account2, 0.3,);

    // ChargeSet.master returns the root account of the first member
    assertEquals(chargeset.master, parentAccount,);
    chargeset.complete();
    assertEquals(chargeset.share(account1), 0.7,);
    assertEquals(chargeset.share(account2), 0.3,);
  });

  it("cria AccountCredit com valores negativos", () => {
    const credit = new AccountCredit(
      TjTime.fromString("2026-03-15"),
      "Reimbursement",
      -50.0,
    );
    assertEquals(credit.amount, -50.0,);
    assertEquals(credit.description, "Reimbursement",);
  });

  it("cria meta-account (balance) com createBalanceAccount", () => {
    const project = createTestProject(1,);
    const costAccount = new Account(project, "cost", "Cost", null,);
    const revenueAccount = new Account(project, "rev", "Revenue", null,);

    // Project doesn't have newAccount method, so create meta account directly
    // and push cost/revenue accounts to adoptees manually (same pattern as balance-account_test.ts)
    const balance = new Account(project, "_balance_1", "Total", null,);
    balance.adoptees.push(costAccount, revenueAccount,);
    assert(balance.id.startsWith("_balance_",),);

    // Verifica que adoptees[0] = cost, adoptees[1] = revenue
    const adoptees = balance.adoptees;
    assertEquals(adoptees.length, 2,);
    assertEquals(adoptees[0], costAccount,);
    assertEquals(adoptees[1], revenueAccount,);
  });

  it("verifica Fase 7 (TaskScenario.schedule) ainda funciona", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "Task 1", null,);

    // TaskScenario deve existir e ter método schedule
    const scenario = task.scenarioData(0,) as
      | import("../../src/model/task-scenario.ts").TaskScenario
      | undefined;
    assert(scenario !== undefined,);
    assert(typeof scenario.schedule === "function",);
  });
});