import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MockProject, } from "./mock-project.ts";
import { Shift, } from "../../src/model/shift.ts";
import { ShiftScenario, } from "../../src/model/shift-scenario.ts";
import { WorkingHours, } from "../../src/calendar/working-hours.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("Shift", () => {
  let project: MockProject;

  beforeEach(() => {
    project = new MockProject(2,);
  },);

  it("cria shift com id e nome", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null,);
    assertEquals(shift.id, "shift1",);
    assertEquals(shift.name, "Shift 1",);
    assertEquals(shift.level, 0,);
  });

  it("shift herda de PropertyTreeNode", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null,);
    assertEquals(shift.project, project,);
    assertEquals(shift.parents()[0], undefined,);
  });

  it("shift all() inclui self", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null,);
    assertEquals(shift.all().length, 1,);
    assertEquals(shift.all()[0], shift,);
  });

  it("shift allLeaves(withoutSelf=false) inclui self se folha", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null,);
    assertEquals(shift.allLeaves(false,).length, 1,);
    assertEquals(shift.allLeaves(false,)[0], shift,);
  });

  it("shift allLeaves(withoutSelf=true) exclui self", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null,);
    assertEquals(shift.allLeaves(true,).length, 0,);
  });

  it("cria cenário para shift", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null,);
    const scenario = shift.scenarioData(0,);
    assert(scenario instanceof ShiftScenario,);
    // ShiftScenario pré-carrega workinghours, replace, leaves (Fase 6.4)
    assert(scenario.a("workinghours",) !== undefined,);
    assert(scenario.a("leaves",) !== undefined,);
    assert(scenario.a("replace",) !== undefined,);
  });

  it("cenario pré-carrega atributos", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null,);
    const scenario = shift.scenarioData(0,);
    // ShiftScenario pré-carrega workinghours, replace, leaves (Fase 6.4)
    assert(scenario.a("workinghours",) !== undefined,);
    assert(scenario.a("leaves",) !== undefined,);
    assert(scenario.a("replace",) !== undefined,);
  });

  it("getScenarioAttribute pré-carrega atributo", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null,);
    const attr = shift.getScenarioAttribute(0, "workinghours",);
    assert(attr !== undefined,);
    assertEquals(attr.id, "workinghours",);
  });

  it("getScenarioAttribute lança para atributo não específico de cenário", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null,);
    try {
      shift.getScenarioAttribute(0, "id",);
      assert(false, "Deveria ter lançado",);
    } catch (e) {
      assert(e instanceof Error,);
    }
  });

  it("setForScenario define valor", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null,);
    shift.setForScenario("replace", true, 0,);
    assertEquals(shift.getForScenario("replace", 0,), true,);
  });

  it("setForScenario lança para atributo não específico de cenário", () => {
    const shift = new Shift(project, "shift1", "Shift 1", null,);
    try {
      shift.setForScenario("id", "newid", 0,);
      assert(false, "Deveria ter lançado",);
    } catch (e) {
      assert(e instanceof Error,);
    }
  });

  it("shift com pai herda nível", () => {
    const parent = new Shift(project, "parent", "Parent", null,);
    const child = new Shift(project, "child", "Child", parent,);
    assertEquals(child.level, 1,);
  });

  it("shift com pai herda fullId", () => {
    const parent = new Shift(project, "parent", "Parent", null,);
    const child = new Shift(project, "child", "Child", parent,);
    assertEquals(child.fullId, "parent.child",);
  });

  it("shift com id hierárquico resolve pai do PropertySet", () => {
    const shift = new Shift(project, "parent.child", "Child", null,);
    assertEquals(shift.fullId, "parent.child",);
    assertEquals(shift.subId, "child",);
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente)", () => {
    const existing = new Shift(project, "parent", "Parent", null,);
    const shift = new Shift(project, "parent.child", "Child", null,);
    assertEquals(shift.parent, existing,);
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true", () => {
    const project2 = new MockProject(1, true,);
    const existing = new Shift(project2, "parent", "Parent", null,);
    const shift = new Shift(project2, "parent.child", "Child", null,);
    assertEquals(shift.fullId, "parent.child",);
    assertEquals(shift.subId, "parent.child",);
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, id com múltiplos pontos", () => {
    const project2 = new MockProject(1, true,);
    const existing = new Shift(project2, "parent", "Parent", null,);
    const shift = new Shift(
      project2,
      "parent.child.grandchild",
      "Grandchild",
      null,
    );
    assertEquals(shift.fullId, "parent.child.grandchild",);
    assertEquals(shift.subId, "parent.child.grandchild",);
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, parent does not exist", () => {
    const project2 = new MockProject(1, false,);
    const shift = new Shift(project2, "nonexistent.child", "Child", null,);
    assertEquals(shift.fullId, "nonexistent.child",);
    assertEquals(shift.subId, "child",);
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, parent does not exist", () => {
    const project2 = new MockProject(1, true,);
    const shift = new Shift(project2, "nonexistent.child", "Child", null,);
    assertEquals(shift.fullId, "nonexistent.child",);
    assertEquals(shift.subId, "nonexistent.child",);
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists", () => {
    const project2 = new MockProject(1, false,);
    const existing = new Shift(project2, "child", "Child", null,);
    const shift = new Shift(project2, "nonexistent.child", "Child", null,);
    assertEquals(shift.fullId, "nonexistent.child",);
    assertEquals(shift.subId, "child",);
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists", () => {
    const project2 = new MockProject(1, true,);
    const existing = new Shift(project2, "child", "Child", null,);
    const shift = new Shift(project2, "nonexistent.child", "Child", null,);
    assertEquals(shift.fullId, "nonexistent.child",);
    assertEquals(shift.subId, "nonexistent.child",);
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace false, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, false,);
    const parent = new Shift(project2, "parent", "Parent", null,);
    const existing = new Shift(project2, "parent.child", "Child", null,);
    const shift = new Shift(project2, "parent.child", "Child", null,);
    assertEquals(shift.fullId, "parent.child",);
    assertEquals(shift.subId, "child",);
  });

  it("shift com id hierárquico resolve pai do PropertySet (já existente) - flatNamespace true, child already exists, parent already exists", () => {
    const project2 = new MockProject(1, true,);
    const parent = new Shift(project2, "parent", "Parent", null,);
    const existing = new Shift(project2, "parent.child", "Child", null,);
    const shift = new Shift(project2, "parent.child", "Child", null,);
    assertEquals(shift.fullId, "parent.child",);
    assertEquals(shift.subId, "parent.child",);
  });
});

describe("ShiftScenario", () => {
  let project: MockProject;
  let shift: Shift;
  let shiftScenario: ShiftScenario;

  beforeEach(() => {
    project = new MockProject(2,);
    shift = new Shift(project, "shift1", "Shift 1", null,);
    shiftScenario = shift.scenarioData(0,);
  },);

  it("onShift? retorna true para slot de tempo de trabalho", () => {
    const start = new Date("2026-01-05T00:00:00Z",);
    const end = new Date("2026-01-12T00:00:00Z",);
    const wh = new WorkingHours(3600, start, end,);
    wh.setWorkingHours(1, [[9 * 60 * 60, 17 * 60 * 60,],],);
    shift.setForScenario("workinghours", wh, 0,);

    const monday10am = TjTime.fromDate(new Date("2026-01-05T10:00:00Z",),);
    assertEquals(shiftScenario.onShift(monday10am,), true,);

    const monday8pm = TjTime.fromDate(new Date("2026-01-05T20:00:00Z",),);
    assertEquals(shiftScenario.onShift(monday8pm,), false,);

    const sunday10am = TjTime.fromDate(new Date("2026-01-04T10:00:00Z",),);
    assertEquals(shiftScenario.onShift(sunday10am,), false,);
  });

  it("onShift? retorna true para slot sem workinghours", () => {
    const monday10am = TjTime.fromDate(new Date("2026-01-05T10:00:00Z",),);
    assertEquals(shiftScenario.onShift(monday10am,), true,);
  });

  it("replace? retorna true quando definido", () => {
    shift.setForScenario("replace", true, 0,);
    assertEquals(shiftScenario.replace(), true,);
  });

  it("replace? retorna false quando não definido", () => {
    assertEquals(shiftScenario.replace(), false,);
  });

  it("onLeave? retorna true para slot com leave", () => {
    const leaveInterval = { contains: (_date: TjTime,) => true, };
    shift.setForScenario("leaves", [{ interval: leaveInterval, },], 0,);

    const date = TjTime.fromDate(new Date("2026-01-05T12:00:00Z",),);
    assertEquals(shiftScenario.onLeave(date,), true,);
  });

  it("onLeave? retorna false para slot sem leave", () => {
    const date = TjTime.fromDate(new Date("2026-01-05T12:00:00Z",),);
    assertEquals(shiftScenario.onLeave(date,), false,);
  });
});
