/**
 * TimeSheetReport — generator of time sheet templates in TJP syntax.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/reports/TimeSheetReport.rb`.
 *
 * The report produces no table: it emits one `.tji` **form** per resource, with
 * the planned work of the period pre-filled and comments explaining how to fill
 * it in. `SheetSender` (18.6) uses it to generate the templates and
 * `SheetReceiver` (18.7) walks the other way.
 *
 * ⚠️ Browser (ADR 027): nothing is written to disk; the text leaves through
 * `to_tjp()` and the caller decides where to keep it (`FileStore`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/reports/TimeSheetReport.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.6)
 */

import type { Report, } from "../model/report.ts";
import type { Resource, } from "../model/resource.ts";
import type { Task, } from "../model/task.ts";
import type { MaterialAllocation, } from "../model/material-allocation.ts";
import { PropertyList, } from "../model/property-list.ts";
import { registerContentFactory, } from "../model/report-content.ts";
import { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "../logic/logical-expression.ts";
import { ReportBase, } from "./report-base.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import type { TjTime, } from "../time/tj-time.ts";

/** Aggregate per resource in the intermediate format (Ruby `TSResourceRecord`). */
export interface TSResourceRecord {
  /** Resource this aggregate belongs to. */
  resource: Resource;
  /** Total off-hours of the period, already formatted (Ruby `query.to_s`). */
  vacationHours: string;
  /** Off percentage over the working days of the period. */
  vacationPercent: number;
  /** Tasks the resource is allocated to in the period. */
  tasks: TSTaskRecord[];
}

/** One task allocated to the resource in the period (Ruby `TSTaskRecord`). */
export interface TSTaskRecord {
  /** Task the record was collected for. */
  task: Task;
  /** Working days booked on the task in the period. */
  workDays: number;
  /** Working days as a percentage of the period. */
  workPercent: number;
  /** Remaining effort in days (effort task), or `null`. */
  remaining: string | null;
  /** Planned end (duration task), or `null`. */
  endDate: TjTime | null;
  /**
   * Materials allocated to the task (extension 18.17.4): they become a commented
   * `material <id> { work/unitprice }` skeleton in the form.
   */
  materials: MaterialAllocation[];
}

/** Fixed header of the form (Ruby `to_tjp` l.77-87). */
const HEADER =
  `# The status headline should be no more than 60 characters and may
# not be empty! The status summary is optional and should be no
# longer than one or two sentences of plain text. The details section
# is also optional has no length limitation. You can use simple
# markup in this section.  It is recommended that you provide at
# least a summary or a details section.
# See http://www.taskjuggler.org/tj3/manual/timesheet.html for details.
#
# --------8<--------8<--------
`;

/** Fixed help block at the end of each sheet (Ruby `to_tjp` l.129-155). */
const NEW_TASK_HELP =
  `  # If you had unplanned tasks, uncomment and fill out the
  # following lines:
  # newtask new.task.id "A task title" {
  #   work X%
  #   remaining Y.Yd
  #   status green "Your headline here!" {
  #     summary -8<-
  #     A summary text
  #     ->8-
  #     details -8<-
  #     Some more details
  #     ->8-
  #     flags ...
  #   }
  # }

  # You can use the following section to report personal notes.
  # status green "Your headline here!" {
  #   summary -8<-
  #   A summary text
  #   ->8-
  #   details -8<-
  #   Some more details
  #   ->8-
  # }
`;

/** Header of the upcoming-tasks list (Ruby `to_tjp` l.158-164). */
const FUTURE_HELP = `  #
  # Your upcoming tasks for the next period
  # Please check them carefully and discuss any necessary
  # changes with your manager or project manager!
  #
`;

/**
 * Formats a number like Ruby's `Float#to_s`: integers gain `.0` (Ruby prints
 * `50.0`, not `50`).
 */
function rubyFloat(value: number,): string {
  return Number.isInteger(value,) ? `${value}.0` : String(value,);
}

/**
 * Generator of time sheet templates (Ruby `TimeSheetReport < ReportBase`).
 */
export class TimeSheetReport extends ReportBase {
  /** Records of the reported period. */
  private current: TSResourceRecord[] = [];
  /** Records of the following period (upcoming tasks). */
  private future: TSResourceRecord[] = [];

  /**
   * Creates a time sheet report.
   *
   * @param report Report definition being rendered.
   */
  constructor(report: Report,) {
    super(report,);
  }

  /** Builds the records of both the reported and the future period. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    const from = this.a("start",) as TjTime;
    const to = this.a("end",) as TjTime;
    this.current = this.collectRecords(from, to,);
    // Ruby (l.69-71): `newEnd` is computed and **discarded** — dead residue.
    // The future period uses the same length as the reported period.
    this.future = this.collectRecords(
      to,
      to.addSeconds(to.toSeconds() - from.toSeconds(),),
    );
  }

  /** Templates in TJP syntax, one `timesheet` block per resource. */
  to_tjp(): string {
    let file = HEADER;
    const start = this.a("start",) as TjTime;
    const end = this.a("end",) as TjTime;

    for (const record of this.current) {
      const resource = record.resource;
      file +=
        `timesheet ${resource.fullId} ${start.to_s()} - ${end.to_s()} {\n\n`;
      file += `  # Vacation time: ${
        rubyFloat(
          record.vacationPercent,
        )
      }%\n\n`;

      if (record.tasks.length === 0) {
        file += "  # There were no planned tasks assignments for " +
          "this period!\n\n";
      } else {
        for (const taskRecord of record.tasks) {
          const task = taskRecord.task;
          file += `  # Task: ${task.name}\n`;
          file += `  task ${task.fullId} {\n`;
          file += `    work ${rubyFloat(taskRecord.workPercent,)}%\n`;
          if (taskRecord.remaining !== null) {
            file += `    remaining ${taskRecord.remaining}d\n`;
          } else {
            file += `    end ${taskRecord.endDate?.to_s() ?? ""}\n`;
          }
          const comment = taskRecord.workDays > 1.0 ? "" : "# ";
          file += `    ${comment}status green "Your headline here!" {\n` +
            "    #  summary -8<-\n" +
            "    #  A summary text\n" +
            "    #  ->8-\n" +
            "    #  details -8<-\n" +
            "    #  Some more details\n" +
            "    #  ->8-\n" +
            "    #  flags ...\n" +
            `    ${comment}}\n`;
          // Extension 18.17.4: materials allocated to the task enter the form as
          // a commented skeleton — the executor uncomments it and fills in the
          // quantity actually consumed.
          for (const allocation of taskRecord.materials) {
            file += `    # Material: ${allocation.material.name}\n`;
            file += `    # material ${allocation.material.fullId} {\n`;
            file += `    #   work ${rubyFloat(allocation.quantity,)}` +
              "\n";
            // 18.17.10: `unitprice` is only re-emitted when the allocation
            // declares a price of its own — sheets without a price stay identical.
            if (allocation.unitPrice !== undefined) {
              file += `    #   unitprice ${rubyFloat(allocation.unitPrice,)}` +
                "\n";
            }
            file += "    # }\n";
          }
          file += "  }\n\n";
        }
      }

      file += NEW_TASK_HELP;
      const future = this.future.find((r,) => r.resource === resource);
      if (future && future.tasks.length > 0) {
        file += FUTURE_HELP;
        for (const taskRecord of future.tasks) {
          file += `  # ${taskRecord.task.name}: ${
            rubyFloat(taskRecord.workPercent,)
          }%\n`;
        }
        file += "\n";
      } else {
        file += "\n  # You have no future assignments for this project!\n";
      }
      file += "}\n# -------->8-------->8--------\n\n";
    }
    return file;
  }

  /**
   * Builds the records of the period `[from, to)` (Ruby `collectRecords`).
   *
   * It walks the visible resources (leaves only), queries `timeoffdays` and,
   * for every allocated task crossing the period, the `effort` of the interval.
   *
   * @param from First instant of the period.
   * @param to Last instant of the period (exclusive).
   * @returns One record per visible leaf resource.
   */
  private collectRecords(
    from: TjTime,
    to: TjTime,
  ): TSResourceRecord[] {
    const project = this.project;

    // Visible resources, in the order requested by the report.
    let resourceList = new PropertyList<Resource>(project.resources,);
    resourceList.setSorting(
      this.a("sortResources",) as Array<[string, boolean, number,]>,
    );
    resourceList = this.filterResourceList(
      resourceList,
      null,
      this.a("hideResource",) as LogicalExpression | null,
      this.a("rollupResource",) as LogicalExpression | null,
      null,
    );

    // Template of the Query used to inspect every property.
    const scenarioIdx = ((this.a("scenarios",) as number[]) ?? [0,])[0] ?? 0;
    const queryAttrs = {
      project,
      scopeProperty: null as unknown,
      scenarioIdx,
      loadUnit: "days",
      timeFormat: "%Y-%m-%d",
      start: from,
      end: to,
      hideJournalEntry: this.a("hideJournalEntry",),
      journalMode: this.a("journalMode",),
      journalAttributes: this.a("journalAttributes",),
      sortJournalEntries: this.a("sortJournalEntries",),
      costAccount: this.a("costaccount",),
      revenueAccount: this.a("revenueaccount",),
    };
    resourceList.query = new Query(queryAttrs as never,);
    resourceList.sort();

    // Visible tasks, in the order requested by the report.
    let taskList = new PropertyList<Task>(project.tasks,);
    taskList.setSorting(
      this.a("sortTasks",) as Array<[string, boolean, number,]>,
    );
    taskList = this.filterTaskList(
      taskList,
      null,
      this.a("hideTask",) as LogicalExpression | null,
      this.a("rollupTask",) as LogicalExpression | null,
      null,
    );

    const weeklyWorkingDays = project.weeklyWorkingDays();
    const weeksToReport = (to.toSeconds() - from.toSeconds()) /
      (60 * 60 * 24 * 7);

    const records: TSResourceRecord[] = [];
    for (const resource of resourceList.toArray()) {
      // Time sheets only make sense for leaf resources that actually work.
      if (!resource.leaf()) continue;

      const record: TSResourceRecord = {
        resource,
        vacationHours: "",
        vacationPercent: 0,
        tasks: [],
      };
      records.push(record,);

      // Off days of the period → hours and percentage.
      const vacationQuery = new Query(queryAttrs as never,);
      vacationQuery.property = resource;
      vacationQuery.attributeId = "timeoffdays";
      vacationQuery.process();
      record.vacationHours = vacationQuery.to_s();
      record.vacationPercent = ((vacationQuery.to_num() ?? 0) /
        (weeksToReport * weeklyWorkingDays)) * 100.0;

      // Tasks the resource is allocated to in the period.
      const assignedTaskList = this.filterTaskList(
        taskList,
        resource,
        this.a("hideTask",) as LogicalExpression | null,
        this.a("rollupTask",) as LogicalExpression | null,
        null,
      );
      assignedTaskList.query = new Query({
        ...queryAttrs,
        scopeProperty: resource,
      } as never,);
      assignedTaskList.sort();

      for (const task of assignedTaskList.toArray()) {
        const taskStart = task.getForScenario("start", scenarioIdx,) as TjTime;
        const taskEnd = task.getForScenario("end", scenarioIdx,) as TjTime;
        if (!task.leaf()) continue;
        if (
          !new TimeInterval(from, to,).overlaps(
            new TimeInterval(taskStart, taskEnd,),
          )
        ) {
          continue;
        }

        const query = new Query(queryAttrs as never,);
        query.property = task;
        query.attributeId = "effort";
        query.start = from;
        query.end = to;
        query.process();
        // `Query#to_num` of an effort always returns days.
        const workDays = query.to_num() ?? 0;
        const workPercent = (workDays / (weeksToReport * weeklyWorkingDays)) *
          100.0;

        let remaining: string | null = null;
        let endDate: TjTime | null = null;
        if (
          ((task.getForScenario("effort", scenarioIdx,) as number) ?? 0) > 0
        ) {
          // Effort task: remaining effort after the period.
          query.start = to;
          query.end = taskEnd ?? to;
          query.loadUnit = "days";
          query.process();
          remaining = query.to_s();
        } else {
          // Duration task: planned end.
          endDate = taskEnd;
        }

        record.tasks.push({
          task,
          workDays,
          workPercent,
          remaining,
          endDate,
          // Extension 18.17.4: material allocations of the task (the form shows
          // a skeleton for the executor to fill in).
          materials:
            (task.getForScenario("materialallocations", scenarioIdx,) ??
              []) as MaterialAllocation[],
        },);
      }
    }

    return records;
  }
}

// Registers the `timesheet` content in the factory (14.11).
registerContentFactory(
  "timesheet",
  (report: unknown,): TimeSheetReport => new TimeSheetReport(report as Report,),
);
