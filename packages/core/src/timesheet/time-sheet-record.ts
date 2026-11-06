/**
 * TimeSheetRecord — o que um recurso reportou para uma tarefa num período.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/TimeSheets.rb` — classe
 * `TimeSheetRecord` (l.22-239).
 *
 * Um registro pode apontar para uma `Task` existente ou, no caso de
 * `newtask`, para o ID (`string`) de uma tarefa que ainda não existe. O
 * trabalho é sempre medido em **slots**; `remaining` também. O `expectedEnd`
 * só é usado por tarefas de duração (não-esforço).
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.2)
 */
import { Task, } from "../model/task.ts";
import { Material, } from "../model/material.ts";
import { MaterialBooking, } from "../model/material-booking.ts";
import type { TaskScenario, } from "../model/task-scenario.ts";
import type { JournalEntry, } from "../model/journal.ts";
import type { TjTime, } from "../time/tj-time.ts";
import { Percent, } from "../time/percent.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import type { TimeSheet, } from "./time-sheet.ts";
import type { ProjectTiming, } from "./project-timing.ts";

export class TimeSheetRecord {
  readonly timeSheet: TimeSheet;
  /**
   * Alvo do registro: `Task` existente, `Material` (extensão 18.17.1) ou o ID
   * (`string`) de uma tarefa nova (`newtask`).
   */
  readonly task: Task | Material | string | null;
  /**
   * Tarefa dona de um registro de material — a que envolve o bloco
   * `material <id> { … }` no sheet (18.17.9). `null` fora desse contexto.
   */
  ownerTask: Task | null = null;
  name: string | null = null;
  sourceFileInfo: SourceFileInfo | null = null;
  /** Fim esperado da tarefa (só para tarefas de duração). */
  expectedEnd: TjTime | null = null;
  /**
   * Preço unitário informado para o material no sheet (extensão 18.17.9).
   * `null` ⇒ o booking cai para a alocação/material (precedência da 14C.11.6).
   */
  unitPrice: number | null = null;
  /** Prioridade da tarefa nova (`ts_bad_priority` valida 1..1000). */
  priority = 0;
  /** Esforço restante em slots (tarefas de esforço) ou quantidade (material). */
  remaining: number | null = null;
  /** Entrada de journal que carrega o status reportado. */
  status: JournalEntry | null = null;
  /**
   * Trabalho reportado: slots para tarefas (Ruby `attr_reader :work`) ou a
   * quantidade consumida quando o alvo é um `Material`.
   */
  private workValue: number | null = null;

  constructor(
    timeSheet: TimeSheet,
    task: Task | Material | string | null,
  ) {
    this.timeSheet = timeSheet;
    this.task = task;
    // Ruby: `(@timeSheet = timeSheet) << self` (l.35) — o registro entra na
    // folha já no construtor, com checagem de duplicata.
    timeSheet.appendRecord(this,);
  }

  /** Trabalho reportado, em slots (tarefa) ou unidades (material). */
  get work(): number | null {
    return this.workValue;
  }

  /**
   * Ruby `TimeSheetRecord#work=` (l.53-60): um inteiro é atribuído direto
   * (slots); um percentual (`Percent`, o antigo `Float` do Ruby) é convertido
   * por `TimeSheet#percentToSlots`.
   *
   * Extensão 18.17.1: para `Material` o valor é a **quantidade** consumida —
   * não é percentual nem slot, então é atribuído cru.
   */
  set work(value: number | Percent | null,) {
    if (value === null) {
      this.workValue = null;
      return;
    }
    if (this.material !== null) {
      this.workValue = Number(value,);
      return;
    }
    if (value instanceof Percent || !Number.isInteger(value,)) {
      this.workValue = this.timeSheet.percentToSlots(Number(value,),);
    } else {
      this.workValue = value;
    }
  }

  /** Alvo é um `Material` (extensão 18.17.1)? */
  get material(): Material | null {
    return this.task instanceof Material ? this.task : null;
  }

  /** Ruby `TimeSheetRecord#taskId` (l.190-192). */
  get taskId(): string {
    if (this.task instanceof Task || this.task instanceof Material) {
      return this.task.fullId;
    }
    return this.task ?? "";
  }

  /** Tarefa nova (ainda não existe no projeto)? */
  get isNewTask(): boolean {
    return typeof this.task === "string";
  }

  /**
   * Consistência do registro (Ruby `TimeSheetRecord#check`, l.63-129).
   *
   * As mensagens vão para o `MessageHandlerInstance` com o `sourceFileInfo`
   * do registro — o módulo `MessageHandler` do Ruby usa `nil` por padrão,
   * mas o registro sempre tem a linha de origem do arquivo `.tji`.
   */
  check(): void {
    const scIdx = this.timeSheet.scenarioIdx;
    const taskId = this.taskId;

    // Um registro sem 'work' não informa quanto foi feito (Ruby l.84-93).
    if (this.work === null) {
      this.error(
        "ts_no_work",
        `The time sheet record for task ${taskId} must have a 'work' ` +
          "attribute to specify how much was done for this task during the " +
          "reported period.",
      );
    }

    if (this.task instanceof Task) {
      // Tarefa já conhecida: esforço pede 'remaining'; duração pede 'end'.
      if (this.effort(scIdx,) > 0) {
        if (this.remaining === null) {
          this.error(
            "ts_no_remaining",
            `The time sheet record for task ${taskId} must have a ` +
              "'remaining' attribute to specify how much effort is left for " +
              "this task.",
          );
        }
      } else if (this.expectedEnd === null) {
        this.error(
          "ts_no_expected_end",
          `The time sheet record for task ${taskId} must have an 'end' ` +
            "attribute to specify the expected end of this task.",
        );
      }
    } else if (this.material !== null) {
      // Extensão 18.17.1: material não tem esforço planejado nem data de fim,
      // então 'remaining'/'end' são opcionais; o preço também (18.17.9).
      // A validação individual do material é só a de 'work' (acima) e a do
      // 'status', quando houver.
    } else if (this.remaining === null && this.expectedEnd === null) {
      this.error(
        "ts_no_rem_or_end",
        `New task ${taskId} requires either a 'remaining' or a 'end' ` +
          "attribute.",
      );
    }

    // Extensão 18.17.1: a comparação é com um dia de **slots**, unidade que
    // não existe para material (a quantidade é em unidades do insumo).
    if (
      this.material === null && this.work !== null &&
      this.work >= this.timeSheet.daysToSlots(1,) &&
      this.status === null
    ) {
      this.error(
        "ts_no_status_work",
        `You must specify a status for task ${taskId}. It was worked on for ` +
          "a day or more.",
      );
    }

    const status = this.status;
    if (status === null) return;

    if (status.headline === "") {
      this.error(
        "ts_no_headline",
        `You must provide a headline for the status of task ${taskId}`,
      );
    }
    if (status.summary === "A summary text\n") {
      this.error(
        "ts_default_summary",
        "You must change the default summary text of the status for task " +
          `${taskId}.`,
      );
    }
    if (
      status.alertLevel > 0 && status.summary === null &&
      status.details === null
    ) {
      this.error(
        "ts_alert1_more_details",
        `Task ${taskId} has an elevated alert level and must have a summary ` +
          "or details section.",
      );
    }
    if (status.alertLevel > 1 && status.details === null) {
      this.error(
        "ts_alert2_more_details",
        `Task ${taskId} has a high alert level and must have a details ` +
          "section.",
      );
    }
  }

  /**
   * Compara o reportado com o plano e emite warnings de delta
   * (Ruby `TimeSheetRecord#warnOnDelta`, l.131-188).
   */
  warnOnDelta(startIdx: number, endIdx: number,): void {
    // Ruby: `return unless @task` — ignora entradas pessoais.
    if (this.task === null) return;
    // Extensão 18.17.1: material não tem plano de esforço por recurso, logo
    // não há delta a comparar (o realizado vira booking, 18.17.9).
    if (this.material !== null) return;

    const resource = this.timeSheet.resource;

    if (typeof this.task === "string") {
      // O recurso está pedindo a criação de uma tarefa nova.
      // Ruby imprime `@end` (typo, ivar inexistente → string vazia); aqui
      // usamos o `expectedEnd` de fato, que é o valor pretendido.
      const status = this.remaining !== null
        ? `Remaining: ${this.timeSheet.slotsToDays(this.remaining,)}d`
        : `End: ${this.expectedEnd?.toString() ?? ""}`;
      this.warning(
        "ts_res_new_task",
        `${resource.name} is requesting a new task:\n` +
          `  ID: ${this.task}\n` +
          `  Name: ${this.name}\n` +
          `  Work: ${this.timeSheet.slotsToDays(this.work ?? 0,)}d  ${status}`,
      );
      return;
    }

    const task = this.task;
    const scenarioIdx = this.timeSheet.scenarioIdx;
    const project = resource.project as unknown as ProjectTiming;
    const plannedWork = (task.scenarioData(scenarioIdx,) as TaskScenario)
      .effWorkInPeriod(startIdx, endIdx, resource,);
    // Converte os slots reportados em carga diária.
    const granularity = Number(project.get("scheduleGranularity",),);
    const work = project.convertToDailyLoad((this.work ?? 0) * granularity,);

    if (work !== plannedWork) {
      this.warning(
        "ts_res_work_delta",
        `${resource.name} worked ${work < plannedWork ? "less" : "more"} on ` +
          `${task.fullId}\n${work}d instead of ${plannedWork}d`,
      );
    }

    if (this.effort(scenarioIdx,) > 0) {
      const remainingEndIdx = project.dateToIdx(
        task.getForScenario("end", scenarioIdx,) as TjTime,
      );
      const remainingWork = (task.scenarioData(scenarioIdx,) as TaskScenario)
        .effWorkInPeriod(
          endIdx,
          remainingEndIdx,
          resource,
        );
      const remaining = project.convertToDailyLoad(
        (this.remaining ?? 0) * granularity,
      );
      if (remaining !== remainingWork) {
        this.warning(
          "ts_res_remain_delta",
          `${resource.name} requests ${
            remaining < remainingWork ? "less" : "more"
          } remaining effort for task ${task.fullId}\n` +
            `${remaining}d instead of ${remainingWork}d`,
        );
      }
    } else {
      const plannedEnd = task.getForScenario("end", scenarioIdx,) as
        | TjTime
        | null;
      if (!sameTime(this.expectedEnd, plannedEnd,)) {
        const direction = this.expectedEnd !== null && plannedEnd !== null &&
            this.expectedEnd.compareTo(plannedEnd,) < 0
          ? "earlier"
          : "later";
        this.warning(
          "ts_res_end_delta",
          `${resource.name} requests ${direction} end (${this.expectedEnd}) ` +
            `for task ${task.fullId}. Planned end is ${plannedEnd}.`,
        );
      }
    }
  }

  /**
   * Aplica o progresso reportado ao cenário do material (extensão 18.17.1):
   * `work` → `effortdone`, `remaining` → `effortleft`.
   *
   * Registros de tarefa são ignorados: a folha só valida o que foi reportado
   * (`check`), o planejado vem do agendamento.
   */
  applyToScenario(scenarioIdx = this.timeSheet.scenarioIdx,): void {
    const material = this.material;
    if (material === null) return;
    if (this.work !== null) {
      material.setForScenario("effortdone", this.work, scenarioIdx,);
    }
    if (this.remaining !== null) {
      material.setForScenario("effortleft", this.remaining, scenarioIdx,);
    }
  }

  /**
   * Converte o registro de material no **consumo realizado** do cenário
   * (extensão 18.17.9): um `MaterialBooking` com a quantidade reportada,
   * datado no fim do período da folha e preso à tarefa dona — ou ao estoque do
   * material, quando o bloco não estava dentro de uma tarefa.
   *
   * O `unitprice` do sheet só entra quando informado; sem ele o custo segue a
   * precedência booking → alocação → material (`MaterialBooking#unitPriceFor`).
   *
   * @returns o booking criado, ou `null` se o alvo não é um material.
   */
  applyMaterialBooking(
    scenarioIdx = this.timeSheet.scenarioIdx,
  ): MaterialBooking | null {
    const material = this.material;
    if (material === null) return null;

    const task = this.ownerTask;
    const booking = new MaterialBooking(
      material,
      task === null ? null : task.fullId,
      this.work ?? 0,
      this.timeSheet.interval.end,
      this.unitPrice ?? undefined,
      task,
    );

    if (task === null) {
      // Sem tarefa dona o booking é movimento de estoque (14C.13.1).
      const current = (material.getForScenario("stockbookings", scenarioIdx,) ??
        []) as MaterialBooking[];
      material.setForScenario(
        "stockbookings",
        current.concat([booking,],),
        scenarioIdx,
      );
    } else {
      const current = (task.getForScenario("materialbookings", scenarioIdx,) ??
        []) as MaterialBooking[];
      task.setForScenario(
        "materialbookings",
        current.concat([booking,],),
        scenarioIdx,
      );
    }
    return booking;
  }

  /** Trabalho reportado em % (0.0-100.0) da jornada média. */
  actualWorkPercent(): number {
    return ((this.work ?? 0) / this.timeSheet.totalGrossWorkingSlots()) * 100.0;
  }

  /** Trabalho planejado em % (0.0-100.0) da jornada média. */
  planWorkPercent(): number {
    const resource = this.timeSheet.resource;
    const project = resource.project as unknown as ProjectTiming;
    const scenarioIdx = this.timeSheet.scenarioIdx;
    const startIdx = project.dateToIdx(this.timeSheet.interval.start,);
    const endIdx = project.dateToIdx(this.timeSheet.interval.end,);
    const allocated = resource.scenarioData(scenarioIdx,).getAllocatedSlots(
      startIdx,
      endIdx,
      this.task instanceof Task ? this.task : null,
    );
    return (allocated / this.timeSheet.totalGrossWorkingSlots()) * 100.0;
  }

  /** Esforço restante reportado, em dias. */
  actualRemaining(): number {
    const project = this.timeSheet.resource.project as unknown as ProjectTiming;
    const granularity = Number(project.get("scheduleGranularity",),);
    return project.convertToDailyLoad((this.remaining ?? 0) * granularity,);
  }

  /** Esforço restante segundo o plano, em dias. */
  planRemaining(): number {
    if (!(this.task instanceof Task)) return 0;
    const resource = this.timeSheet.resource;
    const project = resource.project as unknown as ProjectTiming;
    const scenarioIdx = this.timeSheet.scenarioIdx;
    const startIdx = project.dateToIdx(project.get("now",) as TjTime,);
    const endIdx = project.dateToIdx(
      this.task.getForScenario("end", scenarioIdx,) as TjTime,
    );
    return (this.task.scenarioData(scenarioIdx,) as TaskScenario)
      .effWorkInPeriod(startIdx, endIdx, resource,);
  }

  /** Fim esperado reportado. */
  actualEnd(): TjTime | null {
    return this.expectedEnd;
  }

  /** Fim planejado da tarefa. */
  planEnd(): TjTime | null {
    if (!(this.task instanceof Task)) return null;
    return this.task.getForScenario("end", this.timeSheet.scenarioIdx,) as
      | TjTime
      | null;
  }

  /** `effort` do cenário (0 para tarefas de duração/marco). */
  private effort(scIdx: number,): number {
    if (!(this.task instanceof Task)) return 0;
    return Number(this.task.getForScenario("effort", scIdx,) ?? 0,);
  }

  private error(id: string, text: string,): void {
    MessageHandlerInstance.instance.error(
      id,
      text,
      this.sourceFileInfo,
      null,
      this,
      null,
    );
  }

  private warning(id: string, text: string,): void {
    MessageHandlerInstance.instance.warning(
      id,
      text,
      this.sourceFileInfo,
      null,
      this,
      null,
    );
  }
}

/** Igualdade de datas tolerante a `null` (o Ruby usa `!=` de objetos). */
function sameTime(a: TjTime | null, b: TjTime | null,): boolean {
  if (a === null || b === null) return a === b;
  return a.compareTo(b,) === 0;
}
