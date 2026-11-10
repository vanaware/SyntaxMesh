/**
 * TimeSheet — the timesheet of one resource for one period.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/TimeSheets.rb` — the `TimeSheet`
 * class (l.244-386).
 *
 * Each sheet belongs to an existing `Resource` and covers a `TimeInterval`. The
 * records (one per task) are created by the parser and join the sheet through
 * the `TimeSheetRecord` constructor itself.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.3)
 */
import { Resource, } from "../model/resource.ts";
import type { TimeInterval, } from "../time/time-interval.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import type { TimeSheetRecord, } from "./time-sheet-record.ts";
import type { ProjectTiming, } from "./project-timing.ts";

/**
 * Timesheet of a resource over one reporting period.
 */
export class TimeSheet {
  /** Resource the sheet is filed by. */
  readonly resource: Resource;
  /** Period covered by the sheet. */
  readonly interval: TimeInterval;
  /** Index of the scenario the sheet is reported against. */
  readonly scenarioIdx: number;
  /** Source location of the sheet in the project file, when known. */
  sourceFileInfo: SourceFileInfo | null = null;
  /** `true` when at least one record was reported as a percentage. */
  percentageUsed = false;
  /** Records of the sheet (one per task). */
  readonly records: TimeSheetRecord[] = [];

  /**
   * Creates a timesheet.
   *
   * @param resource Resource the sheet is filed by.
   * @param interval Period covered by the sheet.
   * @param scenarioIdx Index of the scenario the sheet is reported against.
   * @throws Error When the resource is invalid, the interval is missing or the
   * scenario index is undefined.
   */
  constructor(
    resource: Resource,
    interval: TimeInterval,
    scenarioIdx: number,
  ) {
    // Ruby raises `Illegal resource` / `Interval undefined` /
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
   * Ruby `TimeSheet#<<(record)` (l.266-274): rejects duplicate records for the
   * same task and then appends the record.
   *
   * @param record Record to append.
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
   * Sheet consistency check (Ruby `TimeSheet#check`, l.277-312).
   *
   * Besides checking every record, the reported total must match the working
   * slots actually available in the period (`totalNetWorkingSlots`), with a
   * tolerance of one slot for rounding.
   */
  check(): void {
    let totalSlots = 0;
    for (const record of this.records) {
      record.check();
      // Extension 18.17.2: the reported quantity of a material is not time, so
      // it stays out of the total compared with the period slots.
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
      // Acceptable rounding error in the reported total.
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

  /**
   * Records whose target is a material (extension 18.17.1).
   *
   * @returns The subset of `records` that target a material.
   */
  get materialRecords(): TimeSheetRecord[] {
    return this.records.filter((record,) => record.material !== null);
  }

  /**
   * Delegates the delta check of every record (Ruby `TimeSheet#warnOnDelta`,
   * l.314).
   */
  warnOnDelta(): void {
    const project = this.resource.project as unknown as ProjectTiming;
    const startIdx = project.dateToIdx(this.interval.start,);
    const endIdx = project.dateToIdx(this.interval.end,);

    for (const record of this.records) {
      record.warnOnDelta(startIdx, endIdx,);
    }
  }

  /**
   * Slots potentially workable in the period, regardless of the resource (Ruby
   * `TimeSheet#totalGrossWorkingSlots`, l.326-333).
   *
   * @returns The gross number of working slots.
   */
  totalGrossWorkingSlots(): number {
    const project = this.resource.project as unknown as ProjectTiming;
    // Number of weeks in the reported period.
    const weeksToReport = (this.interval.end.toSeconds() -
      this.interval.start.toSeconds()) / (60 * 60 * 24 * 7);
    return this.daysToSlots(
      Math.trunc(project.weeklyWorkingDays() * weeksToReport,),
    );
  }

  /**
   * Slots actually workable by the resource in the period: allocated + free
   * (Ruby `TimeSheet#totalNetWorkingSlots`, l.337-343).
   *
   * @returns The net number of working slots.
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
   * Converts an allocation percentage into slots (Ruby
   * `TimeSheet#percentToSlots`, l.346-349) and sets `percentageUsed`, which
   * changes the unit of the total messages.
   *
   * @param value Percentage to convert.
   * @returns The equivalent number of slots.
   */
  percentToSlots(value: number,): number {
    this.percentageUsed = true;
    return Math.trunc(this.totalGrossWorkingSlots() * value,);
  }

  /**
   * Fraction (0.0-1.0) that `slots` represents of the gross total.
   *
   * @param slots Number of slots.
   * @returns The fraction of the gross total.
   */
  slotsToPercent(slots: number,): number {
    return slots / this.totalGrossWorkingSlots();
  }

  /**
   * Converts slots into working days.
   *
   * @param slots Number of slots.
   * @returns The equivalent number of working days.
   */
  slotsToDays(slots: number,): number {
    return this.resource.project.slotsToDays(slots,);
  }

  /**
   * Converts working days into slots.
   *
   * @param days Number of working days.
   * @returns The equivalent number of slots.
   */
  daysToSlots(days: number,): number {
    const project = this.resource.project as unknown as ProjectTiming;
    const daily = project.dailyWorkingHours();
    const granularity = Number(project.get("scheduleGranularity",),);
    return Math.trunc((days * 60 * 60 * daily) / granularity,);
  }

  /**
   * Reports an error attached to the resource of the sheet (Ruby
   * `TimeSheet#error`, l.367).
   *
   * @param id Message identifier.
   * @param text Message text.
   * @param sourceFileInfo Source location, defaulting to the sheet's own.
   */
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

  /**
   * Reports a warning attached to the resource of the sheet (Ruby
   * `TimeSheet#warning`, l.372).
   *
   * @param id Message identifier.
   * @param text Message text.
   * @param sourceFileInfo Source location of the warning.
   */
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
   * Formats a total in slots using the unit of the sheet — `%` when some record
   * was a percentage, days otherwise (Ruby `#workWithUnit`).
   *
   * @param slots Number of slots to format.
   * @returns The formatted total.
   */
  private workWithUnit(slots: number,): string {
    if (this.percentageUsed) {
      return `${Math.trunc(this.slotsToPercent(slots,) * 100.0,)}%`;
    }
    return `${this.slotsToDays(slots,)} days`;
  }
}
