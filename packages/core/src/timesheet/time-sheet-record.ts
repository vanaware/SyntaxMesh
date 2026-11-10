/**
 * TimeSheetRecord — what a resource reported for a task in one period.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/TimeSheets.rb` — the
 * `TimeSheetRecord` class (l.22-239).
 *
 * A record may point to an existing `Task` or, for `newtask`, to the id
 * (`string`) of a task that does not exist yet. Work is always measured in
 * **slots**, and so is `remaining`. `expectedEnd` is only used by duration
 * tasks (not effort tasks).
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

/**
 * One reported line of a timesheet.
 */
export class TimeSheetRecord {
  /** Sheet the record belongs to. */
  readonly timeSheet: TimeSheet;
  /**
   * Target of the record: an existing `Task`, a `Material` (extension 18.17.1)
   * or the id (`string`) of a new task (`newtask`).
   */
  readonly task: Task | Material | string | null;
  /**
   * Task that owns a material record — the one wrapping the
   * `material <id> { … }` block in the sheet (18.17.9). `null` outside that
   * context.
   */
  ownerTask: Task | null = null;
  /** Name of the new task, used when `task` is a string. */
  name: string | null = null;
  /** Source location of the record in the project file, when known. */
  sourceFileInfo: SourceFileInfo | null = null;
  /** Expected end of the task (only for duration tasks). */
  expectedEnd: TjTime | null = null;
  /**
   * Unit price reported for the material in the sheet (extension 18.17.9).
   * `null` ⇒ the booking falls back to the allocation/material price (14C.11.6
   * precedence).
   */
  unitPrice: number | null = null;
  /** Priority of the new task (`ts_bad_priority` validates 1..1000). */
  priority = 0;
  /** Remaining effort in slots (effort tasks) or quantity (material). */
  remaining: number | null = null;
  /** Journal entry carrying the reported status. */
  status: JournalEntry | null = null;
  /**
   * Reported work: slots for tasks (Ruby `attr_reader :work`) or the consumed
   * quantity when the target is a `Material`.
   */
  private workValue: number | null = null;

  /**
   * Creates a record and appends it to the sheet.
   *
   * @param timeSheet Sheet the record belongs to.
   * @param task Target task, material or id of a new task.
   */
  constructor(
    timeSheet: TimeSheet,
    task: Task | Material | string | null,
  ) {
    this.timeSheet = timeSheet;
    this.task = task;
    // Ruby: `(@timeSheet = timeSheet) << self` (l.35) — the record joins the
    // sheet in the constructor, with a duplicate check.
    timeSheet.appendRecord(this,);
  }

  /**
   * Reported work, in slots (task) or units (material).
   *
   * @returns The reported amount, or `null` when nothing was reported.
   */
  get work(): number | null {
    return this.workValue;
  }

  /**
   * Ruby `TimeSheetRecord#work=` (l.53-60): an integer is assigned directly
   * (slots); a percentage (`Percent`, Ruby's former `Float`) is converted by
   * `TimeSheet#percentToSlots`.
   *
   * Extension 18.17.1: for a `Material` the value is the **quantity** consumed —
   * neither a percentage nor slots — so it is assigned as is.
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

  /**
   * Tells whether the target is a `Material` (extension 18.17.1).
   *
   * @returns The material, or `null` when the target is a task or a new task id.
   */
  get material(): Material | null {
    return this.task instanceof Material ? this.task : null;
  }

  /**
   * Ruby `TimeSheetRecord#taskId` (l.190-192).
   *
   * @returns The full id of the target, or the raw string of a new task.
   */
  get taskId(): string {
    if (this.task instanceof Task || this.task instanceof Material) {
      return this.task.fullId;
    }
    return this.task ?? "";
  }

  /**
   * Tells whether the record targets a new task.
   *
   * @returns `true` when the task does not exist in the project yet.
   */
  get isNewTask(): boolean {
    return typeof this.task === "string";
  }

  /**
   * Record consistency check (Ruby `TimeSheetRecord#check`, l.63-129).
   *
   * Messages go to `MessageHandlerInstance` with the record's
   * `sourceFileInfo` — the Ruby `MessageHandler` module defaults to `nil`, but a
   * record always has the source line of the `.tji` file.
   */
  check(): void {
    const scIdx = this.timeSheet.scenarioIdx;
    const taskId = this.taskId;

    // A record without 'work' does not say how much was done (Ruby l.84-93).
    if (this.work === null) {
      this.error(
        "ts_no_work",
        `The time sheet record for task ${taskId} must have a 'work' ` +
          "attribute to specify how much was done for this task during the " +
          "reported period.",
      );
    }

    if (this.task instanceof Task) {
      // Known task: effort needs 'remaining'; duration needs 'end'.
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
      // Extension 18.17.1: a material has no planned effort and no end date,
      // so 'remaining'/'end' are optional; the price is too (18.17.9).
      // The only per-material validation is 'work' (above) and 'status', when
      // present.
    } else if (this.remaining === null && this.expectedEnd === null) {
      this.error(
        "ts_no_rem_or_end",
        `New task ${taskId} requires either a 'remaining' or a 'end' ` +
          "attribute.",
      );
    }

    // Extension 18.17.1: the comparison is against a day of **slots**, a unit
    // that does not exist for material (quantity is in units of the input).
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
   * Compares the reported values with the plan and emits delta warnings (Ruby
   * `TimeSheetRecord#warnOnDelta`, l.131-188).
   *
   * @param startIdx First slot of the reported period.
   * @param endIdx Last slot of the reported period.
   */
  warnOnDelta(startIdx: number, endIdx: number,): void {
    // Ruby: `return unless @task` — personal entries are ignored.
    if (this.task === null) return;
    // Extension 18.17.1: a material has no per-resource effort plan, so there
    // is no delta to compare (the actuals become a booking, 18.17.9).
    if (this.material !== null) return;

    const resource = this.timeSheet.resource;

    if (typeof this.task === "string") {
      // The resource is asking for a new task to be created.
      // Ruby prints `@end` (a typo, non-existent ivar → empty string); here the
      // real `expectedEnd` is used, which is the intended value.
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
    // Convert the reported slots into a daily load.
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
   * Applies the reported progress to the material scenario (extension 18.17.1):
   * `work` → `effortdone`, `remaining` → `effortleft`.
   *
   * Task records are ignored: the sheet only validates what was reported
   * (`check`); the plan comes from the scheduler.
   *
   * @param scenarioIdx Scenario to write to (defaults to the sheet's).
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
   * Turns the material record into the **actual consumption** of the scenario
   * (extension 18.17.9): a `MaterialBooking` with the reported quantity dated
   * at the end of the sheet period and attached to the owner task — or to the
   * material stock, when the block was not inside a task.
   *
   * The sheet's `unitprice` is only used when provided; without it the cost
   * follows the booking → allocation → material precedence
   * (`MaterialBooking#unitPriceFor`).
   *
   * @param scenarioIdx Scenario to write to (defaults to the sheet's).
   * @returns The created booking, or `null` when the target is not a material.
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
      // Without an owner task the booking is a stock movement (14C.13.1).
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

  /**
   * Reported work as a percentage (0.0-100.0) of the average working day.
   *
   * @returns The reported work in percent.
   */
  actualWorkPercent(): number {
    return ((this.work ?? 0) / this.timeSheet.totalGrossWorkingSlots()) * 100.0;
  }

  /**
   * Planned work as a percentage (0.0-100.0) of the average working day.
   *
   * @returns The planned work in percent.
   */
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

  /**
   * Reported remaining effort, in days.
   *
   * @returns The remaining effort converted to days.
   */
  actualRemaining(): number {
    const project = this.timeSheet.resource.project as unknown as ProjectTiming;
    const granularity = Number(project.get("scheduleGranularity",),);
    return project.convertToDailyLoad((this.remaining ?? 0) * granularity,);
  }

  /**
   * Planned remaining effort, in days.
   *
   * @returns The effort planned from `now` to the end of the task.
   */
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

  /**
   * Reported expected end.
   *
   * @returns The end date reported in the sheet.
   */
  actualEnd(): TjTime | null {
    return this.expectedEnd;
  }

  /**
   * Planned end of the task.
   *
   * @returns The scheduled end, or `null` when the target is not a task.
   */
  planEnd(): TjTime | null {
    if (!(this.task instanceof Task)) return null;
    return this.task.getForScenario("end", this.timeSheet.scenarioIdx,) as
      | TjTime
      | null;
  }

  /**
   * Reads the `effort` attribute of the scenario.
   *
   * @param scIdx Scenario index.
   * @returns The planned effort, or 0 for duration tasks and milestones.
   */
  private effort(scIdx: number,): number {
    if (!(this.task instanceof Task)) return 0;
    return Number(this.task.getForScenario("effort", scIdx,) ?? 0,);
  }

  /**
   * Reports an error attached to this record.
   *
   * @param id Message identifier.
   * @param text Message text.
   */
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

  /**
   * Reports a warning attached to this record.
   *
   * @param id Message identifier.
   * @param text Message text.
   */
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

/**
 * Date equality tolerant to `null` (the Ruby version compares objects with
 * `!=`).
 *
 * @param a Left date.
 * @param b Right date.
 * @returns `true` when both are `null` or both hold the same instant.
 */
function sameTime(a: TjTime | null, b: TjTime | null,): boolean {
  if (a === null || b === null) return a === b;
  return a.compareTo(b,) === 0;
}
