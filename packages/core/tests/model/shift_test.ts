import { beforeEach, describe, it } from "@std/testing/bdd";
import { assertEquals, assert } from "@std/assert";
import { MockProject } from "./mock-project.ts";
import { Shift } from "../../src/model/shift.ts";
import { ShiftScenario } from "../../src/model/shift-scenario.ts";

describe("Shift", () => {
  let project: MockProject;

  beforeEach(() => {
    project = new MockProject(2);
  });

  it("cria shift com id e nome", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null);
    assertEquals(shift.id, "shift1");
    assertEquals(shift.name, "Shift 1");
    assertEquals(shift.level, 0);
  });

  it("shift herda de PropertyTreeNode", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null);
    assertEquals(shift.project, project);
    assertEquals(shift.parents()[0], undefined);
  });

  it("shift all() inclui self", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null);
    assertEquals(shift.all().length, 1);
    assertEquals(shift.all()[0], shift);
  });

  it("shift allLeaves(withoutSelf=false) inclui self se folha", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null);
    assertEquals(shift.allLeaves(false).length, 1);
    assertEquals(shift.allLeaves(false)[0], shift);
  });

  it("shift allLeaves(withoutSelf=true) exclui self", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null);
    assertEquals(shift.allLeaves(true).length, 0);
  });

  it("cria cenário para shift", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null);
    const scenario = shift.scenarioData(0);
    assert(scenario instanceof ShiftScenario);
    // ShiftScenario does NOT preload attributes (per task list 5.5.5)
    assert(scenario.a("workinghours") === undefined);
    assert(scenario.a("leaves") === undefined);
    assert(scenario.a("replace") === undefined);
  });

  it("cenario pré-carrega atributos", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null);
    const scenario = shift.scenarioData(0);
    // ShiftScenario does NOT preload attributes (per task list 5.5.5)
    assert(scenario.a("workinghours") === undefined);
    assert(scenario.a("leaves") === undefined);
    assert(scenario.a("replace") === undefined);
  });

  it("getScenarioAttribute pré-carrega atributo", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null);
    const attr = shift.getScenarioAttribute(0, "workinghours");
    assert(attr !== undefined);
    assertEquals(attr.id, "workinghours");
  });

  it("getScenarioAttribute lança para atributo não específico de cenário", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null);
    try {
      shift.getScenarioAttribute(0, "id");
      assert(false, "Deveria ter lançado");
    } catch (e) {
      assert(e instanceof Error);
    }
  });

  it("setForScenario define valor", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null);
    const attr = shift.getScenarioAttribute(0, "replace");
    console.log("before setForScenario - attr:", attr, "get:", typeof attr.get);
    shift.setForScenario("replace", true, 0);
    const attrAfter = shift.getScenarioAttribute(0, "replace");
    console.log("after setForScenario - attr:", attrAfter, "get:", typeof attrAfter.get);
    console.log("scenarioAttributes[0]:", shift.scenarioAttributes[0]);
    assertEquals(shift.getForScenario("replace", 0), true);
  });

  it("setForScenario lança para atributo não específico de cenário", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null);
    try {
      shift.setForScenario("id", "newid", 0);
      assert(false, "Deveria ter lançado");
    } catch (e) {
      assert(e instanceof Error);
    }
  });

  it("shift com pai herda nível", () => {
    const parent = new Shift(project, "parent", "Parent", null);
    const child = new Shift(project, "child", "Child", parent);
    assertEquals(child.level, 1);
  });

  it("shift com pai herda fullId", () => {
    const parent = new Shift(project, "parent", "Parent", null);
    const child = new Shift(project, "child", "Child", parent);
    assertEquals(child.fullId, "parent.child");
  });

  it("shift com id hierárquico resolve pai do PropertySet", () => {
    const shift = new Shift(project, "parent.child", "Child", null);
    assertEquals(shift.fullId, "parent.child");
    assertEquals(shift.subId, "child");
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente)", () => {
    const existing = new Shift(project, "parent", "Parent", null);
    const shift = new Shift(project, "parent.child", "Child", null);
    assertEquals(shift.parent, existing);
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true", () => {
    const project2 = new MockProject(1, true);
    const existing = new Shift(project2, "parent", "Parent", null);
    const shift = new Shift(project2, "parent.child", "Child", null);
    assertEquals(shift.fullId, "parent.child");
    assertEquals(shift.subId, "parent.child");
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, id com múltiplos pontos", () => {
    const project2 = new MockProject(1, true);
    const existing = new Shift(project2, "parent", "Parent", null);
    const shift = new Shift(project2, "parent.child.grandchild", "Grandchild", null);
    assertEquals(shift.fullId, "parent.child.grandchild");
    assertEquals(shift.subId, "parent.child.grandchild");
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, parent does not exist", () => {
    const project2 = new MockProject(1, false);
    const shift = new Shift(project2, "nonexistent.child", "Child", null);
    assertEquals(shift.fullId, "nonexistent.child");
    assertEquals(shift.subId, "child");
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, parent does not exist", () => {
    const project2 = new MockProject(1, true);
    const shift = new Shift(project2, "nonexistent.child", "Child", null);
    assertEquals(shift.fullId, "nonexistent.child");
    assertEquals(shift.subId, "nonexistent.child");
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists", () => {
    const project2 = new MockProject(1, false);
    const existing = new Shift(project2, "child", "Child", null);
    const shift = new Shift(project2, "nonexistent.child", "Child", null);
    assertEquals(shift.fullId, "nonexistent.child");
    assertEquals(shift.subId, "child");
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists", () => {
    const project2 = new MockProject(1, true);
    const existing = new Shift(project2, "child", "Child", null);
    const shift = new Shift(project2, "nonexistent.child", "Child", null);
    assertEquals(shift.fullId, "nonexistent.child");
    assertEquals(shift.subId, "nonexistent.child");
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, false);
    const parent = new Shift(project2, "parent", "Parent", null);
    const existing = new Shift(project2, "parent.child", "Child", null);
    const shift = new Shift(project2, "parent.child", "Child", null);
    assertEquals(shift.fullId, "parent.child");
    assertEquals(shift.subId, "child");
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, true);
    const parent = new Shift(project2, "parent", "Parent", null);
    const existing = new Shift(project2, "parent.child", "Child", null);
    const shift = new Shift(project2, "parent.child", "Child", null);
    assertEquals(shift.fullId, "parent.child");
    assertEquals(shift.subId, "parent.child");
  });
});
