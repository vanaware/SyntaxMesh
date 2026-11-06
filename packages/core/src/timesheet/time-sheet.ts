/**
 * TimeSheet — a folha de ponto de um recurso para um período.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/TimeSheets.rb` — classe
 * `TimeSheet` (l.244-386).
 *
 * Cada folha pertence a um `Resource` existente e cobre um `TimeInterval`.
 * Os registros (um por tarefa) são criados pelo parser e entram na folha pelo
 * próprio construtor de `TimeSheetRecord`.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.3)
 */
import { Resource, } from "../model/resource.ts";
import type { TimeInterval, } from "../time/time-interval.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import type { TimeSheetRecord, } from "./time-sheet-record.ts";
import type { ProjectTiming, } from "./project-timing.ts";

export class TimeSheet {
  readonly resource: Resource;
  readonly interval: TimeInterval;
  readonly scenarioIdx: number;
  sourceFileInfo: SourceFileInfo | null = null;
  /** True se ao menos um registro foi reportado como percentual. */
  percentageUsed = false;
  /** Registros da folha (um por tarefa). */
  readonly records: TimeSheetRecord[] = [];

  constructor(
    resource: Resource,
    interval: TimeInterval,
    scenarioIdx: number,
  ) {
    // Ruby levanta `Illegal resource` / `Interval undefined` /
    // `Sceneario index undefined` (l.250-255).
    if (!(resource instanceof Resource)) {
      throw new Error("Illegal resource",);
    }
    if (!interval) {
      throw new Error("Interval undefined",);
    }
    if (scenarioIdx === null || scenarioIdx === undefined) {
      throw new Error("Sceneario index undefined",);
    }
    this.resource = resource;
    this.interval = interval;
    this.scenarioIdx = scenarioIdx;
  }

  /**
   * Ruby `TimeSheet#<<(record)` (l.266-274): rejeita registros duplicados
   * para a mesma tarefa.
   */
  appendRecord(record: TimeSheetRecord,): void {
    for (const r of this.records) {
      if (r.task === record.task) {
        this.error(
          "ts_duplicate_task",
          `Duplicate records for task ${r.taskId}`,
        );
      }
    }
    this.records.push(record,);
  }

  /**
   * Consistência da folha (Ruby `TimeSheet#check`, l.277-312).
   *
   * Além de checar cada registro, o total reportado precisa bater com os
   * slots realmente trabalháveis do período (`totalNetWorkingSlots`), com
   * tolerância de 1 slot para arredondamento.
   */
  check(): void {
    let totalSlots = 0;
    for (const record of this.records) {
      record.check();
      // Extensão 18.17.2: a quantidade reportada de um material não é tempo,
      // então fica fora do total que é comparado com os slots do período.
      if (record.material === null) totalSlots += record.work ?? 0;
    }

    const project = this.resource.project as unknown as ProjectTiming;
    const scenarioIdx = project.get("trackingScenarioIdx",) as
      | number
      | null
      | undefined;
    if (scenarioIdx === null || scenarioIdx === undefined) {
      this.error(
        "ts_no_tracking_scenario",
        "No trackingscenario has been defined.",
      );
    }

    const efficiency = Number(
      this.resource.getForScenario(
        "efficiency",
        scenarioIdx ?? this.scenarioIdx,
      ) ??
        0,
    );
    if (efficiency > 0.0) {
      const targetSlots = this.totalNetWorkingSlots();
      // Erro de arredondamento aceitável no total reportado.
      const delta = 1;
      if (totalSlots < targetSlots - delta) {
        this.error(
          "ts_work_too_low",
          "The total work to be reported for this time sheet is " +
            `${this.workWithUnit(targetSlots,)} but only ` +
            `${this.workWithUnit(totalSlots,)} were reported.`,
        );
      }
      if (totalSlots > targetSlots + delta) {
        this.error(
          "ts_work_too_high",
          "The total work to be reported for this time sheet is " +
            `${this.workWithUnit(targetSlots,)} but ` +
            `${this.workWithUnit(totalSlots,)} were reported.`,
        );
      }
    } else if (totalSlots > 0) {
      this.error(
        "ts_work_not_null",
        "The reported work for non-working resources must be 0.",
      );
    }
  }

  /** Registros cujo alvo é um material (extensão 18.17.1). */
  get materialRecords(): TimeSheetRecord[] {
    return this.records.filter((record,) => record.material !== null);
  }

  /** Delega o delta de cada registro (Ruby `TimeSheet#warnOnDelta`, l.314). */
  warnOnDelta(): void {
    const project = this.resource.project as unknown as ProjectTiming;
    const startIdx = project.dateToIdx(this.interval.start,);
    const endIdx = project.dateToIdx(this.interval.end,);

    for (const record of this.records) {
      record.warnOnDelta(startIdx, endIdx,);
    }
  }

  /**
   * Total de slots potencialmente trabalháveis no período — independe do
   * recurso (Ruby `TimeSheet#totalGrossWorkingSlots`, l.326-333).
   */
  totalGrossWorkingSlots(): number {
    const project = this.resource.project as unknown as ProjectTiming;
    // Número de semanas no período reportado.
    const weeksToReport = (this.interval.end.toSeconds() -
      this.interval.start.toSeconds()) / (60 * 60 * 24 * 7);
    return this.daysToSlots(
      Math.trunc(project.weeklyWorkingDays() * weeksToReport,),
    );
  }

  /**
   * Slots realmente trabalháveis do recurso no período: alocados + livres
   * (Ruby `TimeSheet#totalNetWorkingSlots`, l.337-343).
   */
  totalNetWorkingSlots(): number {
    const project = this.resource.project as unknown as ProjectTiming;
    const startIdx = project.dateToIdx(this.interval.start,);
    const endIdx = project.dateToIdx(this.interval.end,);
    const scenario = this.resource.scenarioData(this.scenarioIdx,);
    return scenario.getAllocatedSlots(startIdx, endIdx, null,) +
      scenario.getFreeSlots(startIdx, endIdx,);
  }

  /**
   * Converte percentual de alocação em slots (Ruby `TimeSheet#percentToSlots`,
   * l.346-349) e marca `percentageUsed` — o que muda a unidade das mensagens
   * de total.
   */
  percentToSlots(value: number,): number {
    this.percentageUsed = true;
    return Math.trunc(this.totalGrossWorkingSlots() * value,);
  }

  /** Fração (0.0-1.0) que `slots` representa do total bruto. */
  slotsToPercent(slots: number,): number {
    return slots / this.totalGrossWorkingSlots();
  }

  /** Converte slots em dias de trabalho. */
  slotsToDays(slots: number,): number {
    return this.resource.project.slotsToDays(slots,);
  }

  /** Converte dias de trabalho em slots. */
  daysToSlots(days: number,): number {
    const project = this.resource.project as unknown as ProjectTiming;
    const daily = project.dailyWorkingHours();
    const granularity = Number(project.get("scheduleGranularity",),);
    return Math.trunc((days * 60 * 60 * daily) / granularity,);
  }

  /** Erro associado ao recurso da folha (Ruby `TimeSheet#error`, l.367). */
  error(
    id: string,
    text: string,
    sourceFileInfo: SourceFileInfo | null = null,
  ): void {
    MessageHandlerInstance.instance.error(
      id,
      text,
      sourceFileInfo ?? this.sourceFileInfo,
      null,
      this.resource,
      null,
    );
  }

  /** Aviso associado ao recurso da folha (Ruby `TimeSheet#warning`, l.372). */
  warning(
    id: string,
    text: string,
    sourceFileInfo: SourceFileInfo | null = null,
  ): void {
    MessageHandlerInstance.instance.warning(
      id,
      text,
      sourceFileInfo,
      null,
      this.resource,
      null,
    );
  }

  /**
   * Formata um total em slots na unidade usada pela folha — `%` quando algum
   * registro foi percentual, dias caso contrário (Ruby `#workWithUnit`).
   */
  private workWithUnit(slots: number,): string {
    if (this.percentageUsed) {
      return `${Math.trunc(this.slotsToPercent(slots,) * 100.0,)}%`;
    }
    return `${this.slotsToDays(slots,)} days`;
  }
}
