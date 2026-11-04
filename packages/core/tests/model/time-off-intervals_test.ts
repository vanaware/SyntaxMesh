/**
 * Testes de `collectTimeOffIntervals` (pré-requisito da Fase 15.10.4).
 *
 * Fonte Ruby:
 * - `ResourceScenario.rb:733` (só folhas, máscara `0x3E`);
 * - `TaskScenario.rb:1623` (intersecção de recursos/filhos/leaves globais);
 * - `Project.rb:976` (leaves globais).
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.10.4)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Task, } from "../../src/model/task.ts";
import { Scoreboard, } from "../../src/time/scoreboard.ts";
import { IntervalList, } from "../../src/time/interval-list.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";

const D = (s: string,): TjTime => TjTime.fromString(s,);

/** Atalho para montar o `IntervalList` devolvido pelas APIs do modelo. */
function il(...ranges: Array<[TjTime, TjTime,]>): IntervalList<TimeInterval> {
  const list = new IntervalList<TimeInterval>();
  for (const [start, end,] of ranges) list.push(new TimeInterval(start, end,),);
  return list;
}

/** Slot de folga no scoreboard: `leaveType << 2` (máscara `0x3E`). */
const OFF_DUTY = 4;

describe("collectTimeOffIntervals (Fase 15.10.4)", () => {
  beforeEach(() => {
    TjTime.setTimeZone("UTC",);
  },);

  describe("ResourceScenario", () => {
    it("recurso container devolve lista vazia sem criar scoreboard", () => {
      const project = createTestProject();
      const group = new Resource(project, "g", "Group", null,);
      new Resource(project, "g.1", "Child", group,);

      const sc = group.scenarioData(0,);
      const iv = new TimeInterval(D("2026-01-01",), D("2026-01-02",),);
      assertEquals(sc.collectTimeOffIntervals(iv, 3600,).length, 0,);
      // `leaf?` falha antes do `initScoreboard`.
      assertEquals(sc.scoreboard, null,);
    });

    it("recurso folha sem folgas devolve lista vazia", () => {
      const project = createTestProject();
      const resource = new Resource(project, "r1", "Res 1", null,);
      const sc = resource.scenarioData(0,);

      const iv = new TimeInterval(D("2026-01-01",), D("2026-01-02",),);
      assertEquals(sc.collectTimeOffIntervals(iv, 3600,).length, 0,);
    });

    it("converte slots fora de expediente em intervalos", () => {
      const project = createTestProject();
      const resource = new Resource(project, "r1", "Res 1", null,);
      const sc = resource.scenarioData(0,);
      sc.initScoreboard();
      // Slots 10..14 (10h às 15h de 2026-01-01) marcados como folga.
      for (let i = 10; i < 15; i++) sc.scoreboard!.set(i, OFF_DUTY,);

      const iv = new TimeInterval(D("2026-01-01",), D("2026-01-02",),);
      const zones = sc.collectTimeOffIntervals(iv, 3600,);
      assertEquals(zones.length, 1,);
      const base = D("2026-01-01",).toSeconds();
      assertEquals(zones[0]!.start.toSeconds(), base + 10 * 3600,);
      assertEquals(zones[0]!.end.toSeconds(), base + 15 * 3600,);
    });

    it("descarta intervalos menores que minDuration", () => {
      const project = createTestProject();
      const resource = new Resource(project, "r1", "Res 1", null,);
      const sc = resource.scenarioData(0,);
      sc.initScoreboard();
      for (let i = 10; i < 15; i++) sc.scoreboard!.set(i, OFF_DUTY,);

      const iv = new TimeInterval(D("2026-01-01",), D("2026-01-02",),);
      // 5 slots de 1h < 6h exigidas.
      assertEquals(sc.collectTimeOffIntervals(iv, 6 * 3600,).length, 0,);
    });
  });

  describe("Project", () => {
    it("sem scoreboard devolve lista vazia", () => {
      const project = createTestProject();
      const iv = new TimeInterval(D("2026-01-01",), D("2026-01-02",),);
      assertEquals(project.collectTimeOffIntervals(iv, 3600,).length, 0,);
    });

    it("usa o scoreboard global (máscara 0x3E)", () => {
      const project = createTestProject();
      project.scoreboard = new Scoreboard<number | null>(
        D("2026-01-01",).toDate(),
        D("2026-01-03",).toDate(),
        3600,
        null,
      );
      for (let i = 20; i < 25; i++) project.scoreboard.set(i, OFF_DUTY,);

      const iv = new TimeInterval(D("2026-01-01",), D("2026-01-02",),);
      const zones = project.collectTimeOffIntervals(iv, 3600,);
      assertEquals(zones.length, 1,);
      const base = D("2026-01-01",).toSeconds();
      assertEquals(zones[0]!.start.toSeconds(), base + 20 * 3600,);
      // 25 slots → 2026-01-02T01:00.
      assertEquals(zones[0]!.end.toSeconds(), base + 25 * 3600,);
    });
  });

  describe("TaskScenario", () => {
    it("folha sem recursos usa os leaves globais do projeto", () => {
      const project = createTestProject();
      const task = new Task(project, "t1", "Task 1", null,);
      const iv = new TimeInterval(D("2026-01-01",), D("2026-01-02",),);

      const sc = task.scenarioData(0,);
      assertEquals(sc.collectTimeOffIntervals(iv, 3600,).length, 0,);

      // Injetado no projeto: os intervalos devem passar direto.
      project.collectTimeOffIntervals = () =>
        il([D("2026-03-01",), D("2026-03-05",),],);
      const zones = sc.collectTimeOffIntervals(iv, 3600,);
      assertEquals(zones.length, 1,);
      assertEquals(zones[0]!.start.toSeconds(), D("2026-03-01",).toSeconds(),);
    });

    it("folha com recursos intersecta os intervalos deles", () => {
      const project = createTestProject();
      const task = new Task(project, "t1", "Task 1", null,);
      const r1 = new Resource(project, "r1", "Res 1", null,);
      const r2 = new Resource(project, "r2", "Res 2", null,);
      task.setForScenario("assignedresources", [r1, r2,], 0,);

      r1.scenarioData(0,).collectTimeOffIntervals = () =>
        il([D("2026-02-01",), D("2026-02-10",),],);
      r2.scenarioData(0,).collectTimeOffIntervals = () =>
        il([D("2026-02-05",), D("2026-02-20",),],);

      const iv = new TimeInterval(D("2026-01-01",), D("2026-01-02",),);
      const zones = task.scenarioData(0,).collectTimeOffIntervals(iv, 3600,);
      assertEquals(zones.length, 1,);
      // Intersecção: [2026-02-05, 2026-02-10].
      assertEquals(zones[0]!.start.toSeconds(), D("2026-02-05",).toSeconds(),);
      assertEquals(zones[0]!.end.toSeconds(), D("2026-02-10",).toSeconds(),);
    });

    it("container intersecta os intervalos dos filhos", () => {
      const project = createTestProject();
      const container = new Task(project, "c1", "Container", null,);
      const kid1 = new Task(project, "c1.1", "Kid 1", container,);
      const kid2 = new Task(project, "c1.2", "Kid 2", container,);

      kid1.scenarioData(0,).collectTimeOffIntervals = () =>
        il([D("2026-04-01",), D("2026-04-10",),],);
      kid2.scenarioData(0,).collectTimeOffIntervals = () =>
        il([D("2026-04-08",), D("2026-04-30",),],);

      const iv = new TimeInterval(D("2026-01-01",), D("2026-01-02",),);
      const zones = container.scenarioData(0,).collectTimeOffIntervals(
        iv,
        3600,
      );
      assertEquals(zones.length, 1,);
      assertEquals(zones[0]!.start.toSeconds(), D("2026-04-08",).toSeconds(),);
      assertEquals(zones[0]!.end.toSeconds(), D("2026-04-10",).toSeconds(),);
    });
  });
});
