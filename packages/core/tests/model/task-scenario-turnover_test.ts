import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MockProject, } from "./mock-project.ts";
import { Task, } from "../../src/model/task.ts";
import { TaskScenario, } from "../../src/model/task-scenario.ts";
import { Resource, } from "../../src/model/resource.ts";
import { ResourceScenario, } from "../../src/model/resource-scenario.ts";
import { Account, } from "../../src/model/account.ts";
import { Charge, ChargeMode, } from "../../src/finance/charge.ts";
import { ChargeSet, } from "../../src/finance/charge-set.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

/**
 * Injeta um Charge no atributo `charge` da task.
 *
 * O atributo `charge` é tipado como `{ amount: number }[]` (formato do parser),
 * mas a implementação de `turnover` espera objetos `Charge`. Para testes
 * unitários, injetamos objetos Charge diretamente com um cast.
 */
function injectCharge(
  task: Task,
  amount: number,
  mode: ChargeMode,
  scIdx: number,
): void {
  const charge = new Charge(amount, mode, task, scIdx,);
  // O atributo `charge` espera { amount: number }[] (formato do parser),
  // mas a implementação de `turnover` espera objetos Charge. Injetamos com cast.
  // Acumula no array existente (setForScenario substitui o array inteiro).
  const current = (task.getForScenario("charge", scIdx,) as { amount: number }[] | null) ?? [];
  current.push(charge as unknown as { amount: number });
  task.setForScenario("charge", current, scIdx,);
}

/**
 * Injeta um ChargeSet no atributo `chargeset` da task.
 */
function injectChargeSet(
  task: Task,
  chargeSet: ChargeSet,
  scIdx: number,
): void {
  // O atributo `chargeset` espera ChargeSet[]
  task.setForScenario("chargeset", [chargeSet], scIdx,);
}

/**
 * Reserva os slots do recurso para a tarefa (do start ao end, exclusivo).
 */
function bookResource(
  resourceScenario: ResourceScenario,
  task: Task,
  scIdx: number,
  project: MockProject,
): void {
  const start = task.getForScenario("start", scIdx,) as TjTime;
  const end = task.getForScenario("end", scIdx,) as TjTime;
  const startIdx = project.dateToIdx(start,);
  const endIdx = project.dateToIdx(end,);
  console.log("Booking resource for task slots", startIdx, "to", endIdx, "(task start", start.toString(), "end", end.toString(), ")");
  for (let i = startIdx; i < endIdx; i++) {
    const available = resourceScenario.available(i,);
    console.log("Slot", i, "available?", available);
    const booked = resourceScenario.book(i, task,);
    console.log("Booked slot", i, "result", booked);
  }
}

describe("TaskScenario", () => {
  let project: MockProject;
  let task: Task;
  let taskScenario: TaskScenario;
  let resource: Resource;
  let resourceScenario: ResourceScenario;
  let account: Account;

  beforeEach(() => {
    project = new MockProject(1,);
    // Granularidade diária para que os índices correspondam a datas previsíveis.
    project.set("start", TjTime.fromString("2026-01-01",));
    project.set("end", TjTime.fromString("2026-12-31",));
    project.set("scheduleGranularity", 86400,);
    // 1 dia de trabalho = 24h para que os cálculos de custo sejam previsíveis
    // (2 dias * 24h * 100/h = 4800).
    project.set("dailyWorkingHours", 1,);
    task = new Task(project, "t1", "Task 1", null,);
    taskScenario = task.scenarioData(0,);
    resource = new Resource(project, "r1", "Resource 1", null,);
    resourceScenario = resource.scenarioData(0,);
    account = new Account(project, "acc1", "Account 1", null,);
  },);

  describe("turnover — sem custos", () => {
    it("retorna 0.0 para tarefa sem chargeset", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-02",), 0,);
      assertEquals(taskScenario.turnover(0, 365, account,), 0.0,);
    });

    it("retorna 0.0 para tarefa container sem chargeset", () => {
      const child = new Task(project, "t2", "Child", task,);
      child.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      child.setForScenario("end", TjTime.fromString("2026-01-02",), 0,);
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-02",), 0,);
      assertEquals(taskScenario.turnover(0, 365, account,), 0.0,);
    });
  });

  describe("turnover — perDiem charge", () => {
    it("soma charge perDiem dentro do intervalo", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      injectCharge(task, 100, "perDiem", 0,);
      injectChargeSet(task, chargeSet, 0,);
      // 2 dias * 100 = 200
      assertEquals(taskScenario.turnover(0, 365, account,), 200.0,);
    });

    it("exclui charge perDiem fora do intervalo", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      injectCharge(task, 100, "perDiem", 0,);
      injectChargeSet(task, chargeSet, 0,);
      // Intervalo 365-365 (dia 2026-12-31) não intersecta a tarefa
      assertEquals(taskScenario.turnover(365, 365, account,), 0.0,);
    });

    it("soma múltiplas charges perDiem", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      injectCharge(task, 100, "perDiem", 0,);
      injectCharge(task, 50, "perDiem", 0,);
      injectChargeSet(task, chargeSet, 0,);
      // 2 dias * (100 + 50) = 300
      assertEquals(taskScenario.turnover(0, 365, account,), 300.0,);
    });
  });

  describe("turnover — onStart charge", () => {
    it("soma charge onStart quando o start está no intervalo", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      injectCharge(task, 100, "onStart", 0,);
      injectChargeSet(task, chargeSet, 0,);
      assertEquals(taskScenario.turnover(0, 365, account,), 100.0,);
    });

    it("exclui charge onStart quando o start está fora do intervalo", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      injectCharge(task, 100, "onStart", 0,);
      injectChargeSet(task, chargeSet, 0,);
      // Intervalo começa em 2026-06-01, start da tarefa está fora
      assertEquals(taskScenario.turnover(151, 365, account,), 0.0,);
    });
  });

  describe("turnover — onEnd charge", () => {
    it("soma charge onEnd quando o end está no intervalo", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      injectCharge(task, 100, "onEnd", 0,);
      injectChargeSet(task, chargeSet, 0,);
      assertEquals(taskScenario.turnover(0, 365, account,), 100.0,);
    });

    it("exclui charge onEnd quando o end está fora do intervalo", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      injectCharge(task, 100, "onEnd", 0,);
      injectChargeSet(task, chargeSet, 0,);
      // Intervalo começa em 2026-01-04 (índice 3), end da tarefa (índice 2) está fora
      assertEquals(taskScenario.turnover(3, 365, account,), 0.0,);
    });
  });

  describe("turnover — resource cost", () => {
    it("soma custo do recurso alocado (rate * tempo)", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      resource.setForScenario("rate", 100, 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      resource.setForScenario("chargeset", [chargeSet], 0,);
      bookResource(resourceScenario, task, 0, project,);
      // 2 dias * 24h * 100/h = 4800
      assertEquals(taskScenario.turnover(0, 365, account, resource,), 4800.0,);
    });

    it("soma custo do recurso + charge perDiem", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      resource.setForScenario("rate", 100, 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 1.0,);
      resource.setForScenario("chargeset", [chargeSet], 0,);
      injectCharge(task, 100, "perDiem", 0,);
      bookResource(resourceScenario, task, 0, project,);
      // (2 dias * 24h * 100/h) + (2 dias * 100) = 4800 + 200 = 5000
      assertEquals(taskScenario.turnover(0, 365, account, resource,), 5000.0,);
    });
  });

  describe("turnover — chargeset share", () => {
    it("pesa o custo pelo share da conta", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      resource.setForScenario("rate", 100, 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 0.5,);
      resource.setForScenario("chargeset", [chargeSet], 0,);
      bookResource(resourceScenario, task, 0, project,);
      // (2 dias * 24h * 100/h) * 0.5 = 2400
      assertEquals(taskScenario.turnover(0, 365, account, resource,), 2400.0,);
    });

    it("exclui conta com share 0", () => {
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      resource.setForScenario("rate", 100, 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(account, 0.0,);
      resource.setForScenario("chargeset", [chargeSet], 0,);
      bookResource(resourceScenario, task, 0, project,);
      assertEquals(taskScenario.turnover(0, 365, account, resource,), 0.0,);
    });

    it("inclui conta filha do account", () => {
      const childAccount = new Account(project, "acc2", "Child Account", account,);
      task.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      task.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      resource.setForScenario("rate", 100, 0,);
      const chargeSet = new ChargeSet();
      chargeSet.addAccount(childAccount, 1.0,);
      resource.setForScenario("chargeset", [chargeSet], 0,);
      bookResource(resourceScenario, task, 0, project,);
      // 2 dias * 24h * 100/h = 4800 (conta filha é incluída)
      assertEquals(taskScenario.turnover(0, 365, account, resource,), 4800.0,);
    });
  });

  describe("turnover — container recursivo", () => {
    it("soma turnover dos filhos container", () => {
      const child = new Task(project, "t2", "Child", task,);
      child.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      child.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      const childScenario = child.scenarioData(0,);
      const childChargeSet = new ChargeSet();
      childChargeSet.addAccount(account, 1.0,);
      injectCharge(child, 100, "perDiem", 0,);
      injectChargeSet(child, childChargeSet, 0,);
      // 2 dias * 100 = 200
      assertEquals(taskScenario.turnover(0, 365, account,), 200.0,);
    });

    it("recursão 3 níveis soma tudo", () => {
      const child = new Task(project, "t2", "Child", task,);
      child.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      child.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      const childScenario = child.scenarioData(0,);
      const grandchild = new Task(project, "t3", "Grandchild", child,);
      grandchild.setForScenario("start", TjTime.fromString("2026-01-01",), 0,);
      grandchild.setForScenario("end", TjTime.fromString("2026-01-03",), 0,);
      const grandchildScenario = grandchild.scenarioData(0,);
      const childChargeSet = new ChargeSet();
      childChargeSet.addAccount(account, 1.0,);
      const grandchildChargeSet = new ChargeSet();
      grandchildChargeSet.addAccount(account, 1.0,);
      injectCharge(child, 100, "perDiem", 0,);
      injectChargeSet(child, childChargeSet, 0,);
      injectCharge(grandchild, 50, "perDiem", 0,);
      injectChargeSet(grandchild, grandchildChargeSet, 0,);
      // (2 * 100) + (2 * 50) = 300
      assertEquals(taskScenario.turnover(0, 365, account,), 300.0,);
    });
  });
});
