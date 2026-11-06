/**
 * Fixture compartilhada dos testes de time sheet (Fase 18).
 *
 * Um projeto mínimo, mas **agendado de verdade** (scoreboard real), porque os
 * totais de slots e as comparações de delta dependem do plano: dois recursos
 * (um trabalhador e um com `efficiency 0`), uma tarefa de esforço e uma de
 * duração, com um cenário de tracking (`plan`).
 */
import { assert, } from "@std/assert";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Resource, } from "../../src/model/resource.ts";
import type { Task, } from "../../src/model/task.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { parseProject, } from "../parser/parse-helper.ts";

/** Projeto de teste: janeiro–dezembro de 2026, tracking `plan`. */
export const TS_PROJECT =
  `project prj "Time Sheet Test" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
  timeformat "%Y-%m-%d"
  now 2026-01-01
  workinghours mon - fri 9:00 - 17:00
  scenario plan "Plan" {
  }
  trackingscenario plan
}

resource dev "Developer"
resource idle "Idle Resource" {
  efficiency 0
}

task effortTask "Effort Task" {
  effort 10d
  allocate dev
}

task durationTask "Duration Task" {
  start 2026-02-02
  duration 3d
  allocate dev
}
`;

export interface TsFixture {
  project: Project;
  dev: Resource;
  idle: Resource;
  effortTask: Task;
  durationTask: Task;
}

/** Sobe o projeto da fixture (parse + schedule). */
export function buildFixture(): TsFixture {
  const out = parseProject(TS_PROJECT,);
  assert(out.threw === null, `parse lançou: ${out.threw?.message}`,);
  const project = out.result as Project;

  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  assert(project.schedule(), "schedule() devolveu false",);

  return {
    project,
    dev: project.resource("dev",) as Resource,
    idle: project.resource("idle",) as Resource,
    effortTask: project.task("effortTask",) as Task,
    durationTask: project.task("durationTask",) as Task,
  };
}

/** Intervalo de `days` dias a partir de `date` (segunda-feira). */
export function intervalOf(date: string, days = 28,): TimeInterval {
  return new TimeInterval(
    TjTime.fromString(date,),
    TjTime.fromString(date,).addSeconds(days * 24 * 60 * 60,),
  );
}

/** Devolve os IDs das mensagens emitidas por `fn` (limpa antes). */
export function messageIdsOf(fn: () => void,): string[] {
  MessageHandlerInstance.instance.messages.length = 0;
  MessageHandlerInstance.instance.errors = 0;
  fn();
  return MessageHandlerInstance.instance.messages.map((m,) => m.id);
}
