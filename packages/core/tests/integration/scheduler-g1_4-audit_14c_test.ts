/**
 * 14C.12 — Auditoria G1.4 do scheduler (adendo §10 do plano).
 *
 * O adendo §10 apontava o G1.4 (placement de datas em modelo construído à
 * mão) como o gap real do núcleo. A Fase 7 fechou o gap com quatro correções
 * de port, registradas em `fase-7-scheduler-core-tarefas.md` (adendo
 * 2026-10-27) e aqui verificadas ponta-a-ponta:
 *
 *  1. `PropertyList` populado a partir do `PropertySet` (`items = arg.to_ary`)
 *     — sem isso o loop de scheduling nunca via tarefa alguma;
 *  2. `doneEffort()` lendo o contador interno `_doneEffort` (e não o atributo
 *     de usuário `effortdone`) — sem isso o effort nunca encerrava;
 *  3. `Xref()` respeitando `onEnd` e `checkDependency` atribuindo
 *     `dependency.task` (equivalente a `TaskDependency#resolve`) — sem isso a
 *     cadeia de dependências não propagava o start;
 *  4. `propagateDate` gravando `start`/`end` no bag e propagando a
 *     dependentes/filhos/containers (era stub de `@startIdx`/`@endIdx`).
 *
 * Este arquivo não reimplementa o scheduler: ele fixa o comportamento atual
 * como âncora (14C.12.2) e cobre o bug remanescente encontrado na varredura
 * (14C.12.3) — a comparação de datas em `propagateDateToDep()` estourava
 * `TypeError` quando a própria tarefa não tinha a data do lado comparado.
 *
 * @see docs/syntaxmesh/fases/fase-7-scheduler-core-tarefas.md (adendo 2026-10-27)
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.12)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { TaskScenario, } from "../../src/model/task-scenario.ts";
import { Allocation, } from "../../src/scheduling/allocation.ts";
import { TaskDependency, } from "../../src/scheduling/task-dependency.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Project, } from "../../src/model/project.ts";

const D = (s: string,): TjTime => TjTime.fromString(s,);

/** Modelo agendável mínimo: 1 recurso full-time (24h/dia) e 1 tarefa de 16h. */
function schedulableModel(): { project: Project; task: Task } {
  const project = createTestProject(1,);
  const resource = new Resource(project, "r1", "R1", null,);
  const task = new Task(project, "t1", "T1", null,);
  task.setForScenario("effort", 16, 0,);
  task.setForScenario("allocate", [new Allocation([resource,],),], 0,);
  task.setForScenario("start", D("2026-01-01",), 0,);
  return { project, task, };
}

describe("14C.12 — auditoria G1.4 do scheduler", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.messages.length = 0;
    MessageHandlerInstance.instance.errors = 0;
  },);

  it("probe: modelo à mão recebe start/end e bookings (âncora do G1.4)", () => {
    const { project, task, } = schedulableModel();
    assertEquals(project.schedule(), true,);
    const start = task.getForScenario("start", 0,) as TjTime | null;
    const end = task.getForScenario("end", 0,) as TjTime | null;
    assert(start !== null, "start colocado",);
    assert(end !== null, "end colocado — o gap do G1.4 segue fechado",);
    // O esforço planejado foi integralmente consumido pelo loop de slots.
    const done = (task.scenarioData(0,) as TaskScenario).doneEffort();
    assertEquals(done, 16,);
  });

  it("propagateDateToDep() sem data própria não lança (14C.12.3)", () => {
    const project = createTestProject(1,);
    // `dep` está agendado; `pre` (que carrega o `depends`) nunca foi agendado
    // e portanto não tem `end` — a comparação usaria `null.toSeconds()`.
    const dependent = new Task(project, "dep", "Dep", null,);
    dependent.setForScenario("start", D("2026-01-02",), 0,);
    (dependent.scenarioData(0,) as TaskScenario).markAsScheduled();

    const pre = new Task(project, "pre", "Pre", null,);
    const dependency = new TaskDependency("dep", true,);
    dependency.task = dependent;
    pre.setForScenario("depends", [dependency,], 0,);

    let called = false;
    (dependent.scenarioData(0,) as TaskScenario).finishScheduling = () => {
      called = true;
    };
    (pre.scenarioData(0,) as TaskScenario).propagateDateToDep();
    assertEquals(called, false, "sem `end` próprio nada é propagado",);
  });

  it("propagateDateToDep() reprograma o dependente quando a data muda (14C.12.3)", () => {
    const project = createTestProject(1,);
    const dependent = new Task(project, "dep", "Dep", null,);
    dependent.setForScenario("start", D("2025-12-01",), 0,);
    (dependent.scenarioData(0,) as TaskScenario).markAsScheduled();

    const pre = new Task(project, "pre", "Pre", null,);
    pre.setForScenario("end", D("2026-01-05",), 0,);
    const dependency = new TaskDependency("dep", true,);
    dependency.task = dependent;
    pre.setForScenario("depends", [dependency,], 0,);

    let called = false;
    (dependent.scenarioData(0,) as TaskScenario).finishScheduling = () => {
      called = true;
    };
    // `dep.start` (01/12) < `pre.end` (05/01): a data mudou, então o
    // dependente precisa ser reprogramado.
    (pre.scenarioData(0,) as TaskScenario).propagateDateToDep();
    assertEquals(called, true,);
  });
});
