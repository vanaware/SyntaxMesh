import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assert, } from "@std/assert";
import { MockProject, } from "../model/mock-project.ts";
import { Task, } from "../../src/model/task.ts";
import { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";
import { PropertySet, } from "../../src/model/property-set.ts";

describe("Smoke test after Phase 5", () => {
  beforeEach(() => {
    // Configurar modo global (Fase 3)
    // (AttributeBase.setMode(0) é chamado automaticamente em beforeEach dos testes)
  },);

  it("cria MockProject com 6 PropertySets", () => {
    const project = new MockProject(1);
    assert(project.scenarios instanceof PropertySet);
    assert(project.shifts instanceof PropertySet);
    assert(project.accounts instanceof PropertySet);
    assert(project.resources instanceof PropertySet);
    assert(project.tasks instanceof PropertySet);
    assert(project.reports instanceof PropertySet);
  });

  it("cria Task e verifica pré-carregamento de atributos de cenário", () => {
    const project = new MockProject(1);
    const task = new Task(project, "task1", "Task 1", null);
    assertEquals(task.id, "task1");
    assertEquals(task.name, "Task 1");

    // Verificar que o atributo de cenário está pré-carregado
    const attr = task.getScenarioAttribute(0, "effort");
    assert(attr !== undefined, "Atributo de cenário 'effort' deve estar pré-carregado");
    // IntegerAttribute tem default 0 (não null) — o importante é que o atributo existe
    assertEquals(attr.get(), 0, "Atributo de cenário 'effort' deve ter default 0");

    // Verificar outros atributos de cenário
    assert(task.getScenarioAttribute(0, "duration") !== undefined);
    assert(task.getScenarioAttribute(0, "start") !== undefined);
  });

  it("verifica Fase 4 (PropertyTreeNode) através de Task", () => {
    const project = new MockProject(1);
    const task = new Task(project, "task1", "Task 1", null);

    // Verificar herança de PropertyTreeNode
    assertEquals(task.project, project);
    assertEquals(task.level, 0);
    assertEquals(task.all().length, 1);
    assertEquals(task.all()[0], task);

    // Verificar que a tarefa é um PropertyTreeNode
    assert(task instanceof PropertyTreeNode);
    assert(task.propertySet instanceof PropertySet);

    // Verificar que a tarefa tem scenarioData
    const scenario = task.scenarioData(0);
    assert(scenario !== undefined);
    assertEquals(scenario.getScenarioIdx(), 0);

    // Verificar que a tarefa pode definir atributos de cenário
    task.setForScenario("effort", 5, 0);
    assertEquals(task.getForScenario("effort", 0), 5);
  });

  it("verifica que MockProject implementa ProjectLike corretamente", () => {
    const project = new MockProject(2);
    assertEquals(project.scenarioCount, 2);
    assertEquals(project.scenario(0)?.id, "plan");
    assertEquals(project.scenario(1)?.id, "scenario1");

    // Verificar que getScenarioAttribute funciona
    const attr = project.getScenarioAttribute(0, "effort");
    assert(attr !== undefined);

    // Verificar que addScenario funciona
    project.addScenario({ id: "scenario2", fullId: "scenario2" });
    assertEquals(project.scenarioCount, 3);
    assertEquals(project.scenario(2)?.id, "scenario2");
  });
});