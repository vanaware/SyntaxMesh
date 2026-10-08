import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MockProject, } from "../model/mock-project.ts";
import { Shift, } from "../../src/model/shift.ts";
import { ShiftScenario, } from "../../src/model/shift-scenario.ts";
import {
  ShiftAssignment,
  ShiftAssignments,
} from "../../src/scheduling/shift-assignments.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

describe("ShiftAssignment", () => {
  let project: MockProject;
  let shift: Shift;
  let shiftScenario: ShiftScenario;
  let interval: TimeInterval;

  beforeEach(() => {
    project = new MockProject(2,);
    shift = new Shift(project, "shift1", "Shift 1", null,);
    shiftScenario = shift.scenarioData(0,);
    interval = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-01T09:00:00Z",),),
      TjTime.fromDate(new Date("2026-01-01T17:00:00Z",),),
    );
  },);

  it("constructor cria ShiftAssignment com shiftScenario e interval", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    assertEquals(sa.shiftScenario, shiftScenario,);
    assertEquals(sa.interval, interval,);
  });

  it("hashKey retorna chave determinística", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    const hash = sa.hashKey();
    assertEquals(typeof hash, "string",);
    assert(hash.includes("|0|",),);
  });

  it("copy cria cópia profunda", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    const copy = sa.copy();
    assertEquals(copy.shiftScenario, sa.shiftScenario,);
    assertEquals(copy.interval, sa.interval,);
    assert(copy !== sa,);
    assert(copy.interval !== sa.interval,);
  });

  it("overlaps retorna true para intervalos sobrepostos", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    const other = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-01T15:00:00Z",),),
      TjTime.fromDate(new Date("2026-01-01T18:00:00Z",),),
    );
    assertEquals(sa.overlaps(other,), true,);
  });

  it("overlaps retorna false para intervalos não sobrepostos", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    const other = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-01T18:00:00Z",),),
      TjTime.fromDate(new Date("2026-01-01T20:00:00Z",),),
    );
    assertEquals(sa.overlaps(other,), false,);
  });

  it("assigned retorna true para data dentro do intervalo", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    const date = TjTime.fromDate(new Date("2026-01-01T12:00:00Z",),);
    assertEquals(sa.assigned(date,), true,);
  });

  it("assigned retorna false para data fora do intervalo", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    const date = TjTime.fromDate(new Date("2026-01-01T18:00:00Z",),);
    assertEquals(sa.assigned(date,), false,);
  });

  it("replace retorna true para data dentro do intervalo e replace true", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    shift.setForScenario("replace", true, 0,);
    const date = TjTime.fromDate(new Date("2026-01-01T12:00:00Z",),);
    assertEquals(sa.replace(date,), true,);
  });

  it("replace retorna false para data fora do intervalo", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    shift.setForScenario("replace", true, 0,);
    const date = TjTime.fromDate(new Date("2026-01-01T18:00:00Z",),);
    assertEquals(sa.replace(date,), false,);
  });

  it("replace retorna false para replace false", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    shift.setForScenario("replace", false, 0,);
    const date = TjTime.fromDate(new Date("2026-01-01T12:00:00Z",),);
    assertEquals(sa.replace(date,), false,);
  });

  it("onShift delega a shiftScenario.onShift", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    const date = TjTime.fromDate(new Date("2026-01-01T12:00:00Z",),);
    assertEquals(sa.onShift(date,), true,);
  });

  it("onLeave delega a shiftScenario.onLeave", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    const date = TjTime.fromDate(new Date("2026-01-01T12:00:00Z",),);
    assertEquals(sa.onLeave(date,), false,);
  });

  it("to_s retorna representação", () => {
    const sa = new ShiftAssignment(shiftScenario, interval,);
    const str = sa.to_s();
    assertEquals(str, "<0> 2026-01-01-09:00-+00:00 - 2026-01-01-17:00-+00:00",);
  });
});

describe("ShiftAssignments", () => {
  let project: MockProject;
  let shift: Shift;
  let shiftScenario: ShiftScenario;
  let interval: TimeInterval;
  let sa: ShiftAssignment;

  beforeEach(() => {
    project = new MockProject(2,);
    shift = new Shift(project, "shift1", "Shift 1", null,);
    shiftScenario = shift.scenarioData(0,);
    interval = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-01T09:00:00Z",),),
      TjTime.fromDate(new Date("2026-01-01T17:00:00Z",),),
    );
    sa = new ShiftAssignment(shiftScenario, interval,);
    ShiftAssignments.sbClear();
  },);

  it("constructor cria ShiftAssignments vazio", () => {
    const sas = new ShiftAssignments();
    assertEquals(sas.project, null,);
    assertEquals(sas.assignments.length, 0,);
  });

  it("constructor com ShiftAssignments copia deep", () => {
    const sas1 = new ShiftAssignments();
    sas1.project = project;
    sas1.addAssignment(sa,);
    const sas2 = new ShiftAssignments(sas1,);
    assertEquals(sas2.assignments.length, 1,);
    assertEquals(sas2.assignments[0]!.shiftScenario, sa.shiftScenario,);
    assertEquals(sas2.assignments[0]!.interval, sa.interval,);
    assert(sas2 !== sas1,);
    assert(sas2.assignments[0] !== sas1.assignments[0],);
  });

  it("addAssignment adiciona se não houver sobreposição", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    const result = sas.addAssignment(sa,);
    assertEquals(result, true,);
    assertEquals(sas.assignments.length, 1,);
  });

  it("addAssignment retorna false para sobreposição", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    sas.addAssignment(sa,);
    const other = new ShiftAssignment(
      shiftScenario,
      new TimeInterval(
        TjTime.fromDate(new Date("2026-01-01T12:00:00Z",),),
        TjTime.fromDate(new Date("2026-01-01T18:00:00Z",),),
      ),
    );
    const result = sas.addAssignment(other,);
    assertEquals(result, false,);
    assertEquals(sas.assignments.length, 1,);
  });

  it("hashKey é determinístico para instâncias idênticas", () => {
    const sas1 = new ShiftAssignments();
    sas1.project = project;
    sas1.addAssignment(sa,);
    const sas2 = new ShiftAssignments();
    sas2.project = project;
    sas2.addAssignment(sa,);
    assertEquals(sas1.hashKey(), sas2.hashKey(),);
  });

  it("hashKey é diferente para instâncias diferentes", () => {
    const sas1 = new ShiftAssignments();
    sas1.project = project;
    sas1.addAssignment(sa,);
    const sas2 = new ShiftAssignments();
    sas2.project = project;
    const otherInterval = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-02T09:00:00Z",),),
      TjTime.fromDate(new Date("2026-01-02T17:00:00Z",),),
    );
    const otherSa = new ShiftAssignment(shiftScenario, otherInterval,);
    sas2.addAssignment(otherSa,);
    assert(sas1.hashKey() !== sas2.hashKey(),);
  });

  it("newScoreboard cria ou reutiliza scoreboard compartilhado", () => {
    const sas1 = new ShiftAssignments();
    sas1.project = project;
    sas1.addAssignment(sa,);
    const sb1 = sas1.newScoreboard();
    const sas2 = new ShiftAssignments();
    sas2.project = project;
    sas2.addAssignment(sa,);
    const sb2 = sas2.newScoreboard();
    assertEquals(sb1, sb2,);
  });

  it("getSbSlot retorna valor cacheado se presente", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    // Set project start to match assignment start so index 0 covers the assignment
    sas.project.set(
      "start",
      TjTime.fromDate(new Date("2026-01-01T09:00:00Z",),),
    );
    sas.addAssignment(sa,);
    const slot = sas.getSbSlot(0,);
    assertEquals(slot, 1,);
    const slot2 = sas.getSbSlot(0,);
    assertEquals(slot2, 1,);
  });

  it("getSbSlot computa encoding lazy", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    // Set project start to match assignment start so index 0 covers the assignment
    sas.project.set(
      "start",
      TjTime.fromDate(new Date("2026-01-01T09:00:00Z",),),
    );
    sas.addAssignment(sa,);
    const slot = sas.getSbSlot(0,);
    assertEquals(slot, 1,);
  });

  it("assigned retorna true para índice com atribuição", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    // Set project start to match assignment start so index 0 covers the assignment
    sas.project.set(
      "start",
      TjTime.fromDate(new Date("2026-01-01T09:00:00Z",),),
    );
    sas.addAssignment(sa,);
    assertEquals(sas.assigned(0,), true,);
  });

  it("assigned retorna false para índice sem atribuição", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    assertEquals(sas.assigned(0,), false,);
  });

  it("onShift retorna true para slot de tempo de trabalho", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    sas.addAssignment(sa,);
    assertEquals(sas.onShift(0,), true,);
  });

  it("onShift retorna true para slot sem tempo de trabalho (sem workinghours)", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    sas.addAssignment(sa,);
    const otherInterval = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-01T09:00:00Z",),),
      TjTime.fromDate(new Date("2026-01-01T17:00:00Z",),),
    );
    const otherSa = new ShiftAssignment(shiftScenario, otherInterval,);
    sas.addAssignment(otherSa,);
    assertEquals(sas.onShift(0,), true,);
  });

  it("timeOff retorna false para slot com tempo de trabalho", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    sas.addAssignment(sa,);
    assertEquals(sas.timeOff(0,), false,);
  });

  it("timeOff retorna false para slot sem tempo de trabalho (sem workinghours)", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    sas.addAssignment(sa,);
    const otherInterval = new ShiftAssignment(
      shiftScenario,
      new TimeInterval(
        TjTime.fromDate(new Date("2026-01-01T09:00:00Z",),),
        TjTime.fromDate(new Date("2026-01-01T17:00:00Z",),),
      ),
    );
    sas.addAssignment(otherInterval,);
    assertEquals(sas.timeOff(0,), false,);
  });

  it("onLeave retorna false para slot sem leave", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    sas.addAssignment(sa,);
    assertEquals(sas.onLeave(0,), false,);
  });

  it("onLeave retorna true para slot com leave", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    sas.project.set(
      "start",
      TjTime.fromDate(new Date("2026-01-01T09:00:00Z",),),
    );
    shift.setForScenario("leaves", [{
      interval: { contains: (d: any,) => true, },
    },], 0,);
    sas.addAssignment(sa,);
    assertEquals(sas.onLeave(0,), true,);
  });

  it("collectTimeOffIntervals coleta intervalos de tempo fora", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    sas.addAssignment(sa,);
    const iv = new TimeInterval(
      TjTime.fromDate(new Date("2026-01-01T00:00:00Z",),),
      TjTime.fromDate(new Date("2026-01-01T24:00:00Z",),),
    );
    const intervals = sas.collectTimeOffIntervals(iv, 0,);
    assertEquals(intervals.length, 0,);
  });

  it("to_s retorna representação para assignments não vazios", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    sas.addAssignment(sa,);
    const str = sas.to_s();
    assert(str.includes("shifts",),);
    assert(str.includes("<0>",),);
    assert(str.includes("2026-01-01-09:00-+00:00",),);
  });

  it("to_s retorna string vazia para assignments vazios", () => {
    const sas = new ShiftAssignments();
    sas.project = project;
    const str = sas.to_s();
    assertEquals(str, "",);
  });
});
