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
});