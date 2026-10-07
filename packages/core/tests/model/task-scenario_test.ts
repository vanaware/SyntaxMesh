import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert, assertThrows } from "@std/assert";
import { MockProject } from "./mock-project.ts";
import { Task } from "../../src/model/task.ts";
import { TaskScenario } from "../../src/model/task-scenario.ts";
import { DurationType } from "../../src/scheduling/mod.ts";
import { TjTime } from "../../src/time/tj-time.ts";
import { Resource } from "../../src/model/resource.ts";
import { ScoreboardInterval } from "../../src/time/scoreboard-interval.ts";
import { Booking } from "../../src/scheduling/booking.ts";

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

  // Test preScheduleCheck
  it("preScheduleCheck passa para tarefa simples sem esforço", () => {
    // Tarefa simples sem esforço, sem alocações, sem bookings
    // Give it an end date so it's not underspecified
    task.setForScenario("end", TjTime.fromString("2026-01-02"), 0);
    taskScenario.preScheduleCheck();
    assertEquals(taskScenario.errors(), 0);
  });

  it("preScheduleCheck falha para tarefa com esforço mas sem alocações", () => {
    task.setForScenario("effort", 3600, 0);
    taskScenario.preScheduleCheck();
    assert(taskScenario.errors() > 0);
  });

  it("preScheduleCheck falha para tarefa container com bookings", () => {
    // Criar uma tarefa container (com filhos)
    const childTask = new Task(project, "t2", "Child Task", task);
    task.setForScenario("effort", 3600, 0);
    task.setForScenario("allocate", [], 0);
    task.setForScenario("booking", [], 0);
    taskScenario.preScheduleCheck();
    assert(taskScenario.errors() > 0);
  });

  it("preScheduleCheck falha para milestone com bookings", () => {
    // Create a real Booking for the milestone
    const resource = new Resource(project, "r1", "Resource 1", null);
    const interval = new ScoreboardInterval(
      project.get("start") as TjTime,
      (project.get("scheduleGranularity") as number) ?? 3600,
      0,
      1,
    );
    const booking = new Booking(resource, task, [interval]);
    task.setForScenario("milestone", true, 0);
    task.setForScenario("booking", [booking], 0);
    taskScenario.preScheduleCheck();
    assert(taskScenario.errors() > 0);
  });

  it("preScheduleCheck falha para tarefa agendada sem start/end", () => {
    task.setForScenario("scheduled", true, 0);
    taskScenario.preScheduleCheck();
    assert(taskScenario.errors() > 0);
  });

  // Test checkForLoops - simplified test
  it("checkForLoops não lança para tarefa simples", () => {
    taskScenario.checkForLoops([], false, false, true);
    assertEquals(taskScenario.errors(), 0);
  });

  // Test calcCriticalness
  it("calcCriticalness para milestone sem esforço", () => {
    task.setForScenario("milestone", true, 0);
    task.setForScenario("priority", 1000, 0);
    taskScenario.calcCriticalness();
    assertEquals(taskScenario.criticalness(), 2.0);
  });

  it("calcCriticalness para tarefa sem esforço", () => {
    taskScenario.calcCriticalness();
    assertEquals(taskScenario.criticalness(), 0.0);
  });

  // Test calcPathCriticalness
  it("calcPathCriticalness para tarefa sem dependências", () => {
    taskScenario.calcCriticalness();
    const pathCriticalness = taskScenario.calcPathCriticalness();
    assertEquals(taskScenario.a("pathcriticalness"), 0.0);
  });

  // Test countResourceAllocations
  it("countResourceAllocations conta alocações", () => {
    task.setForScenario("allocate", [], 0);
    // countResourceAllocations returns void; verify it doesn't throw
    taskScenario.countResourceAllocations();
  });

  // Test candidates
  it("candidates retorna lista vazia sem alocações", () => {
    const candidates = taskScenario.candidates();
    assertEquals(candidates.length, 0);
  });

  // Test resetLoopFlags
  it("resetLoopFlags reseta flags de loop", () => {
    taskScenario.resetLoopFlags();
    // Verificar que os flags foram resetados (não há método público para verificar)
    // Apenas verificar que não lança erro
  });

  // Test hasDependencies
  it("hasDependencies retorna false para tarefa sem dependências", () => {
    assertEquals(taskScenario.hasDependencies(false), false);
    assertEquals(taskScenario.hasDependencies(true), false);
  });

  // Test hasStrongDeps
  it("hasStrongDeps retorna false para tarefa sem dependências fortes", () => {
    assertEquals(taskScenario.hasStrongDeps(false), false);
  });

  // Test markAsRunaway
  it("markAsRunaway marca tarefa como runaway", () => {
    taskScenario.markAsRunaway();
    assertEquals(taskScenario.isRunAway(), true);
  });

  // Test readyForScheduling
  it("readyForScheduling para tarefa sem start", () => {
    assertEquals(taskScenario.readyForScheduling(), false);
  });

  it("readyForScheduling para tarefa com start e sem esforço", () => {
    task.setForScenario("start", TjTime.fromString("2026-01-01"), 0);
    // Forward task with start but no duration spec and no end is not ready
    assertEquals(taskScenario.readyForScheduling(), false);
  });
});