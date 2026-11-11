/**
 * F14-C §13.7 / 14C.15.4 (Fase 21 1ª onda, 2026-11-10) — consumer contábil de
 * `booking charge`.
 *
 * O parser já depositava a booking em `chargebookings` da tarefa; faltava o
 * lado contábil — transformar a booking em `CostEvent` `task_charge` no modo
 * `actual` e fazê-la aparecer no turnover da conta que `resolveAccount`
 * atribui (regra 3: `chargeset` da tarefa; regra 4: `defaultaccount` do
 * projeto). Cobre também a idempotência por booking.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §13.7
 * @see docs/syntaxmesh/fases/completude-matrix.md §D/D9
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Account, } from "../../src/model/account.ts";
import { Task, } from "../../src/model/task.ts";
import { ChargeBooking, } from "../../src/model/charge-booking.ts";
import { ChargeSet, } from "../../src/finance/charge-set.ts";
import { ChargeSetCollection, } from "../../src/finance/charge-set-collection.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

Deno.env.set("TZ", "UTC",);
TjTime.setTimeZone("UTC",);

const D = (s: string,) => TjTime.fromString(s,);

function attachBooking(
  _project: Project,
  task: Task,
  amount: number,
  date: TjTime,
): ChargeBooking {
  const booking = new ChargeBooking(null, null, amount, date, task,);
  const current = (task.getForScenario("chargebookings", 0,) ??
    []) as ChargeBooking[];
  task.setForScenario("chargebookings", current.concat([booking,],), 0,);
  return booking;
}

/** Attach a single-account chargeset to the task (rule 3 of `resolveAccount`). */
function taskChargeset(task: Task, account: Account,): void {
  const set = new ChargeSet();
  set.addAccount(account, 1.0,);
  const collection = new ChargeSetCollection();
  collection.add(set,);
  task.chargeset = collection;
}

describe("AccountScenario · addChargeBookings (F21 1ª onda, F14-C §13.7)", () => {
  let project: Project;
  let account: Account;
  let other: Account;
  let task: Task;

  beforeEach(() => {
    project = createTestProject(1,);
    project.set("start", D("2026-01-01",),);
    project.set("end", D("2026-12-31",),);
    project.set("scheduleGranularity", 86400,);
    account = new Account(project, "acc", "Acc", null,);
    account.set("aggregate", "charges",);
    other = new Account(project, "other", "Other", null,);
    other.set("aggregate", "charges",);
    task = new Task(project, "t1", "Task 1", null,);
  },);

  it("booking com chargeset da tarefa (regra 3) entra no turnover", () => {
    taskChargeset(task, account,);
    attachBooking(project, task, 48000, D("2026-06-15",),);

    const scenario = account.scenarioData(0,);
    const total = scenario.turnover(0, 365,);
    assertEquals(total, 48000,);
    assertEquals(scenario.getBuckets().charge, 48000,);
  });

  it("booking fora da janela [start, end) não conta", () => {
    taskChargeset(task, account,);
    attachBooking(project, task, 48000, D("2025-06-15",),);

    const scenario = account.scenarioData(0,);
    assertEquals(scenario.turnover(0, 365,), 0.0,);
  });

  it("estorno (amount negativo) subtrai do turnover", () => {
    taskChargeset(task, account,);
    attachBooking(project, task, -1200, D("2026-03-01",),);
    const scenario = account.scenarioData(0,);
    assertEquals(scenario.turnover(0, 365,), -1200,);
  });

  it("emite CostEvent task_charge/actual idempotente", () => {
    taskChargeset(task, account,);
    const booking = attachBooking(project, task, 5000, D("2026-04-10",),);

    const scenario = account.scenarioData(0,);
    scenario.turnover(0, 365,);
    const events = project.costEvents.filter((e,) => e.type === "task_charge");
    assertEquals(events.length, 1, "primeiro turnover não emitiu 1 evento",);
    assertEquals(events[0]!.amount, 5000,);
    assertEquals(events[0]!.mode, "actual",);
    assert(task.chargeBookingEmitted(booking,), "booking não marcada",);

    // Turnover chamado novamente não deve duplicar o CostEvent.
    scenario.turnover(0, 365,);
    assertEquals(
      project.costEvents.filter((e,) => e.type === "task_charge").length,
      1,
      "segundo turnover duplicou CostEvent",
    );
  });

  it("booking sem chargeset cai em defaultaccount do projeto (regra 4)", () => {
    project.defaultAccountId = "acc";
    attachBooking(project, task, 900, D("2026-05-01",),);

    const scenario = account.scenarioData(0,);
    assertEquals(scenario.turnover(0, 365,), 900,);
  });

  it("booking para conta irmã não entra no turnover desta conta", () => {
    taskChargeset(task, other,);
    attachBooking(project, task, 1000, D("2026-06-01",),);

    const scenario = account.scenarioData(0,);
    assertEquals(scenario.turnover(0, 365,), 0.0,);
    const otherScenario = other.scenarioData(0,);
    assertEquals(otherScenario.turnover(0, 365,), 1000,);
  });
});
