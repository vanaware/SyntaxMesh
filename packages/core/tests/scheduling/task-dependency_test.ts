import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { MockProject } from "../model/mock-project.ts";
import { Task } from "../../src/model/task.ts";
import { TaskDependency } from "../../src/scheduling/task-dependency.ts";

describe("TaskDependency", () => {
  let project: MockProject;
  let task1: Task;
  let task2: Task;

  beforeEach(() => {
    project = new MockProject(1);
    task1 = new Task(project, "t1", "Task 1", null);
    task2 = new Task(project, "t2", "Task 2", null);
  });

  it("constructor cria TaskDependency com taskId e onEnd", () => {
    const dep = new TaskDependency("t1", true);
    assertEquals(dep.taskId, "t1");
    assertEquals(dep.onEnd, true);
    assertEquals(dep.task, null);
    assertEquals(dep.gapDuration, 0);
    assertEquals(dep.gapLength, 0);
  });

  it("equals retorna true para dependências iguais", () => {
    const dep1 = new TaskDependency("t1", true);
    dep1.gapDuration = 3600;
    dep1.gapLength = 2;
    const dep2 = new TaskDependency("t1", true);
    dep2.gapDuration = 3600;
    dep2.gapLength = 2;
    assertEquals(dep1.equals(dep2), true);
  });

  it("equals retorna false para dependências com taskId diferente", () => {
    const dep1 = new TaskDependency("t1", true);
    const dep2 = new TaskDependency("t2", true);
    assertEquals(dep1.equals(dep2), false);
  });

  it("equals retorna false para dependências com onEnd diferente", () => {
    const dep1 = new TaskDependency("t1", true);
    const dep2 = new TaskDependency("t1", false);
    assertEquals(dep1.equals(dep2), false);
  });

  it("equals retorna false para dependências com gapDuration diferente", () => {
    const dep1 = new TaskDependency("t1", true);
    dep1.gapDuration = 3600;
    const dep2 = new TaskDependency("t1", true);
    dep2.gapDuration = 7200;
    assertEquals(dep1.equals(dep2), false);
  });

  it("equals retorna false para dependências com gapLength diferente", () => {
    const dep1 = new TaskDependency("t1", true);
    dep1.gapLength = 2;
    const dep2 = new TaskDependency("t1", true);
    dep2.gapLength = 3;
    assertEquals(dep1.equals(dep2), false);
  });

  it("resolve resolve taskId para Task existente", () => {
    const dep = new TaskDependency("t1", true);
    const resolved = dep.resolve(project);
    assertEquals(resolved, task1);
    assertEquals(dep.task, task1);
  });

  it("resolve retorna null para taskId inexistente", () => {
    const dep = new TaskDependency("t3", true);
    const resolved = dep.resolve(project);
    assertEquals(resolved, null);
    assertEquals(dep.task, null);
  });
});