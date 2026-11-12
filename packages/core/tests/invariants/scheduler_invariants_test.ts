/**
 * 11.G.H.1 — Invariantes do scheduler (Fase 11-Gaps, Bloco H).
 *
 * Todo cronograma válido produzido por `Project.schedule()` deve satisfazer
 * as invariantes abaixo. Este arquivo fixa a semântica da Fase 7/G1:
 *
 *  1. Toda task `scheduled` tem `start !== null`.
 *  2. Toda task `scheduled` tem `end !== null`.
 *  3. `start <= end` em todas as tasks agendadas.
 *  4. Toda milestone tem `start == end`.
 *  5. Dependência respeitada: se B `depends` A, `B.start >= A.end` (onEnd)
 *     ou `B.start >= A.start` (onStart).
 *  6. Task dentro do range do projeto **ou** `isRunAway === true`.
 *  7. `doneEffort <= effort` quando `effort` está definido (não-ultrapassa).
 *
 * Rodamos as invariantes sobre um modelo rico construído à mão (containers,
 * milestones, dependências, effortTasks, alocações) e, em `scheduler_fuzz_test.ts`,
 * sobre N=20 projetos determinísticos gerados via seed fixa.
 *
 * @see docs/syntaxmesh/fases/fase-11-logical-gaps-tarefas.md §11.G.H.1
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import {
  allTasks,
  checkInvariants,
  isoDate,
  msOf,
  richModel,
} from "../helpers/scheduler-invariants.ts";

describe("H.1 — invariantes do scheduler", () => {
  const prevTz = Deno.env.get("TZ",);
  Deno.env.set("TZ", "UTC",);
  TjTime.setTimeZone("UTC",);

  beforeEach_resetMessages();

  it("todos os 7 invariantes valem no modelo rico agendado", () => {
    const project = richModel();
    assert(project.schedule(), "schedule() deve retornar true",);
    const violations = checkInvariants(project,);
    assertEquals(
      violations,
      [],
      `violações: ${violations.join(" | ",)}`,
    );
  });

  it("invariante 4 (milestone start==end) pegaria regressão", () => {
    // Modelo com milestone declarado mas sem `start`: o scheduler propaga
    // start=end; verificamos que a invariante passa. Se o markAsMilestone
    // regredir (guards invertidos), a invariante falha.
    const project = createTestProject(1,);
    const dev = new Resource(project, "dev", "Dev", null,);
    const t = new Task(project, "m", "Milestone", null,);
    t.setForScenario("milestone", true, 0,);
    t.setForScenario("start", TjTime.fromString("2026-02-01",), 0,);
    // Sem effort/allocate/booking — é milestone puro.
    project.schedule();
    const violations = checkInvariants(project,);
    assertEquals(violations, [], `${violations.join(" | ",)}`,);
    // Confirma que a task é realmente milestone.
    assertEquals(isoDate(t.getForScenario("start", 0,),), "2026-02-01",);
    assertEquals(isoDate(t.getForScenario("end", 0,),), "2026-02-01",);
    void dev;
  });

  it("invariante 5 (dependência B.start >= A.end) vale para t2 após t1", () => {
    const project = richModel();
    project.schedule();
    const t1 = allTasks(project,).find((x,) => x.fullId === "phase1.t1")!;
    const t2 = allTasks(project,).find((x,) => x.fullId === "phase1.t2")!;
    const endT1 = t1.getForScenario("end", 0,) as TjTime;
    const startT2 = t2.getForScenario("start", 0,) as TjTime;
    assert(
      startT2.toSeconds() >= endT1.toSeconds(),
      `t2.start (${startT2.toString()}) deve ser >= t1.end ${endT1.toString()}`,
    );
  });

  it("invariante 3 (start <= end) vale para todas as tasks agendadas", () => {
    const project = richModel();
    project.schedule();
    for (const t of allTasks(project,)) {
      const s = msOf(t.getForScenario("start", 0,),);
      const e = msOf(t.getForScenario("end", 0,),);
      if (s === null || e === null) continue;
      assert(
        s <= e,
        `${t.fullId}: start ${
          isoDate(
            t.getForScenario("start", 0,),
          )
        } > end ${isoDate(t.getForScenario("end", 0,),)}`,
      );
    }
  });

  // Restaura TZ para não contaminar outros arquivos.
  if (prevTz === undefined) Deno.env.delete("TZ",);
  else Deno.env.set("TZ", prevTz,);
});

/** Zera MessageHandler antes do suite (helper inline para não importar hooks). */
function beforeEach_resetMessages() {
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
}
