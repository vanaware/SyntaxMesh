/**
 * Scheduler invariant checks and the rich fixture model — shared by
 * `invariants/scheduler_invariants_test.ts` and `fuzz/scheduler_fuzz_test.ts`.
 *
 * Lives outside `*_test.ts` on purpose: importing helpers from a test module
 * re-registers its whole suite in every importing file (Deno discovers tests
 * per module), running the same assertions twice.
 */
import type { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import type { TaskScenario, } from "../../src/model/task-scenario.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Allocation, } from "../../src/scheduling/allocation.ts";
import { TaskDependency, } from "../../src/scheduling/task-dependency.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";

/** Extrai a data ISO (AAAA-MM-DD) de um valor TjTime ou `null`. */
export function isoDate(v: unknown,): string | null {
  return v instanceof TjTime ? v.toString().slice(0, 10,) : null;
}

/** Extrai o timestamp numérico (segundos desde epoch) de um TjTime ou `null`. */
export function msOf(v: unknown,): number | null {
  return v instanceof TjTime ? v.toSeconds() : null;
}

/** Enumera as tasks do projeto em lista flat (PropertySet já é achatado). */
export function allTasks(project: Project,): Task[] {
  return project.tasks.toArray() as unknown as Task[];
}

/** Roda todas as 7 invariantes sobre um projeto recém-agendado. */
export function checkInvariants(project: Project,): string[] {
  const violations: string[] = [];
  const projStart = project.get("start",) as TjTime;
  const projEnd = project.get("end",) as TjTime;
  const projStartMs = projStart.toSeconds();
  const projEndMs = projEnd.toSeconds();

  for (const task of allTasks(project,)) {
    const sc = task.scenarioData(0,) as TaskScenario;
    const scheduled = Boolean(task.getForScenario("scheduled", 0,),);
    const start = task.getForScenario("start", 0,);
    const end = task.getForScenario("end", 0,);
    const id = task.fullId;

    // 1. scheduled → start !== null
    if (scheduled && !(start instanceof TjTime)) {
      violations.push(`${id}: scheduled mas start=${String(start,)}`,);
    }
    // 2. scheduled → end !== null
    if (scheduled && !(end instanceof TjTime)) {
      violations.push(`${id}: scheduled mas end=${String(end,)}`,);
    }
    // 3. start <= end (quando ambos definidos)
    const s = msOf(start,);
    const e = msOf(end,);
    if (s !== null && e !== null && s > e) {
      violations.push(
        `${id}: start (${isoDate(start,)}) > end (${isoDate(end,)})`,
      );
    }
    // 4. milestone → start == end
    const isMilestone = Boolean(task.getForScenario("milestone", 0,),) ||
      sc.durationType() === "milestone";
    if (isMilestone && s !== null && e !== null && s !== e) {
      violations.push(
        `${id}: milestone com start (${isoDate(start,)}) ≠ end (${
          isoDate(end,)
        })`,
      );
    }
    // 6. dentro do range do projeto OU isRunAway
    if (s !== null && e !== null && !sc.isRunAway()) {
      if (s < projStartMs || e > projEndMs) {
        violations.push(
          `${id}: fora do range do projeto ` +
            `(${projStart.toString()}..${projEnd.toString()}) sem isRunAway ` +
            `— start=${isoDate(start,)} end=${isoDate(end,)}`,
        );
      }
    }
    // 7. doneEffort <= effort (quando effort está definido)
    const effort = task.getForScenario("effort", 0,);
    if (typeof effort === "number" && effort > 0) {
      const done = sc.doneEffort();
      // tolerância de 1 slot de arredondamento
      if (done > effort + 1) {
        violations.push(
          `${id}: doneEffort (${done}) > effort (${effort})`,
        );
      }
    }
    // 5. dependências respeitadas
    const deps = (task.getForScenario("depends", 0,) as TaskDependency[]) ??
      [];
    for (const dep of deps) {
      const target = dep.task;
      if (!target) continue;
      const tStart = msOf(target.getForScenario("start", 0,),);
      const tEnd = msOf(target.getForScenario("end", 0,),);
      const ref = dep.onEnd ? tEnd : tStart;
      if (ref === null || s === null) continue;
      if (s < ref) {
        violations.push(
          `${id}: start (${isoDate(start,)}) < ` +
            `${target.fullId}.${dep.onEnd ? "end" : "start"} ` +
            `(${isoDate(dep.onEnd ? end : start,)})`,
        );
      }
    }
  }
  return violations;
}

/**
 * Modelo rico com containers, milestones, effortTasks e dependências —
 * exercita todos os 7 invariantes num único `schedule()`.
 */
export function richModel(): Project {
  const project = createTestProject(1,);
  const dev = new Resource(project, "dev", "Dev", null,);

  // Container “phase1” com duas effortTasks sequenciais.
  const phase1 = new Task(project, "phase1", "Phase 1", null,);
  const t1 = new Task(project, "t1", "T1", phase1,);
  const t2 = new Task(project, "t2", "T2", phase1,);
  t1.setForScenario("effort", 8, 0,);
  t1.setForScenario("allocate", [new Allocation([dev,],),], 0,);
  t2.setForScenario("effort", 8, 0,);
  t2.setForScenario("allocate", [new Allocation([dev,],),], 0,);
  // t2 depende de t1 (onEnd).
  const dep = new TaskDependency("phase1.t1", true,);
  t2.setForScenario("depends", [dep,], 0,);

  // Milestone automático: t3 sem effort/booking/allocate, com milestone:true.
  const t3 = new Task(project, "t3", "T3", null,);
  t3.setForScenario("milestone", true, 0,);
  t3.setForScenario("start", TjTime.fromString("2026-01-15",), 0,);

  return project;
}
