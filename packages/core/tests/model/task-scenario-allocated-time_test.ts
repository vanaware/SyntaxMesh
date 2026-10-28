/**
 * G1.1 (Complemento Fase 11 — 2ª onda §6.1): port fiel de
 * `TaskScenario#getAllocatedTime` (TaskScenario.rb:1562–1588).
 *
 * Usamos `ResourceScenario#book` — o primitivo que o scheduler usa — para
 * popular o scoreboard real sem rodar o agendamento completo. As conversões
 * (slots → dias) vêm do fixture `createTestProject` (granularity 3600s,
 * dailyWorkingHours padrão 8 → 8 slots = 1 dia).
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Task, } from "../../src/model/task.ts";

describe("TaskScenario.getAllocatedTime (G1.1)", () => {
  let project: Project;
  let task: Task;
  let resource: Resource;

  beforeEach(() => {
    project = createTestProject();
    task = new Task(project, "t1", "Task 1", null,);
    resource = new Resource(project, "r1", "Resource 1", null,);
    task.setForScenario("assignedresources", [resource,], 0,);
  },);

  it("soma o tempo alocado pelos recursos designados (leaf)", () => {
    const rs = resource.scenarioData(0,);
    for (let i = 0; i < 8; i++) rs.book(i, task,);
    const ts = task.scenarioData(0,);
    // 8 slots × 3600s / (8h × 3600s) = 1 dia.
    assertEquals(ts.getAllocatedTime(0, 8,), 1,);
  });

  it("com `resource`, conta só aquele recurso; recurso não designado → 0", () => {
    const rs = resource.scenarioData(0,);
    for (let i = 0; i < 8; i++) rs.book(i, task,);
    const other = new Resource(project, "r2", "Resource 2", null,);
    const ts = task.scenarioData(0,);
    assertEquals(ts.getAllocatedTime(0, 8, resource,), 1,);
    // Ruby: guard `resource && !@assignedresources.include?(resource)` → 0.
    assertEquals(ts.getAllocatedTime(0, 8, other,), 0,);
  });

  it("milestone e intervalo vazio retornam 0 (guards fiéis)", () => {
    const rs = resource.scenarioData(0,);
    for (let i = 0; i < 8; i++) rs.book(i, task,);
    const ts = task.scenarioData(0,);
    assertEquals(ts.getAllocatedTime(5, 5,), 0,); // startIdx >= endIdx
    task.setForScenario("milestone", true, 0,);
    assertEquals(ts.getAllocatedTime(0, 8,), 0,); // milestone guard
  });

  it("container soma as alocações dos filhos (recursão fiel)", () => {
    const parent = new Task(project, "p", "Parent", null,);
    const child1 = new Task(project, "c1", "Child 1", parent,);
    const child2 = new Task(project, "c2", "Child 2", parent,);
    parent.setForScenario("assignedresources", [resource,], 0,);
    child1.setForScenario("assignedresources", [resource,], 0,);
    child2.setForScenario("assignedresources", [resource,], 0,);
    const rs = resource.scenarioData(0,);
    for (let i = 0; i < 8; i++) {
      rs.book(i, child1,);
      rs.book(i + 8, child2,);
    }
    const ps = parent.scenarioData(0,);
    // Cada filho soma seus 8 slots; o container totaliza 2 dias.
    assertEquals(ps.getAllocatedTime(0, 16,), 2,);
    // Restrição por recurso designado também recursa.
    assertEquals(ps.getAllocatedTime(0, 16, resource,), 2,);
  });
});
