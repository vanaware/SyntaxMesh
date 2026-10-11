import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MockProject, } from "./mock-project.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Task, } from "../../src/model/task.ts";
import { ResourceScenario, } from "../../src/model/resource-scenario.ts";
import { Account, } from "../../src/model/account.ts";
import { Booking, } from "../../src/scheduling/booking.ts";
import { ScoreboardInterval, } from "../../src/time/scoreboard-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("ResourceScenario", () => {
  let project: MockProject;
  let resource: Resource;
  let resourceScenario: ResourceScenario;

  beforeEach(() => {
    project = new MockProject(1,);
    resource = new Resource(project, "r1", "Resource 1", null,);
    resourceScenario = resource.scenarioData(0,);
  },);

  it("constructor pré-carrega atributos", () => {
    // Verificar que os atributos foram pré-carregados
    assertEquals(resourceScenario.a("rate",), 0,);
    assertEquals(resourceScenario.a("efficiency",), 1,);
    assertEquals(resourceScenario.a("limits",), null,);
    assertEquals(resourceScenario.a("shifts",), null,);
    assertEquals(resourceScenario.a("workinghours",), null,);
    assertEquals(resourceScenario.a("leaves",), [],);
    assertEquals(resourceScenario.a("leaveallowances",), [],);
    assertEquals(resourceScenario.a("managers",), [],);
    assertEquals(resourceScenario.a("reports",), [],);
    assertEquals(resourceScenario.a("duties",), [],);
    assertEquals(resourceScenario.a("criticalness",), 0,);
    assertEquals(resourceScenario.a("chargeset",), [],);
    assertEquals(resourceScenario.a("alloctdeffort",), 0,);
    assertEquals(resourceScenario.a("directreports",), [],);
  });

  it("a retorna valor de atributo", () => {
    // Definir um valor de atributo
    resource.setForScenario("rate", 100, 0,);
    assertEquals(resourceScenario.a("rate",), 100,);
  });

  it("a retorna null para atributo não definido", () => {
    assertEquals(resourceScenario.a("nonexistent",), null,);
  });

  it("constructor cria ResourceScenario com resource e scenarioIdx corretos", () => {
    assertEquals(resourceScenario.getProperty(), resource,);
    assertEquals(resourceScenario.getScenarioIdx(), 0,);
  });

  it("constructor com múltiplos cenários", () => {
    const project2 = new MockProject(3,);
    const resource2 = new Resource(project2, "r2", "Resource 2", null,);
    assertEquals(resource2.scenarioData(0,).getScenarioIdx(), 0,);
    assertEquals(resource2.scenarioData(1,).getScenarioIdx(), 1,);
    assertEquals(resource2.scenarioData(2,).getScenarioIdx(), 2,);
  });

  it("onShift retorna true se shifts não definido e workinghours não definido", () => {
    // Sem shifts e sem workinghours definidos
    assertEquals(resourceScenario.onShift(0,), true,);
  });

  it("onShift retorna valor de shifts se definido", () => {
    // TODO(@username): Implementar teste com shifts definido
    // Por enquanto, apenas verificar que o método existe
    assertEquals(typeof resourceScenario.onShift, "function",);
  });

  it("available retorna true para slot não ocupado", () => {
    // O scoreboard é inicializado lazy em available() quando necessário
    assertEquals(resourceScenario.available(0,), true,);
  });

  it("booked retorna false para slot não ocupado", () => {
    // O scoreboard é inicializado lazy em booked() quando necessário
    assertEquals(resourceScenario.booked(0,), false,);
  });

  it("bookedTask retorna null para slot não ocupado", () => {
    // O scoreboard é inicializado lazy em bookedTask() quando necessário
    assertEquals(resourceScenario.bookedTask(0,), null,);
  });

  it("book registra ocupação para slot", () => {
    const project2 = new MockProject(1,);
    const resource2 = new Resource(project2, "r2", "Resource 2", null,);
    const task = new Task(project2, "t1", "Task 1", null,);
    const resourceScenario2 = resource2.scenarioData(0,);
    // O scoreboard é inicializado lazy em book() via available()
    resourceScenario2.book(0, task,);
    assertEquals(resourceScenario2.booked(0,), true,);
  });

  it("bookBooking registra ocupação com tarefa", () => {
    const project2 = new MockProject(1,);
    const resource2 = new Resource(project2, "r2", "Resource 2", null,);
    const task = new Task(project2, "t1", "Task 1", null,);
    const resourceScenario2 = resource2.scenarioData(0,);
    const booking = new Booking(
      resource2,
      task,
      [
        new ScoreboardInterval(
          TjTime.fromDate(new Date("2026-01-01T00:00:00Z",),),
          3600,
          0,
          1,
        ),
      ],
    );
    resourceScenario2.bookBooking(0, booking,);
    assertEquals(resourceScenario2.booked(0,), true,);
    assertEquals(resourceScenario2.bookedTask(0,), task,);
  });

  it("bookedEffort retorna 0 inicialmente", () => {
    assertEquals(resourceScenario.bookedEffort(), 0,);
  });

  it("getMinSlot retorna o primeiro slot disponível", () => {
    // initScoreboard marca todos os slots como disponíveis (onShift = true)
    // e define minslot com o primeiro slot disponível.
    assertEquals(resourceScenario.getMinSlot(), 0,);
  });

  it("getMaxSlot retorna o último slot disponível", () => {
    // initScoreboard define maxslot como o último slot disponível.
    assertEquals(
      resourceScenario.getMaxSlot(),
      resourceScenario.scoreboard!.size - 1,
    );
  });

  it("rate retorna taxa do recurso", () => {
    assertEquals(resourceScenario.rate(), 0,);
    resource.setForScenario("rate", 100, 0,);
    assertEquals(resourceScenario.rate(), 100,);
  });

  it("turnover retorna turnover do recurso", () => {
    const account = new Account(project, "acc1", "Account 1", null,);
    assertEquals(resourceScenario.turnover(0, 10, account, null, false,), 0,);
  });

  it("cost calcula custo do recurso", () => {
    assertEquals(resourceScenario.cost(0, 10, null,), 0,);
  });

  it("getEffectiveWork retorna trabalho efetivo", () => {
    assertEquals(resourceScenario.getEffectiveWork(0, 10, null,), 0,);
  });

  it("getAllocatedTime retorna tempo alocado", () => {
    assertEquals(resourceScenario.getAllocatedTime(0, 10, null,), 0,);
  });

  it("getEffectiveFreeTime retorna tempo livre efetivo", () => {
    // 10 slots * 3600s = 36000 segundos (todos os slots livres)
    assertEquals(resourceScenario.getEffectiveFreeTime(0, 10,), 36000,);
  });

  it("getEffectiveFreeWork retorna trabalho livre efetivo", () => {
    // (10 slots * 3600s) / (8h * 3600s) * eficiência(1) = 1.25
    assertEquals(resourceScenario.getEffectiveFreeWork(0, 10,), 1.25,);
  });

  it("getTimeOffDays retorna dias de folga", () => {
    assertEquals(resourceScenario.getTimeOffDays(0, 10,), 0,);
  });

  it("getLeave retorna folgas", () => {
    assertEquals(resourceScenario.getLeave(0, 10, "vacation",), 0,);
  });
});
