import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { MockProject } from "./mock-project.ts";
import { Resource } from "../../src/model/resource.ts";
import { ResourceScenario } from "../../src/model/resource-scenario.ts";

describe("ResourceScenario", () => {
  let project: MockProject;
  let resource: Resource;
  let resourceScenario: ResourceScenario;

  beforeEach(() => {
    project = new MockProject(1);
    resource = new Resource(project, "r1", "Resource 1", null);
    resourceScenario = resource.scenarioData(0);
  });

  it("constructor pré-carrega atributos", () => {
    // Verificar que os atributos foram pré-carregados
    assertEquals(resourceScenario.a("rate"), 0);
    assertEquals(resourceScenario.a("efficiency"), 1);
    assertEquals(resourceScenario.a("limits"), null);
    assertEquals(resourceScenario.a("shifts"), null);
    assertEquals(resourceScenario.a("workinghours"), null);
    assertEquals(resourceScenario.a("leaves"), []);
    assertEquals(resourceScenario.a("leaveallowances"), []);
    assertEquals(resourceScenario.a("managers"), []);
    assertEquals(resourceScenario.a("reports"), []);
    assertEquals(resourceScenario.a("duties"), []);
    assertEquals(resourceScenario.a("criticalness"), 0);
    assertEquals(resourceScenario.a("chargeset"), []);
    assertEquals(resourceScenario.a("alloctdeffort"), 0);
    assertEquals(resourceScenario.a("directreports"), []);
  });

  it("a retorna valor de atributo", () => {
    // Definir um valor de atributo
    resource.setForScenario("rate", 100, 0);
    assertEquals(resourceScenario.a("rate"), 100);
  });

  it("a retorna null para atributo não definido", () => {
    assertEquals(resourceScenario.a("nonexistent"), null);
  });

  it("constructor cria ResourceScenario com resource e scenarioIdx corretos", () => {
    assertEquals(resourceScenario.getProperty(), resource);
    assertEquals(resourceScenario.getScenarioIdx(), 0);
  });

  it("constructor com múltiplos cenários", () => {
    const project2 = new MockProject(3);
    const resource2 = new Resource(project2, "r2", "Resource 2", null);
    assertEquals(resource2.scenarioData(0).getScenarioIdx(), 0);
    assertEquals(resource2.scenarioData(1).getScenarioIdx(), 1);
    assertEquals(resource2.scenarioData(2).getScenarioIdx(), 2);
  });

  it("onShift retorna true se shifts não definido e workinghours não definido", () => {
    // Sem shifts e sem workinghours definidos
    assertEquals(resourceScenario.onShift(0), true);
  });

  it("onShift retorna valor de shifts se definido", () => {
    // TODO: Implementar teste com shifts definido
    // Por enquanto, apenas verificar que o método existe
    assertEquals(typeof resourceScenario.onShift, "function");
  });

  it("available retorna true para slot não ocupado", () => {
    assertEquals(resourceScenario.available(0), true);
  });

  it("booked retorna false para slot não ocupado", () => {
    assertEquals(resourceScenario.booked(0), false);
  });

  it("bookedTask retorna null para slot não ocupado", () => {
    assertEquals(resourceScenario.bookedTask(0), null);
  });

  it("book registra ocupação para slot", () => {
    const project2 = new MockProject(1);
    const resource2 = new Resource(project2, "r2", "Resource 2", null);
    const resourceScenario2 = resource2.scenarioData(0);
    resourceScenario2.book(0, 1);
    assertEquals(resourceScenario2.booked(0), true);
  });

  it("bookBooking registra ocupação com tarefa", () => {
    const project2 = new MockProject(1);
    const resource2 = new Resource(project2, "r2", "Resource 2", null);
    const resourceScenario2 = resource2.scenarioData(0);
    const task = { id: "task1", duration: 1 } as any;
    resourceScenario2.bookBooking(0, task);
    assertEquals(resourceScenario2.booked(0), true);
    assertEquals(resourceScenario2.bookedTask(0), task);
  });

  it("bookedEffort retorna 0 inicialmente", () => {
    assertEquals(resourceScenario.bookedEffort(), 0);
  });

  it("getMinSlot retorna o primeiro slot", () => {
    assertEquals(resourceScenario.getMinSlot(), null);
  });

  it("getMaxSlot retorna o último slot", () => {
    assertEquals(resourceScenario.getMaxSlot(), null);
  });

  it("rate retorna taxa do recurso", () => {
    assertEquals(resourceScenario.rate(), 0);
    resource.setForScenario("rate", 100, 0);
    assertEquals(resourceScenario.rate(), 100);
  });

  it("turnover retorna turnover do recurso", () => {
    assertEquals(resourceScenario.turnover(0, 10, null, null, false), 0);
  });

  it("cost calcula custo do recurso", () => {
    assertEquals(resourceScenario.cost(0, 10, null), 0);
  });

  it("getEffectiveWork retorna trabalho efetivo", () => {
    assertEquals(resourceScenario.getEffectiveWork(0, 10, null), 0);
  });

  it("getAllocatedTime retorna tempo alocado", () => {
    assertEquals(resourceScenario.getAllocatedTime(0, 10, null), 0);
  });

  it("getEffectiveFreeTime retorna tempo livre efetivo", () => {
    assertEquals(resourceScenario.getEffectiveFreeTime(0, 10), 0);
  });

  it("getEffectiveFreeWork retorna trabalho livre efetivo", () => {
    assertEquals(resourceScenario.getEffectiveFreeWork(0, 10), 0);
  });

  it("getTimeOffDays retorna dias de folga", () => {
    assertEquals(resourceScenario.getTimeOffDays(0, 10), 0);
  });

  it("getLeave retorna folgas", () => {
    assertEquals(resourceScenario.getLeave(0, 10, "vacation"), 0);
  });
});