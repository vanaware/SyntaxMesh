import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { MockProject } from "./mock-project.ts";
import { Resource } from "../../src/model/resource.ts";
import { ResourceScenario } from "../../src/model/resource-scenario.ts";
import { WorkingHours } from "../../src/calendar/working-hours.ts";
import { Shift } from "../../src/model/shift.ts";
import { ShiftScenario } from "../../src/model/shift-scenario.ts";
import { ShiftAssignment, ShiftAssignments } from "../../src/scheduling/shift-assignments.ts";
import { TimeInterval } from "../../src/time/time-interval.ts";
import { TjTime } from "../../src/time/tj-time.ts";

describe("Resource", () => {
  let project: MockProject;

  beforeEach(() => {
    project = new MockProject(2);
  });

  it("cria recurso com id e nome", () => {
    const resource = new Resource(project, "res1", "Resource 1", null);
    assertEquals(resource.id, "res1");
    assertEquals(resource.name, "Resource 1");
    assertEquals(resource.level, 0);
  });

  it("recurso herda de PropertyTreeNode", () => {
    const resource = new Resource(project, "res1", "Resource 1", null);
    assertEquals(resource.project, project);
    assertEquals(resource.parents()[0], undefined);
  });

  it("recurso all() inclui self", () => {
    const resource = new Resource(project, "res1", "Resource 1", null);
    assertEquals(resource.all().length, 1);
    assertEquals(resource.all()[0], resource);
  });

  it("recurso allLeaves(withoutSelf=false) inclui self se folha", () => {
    const resource = new Resource(project, "res1", "Resource 1", null);
    assertEquals(resource.allLeaves(false).length, 1);
    assertEquals(resource.allLeaves(false)[0], resource);
  });

  it("recurso allLeaves(withoutSelf=true) exclui self", () => {
    const resource = new Resource(project, "res1", "Resource 1", null);
    assertEquals(resource.allLeaves(true).length, 0);
  });

  it("cria cenário para recurso", () => {
    const resource = new Resource(project, "res1", "Resource 1", null);
    const scenario = resource.scenarioData(0);
    assert(scenario instanceof ResourceScenario);
    assert(scenario.a("efficiency") !== undefined);
  });

  it("cenario pré-carrega atributos", () => {
    const resource = new Resource(project, "res1", "Resource 1", null);
    const scenario = resource.scenarioData(0);
    assert(scenario.a("efficiency") !== undefined);
    assert(scenario.a("rate") !== undefined);
    assert(scenario.a("workinghours") !== undefined);
  });

  it("getScenarioAttribute pré-carrega atributo", () => {
    const resource = new Resource(project, "res1", "Resource 1", null);
    const attr = resource.getScenarioAttribute(0, "efficiency");
    assert(attr !== undefined);
    assertEquals(attr.id, "efficiency");
  });

  it("getScenarioAttribute lança para atributo não específico de cenário", () => {
    const resource = new Resource(project, "res1", "Resource 1", null);
    try {
      resource.getScenarioAttribute(0, "id");
      assert(false, "Deveria ter lançado");
    } catch (e) {
      assert(e instanceof Error);
    }
  });

  it("setForScenario define valor", () => {
    const resource = new Resource(project, "res1", "Resource 1", null);
    resource.setForScenario("rate", 10, 0);
    assertEquals(resource.getForScenario("rate", 0), 10);
  });

  it("setForScenario lança para atributo não específico de cenário", () => {
    const resource = new Resource(project, "res1", "Resource 1", null);
    try {
      resource.setForScenario("id", "newid", 0);
      assert(false, "Deveria ter lançado");
    } catch (e) {
      assert(e instanceof Error);
    }
  });

  it("recurso com pai herda nível", () => {
    const parent = new Resource(project, "parent", "Parent", null);
    const child = new Resource(project, "child", "Child", parent);
    assertEquals(child.level, 1);
  });

  it("recurso com pai herda fullId", () => {
    const parent = new Resource(project, "parent", "Parent", null);
    const child = new Resource(project, "child", "Child", parent);
    assertEquals(child.fullId, "parent.child");
  });

  it("recurso com id hierárquico resolve pai do PropertySet", () => {
    const resource = new Resource(project, "parent.child", "Child", null);
    assertEquals(resource.fullId, "parent.child");
    assertEquals(resource.subId, "child");
  });

  it("recurso com id hierárquico resolve pai do PropertySet (já existente)", () => {
    const existing = new Resource(project, "parent", "Parent", null);
    const resource = new Resource(project, "parent.child", "Child", null);
    assertEquals(resource.parent, existing);
  });

  it("recurso com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true", () => {
    const project2 = new MockProject(1, true);
    const existing = new Resource(project2, "parent", "Parent", null);
    const resource = new Resource(project2, "parent.child", "Child", null);
    assertEquals(resource.fullId, "parent.child");
    assertEquals(resource.subId, "parent.child");
  });

  it("recurso com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, id com múltiplos pontos", () => {
    const project2 = new MockProject(1, true);
    const existing = new Resource(project2, "parent", "Parent", null);
    const resource = new Resource(project2, "parent.child.grandchild", "Grandchild", null);
    assertEquals(resource.fullId, "parent.child.grandchild");
    assertEquals(resource.subId, "parent.child.grandchild");
  });

  it("recurso com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, parent does not exist", () => {
    const project2 = new MockProject(1, false);
    const resource = new Resource(project2, "nonexistent.child", "Child", null);
    assertEquals(resource.fullId, "nonexistent.child");
    assertEquals(resource.subId, "child");
  });

  it("recurso com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, parent does not exist", () => {
    const project2 = new MockProject(1, true);
    const resource = new Resource(project2, "nonexistent.child", "Child", null);
    assertEquals(resource.fullId, "nonexistent.child");
    assertEquals(resource.subId, "nonexistent.child");
  });

  it("recurso com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists", () => {
    const project2 = new MockProject(1, false);
    const existing = new Resource(project2, "child", "Child", null);
    const resource = new Resource(project2, "nonexistent.child", "Child", null);
    assertEquals(resource.fullId, "nonexistent.child");
    assertEquals(resource.subId, "child");
  });

  it("recurso com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists", () => {
    const project2 = new MockProject(1, true);
    const existing = new Resource(project2, "child", "Child", null);
    const resource = new Resource(project2, "nonexistent.child", "Child", null);
    assertEquals(resource.fullId, "nonexistent.child");
    assertEquals(resource.subId, "nonexistent.child");
  });

  it("recurso com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, false);
    const parent = new Resource(project2, "parent", "Parent", null);
    const existing = new Resource(project2, "parent.child", "Child", null);
    const resource = new Resource(project2, "parent.child", "Child", null);
    assertEquals(resource.fullId, "parent.child");
    assertEquals(resource.subId, "child");
  });

  it("recurso com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, true);
    const parent = new Resource(project2, "parent", "Parent", null);
    const existing = new Resource(project2, "parent.child", "Child", null);
    const resource = new Resource(project2, "parent.child", "Child", null);
    assertEquals(resource.fullId, "parent.child");
    assertEquals(resource.subId, "parent.child");
  });
});

describe("ResourceScenario.onShift?", () => {
  let project: MockProject;
  let resource: Resource;
  let scenario: ResourceScenario;

  beforeEach(() => {
    project = new MockProject(2);
    project.set("start", TjTime.fromDate(new Date("2026-01-01T00:00:00Z")));
    project.set("scheduleGranularity", 3600);
    resource = new Resource(project, "res1", "Resource 1", null);
    scenario = resource.scenarioData(0);
    ShiftAssignments.sbClear();
  });

  it("usa workinghours quando shifts não atribuídos", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-08T00:00:00Z");
    const wh = new WorkingHours(3600, start, end);
    wh.setWorkingHours(1, [[9 * 60 * 60, 17 * 60 * 60]]);
    resource.setForScenario("workinghours", wh, 0);

    // sbIdx 10 = 2026-01-01T10:00Z (Monday 10am)
    assertEquals(scenario.onShift(10), true);
    // sbIdx 20 = 2026-01-01T20:00Z (Monday 8pm)
    assertEquals(scenario.onShift(20), false);
    // sbIdx 0 = 2026-01-01T00:00Z (Tuesday midnight)
    assertEquals(scenario.onShift(0), false);
  });

  it("retorna true quando workinghours ausente", () => {
    assertEquals(scenario.onShift(10), true);
  });

  it("prioriza shifts sobre workinghours", () => {
    const start = new Date("2026-01-01T00:00:00Z");
    const end = new Date("2026-01-08T00:00:00Z");
    const wh = new WorkingHours(3600, start, end);
    wh.setWorkingHours(1, [[9 * 60 * 60, 17 * 60 * 60]]);
    resource.setForScenario("workinghours", wh, 0);

    const shift = new Shift(project, "night", "Night", null);
    const shiftScenario = shift.scenarioData(0);
    const interval = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-01T20:00:00Z")),
      TjTime.fromDate(new Date("2026-01-02T04:00:00Z")),
    );
    const sas = new ShiftAssignments();
    sas.project = project;
    sas.addAssignment(new ShiftAssignment(shiftScenario, interval));
    resource.setForScenario("shifts", sas, 0);

    // sbIdx 10 = 10:00 (shift não cobre, herda workinghours → true)
    assertEquals(scenario.onShift(10), true);
    // sbIdx 20 = 20:00 (shift cobre e tem prioridade → true)
    assertEquals(scenario.onShift(20), true);
  });
});
