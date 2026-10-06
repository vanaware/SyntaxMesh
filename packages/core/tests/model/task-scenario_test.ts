import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { MockProject } from "./mock-project.ts";
import { Task } from "../../src/model/task.ts";
import { TaskScenario } from "../../src/model/task-scenario.ts";
import { DurationType } from "../../src/scheduling/mod.ts";

describe("TaskScenario", () => {
  let project: MockProject;
  let task: Task;
  let taskScenario: TaskScenario;

  beforeEach(() => {
    project = new MockProject(1);
    task = new Task(project, "t1", "Task 1", null);
    taskScenario = task.scenarioData(0);
  });

  it("constructor pré-carrega atributos", () => {
    // Verificar que os atributos foram pré-carregados
    assertEquals(taskScenario.a("effort"), 0);
    assertEquals(taskScenario.a("length"), 0);
    assertEquals(taskScenario.a("duration"), 0);
    assertEquals(taskScenario.a("start"), null);
    assertEquals(taskScenario.a("end"), null);
    assertEquals(taskScenario.a("milestone"), false);
    assertEquals(taskScenario.a("forward"), true);
    assertEquals(taskScenario.a("priority"), 500);
  });

  it("a retorna valor de atributo", () => {
    // Definir um valor de atributo
    task.setForScenario("effort", 3600, 0);
    assertEquals(taskScenario.a("effort"), 3600);
  });

  it("a retorna null para atributo não definido", () => {
    assertEquals(taskScenario.a("nonexistent"), null);
  });

  it("constructor cria TaskScenario com task e scenarioIdx corretos", () => {
    assertEquals(taskScenario.getProperty(), task);
    assertEquals(taskScenario.getScenarioIdx(), 0);
  });

  it("constructor com múltiplos cenários", () => {
    const project2 = new MockProject(3);
    const task2 = new Task(project2, "t2", "Task 2", null);
    assertEquals(task2.scenarioData(0).getScenarioIdx(), 0);
    assertEquals(task2.scenarioData(1).getScenarioIdx(), 1);
    assertEquals(task2.scenarioData(2).getScenarioIdx(), 2);
  });
});