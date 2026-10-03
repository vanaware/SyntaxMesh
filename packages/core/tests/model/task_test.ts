import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { MockProject } from "./mock-project.ts";
import { Task } from "../../src/model/task.ts";
import { TaskScenario } from "../../src/model/task-scenario.ts";

describe("Task", () => {
  let project: MockProject;

  beforeEach(() => {
    project = new MockProject(2);
  });

  it("cria tarefa com id e nome", () => {
    const task = new Task(project, "task1", "Task 1", null);
    assertEquals(task.id, "task1");
    assertEquals(task.name, "Task 1");
    assertEquals(task.level, 0);
  });

  it("tarefa herda de PropertyTreeNode", () => {
    const task = new Task(project, "task1", "Task 1", null);
    assertEquals(task.project, project);
    assertEquals(task.parents()[0], undefined);
  });

  it("tarefa all() inclui self", () => {
    const task = new Task(project, "task1", "Task 1", null);
    assertEquals(task.all().length, 1);
    assertEquals(task.all()[0], task);
  });

  it("tarefa allLeaves(withoutSelf=false) inclui self se folha", () => {
    const task = new Task(project, "task1", "Task 1", null);
    assertEquals(task.allLeaves(false).length, 1);
    assertEquals(task.allLeaves(false)[0], task);
  });

  it("tarefa allLeaves(withoutSelf=true) exclui self", () => {
    const task = new Task(project, "task1", "Task 1", null);
    assertEquals(task.allLeaves(true).length, 0);
  });

  it("cria cenário para tarefa", () => {
    const task = new Task(project, "task1", "Task 1", null);
    const scenario = task.scenarioData(0);
    assert(scenario instanceof TaskScenario);
    assert(scenario.a("effort") !== undefined);
  });

  it("cenario pré-carrega atributos", () => {
    const task = new Task(project, "task1", "Task 1", null);
    const scenario = task.scenarioData(0);
    assert(scenario.a("effort") !== undefined);
    assert(scenario.a("duration") !== undefined);
  });

  it("getScenarioAttribute pré-carrega atributo", () => {
    const task = new Task(project, "task1", "Task 1", null);
    const attr = task.getScenarioAttribute(0, "effort");
    assert(attr !== undefined);
    assertEquals(attr.id, "effort");
  });

  it("getScenarioAttribute lança para atributo não específico de cenário", () => {
    const task = new Task(project, "task1", "Task 1", null);
    try {
      task.getScenarioAttribute(0, "id");
      assert(false, "Deveria ter lançado");
    } catch (e) {
      assert(e instanceof Error);
    }
  });

  it("setForScenario define valor", () => {
    const task = new Task(project, "task1", "Task 1", null);
    task.setForScenario("effort", 5, 0);
    assertEquals(task.getForScenario("effort", 0), 5);
  });

  it("setForScenario lança para atributo não específico de cenário", () => {
    const task = new Task(project, "task1", "Task 1", null);
    try {
      task.setForScenario("id", "newid", 0);
      assert(false, "Deveria ter lançado");
    } catch (e) {
      assert(e instanceof Error);
    }
  });

  it("tarefa com pai herda nível", () => {
    const parent = new Task(project, "parent", "Parent", null);
    const child = new Task(project, "child", "Child", parent);
    assertEquals(child.level, 1);
  });

  it("tarefa com pai herda fullId", () => {
    const parent = new Task(project, "parent", "Parent", null);
    const child = new Task(project, "child", "Child", parent);
    assertEquals(child.fullId, "parent.child");
  });

  it("tarefa com id hierárquico resolve pai do PropertySet", () => {
    const task = new Task(project, "parent.child", "Child", null);
    assertEquals(task.fullId, "parent.child");
    assertEquals(task.subId, "child");
  });

  it("tarefa com id hierárquico resolve pai do PropertySet (já existente)", () => {
    const existing = new Task(project, "parent", "Parent", null);
    const task = new Task(project, "parent.child", "Child", null);
    assertEquals(task.parent, existing);
  });

  it("tarefa com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true", () => {
    const project2 = new MockProject(1, true);
    const existing = new Task(project2, "parent", "Parent", null);
    const task = new Task(project2, "parent.child", "Child", null);
    assertEquals(task.fullId, "parent.child");
    assertEquals(task.subId, "parent.child");
  });

  it("tarefa com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, id com múltiplos pontos", () => {
    const project2 = new MockProject(1, true);
    const existing = new Task(project2, "parent", "Parent", null);
    const task = new Task(project2, "parent.child.grandchild", "Grandchild", null);
    assertEquals(task.fullId, "parent.child.grandchild");
    assertEquals(task.subId, "parent.child.grandchild");
  });

  it("tarefa com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, parent does not exist", () => {
    const project2 = new MockProject(1, false);
    const task = new Task(project2, "nonexistent.child", "Child", null);
    assertEquals(task.fullId, "nonexistent.child");
    assertEquals(task.subId, "child");
  });

  it("tarefa com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, parent does not exist", () => {
    const project2 = new MockProject(1, true);
    const task = new Task(project2, "nonexistent.child", "Child", null);
    assertEquals(task.fullId, "nonexistent.child");
    assertEquals(task.subId, "nonexistent.child");
  });

  it("tarefa com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists", () => {
    const project2 = new MockProject(1, false);
    const existing = new Task(project2, "child", "Child", null);
    const task = new Task(project2, "nonexistent.child", "Child", null);
    assertEquals(task.fullId, "nonexistent.child");
    assertEquals(task.subId, "child");
  });

  it("tarefa com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists", () => {
    const project2 = new MockProject(1, true);
    const existing = new Task(project2, "child", "Child", null);
    const task = new Task(project2, "nonexistent.child", "Child", null);
    assertEquals(task.fullId, "nonexistent.child");
    assertEquals(task.subId, "nonexistent.child");
  });

  it("tarefa com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, false);
    const parent = new Task(project2, "parent", "Parent", null);
    const existing = new Task(project2, "parent.child", "Child", null);
    const task = new Task(project2, "parent.child", "Child", null);
    assertEquals(task.fullId, "parent.child");
    assertEquals(task.subId, "child");
  });

  it("tarefa com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, true);
    const parent = new Task(project2, "parent", "Parent", null);
    const existing = new Task(project2, "parent.child", "Child", null);
    const task = new Task(project2, "parent.child", "Child", null);
    assertEquals(task.fullId, "parent.child");
    assertEquals(task.subId, "parent.child");
  });
});
