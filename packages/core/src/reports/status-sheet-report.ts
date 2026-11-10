/**
 * StatusSheetReport — generator of status sheet templates in TJP syntax.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/reports/StatusSheetReport.rb`.
 *
 * The report mirrors `TimeSheetReport`: instead of collecting planned work per
 * resource, it collects the **responsibilities** of every manager (the top-level
 * tasks a resource is `responsible` for) and the latest journal entries of each
 * one — including the entries that came from time sheets, through
 * `JournalEntry#timeSheetRecord` (phase 18).
 *
 * ⚠️ Browser (ADR 027): nothing is written to disk; the text leaves through
 * `to_tjp()`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/reports/StatusSheetReport.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.8/18.17)
 */

import type { Report, } from "../model/report.ts";
import type { Resource, } from "../model/resource.ts";
import type { Task, } from "../model/task.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { JournalEntry, } from "../model/journal.ts";
import { PropertyList, } from "../model/property-list.ts";
import { registerContentFactory, } from "../model/report-content.ts";
import { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "../logic/logical-expression.ts";
import type { AlertLevelDefinition, } from "../model/alert-levels.ts";
import type { Material, } from "../model/material.ts";
import type { MaterialAllocation, } from "../model/material-allocation.ts";
import type { TimeSheetRecord, } from "../timesheet/time-sheet-record.ts";
import type { TjTime, } from "../time/tj-time.ts";
import { ReportBase, } from "./report-base.ts";

/** Tasks a manager is responsible for (Ruby `ManagerResponsibilities`). */
export class ManagerResponsibilities {
  /** Top-level task the manager answers for. */
  readonly task: Task;
  /** Journal entries reported for that task and its subtasks. */
  readonly journalEntries: JournalEntry[];

  /**
   * Creates a responsibility.
   *
   * @param task Top-level task the manager answers for.
   * @param journalEntries Journal entries of the task and its subtasks.
   */
  constructor(task: Task, journalEntries: JournalEntry[],) {
    this.task = task;
    // Ruby `journalEntries.dup` — the journal list is not mutated.
    this.journalEntries = [...journalEntries,];
  }

  /**
   * Sorts the entries by the order of the original `taskList` (Ruby `sort!`).
   *
   * @param taskList Task list defining the order.
   */
  sort(taskList: PropertyList<Task>,): void {
    this.journalEntries.sort((e1, e2,) =>
      taskList.itemIndex(e1.property as Task,) -
      taskList.itemIndex(e2.property as Task,)
    );
  }
}

/** A manager and its responsibilities (Ruby `ManagerStatusRecord`). */
export class ManagerStatusRecord {
  /** Manager the record belongs to. */
  readonly resource: Resource;
  /** Top-level tasks the manager is responsible for. */
  readonly responsibilities: ManagerResponsibilities[] = [];

  /**
   * Creates a manager record.
   *
   * @param resource Manager the record belongs to.
   */
  constructor(resource: Resource,) {
    this.resource = resource;
  }

  /**
   * Sorts the responsibilities and their entries (Ruby `sort!`).
   *
   * @param taskList Task list defining the order.
   */
  sort(taskList: PropertyList<Task>,): void {
    this.responsibilities.sort((r1, r2,) =>
      taskList.itemIndex(r1.task,) - taskList.itemIndex(r2.task,)
    );
    for (const responsibility of this.responsibilities) {
      responsibility.sort(taskList,);
    }
  }
}

/**
 * Generator of status sheet templates (Ruby `StatusSheetReport`).
 */
export class StatusSheetReport extends ReportBase {
  private managers: ManagerStatusRecord[] = [];

  /**
   * Creates a status sheet report.
   *
   * @param report Report definition being rendered.
   */
  constructor(report: Report,) {
    super(report,);
  }

  /** Collects the responsibilities and the status lines of every manager. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    this.managers = [];
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
      currencyFormat: this.a("currencyFormat",),
      start: this.a("start",),
      end: this.a("end",),
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
    taskList.sort();

    const start = this.a("start",) as TjTime;
    const end = this.a("end",) as TjTime;

    for (const resource of resourceList.toArray()) {
      // Status sheets only make sense for leaf resources.
      if (!resource.leaf()) continue;

      // Tasks the resource is responsible for whose parent it is **not**
      // responsible for (the top level of its hierarchy).
      const topLevelTasks: Task[] = [];
      for (const task of taskList.toArray()) {
        if (!this.responsibleOf(task, scenarioIdx,).includes(resource,)) {
          continue;
        }
        const parent = task.parent as Task | null;
        if (
          parent === null ||
          !this.responsibleOf(parent, scenarioIdx,).includes(resource,)
        ) {
          topLevelTasks.push(task,);
        }
      }
      if (topLevelTasks.length === 0) continue;

      const manager = new ManagerStatusRecord(resource,);
      this.managers.push(manager,);

      for (const task of topLevelTasks) {
        // Current journal entries of the task and its subtasks.
        const entries = project.journal.currentEntriesR(
          end,
          task,
          0,
          start.addSeconds(1,),
          resourceList.query!,
        );
        if (entries.length === 0) continue;
        manager.responsibilities.push(
          new ManagerResponsibilities(task, entries,),
        );
      }
      // Sorts the responsibilities by the original taskList.
      manager.sort(taskList,);
    }
  }

  /** Templates in TJP syntax, one `statussheet` block per manager. */
  to_tjp(): string {
    const levels = this.project.get("alertLevels",) as AlertLevelDefinition[];
    const timeFormat = (this.a("timeFormat",) as string | null) ?? "%Y-%m-%d";
    const start = this.a("start",) as TjTime;
    const end = this.a("end",) as TjTime;
    let file = "";

    for (const manager of this.managers) {
      const resource = manager.resource;
      file += "# --------8<--------8<--------\n";
      file +=
        `statussheet ${resource.fullId} ${start.to_s()} - ${end.to_s()} {\n\n`;

      if (manager.responsibilities.length === 0) {
        file += "  # This resource is not responsible for any task.\n\n";
      } else {
        for (const responsibility of manager.responsibilities) {
          file += `  # Task: ${responsibility.task.name}\n`;

          // Extension 18.17.8: each task is listed only once (the journal
          // entries may repeat the same task).
          const tasksShown = new Set<Task>();
          for (const entry of responsibility.journalEntries) {
            const task = entry.property as Task;
            file += `  task ${task.fullId} {\n`;
            const alertLevel = levels[entry.alertLevel]?.id ??
              String(entry.alertLevel,);
            file += `    # status ${alertLevel} "${entry.headline}" {\n`;
            file += `    #   # Date: ${entry.date.to_s()}\n`;
            const tsRecord = entry.timeSheetRecord as TimeSheetRecord | null;
            if (tsRecord) {
              file += "    #   # ";
              file += `Work: ${Math.trunc(tsRecord.actualWorkPercent(),)}% `;
              if (tsRecord.actualWorkPercent() !== tsRecord.planWorkPercent()) {
                file += `(${Math.trunc(tsRecord.planWorkPercent(),)}%) `;
              }
              if (tsRecord.remaining !== null) {
                file += `   Remaining: ${tsRecord.actualRemaining()}d `;
                if (tsRecord.actualRemaining() !== tsRecord.planRemaining()) {
                  file += `(${tsRecord.planRemaining()}d) `;
                }
              } else {
                const actualEnd = tsRecord.actualEnd();
                file += `   End: ${actualEnd?.to_s(timeFormat,) ?? ""} `;
                if (!sameTime(actualEnd, tsRecord.planEnd(),)) {
                  file += `(${tsRecord.planEnd()?.to_s(timeFormat,) ?? ""}) `;
                }
              }
              file += "\n";
            }
            const author = entry.author as PropertyTreeNode | null;
            if (author) file += `    #   author ${author.fullId}\n`;
            if (entry.flags.length > 0) {
              file += `    #   flags ${entry.flags.join(", ",)}\n`;
            }
            if (entry.summary) {
              file += "    #   summary -8<-\n" +
                indentBlock(4, entry.summary,) +
                "    #   ->8-\n";
            }
            if (entry.details) {
              file += "    #   details -8<-\n" +
                indentBlock(4, entry.details,) +
                "    #   ->8-\n";
            }
            // Materials of the task enter the block, once per task.
            if (!tasksShown.has(task,)) {
              tasksShown.add(task,);
              file += this.materialLines(task,);
            }
            file += "    # }\n  }\n\n";
          }
        }
      }
      file += "}\n# -------->8-------->8--------\n\n";
    }
    return file;
  }

  /**
   * Commented lines with the material allocations of the task and the
   * `effortdone`/`effortleft` of the tracking scenario (extension 18.17.8).
   *
   * Same format as the `TimeSheetReport` skeleton, so whatever the manager
   * uncomments comes back through the status sheet parser.
   *
   * @param task Task whose materials are listed.
   * @returns One commented `material` block per allocated material.
   */
  private materialLines(task: Task,): string {
    const scenarioIdx = ((this.a("scenarios",) as number[]) ?? [0,])[0] ?? 0;
    const allocations =
      (task.getForScenario("materialallocations", scenarioIdx,) ??
        []) as MaterialAllocation[];
    // The actual figures live in the tracking scenario: that is what the sheet
    // shows.
    const trackIdx = (this.project.get("trackingScenarioIdx",) as
      | number
      | null) ?? scenarioIdx;

    const materials = new Set<Material>(allocations.map((a,) => a.material),);
    let out = "";
    for (const material of materials) {
      const done = Number(
        material.getForScenario("effortdone", trackIdx,) ?? 0,
      );
      const left = Number(
        material.getForScenario("effortleft", trackIdx,) ?? 0,
      );
      out += `    # material ${material.fullId} {\n`;
      if (done !== 0) out += `    #   work ${rubyFloat(done,)}\n`;
      if (left !== 0) out += `    #   remaining ${rubyFloat(left,)}\n`;
      out += "    # }\n";
    }
    return out;
  }

  /** `task['responsible', scenarioIdx]`, tolerating `null`. */
  private responsibleOf(
    task: Task,
    scenarioIdx: number,
  ): Resource[] {
    return (task.getForScenario("responsible", scenarioIdx,) as Resource[]) ??
      [];
  }
}

/**
 * Indents a multi-line block with `' '.repeat(indent) + '#   '`, reapplying the
 * prefix after every line break (Ruby `indentBlock`, l.214-228). Guarantees a
 * trailing line break.
 */
export function indentBlock(indent: number, text: string,): string {
  const indentation = " ".repeat(indent,) + "#   ";
  let buffer = indentation;
  let out = "";
  for (const char of text) {
    if (buffer.length > 0) {
      out += buffer;
      buffer = "";
    }
    out += char;
    if (char === "\n") buffer = indentation;
  }
  if (!out.endsWith("\n",)) out += "\n";
  return out;
}

/** Compares `TjTime | null` (Ruby `==`). */
function sameTime(a: TjTime | null, b: TjTime | null,): boolean {
  if (a === null || b === null) return a === b;
  return a.equals(b,);
}

/** Ruby `Float#to_s`: integers gain `.0` (`20.0`, not `20`). */
function rubyFloat(value: number,): string {
  return Number.isInteger(value,) ? `${value}.0` : String(value,);
}

// Registers the `statussheet` content in the factory (14.11).
registerContentFactory(
  "statussheet",
  (report: unknown,): StatusSheetReport =>
    new StatusSheetReport(report as Report,),
);
