import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assert, } from "@std/assert";
import { MockProject, } from "../model/mock-project.ts";
import { Limits, } from "../../src/scheduling/limits.ts";
import { ShiftAssignments, } from "../../src/scheduling/shift-assignments.ts";
import { Shift, } from "../../src/model/shift.ts";
import { WorkingHours, } from "../../src/calendar/working-hours.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ShiftAssignment, } from "../../src/scheduling/shift-assignments.ts";
import { projectObjectId, } from "../../src/utils/project-object-id.ts";
import { ResourceScenario, } from "../../src/model/resource-scenario.ts";
import { Resource, } from "../../src/model/resource.ts";

describe("Smoke test after Phase 6", () => {
  beforeEach(() => {
    // Configurar modo global (Fase 3)
    // (AttributeBase.setMode(0) é chamado automaticamente em beforeEach dos testes)
  },);

  it("cria Limits e verifica tipos de limite", () => {
    const project = new MockProject(1);
    const limits = new Limits();
    limits.setProject(project);

    // Testar cada tipo de limite
    limits.setLimit("dailymax", 3600);
    assertEquals(limits.limits.length, 1);
    assertEquals(limits.limits[0]!.name, "dailymax");

    limits.setLimit("weeklymax", 7 * 3600);
    assertEquals(limits.limits.length, 2);
    assertEquals(limits.limits[1]!.name, "weeklymax");

    limits.setLimit("monthlymax", 30 * 3600);
    assertEquals(limits.limits.length, 3);
    assertEquals(limits.limits[2]!.name, "monthlymax");

    limits.setLimit("maximum", 3600);
    assertEquals(limits.limits.length, 4);
    assertEquals(limits.limits[3]!.name, "maximum");
  });

  it("verifica ShiftAssignments com atribuição", () => {
    const project = new MockProject(1);
    const shift = new Shift(project, "shift1", "Shift 1", null);
    const wh = new WorkingHours(3600, (project.get("start") as TjTime).toDate(), (project.get("end") as TjTime).toDate(),);
    wh.setWorkingHours(1, [[9 * 3600, 17 * 3600]]);
    shift.setForScenario("workinghours", wh, 0);

    const assignments = new ShiftAssignments();
    assignments.project = project;

    const interval = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-01T09:00:00Z")),
      TjTime.fromDate(new Date("2026-01-01T17:00:00Z")),
    );
    const sa = new ShiftAssignment(shift.scenarioData(0), interval);
    const result = assignments.addAssignment(sa);
    assertEquals(result, true);
    assertEquals(assignments.assignments.length, 1);

    // Verificar que o encoding de bits funciona
    // Slot 0 = 2026-01-01T00:00Z (fora do intervalo 09:00-17:00)
    const slot0 = assignments.getSbSlot(0);
    assertEquals(slot0, 0);
    // Slot 9 = 2026-01-01T09:00Z (dentro do intervalo)
    const slot9 = assignments.getSbSlot(9);
    assertEquals(slot9, 1); // BIT_ASSIGNED = 1
  });

  it("verifica ShiftScenario consolidado", () => {
    const project = new MockProject(1);
    const shift = new Shift(project, "shift1", "Shift 1", null);
    const wh = new WorkingHours(3600, (project.get("start") as TjTime).toDate(), (project.get("end") as TjTime).toDate(),);
    wh.setWorkingHours(1, [[9 * 3600, 17 * 3600]]);
    shift.setForScenario("workinghours", wh, 0);
    shift.setForScenario("replace", true, 0);

    const shiftScenario = shift.scenarioData(0);

    // Testar onShift?
    const date = TjTime.fromDate(new Date("2026-01-01T12:00:00Z"));
    assertEquals(shiftScenario.onShift(date), true);

    // Testar replace?
    assertEquals(shiftScenario.replace(), true);

    // Testar onLeave? (sem leaves)
    assertEquals(shiftScenario.onLeave(date), false);
  });

  it("verifica ResourceScenario.onShift?", () => {
    const project = new MockProject(1);
    const resource = new Resource(project, "res1", "Resource 1", null);
    const shifts = new ShiftAssignments();
    shifts.project = project;

    // Configurar shifts no recurso (Ruby: @property['shifts', @scenarioIdx])
    resource.setForScenario("shifts", shifts, 0);

    const resourceScenario = resource.scenarioData(0) as ResourceScenario;

    // Testar onShift? sem shifts
    assertEquals(resourceScenario.onShift(0), true); // workinghours padrão do project

    // Adicionar uma atribuição de shift
    const shift = new Shift(project, "shift1", "Shift 1", null);
    const wh = new WorkingHours(3600, (project.get("start") as TjTime).toDate(), (project.get("end") as TjTime).toDate(),);
    wh.setWorkingHours(1, [[9 * 3600, 17 * 3600]]);
    shift.setForScenario("workinghours", wh, 0);

    const interval = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-01T09:00:00Z")),
      TjTime.fromDate(new Date("2026-01-01T17:00:00Z")),
    );
    const sa = new ShiftAssignment(shift.scenarioData(0), interval);
    shifts.addAssignment(sa);

    // Testar onShift? com shifts
    assertEquals(resourceScenario.onShift(0), true);
  });

  it("verifica projectObjectId helper", () => {
    const project1 = new MockProject(1);
    const project2 = new MockProject(2);

    const id1 = projectObjectId(project1);
    const id2 = projectObjectId(project2);

    assert(id1 > 0);
    assert(id2 > 0);
    assert(id1 !== id2);

    // Mesmo projeto retorna mesmo ID
    const id1Again = projectObjectId(project1);
    assertEquals(id1Again, id1);
  });

  it("verifica que ShiftAssignments compartilha scoreboards", () => {
    const project = new MockProject(1);
    const shift = new Shift(project, "shift1", "Shift 1", null);
    const wh = new WorkingHours(3600, project.get("start") as Date, project.get("end") as Date,);
    wh.setWorkingHours(1, [[9 * 3600, 17 * 3600]]);
    shift.setForScenario("workinghours", wh, 0);

    const interval = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-01T09:00:00Z")),
      TjTime.fromDate(new Date("2026-01-01T17:00:00Z")),
    );
    const sa = new ShiftAssignment(shift.scenarioData(0), interval);

    const assignments1 = new ShiftAssignments();
    assignments1.project = project;
    assignments1.addAssignment(sa);

    const assignments2 = new ShiftAssignments();
    assignments2.project = project;
    assignments2.addAssignment(sa);

    // Ambos devem compartilhar o mesmo scoreboard
    const sb1 = assignments1.newScoreboard();
    const sb2 = assignments2.newScoreboard();
    assertEquals(sb1, sb2);
  });

  it("verifica que Limits.reset() funciona", () => {
    const project = new MockProject(1);
    const limits = new Limits();
    limits.setProject(project);

    limits.setLimit("dailymax", 3600);
    const limit = limits.limits[0]!;

    // Incrementar
    limits.inc(0);
    assertEquals(limit.getDirty(), true);

    // Reset
    limits.reset();
    assertEquals(limit.getDirty(), false);

    // Verificar que o scoreboard está resetado
    const slot = limit.getScoreboard().get(0);
    assertEquals(slot, 0);
  });

  it("verifica que ShiftAssignments.sbClear() limpa cache", () => {
    const project = new MockProject(1);
    const shift = new Shift(project, "shift1", "Shift 1", null);
    const wh = new WorkingHours(3600, (project.get("start") as TjTime).toDate(), (project.get("end") as TjTime).toDate(),);
    wh.setWorkingHours(1, [[9 * 3600, 17 * 3600]]);
    shift.setForScenario("workinghours", wh, 0);

    const interval = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-01T09:00:00Z")),
      TjTime.fromDate(new Date("2026-01-01T17:00:00Z")),
    );
    const sa = new ShiftAssignment(shift.scenarioData(0), interval);

    const assignments1 = new ShiftAssignments();
    assignments1.project = project;
    assignments1.addAssignment(sa);

    const assignments2 = new ShiftAssignments();
    assignments2.project = project;
    assignments2.addAssignment(sa);

    // Ambos compartilham o mesmo scoreboard
    const sb1 = assignments1.newScoreboard();
    const sb2 = assignments2.newScoreboard();
    assertEquals(sb1, sb2);

    // Limpar cache
    ShiftAssignments.sbClear();

    // Criar novas instâncias — devem ter scoreboards diferentes agora
    const assignments3 = new ShiftAssignments();
    assignments3.project = project;
    assignments3.addAssignment(sa);

    const assignments4 = new ShiftAssignments();
    assignments4.project = project;
    assignments4.addAssignment(sa);

    const sb3 = assignments3.newScoreboard();
    const sb4 = assignments4.newScoreboard();
    assertEquals(sb3, sb4);
    assert(sb3 !== sb1); // Novo scoreboard após sbClear
  });
});