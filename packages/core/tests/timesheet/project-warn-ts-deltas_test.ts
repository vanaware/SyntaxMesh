/**
 * Integração `warnOnDelta` — 18.13.
 *
 * O Ruby (`TaskJuggler#schedule`, l.128-140 + `Project#schedule`) propaga o
 * `--warn-ts-deltas` da CLI para `Project#warnTsDeltas` e, no fim do
 * agendamento, compara cada folha de ponto com o plano
 * (`Project.rb`: `@timeSheets.warnOnDelta if @warnTsDeltas`).
 *
 * Aqui as duas metades são verificadas: a propagação pela fachada e o efeito
 * observável (warnings `ts_res_*`) no `MessageHandler`.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md §18.13
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Resource, } from "../../src/model/resource.ts";
import type { Task, } from "../../src/model/task.ts";
import { TaskJuggler, } from "../../src/taskjuggler.ts";
import { TimeSheet, } from "../../src/timesheet/time-sheet.ts";
import { TimeSheetRecord, } from "../../src/timesheet/time-sheet-record.ts";
import { parseProject, } from "../parser/parse-helper.ts";
import { intervalOf, TS_PROJECT, } from "./fixture.ts";

interface WarnSetup {
  project: Project;
  dev: Resource;
  effortTask: Task;
  tj: TaskJuggler;
}

/**
 * Projeto parseado (ainda **não** agendado) com uma folha de ponto que reporta
 * 8 slots para a tarefa de 10 dias — bem abaixo do plano, para disparar
 * `ts_res_work_delta`.
 */
function setup(warn: boolean,): WarnSetup {
  const out = parseProject(TS_PROJECT,);
  assert(out.threw === null, `parse lançou: ${out.threw?.message}`,);
  const project = out.result as Project;
  const dev = project.resource("dev",) as Resource;
  const effortTask = project.task("effortTask",) as Task;

  const ts = new TimeSheet(dev, intervalOf("2026-01-01", 28,), 0,);
  const record = new TimeSheetRecord(ts, effortTask,);
  record.work = 8;
  record.remaining = 40;
  project.timeSheets.push(ts,);

  const tj = new TaskJuggler();
  tj.project = project;
  tj.warnTsDeltas = warn;
  return { project, dev, effortTask, tj, };
}

/** Agenda com o handler zerado e devolve os ids emitidos. */
function scheduleIds(setup: WarnSetup,): string[] {
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  assertEquals(setup.tj.schedule(), true,);
  return MessageHandlerInstance.instance.messages.map((m,) => m.id);
}

describe("TaskJuggler.schedule propaga warnTsDeltas (18.13.1)", () => {
  it("copia true para o projeto", () => {
    const s = setup(true,);
    s.tj.schedule();
    assertEquals(s.project.warnTsDeltas, true,);
  });

  it("copia false para o projeto", () => {
    const s = setup(false,);
    s.tj.schedule();
    assertEquals(s.project.warnTsDeltas, false,);
  });
});

describe("Project.schedule chama timeSheets.warnOnDelta (18.13.2)", () => {
  it("com warnTsDeltas = true a folha é comparada com o plano", () => {
    const s = setup(true,);
    const ids = scheduleIds(s,);
    assert(
      ids.includes("ts_res_work_delta",),
      `esperava ts_res_work_delta, veio: ${ids.join(", ",)}`,
    );
  });

  it("com warnTsDeltas = false nenhum delta é reportado", () => {
    const s = setup(false,);
    const ids = scheduleIds(s,);
    assertEquals(
      ids.filter((id,) => id.startsWith("ts_res_",)),
      [],
    );
  });
});

describe("warnOnDelta — efeito das flags (18.13.3–18.13.4)", () => {
  it("true: a mensagem traz recurso, tarefa e o delta em dias", () => {
    const s = setup(true,);
    scheduleIds(s,);
    const message = MessageHandlerInstance.instance.messages.find((m,) =>
      m.id === "ts_res_work_delta"
    );
    assert(message !== undefined, "ts_res_work_delta ausente",);
    assert(message.message.includes("Developer",),);
    assert(message.message.includes("effortTask",),);
    assert(message.message.includes("instead of",),);
  });

  it("false: a folha continua no projeto, apenas não é comparada", () => {
    const s = setup(false,);
    scheduleIds(s,);
    assertEquals(s.project.timeSheets.length, 1,);
    assertEquals(s.project.warnTsDeltas, false,);
  });
});
