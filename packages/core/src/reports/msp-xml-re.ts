/**
 * MspXmlRE (phase 14.18.3) — exports the project data as Microsoft Project XML.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/MspXmlRE.rb`. Owing
 * to MS Project and implementation limits, only a subset of the core data is
 * exported (a project already scheduled, with resource/task assignments).
 *
 * ⚠️ Browser (ADR 027): `to_mspxml()` returns the string; there is no disk
 * write. It uses the real `XMLElement`/`XMLDocument` of phase 17.1 (replacing
 * the minimal `xml-node.ts` in 17.12). Serialization is compact (without the
 * byte-for-byte indentation of Ruby); the tests assert structure and elements,
 * not exact byte equality.
 *
 * **14C.4 (phase 14 complement):** beyond the Ruby subset, we export the
 * entities that only exist in SyntaxMesh — material and cost resources,
 * `<Assignment>` with `Units`/`Cost` and a cost series, `<ActualWork>`/
 * `<RemainingWork>` (`effortdone`), `<Notes>`, calendar `<Exceptions>` and
 * `<LinkLag>`/`<LagFormat>`. Those extensions have **no oracle** in tj3: they
 * are validated by structural tests and by the `reports-extensions.golden`
 * snapshot.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.18.3)
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.4)
 */
import type { Report, } from "../model/report.ts";
import type { Task, } from "../model/task.ts";
import type { Resource, } from "../model/resource.ts";
import type { Material, } from "../model/material.ts";
import type { MaterialAllocation, } from "../model/material-allocation.ts";
import type { Charge, } from "../finance/charge.ts";
import type { Leave, } from "../model/leave.ts";
import type { TaskDependency, } from "../scheduling/task-dependency.ts";
import { PropertyList, } from "../model/property-list.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { Query, } from "../query/query.ts";
import type { WorkingHours, } from "../calendar/working-hours.ts";
import { TjTime, } from "../time/tj-time.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { ScoreboardInterval, } from "../time/scoreboard-interval.ts";
import { AppConfig, } from "../app-config.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { ReportBase, } from "./report-base.ts";
import {
  XMLBlob,
  XMLComment,
  XMLElement,
  XMLNamedText,
} from "../xml/xml-element.ts";
import { XMLDocument, } from "../xml/xml-document.ts";

/** Date/time format of MSP XML (`%Y-%m-%dT%H:%M:%S`). */
const TIMEFORMAT = "%Y-%m-%dT%H:%M:%S";

/** `loadUnit` → MSP `WorkFormat` code map (faithful to Ruby). */
const LOAD_UNITS_MAP: Record<string, number> = {
  minutes: 1,
  hours: 2,
  days: 3,
  weeks: 4,
  months: 5,
  quarters: 5,
  years: 5,
  shortauto: 3,
  longauto: 3,
  shortAuto: 3,
  longAuto: 3,
};

/**
 * `<Resource><Type>` — MSPDI (2007) schema, `Type` under `Resource`:
 * `0` = material (consumable), `1` = work (people/equipment), `2` = cost.
 *
 * ⚠️ `docs/tj3-engine/mspdi.md` §3.1 swapped material (2) and cost (0) —
 * corrected on 2026-11-01; the official schema table (and `MspXmlRE.rb`, which
 * already uses `1` for work) prevails. See 14C.4.2 in the evidence table.
 */
export const RESOURCE_TYPE_MATERIAL = "0";
export const RESOURCE_TYPE_WORK = "1";
export const RESOURCE_TYPE_COST = "2";

/** `<DurationFormat>`/`<LagFormat>` (§2.2): `7` = working days, `8` = elapsed days. */
export const DURATION_FORMAT_DAYS = "7";
export const DURATION_FORMAT_ELAPSED_DAYS = "8";

/** `<TimephasedData><Type>`: `1` = remaining work, `6` = actual cost. */
const TIMEPHASED_WORK = "1";
const TIMEPHASED_COST = "6";

/** `<TimephasedData><Unit>`: `2` = days (value in `PT{H}H{M}M{S}S`). */
const TIMEPHASED_UNIT = "2";

/** Converts an attribute value to a string (honouring RichText `to_s`). */
function asString(value: unknown,): string {
  if (value === null || value === undefined) return "";
  const maybe = value as { to_s?: () => string };
  if (typeof maybe.to_s === "function") return maybe.to_s();
  return String(value,);
}

/**
 * Formats a number as an MSPDI decimal.
 *
 * Ruby serializes `Float#to_s` (`1.0`, `0.0`, `62.5`); JS would write `1`, `0`.
 * MS Project expects decimal rates/units (mspdi §3.2/§4.1), so integers gain the
 * `.0` suffix to match the tj3 oracle.
 */
export function asDecimal(value: number,): string {
  if (!Number.isFinite(value,)) return String(value,);
  return Number.isInteger(value,) ? `${value}.0` : String(value,);
}

/**
 * Formats a **monetary** value as an MSPDI decimal, rounded to cents.
 *
 * The cost `TimephasedData` series split the period total into slices
 * (`200/3`), and JS binary arithmetic would leak noise (`166.66666666666669`)
 * into the XML. Currency in MSPDI is a decimal — two places.
 */
export function asMoney(value: number,): string {
  return asDecimal(Math.round(value * 100,) / 100,);
}

/** Material resource derived from a `Material` (14C.4.2). */
interface MaterialResource {
  uid: string;
  material: Material;
}

/** Cost resource derived from a task `Charge` (14C.4.4). */
interface CostResource {
  uid: string;
  task: Task;
  charge: Charge;
  index: number;
}

/**
 * The `mspxml` generator: exports the project as Microsoft Project XML.
 */
export class MspXmlRE extends ReportBase {
  /** Scenario exported by this report (only one is supported). */
  private readonly scenarioIdx: number;
  /**
   * Scenario used as the baseline (`baseline <scenario>`, 14C.10), or `null`.
   * With it the document gains a project-level and per-task `<Baseline>`;
   * without it the output is identical to the previous one (untouched
   * `mspdi.golden.json` oracle).
   */
  private readonly baselineIdx: number | null;
  /** Calendar name → UID map built while the calendars are emitted. */
  private calendarUIDs: Record<string, string> = {};
  private query!: Query;
  private resourceList!: PropertyList<Resource>;
  private taskList!: PropertyList<Task>;
  private file!: XMLDocument;
  /** Material/cost resources (global UID space, after the humans). */
  private materialResources: MaterialResource[] = [];
  private costResources: CostResource[] = [];

  /**
   * Creates the MSP XML exporter.
   *
   * @param report Report definition being rendered.
   */
  constructor(report: Report,) {
    super(report,);
    // This report kind supports a single scenario: the first one is used.
    const scenarios = (this.a("scenarios",) as number[]) ?? [];
    this.scenarioIdx = scenarios[0] ?? 0;
    const baseline = this.a("baseline",);
    this.baselineIdx = typeof baseline === "number" ? baseline : null;
  }

  /** This exporter has no intermediate format. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
  }

  /** Returns the project data as Microsoft Project XML. */
  to_mspxml(): string {
    this.query = this.currentQuery().dup();

    // Prepares the resource list.
    this.resourceList = new PropertyList<Resource>(this.project.resources,);
    this.resourceList.setSorting(
      this.a("sortResources",) as Array<[string, boolean, number,]>,
    );
    this.resourceList = this.filterResourceList(
      this.resourceList,
      null,
      this.a("hideResource",) as never,
      this.a("rollupResource",) as never,
      this.a("openNodes",) as never,
    );
    this.resourceList.sort();

    // Prepares the task list. MSP requires 'tree' order; the user sorting
    // criteria are ignored on purpose.
    this.taskList = new PropertyList<Task>(this.project.tasks,);
    this.taskList.includeAdopted();
    this.taskList.setSorting(
      [
        [
          "tree",
          true,
          -1,
        ],
        [
          "seqno",
          true,
          -1,
        ],
      ],
    );
    this.taskList = this.filterTaskList(
      this.taskList,
      null,
      this.a("hideTask",) as never,
      this.a("rollupTask",) as never,
      this.a("openNodes",) as never,
    );
    this.taskList.sort();
    this.taskList.checkForDuplicates(
      this.report.sourceFileInfo as SourceFileInfo,
    );

    // Material/cost resources derived from the SyntaxMesh entities
    // (14C.4.2–4.4). The list is empty when the project uses no
    // materials/charges, so the subset faithful to `MspXmlRE.rb` stays
    // unchanged (14C.4.14 oracle).
    this.collectExtensionResources();

    this.file = new XMLDocument();
    this.file.append(
      new XMLBlob(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      ),
    );
    this.file.append(
      new XMLComment(
        `Generated by ${AppConfig.softwareName} v${AppConfig.version} on ` +
          `${TjTime.now().to_s()}\n` +
          `For more information about ${AppConfig.softwareName} see ` +
          `${AppConfig.contact}.\n` +
          `Project: ${asString(this.project.get("name",),)}\n` +
          `Date:    ${asString(this.project.get("now",),)}\n`,
      ),
    );
    const project = new XMLElement("Project", {
      xmlns: "http://schemas.microsoft.com/project",
    },);
    this.file.append(project,);

    const calendars = this.generateProjectAttributes(project,);
    if (this.baselineIdx !== null) this.generateProjectBaseline(project,);
    this.generateTasks(project,);
    this.generateResources(project, calendars,);
    this.generateAssignments(project,);

    return this.file.to_s();
  }

  // ------------------------------------------------------------------
  // Document sections
  // ------------------------------------------------------------------

  /**
   * Emits the `<Project>` attributes (scheduling, rates, currency) and the
   * `<Calendars>` block.
   *
   * @param p `<Project>` element being filled.
   * @returns The `<Calendars>` element, so resources can add their calendars.
   */
  private generateProjectAttributes(p: XMLElement,): XMLElement {
    p.append(new XMLNamedText("14", "SaveVersion",),);
    p.append(new XMLNamedText(this.report.name + ".xml", "Name",),);
    p.append(
      new XMLNamedText(TjTime.now().to_s(TIMEFORMAT,), "CreationDate",),
    );
    p.append(new XMLNamedText("1", "ScheduleFromStart",),);
    p.append(
      new XMLNamedText(
        (this.project.get("start",) as TjTime).to_s(TIMEFORMAT,),
        "StartDate",
      ),
    );
    p.append(
      new XMLNamedText(
        (this.project.get("end",) as TjTime).to_s(TIMEFORMAT,),
        "FinishDate",
      ),
    );
    p.append(new XMLNamedText("09:00:00", "DefaultStartTime",),);
    p.append(new XMLNamedText("17:00:00", "DefaultFinishTime",),);
    p.append(new XMLNamedText("1", "CalendarUID",),);
    p.append(
      new XMLNamedText(
        Math.floor(this.project.dailyWorkingHours() * 60,).toString(),
        "MinutesPerDay",
      ),
    );
    p.append(
      new XMLNamedText(
        Math.floor(
          this.project.weeklyWorkingDays() *
            this.project.dailyWorkingHours() * 60,
        ).toString(),
        "MinutesPerWeek",
      ),
    );
    p.append(
      new XMLNamedText(
        String(this.project.yearlyWorkingDays() / 12,),
        "DaysPerMonth",
      ),
    );
    p.append(
      new XMLNamedText(
        (this.project.get("now",) as TjTime).to_s(TIMEFORMAT,),
        "CurrentDate",
      ),
    );
    p.append(
      new XMLNamedText(
        (this.project.get("now",) as TjTime).to_s(TIMEFORMAT,),
        "StatusDate",
      ),
    );
    const loadUnit = String(this.a("loadUnit",) ?? "days",);
    p.append(
      new XMLNamedText(
        String(LOAD_UNITS_MAP[loadUnit] ?? 3,),
        "WorkFormat",
      ),
    );
    p.append(new XMLNamedText("1", "NewTasksAreManual",),);
    p.append(new XMLNamedText("0", "SpreadPercentComplete",),);
    const rate = asDecimal(
      (this.project.get("rate",) as number) /
        this.project.dailyWorkingHours(),
    );
    p.append(new XMLNamedText(rate, "StandardRate",),);
    p.append(new XMLNamedText(rate, "OvertimeRate",),);
    p.append(
      new XMLNamedText(
        asString(this.project.get("currency",),),
        "CurrencySymbol",
      ),
    );
    p.append(
      new XMLNamedText(
        asString(this.project.get("currency",),),
        "CurrencyCode",
      ),
    );

    const calendars = new XMLElement("Calendars",);
    p.append(calendars,);
    this.generateCalendar(
      calendars,
      this.project.get("workinghours",) as WorkingHours,
      "Standard",
      this.projectLeaves(),
    );

    return calendars;
  }

  /**
   * Emits the `<Tasks>` block.
   *
   * @param project `<Project>` element receiving the block.
   */
  private generateTasks(project: XMLElement,): void {
    const tasks = new XMLElement("Tasks",);
    project.append(tasks,);
    for (const task of this.taskList.toArray()) {
      this.generateTask(tasks, task,);
    }
  }

  /**
   * `<Baseline>` of the **project** (`Number` 0), from the dates scheduled in
   * the baseline scenario (addendum §10 / 14C.10.4).
   *
   * The interval comes from the first start and the last end among the
   * scheduled tasks; the cost is the sum of the scenario `CostEvent`s when they
   * exist. Without any scheduled task the element is omitted with a warning —
   * the exporter never invents dates.
   */
  private generateProjectBaseline(project: XMLElement,): void {
    const sc = this.baselineIdx as number;
    let first: TjTime | null = null;
    let last: TjTime | null = null;
    for (const task of this.taskList.toArray()) {
      const dates = this.baselineDates(task, sc,);
      if (!dates) continue;
      if (!first || dates.start.compareTo(first,) < 0) first = dates.start;
      if (!last || dates.end.compareTo(last,) > 0) last = dates.end;
    }
    if (!first || !last) {
      MessageHandlerInstance.instance.warning(
        "baseline_not_scheduled",
        `Baseline scenario ${sc} has no scheduled dates; ` +
          "MSPDI <Baseline> omitted.",
      );
      return;
    }
    this.appendBaseline(project, first, last, this.scenarioCost(null, sc,),);
  }

  /**
   * Dates scheduled for `task` in scenario `scIdx`, or `null` when the scenario
   * was not scheduled for it.
   */
  private baselineDates(
    task: Task,
    scIdx: number,
  ): { start: TjTime; end: TjTime } | null {
    const start = task.getForScenario("start", scIdx,) as TjTime | null;
    const end = task.getForScenario("end", scIdx,) as TjTime | null;
    if (!start || !end) return null;
    return { start, end, };
  }

  /**
   * Cost of scenario `scIdx` (Σ `CostEvent` of the scenario), restricted to
   * `task` when given. `null` when there are no events — `<Cost>` is omitted.
   */
  private scenarioCost(task: Task | null, scIdx: number,): number | null {
    let sum = 0;
    let found = false;
    for (const ce of this.project.costEvents) {
      if (ce.scenarioIdx !== scIdx) continue;
      if (task !== null && ce.task !== task) continue;
      sum += ce.amount;
      found = true;
    }
    return found ? sum : null;
  }

  /** Appends `<Baseline Number="0">` with `Start`/`Finish` and optional `Cost`. */
  private appendBaseline(
    parent: XMLElement,
    start: TjTime,
    end: TjTime,
    cost: number | null,
  ): void {
    const b = new XMLElement("Baseline",);
    parent.append(b,);
    b.append(new XMLNamedText("0", "Number",),);
    b.append(new XMLNamedText(start.to_s(TIMEFORMAT,), "Start",),);
    b.append(new XMLNamedText(end.to_s(TIMEFORMAT,), "Finish",),);
    if (cost !== null) {
      b.append(new XMLNamedText(asDecimal(cost,), "Cost",),);
    }
  }

  /**
   * Emits the `<Resources>` block: people/equipment first, then the material and
   * cost resources (SyntaxMesh extension, 14C.4.2–4.4).
   *
   * @param project `<Project>` element receiving the block.
   * @param calendars `<Calendars>` element the resource calendars are added to.
   */
  private generateResources(
    project: XMLElement,
    calendars: XMLElement,
  ): void {
    const resources = new XMLElement("Resources",);
    project.append(resources,);
    for (const resource of this.resourceList.toArray()) {
      this.generateResource(resources, resource, calendars,);
    }
    // Material and cost resources take UIDs after the human resources.
    for (const ref of this.materialResources) {
      this.generateMaterialResource(resources, ref,);
    }
    for (const ref of this.costResources) {
      this.generateCostResource(resources, ref,);
    }
  }

  /**
   * Emits the `<Assignments>` block: one entry per resource allocated to a task,
   * plus the material and cost assignments of the SyntaxMesh extensions.
   *
   * @param project `<Project>` element receiving the block.
   */
  private generateAssignments(project: XMLElement,): void {
    const assignments = new XMLElement("Assignments",);
    project.append(assignments,);
    let i = 0;
    for (const task of this.taskList.toArray()) {
      // Assignments are only generated for leaves and rolled-up containers.
      if (!this.inAssignmentScope(task,)) continue;
      for (const resource of task.assignedResources(this.scenarioIdx,)) {
        this.generateAssignment(assignments, task, resource, i,);
        i++;
      }
      // Allocated materials (14C.4.3): Units = quantity, Cost = qty × price.
      for (const allocation of this.taskMaterialAllocations(task,)) {
        const ref = this.materialResources.find((r,) =>
          r.material === allocation.material
        );
        if (!ref) continue;
        this.generateMaterialAssignment(assignments, task, allocation, ref, i,);
        i++;
      }
      // Flat charges of the task (14C.4.4): a cost resource with a direct `<Cost>`.
      for (const ref of this.costResources) {
        if (ref.task !== task) continue;
        this.generateCostAssignment(assignments, task, ref, i,);
        i++;
      }
    }
  }

  /**
   * Emits one `<Calendar>` (weekdays, working times and optional exceptions).
   *
   * @param calendars `<Calendars>` element receiving the calendar.
   * @param workinghours Working hours of the calendar owner.
   * @param name Calendar name, also used as the UID key.
   * @param exceptions Project or resource leaves turned into `<Exception>`.
   */
  private generateCalendar(
    calendars: XMLElement,
    workinghours: WorkingHours,
    name: string,
    exceptions: Leave[] = [],
  ): void {
    const cal = new XMLElement("Calendar",);
    calendars.append(cal,);
    const uid = String(Object.keys(this.calendarUIDs,).length,);
    this.calendarUIDs[name] = uid;
    cal.append(new XMLNamedText(uid, "UID",),);
    cal.append(new XMLNamedText(name, "Name",),);
    cal.append(new XMLNamedText("1", "IsBaseCalendar",),);
    cal.append(new XMLNamedText("-1", "BaseCalendarUID",),);

    const weekdays = new XMLElement("WeekDays",);
    cal.append(weekdays,);
    let d = 1;
    for (const day of workinghours.days) {
      const weekday = new XMLElement("WeekDay",);
      weekdays.append(weekday,);
      weekday.append(new XMLNamedText(String(d,), "DayType",),);
      d++;
      if (day.length === 0) {
        weekday.append(new XMLNamedText("0", "DayWorking",),);
      } else {
        weekday.append(new XMLNamedText("1", "DayWorking",),);
        const workingtimes = new XMLElement("WorkingTimes",);
        weekday.append(workingtimes,);
        for (const iv of day) {
          const worktime = new XMLElement("WorkingTime",);
          workingtimes.append(worktime,);
          worktime.append(
            new XMLNamedText(daytimeToS(iv[0],), "FromTime",),
          );
          worktime.append(new XMLNamedText(daytimeToS(iv[1],), "ToTime",),);
        }
      }
    }

    // Project holidays/leaves become `<Exception>` of the base calendar (14C.4.9).
    // `MspXmlRE.rb` emits no such block: it is kept on the base calendar only
    // and only when `Project.leaves` has entries.
    if (exceptions.length > 0) {
      const exs = new XMLElement("Exceptions",);
      cal.append(exs,);
      exceptions.forEach((leave, idx,) => {
        const from = this.leaveBound(leave, "start",);
        const to = this.leaveBound(leave, "end",);
        if (!from || !to) return;
        const ex = new XMLElement("Exception",);
        exs.append(ex,);
        ex.append(new XMLNamedText(String(idx + 1,), "Index",),);
        const reason = leave.reason && leave.reason !== ""
          ? `${leave.type}: ${leave.reason}`
          : leave.type;
        ex.append(new XMLNamedText(reason, "Name",),);
        const period = new XMLElement("TimePeriod",);
        ex.append(period,);
        period.append(new XMLNamedText(from.to_s(TIMEFORMAT,), "FromDate",),);
        period.append(new XMLNamedText(to.to_s(TIMEFORMAT,), "ToDate",),);
        ex.append(new XMLNamedText("0", "DayWorking",),);
      },);
    }
  }

  /**
   * Emits one `<Task>` element: identifiers, dates, progress, predecessors and
   * the optional per-task baseline.
   *
   * @param tasks `<Tasks>` element receiving the task.
   * @param task Task being exported.
   */
  private generateTask(tasks: XMLElement, task: Task,): void {
    const sc = this.scenarioIdx;
    this.query.property = task;
    task.scenarioData(sc,).calcCompletion();
    const percentComplete = (task.getForScenario("complete", sc,) as number) ??
      0;

    const t = new XMLElement("Task",);
    tasks.append(t,);
    const index = String(task.get("index",),);
    t.append(new XMLNamedText(index, "UID",),);
    t.append(new XMLNamedText(index, "ID",),);
    t.append(new XMLNamedText("1", "Active",),);
    t.append(new XMLNamedText("0", "Type",),);
    t.append(new XMLNamedText("0", "IsNull",),);
    t.append(new XMLNamedText(task.name, "Name",),);
    const bsi = asString(task.get("bsi",),);
    t.append(new XMLNamedText(bsi, "WBS",),);
    t.append(new XMLNamedText(bsi, "OutlineNumber",),);
    const taskroot = this.a("taskroot",) as Task | null;
    t.append(
      new XMLNamedText(
        String(task.level - (taskroot ? taskroot.level : 0),),
        "OutlineLevel",
      ),
    );
    t.append(
      new XMLNamedText(
        String(task.getForScenario("priority", sc,) ?? 0,),
        "Priority",
      ),
    );
    const start = task.getForScenario("start", sc,) as TjTime;
    const end = task.getForScenario("end", sc,) as TjTime;
    const startStr = start.to_s(TIMEFORMAT,);
    const endStr = end.to_s(TIMEFORMAT,);
    t.append(new XMLNamedText(startStr, "Start",),);
    t.append(new XMLNamedText(endStr, "Finish",),);
    t.append(new XMLNamedText(startStr, "ManualStart",),);
    t.append(new XMLNamedText(endStr, "ManualFinish",),);
    t.append(new XMLNamedText(startStr, "ActualStart",),);
    t.append(new XMLNamedText(endStr, "ActualFinish",),);
    t.append(new XMLNamedText("2", "ConstraintType",),);
    t.append(new XMLNamedText(startStr, "ConstraintDate",),);
    t.append(new XMLNamedText("3", "FixedCostAccrual",),);

    const note = task.get("note",);
    if (note) t.append(new XMLNamedText(asString(note,), "Notes",),);

    const responsible = this.responsibleNames(task, sc,);
    if (responsible !== "") {
      t.append(new XMLNamedText(responsible, "Contact",),);
    }

    if (task.container()) {
      const rollupTask = this.a("rollupTask",);
      t.append(new XMLNamedText(rollupTask ? "1" : "0", "Manual",),);
      const rolled = rollupTask
        ? (rollupTask as { eval: (q: unknown,) => boolean }).eval(this.query,)
        : false;
      t.append(new XMLNamedText(rolled ? "0" : "1", "Summary",),);
    } else {
      t.append(new XMLNamedText("1", "Manual",),);
      t.append(new XMLNamedText("0", "Summary",),);
      t.append(new XMLNamedText("0", "Estimated",),);
      // 7 = working days; 8 = elapsed days (`ed`, mspdi §8).
      t.append(
        new XMLNamedText(
          this.durationFormatFor(task, start, end, sc,),
          "DurationFormat",
        ),
      );
      if (task.getForScenario("milestone", sc,)) {
        t.append(new XMLNamedText("1", "Milestone",),);
      } else {
        const duration = end.diff(start,);
        t.append(new XMLNamedText(durationToMsp(duration,), "Duration",),);
        t.append(new XMLNamedText(durationToMsp(duration,), "Work",),);
        t.append(new XMLNamedText("0", "Milestone",),);
        t.append(new XMLNamedText("1", "EffortDriven",),);
        const pct = String(Math.trunc(percentComplete,),);
        t.append(new XMLNamedText(pct, "PercentComplete",),);
        t.append(new XMLNamedText(pct, "PercentWorkComplete",),);
      }
      this.appendTaskProgress(t, task, sc, end,);
    }

    this.appendPredecessors(t, task, true,);
    this.appendPredecessors(t, task, false,);

    // Per-task `<Baseline>` (14C.10.5): only when the baseline scenario has
    // scheduled dates for the task.
    if (this.baselineIdx !== null) {
      const dates = this.baselineDates(task, this.baselineIdx,);
      if (dates) {
        this.appendBaseline(
          t,
          dates.start,
          dates.end,
          this.scenarioCost(task, this.baselineIdx,),
        );
      }
    }
  }

  /**
   * Appends the `PredecessorLink` entries of one precedence list (start or end).
   * `fromStart` states which semantics is being walked (startpreds vs endpreds).
   */
  private appendPredecessors(
    t: XMLElement,
    task: Task,
    fromStart: boolean,
  ): void {
    const sc = this.scenarioIdx;
    const preds = fromStart
      ? task.scenarioData(sc,).startpreds()
      : task.scenarioData(sc,).endpreds();
    const parentPreds = task.parent
      ? (fromStart
        ? (task.parent as Task).scenarioData(sc,).startpreds()
        : (task.parent as Task).scenarioData(sc,).endpreds())
      : [];
    for (const [dt, onEnd,] of preds) {
      if (dt === null || !this.taskList.includes(dt,)) continue;
      if (task.parent && predsInclude(parentPreds, dt, onEnd,)) continue;
      const pl = new XMLElement("PredecessorLink",);
      t.append(pl,);
      const canon = this.taskList.find(dt,) ?? dt;
      pl.append(
        new XMLNamedText(String(canon.get("index",),), "PredecessorUID",),
      );
      // startpreds: onEnd ? 1 (FS) : 3 (SS); endpreds: onEnd ? 0 : 2.
      const type = fromStart ? (onEnd ? "1" : "3") : (onEnd ? "0" : "2");
      pl.append(new XMLNamedText(type, "Type",),);
      this.appendLag(pl, task, canon, onEnd, fromStart,);
    }
  }

  /**
   * Emits `<LinkLag>`/`<LagFormat>` of a dependency with lag (14C.4.11).
   *
   * The dependency lives in the `depends`/`precedes` attribute of the node
   * itself, so the (task, onEnd) pair is looked up in the matching list.
   * `gaplength` is working time (working days → `LagFormat` 7); `gapduration`
   * is calendar time (elapsed days → `LagFormat` 8). `<LinkLag>` is expressed in
   * tenths of a minute, as in the MSPDI schema.
   */
  private appendLag(
    pl: XMLElement,
    task: Task,
    pred: Task,
    onEnd: boolean,
    fromStart: boolean,
  ): void {
    const attrId = fromStart ? "depends" : "precedes";
    const list = (task.getForScenario(attrId, this.scenarioIdx,) ??
      []) as TaskDependency[];
    const dep = list.find((d,) => d.task === pred && d.onEnd === onEnd);
    if (!dep) return;
    const dailyMinutes = this.project.dailyWorkingHours() * 60;
    if (dep.gapLength > 0) {
      // `gapLength` is stored in slots (seconds ÷ granularity).
      const gapSeconds = dep.gapLength * this.granularity();
      const days = gapSeconds / (this.project.dailyWorkingHours() * 3600);
      pl.append(
        new XMLNamedText(
          String(Math.round(days * dailyMinutes * 10,),),
          "LinkLag",
        ),
      );
      pl.append(new XMLNamedText(DURATION_FORMAT_DAYS, "LagFormat",),);
      return;
    }
    if (dep.gapDuration > 0) {
      const days = dep.gapDuration / (24 * 60 * 60);
      pl.append(
        new XMLNamedText(String(Math.round(days * 24 * 60 * 10,),), "LinkLag",),
      );
      pl.append(new XMLNamedText(DURATION_FORMAT_ELAPSED_DAYS, "LagFormat",),);
    }
  }

  /**
   * Emits one `<Resource>` element and its own calendar.
   *
   * @param resources `<Resources>` element receiving the resource.
   * @param resource Resource being exported.
   * @param calendars `<Calendars>` element receiving the resource calendar.
   */
  private generateResource(
    resources: XMLElement,
    resource: Resource,
    calendars: XMLElement,
  ): void {
    // MS Project only handles a flat resource list; groups are not exported.
    if (!resource.leaf()) return;

    const sc = this.scenarioIdx;
    const r = new XMLElement("Resource",);
    resources.append(r,);
    r.append(new XMLNamedText(String(resource.get("index",),), "UID",),);
    // Every TJ resource is a person or a piece of equipment.
    r.append(new XMLNamedText(RESOURCE_TYPE_WORK, "Type",),);
    r.append(new XMLNamedText(resource.name, "Name",),);
    r.append(new XMLNamedText(resource.id, "Initials",),);
    const rate = asDecimal(
      (resource.getForScenario("rate", sc,) as number) /
        this.project.dailyWorkingHours(),
    );
    r.append(new XMLNamedText(rate, "StandardRate",),);
    r.append(new XMLNamedText(rate, "OvertimeRate",),);
    r.append(
      new XMLNamedText(
        asDecimal((resource.getForScenario("efficiency", sc,) as number) ?? 0,),
        "MaxUnits",
      ),
    );
    const email = resource.get("email",);
    if (email) r.append(new XMLNamedText(asString(email,), "EmailAddress",),);
    const note = resource.get("note",);
    if (note) r.append(new XMLNamedText(asString(note,), "Notes",),);
    if (resource.parent) {
      r.append(
        new XMLNamedText(
          asString((resource.parent as Resource).name,),
          "Group",
        ),
      );
    }
    // Generates a calendar for this resource and assigns it.
    const calName = `Calendar ${resource.name}`;
    this.generateCalendar(
      calendars,
      resource.getForScenario("workinghours", sc,) as WorkingHours,
      calName,
      this.resourceLeaves(resource, sc,),
    );
    r.append(
      new XMLNamedText(this.calendarUIDs[calName] ?? "0", "CalendarUID",),
    );
  }

  /**
   * Emits one `<Assignment>` linking a task to a resource.
   *
   * @param assignments `<Assignments>` element receiving the entry.
   * @param task Task being assigned.
   * @param resource Resource assigned to the task.
   * @param uid Sequential UID of the assignment.
   */
  private generateAssignment(
    assignments: XMLElement,
    task: Task,
    resource: Resource,
    uid: number,
  ): void {
    const sc = this.scenarioIdx;
    const a = new XMLElement("Assignment",);
    assignments.append(a,);
    a.append(new XMLNamedText(String(uid,), "UID",),);
    a.append(
      new XMLNamedText(String(task.get("index",),), "TaskUID",),
    );
    a.append(
      new XMLNamedText(String(resource.get("index",),), "ResourceUID",),
    );
    a.append(
      new XMLNamedText(
        asDecimal((resource.getForScenario("efficiency", sc,) as number) ?? 0,),
        "Units",
      ),
    );
    const taskStart = task.getForScenario("start", sc,) as TjTime;
    const taskEnd = task.getForScenario("end", sc,) as TjTime;
    a.append(new XMLNamedText(taskStart.to_s(TIMEFORMAT,), "start",),);
    a.append(new XMLNamedText(taskEnd.to_s(TIMEFORMAT,), "finish",),);
    a.append(new XMLNamedText("100.0", "Cost",),);
    a.append(new XMLNamedText("8", "WorkContour",),);
    // PercentWorkComplete must be 0, otherwise MS Project ignores the work.
    a.append(new XMLNamedText("0", "PercentWorkComplete",),);
    const responsible = this.responsibleNames(task, sc,);
    if (responsible !== "") {
      a.append(new XMLNamedText(responsible, "AssnOwner",),);
    }
    this.appendAssignmentProgress(a, task, resource, taskStart, taskEnd, sc,);

    // Configures the query for this task and resource.
    this.query.property = resource;
    this.query.scopeProperty = task;
    this.query.attributeId = "effort";
    this.query.scenarioIdx = sc;
    this.query.start = taskStart;
    this.query.end = taskEnd;
    this.query.process();

    const reportStart = this.a("start",) as TjTime;
    const reportEnd = this.a("end",) as TjTime;

    // Timephased data per day: the work of every day between start and end.
    let t = taskStart.midnight();
    const tEnd = taskEnd;
    while (t.lessThan(tEnd,)) {
      const tn = t.sameTimeNextDay();
      // Keeps the intervals inside the task and the report boundaries.
      let tc = t.lessThan(taskStart,) ? taskStart : t;
      tc = tc.lessThan(reportStart,) ? reportStart : tc;
      let tnc = tn.greaterThan(taskEnd,) ? taskEnd : tn;
      tnc = tnc.greaterThan(reportEnd,) ? reportEnd : tnc;
      this.query.start = tc;
      this.query.end = tnc;
      this.query.process();
      const workSeconds = this.assignmentWork(resource, task, tc, tnc, sc,) *
        this.project.dailyWorkingHours() * 3600;
      const td = new XMLElement("TimephasedData",);
      a.append(td,);
      td.append(new XMLNamedText(String(uid,), "UID",),);
      // Type must be 1; otherwise MS Project takes a long time to load.
      td.append(new XMLNamedText(TIMEPHASED_WORK, "Type",),);
      td.append(new XMLNamedText(tc.to_s(TIMEFORMAT,), "Start",),);
      td.append(
        new XMLNamedText(tnc.subSeconds(1,).to_s(TIMEFORMAT,), "Finish",),
      );
      td.append(new XMLNamedText(TIMEPHASED_UNIT, "Unit",),);
      td.append(
        new XMLNamedText(durationToMsp(workSeconds,), "Value",),
      );
      t = tn;
    }
  }

  /** Names of the responsible resources of the task, joined by commas. */
  private responsibleNames(task: Task, sc: number,): string {
    const list = (task.getForScenario("responsible", sc,) as Resource[]) ??
      [];
    return list.map((r,) => r.name).join(", ",);
  }

  /**
   * Effective work (in days) of the resource on the task within
   * `[start, end)`.
   *
   * Ruby obtains the same number through `Query#to_num`, which dispatches to
   * `ResourceScenario#query_effort` → `getEffectiveWork(startIdx, endIdx,
   * scopeProperty)`. We call the model method directly: the concrete
   * `query_effort` is not ported yet (phase 11) and returned 0, zeroing the
   * whole `TimephasedData` series (14C.4.8).
   */
  private assignmentWork(
    resource: Resource,
    task: Task,
    start: TjTime,
    end: TjTime,
    sc: number,
  ): number {
    const scIdxData = resource.scenarioData(sc,) as unknown as {
      getEffectiveWork(
        s: number,
        e: number,
        t: Task | null,
      ): number;
    };
    const startIdx = this.project.dateToIdx(start,);
    const endIdx = this.project.dateToIdx(end,);
    return scIdxData.getEffectiveWork(startIdx, endIdx, task,);
  }

  // ------------------------------------------------------------------
  // SyntaxMesh extensions (14C.4.2–4.9)
  // ------------------------------------------------------------------

  /**
   * Collects the material/cost resources of the report (14C.4.2/14C.4.4).
   *
   * The UIDs continue from the highest human resource UID: MSPDI requires a
   * single UID space inside `<Resources>`.
   */
  private collectExtensionResources(): void {
    this.materialResources = [];
    this.costResources = [];
    const seenMaterials = new Set<string>();
    let nextUid = this.maxResourceUid() + 1;
    for (const task of this.taskList.toArray()) {
      if (!this.inAssignmentScope(task,)) continue;
      for (const allocation of this.taskMaterialAllocations(task,)) {
        const material = allocation.material;
        if (seenMaterials.has(material.id,) || this.hiddenMaterial(material,)) {
          continue;
        }
        seenMaterials.add(material.id,);
        this.materialResources.push({ uid: String(nextUid++,), material, },);
      }
      this.taskCharges(task,).forEach((charge, index,) => {
        this.costResources.push(
          { uid: String(nextUid++,), task, charge, index, },
        );
      },);
    }
  }

  /** Highest UID among the exported human resources (leaves). */
  private maxResourceUid(): number {
    let max = 0;
    for (const resource of this.resourceList.toArray()) {
      if (!resource.leaf()) continue;
      max = Math.max(max, Number(resource.get("index",) ?? 0,),);
    }
    return max;
  }

  /**
   * Does the task receive an `<Assignment>`? Leaves yes; containers only with
   * `rollupTask`.
   */
  private inAssignmentScope(task: Task,): boolean {
    if (!task.container()) return true;
    const rollupTask = this.a("rollupTask",) as {
      eval: (q: unknown,) => boolean;
    } | null;
    if (!rollupTask) return false;
    this.query.property = task;
    this.query.scopeProperty = null;
    return rollupTask.eval(this.query,);
  }

  /** Material allocations of the task in the report scenario. */
  private taskMaterialAllocations(task: Task,): MaterialAllocation[] {
    return (task.getForScenario("materialallocations", this.scenarioIdx,) ??
      []) as MaterialAllocation[];
  }

  /** Flat charges declared on the task (`charge`, report scenario). */
  private taskCharges(task: Task,): Charge[] {
    return (task.getForScenario("charge", this.scenarioIdx,) ?? []) as Charge[];
  }

  /** `hideMaterial` (14C.4.10/14C.6.8) applied to a material. */
  private hiddenMaterial(material: Material,): boolean {
    return this.hiddenBy("hideMaterial", material,);
  }

  /** Scoreboard granularity (seconds per slot), used to turn
   * `effort`/`effortdone`/`gapLength` (stored in slots) into seconds. */
  private granularity(): number {
    return (this.project.get("scheduleGranularity",) as number | null) ?? 3600;
  }

  /** `<Exception>` of the base calendar: project leaves/holidays (14C.4.9). */
  private projectLeaves(): Leave[] {
    return (this.project.get("leaves",) ?? []) as Leave[];
  }

  /** Leaves/holidays of the resource (they become `<Exception>` of its calendar). */
  private resourceLeaves(resource: Resource, sc: number,): Leave[] {
    return (resource.getForScenario("leaves", sc,) ?? []) as Leave[];
  }

  /**
   * Start/end of a leave as `TjTime`.
   *
   * `Leave.interval` may be a `ScoreboardInterval` (slot indices); in that case
   * the date comes from `sbStart + index × slotDuration`.
   */
  private leaveBound(leave: Leave, which: "start" | "end",): TjTime | null {
    const interval = leave.interval;
    if (interval instanceof ScoreboardInterval) {
      const idx = which === "start" ? interval.start : interval.end;
      return interval.sbStart.addSeconds(idx * interval.slotDuration,);
    }
    const value = (interval as { start: TjTime; end: TjTime })[which];
    return value instanceof TjTime ? value : null;
  }

  /** `<Resource>` of a `Material` (14C.4.2). */
  private generateMaterialResource(
    resources: XMLElement,
    ref: MaterialResource,
  ): void {
    const material = ref.material;
    const r = new XMLElement("Resource",);
    resources.append(r,);
    r.append(new XMLNamedText(ref.uid, "UID",),);
    r.append(new XMLNamedText(RESOURCE_TYPE_MATERIAL, "Type",),);
    r.append(new XMLNamedText(asString(material.name,), "Name",),);
    r.append(new XMLNamedText(material.id, "Initials",),);
    // §3.2: unit label and unit price go into MaterialLabel/rate.
    r.append(new XMLNamedText(material.unitValue(), "MaterialLabel",),);
    r.append(
      new XMLNamedText(asDecimal(material.unitPriceValue(),), "StandardRate",),
    );
    const note = material.get("note",);
    if (note) r.append(new XMLNamedText(asString(note,), "Notes",),);
  }

  /** Cost `<Resource>` for a flat `Charge` of the task (14C.4.4). */
  private generateCostResource(
    resources: XMLElement,
    ref: CostResource,
  ): void {
    const r = new XMLElement("Resource",);
    resources.append(r,);
    r.append(new XMLNamedText(ref.uid, "UID",),);
    r.append(new XMLNamedText(RESOURCE_TYPE_COST, "Type",),);
    r.append(
      new XMLNamedText(`Charges ${ref.task.id} #${ref.index + 1}`, "Name",),
    );
    r.append(new XMLNamedText(`charge${ref.index + 1}`, "Initials",),);
    // No rate: the value goes straight into the `<Cost>` of the assignment (§3.2).
    r.append(
      new XMLNamedText(asDecimal(ref.charge.amount,), "StandardRate",),
    );
    // The model does not mark budget resources: a charge is an expense.
    r.append(new XMLNamedText("0", "IsBudget",),);
  }

  /** Material `<Assignment>`: `Units` = quantity, `Cost` = qty × price. */
  private generateMaterialAssignment(
    assignments: XMLElement,
    task: Task,
    allocation: MaterialAllocation,
    ref: MaterialResource,
    uid: number,
  ): void {
    const sc = this.scenarioIdx;
    const start = task.getForScenario("start", sc,) as TjTime;
    const end = task.getForScenario("end", sc,) as TjTime;
    const unitPrice = ref.material.unitPriceValue();
    const a = new XMLElement("Assignment",);
    assignments.append(a,);
    a.append(new XMLNamedText(String(uid,), "UID",),);
    a.append(new XMLNamedText(String(task.get("index",),), "TaskUID",),);
    a.append(new XMLNamedText(ref.uid, "ResourceUID",),);
    a.append(new XMLNamedText(asDecimal(allocation.quantity,), "Units",),);
    a.append(new XMLNamedText(start.to_s(TIMEFORMAT,), "start",),);
    a.append(new XMLNamedText(end.to_s(TIMEFORMAT,), "finish",),);
    a.append(
      new XMLNamedText(
        asMoney(allocation.quantity * unitPrice,),
        "Cost",
      ),
    );
    a.append(new XMLNamedText("0", "PercentWorkComplete",),);

    // Daily cost series (§7.1): `quantityIn` depends on `attach()` (not called
    // by the scheduler), so the quantity is spread in chronological order.
    const periods = this.dailyPeriods(start, end,);
    const shares = this.materialShares(allocation, periods.length,);
    periods.forEach(([ps, pe,], idx,) => {
      this.appendCostTimephased(
        a,
        uid,
        ps,
        pe,
        (shares[idx] ?? 0) * unitPrice,
      );
    },);
  }

  /** Cost `<Assignment>`: `Cost` straight from the charge (14C.4.4). */
  private generateCostAssignment(
    assignments: XMLElement,
    task: Task,
    ref: CostResource,
    uid: number,
  ): void {
    const sc = this.scenarioIdx;
    const start = task.getForScenario("start", sc,) as TjTime;
    const end = task.getForScenario("end", sc,) as TjTime;
    const a = new XMLElement("Assignment",);
    assignments.append(a,);
    a.append(new XMLNamedText(String(uid,), "UID",),);
    a.append(new XMLNamedText(String(task.get("index",),), "TaskUID",),);
    a.append(new XMLNamedText(ref.uid, "ResourceUID",),);
    a.append(new XMLNamedText(asDecimal(1,), "Units",),);
    a.append(new XMLNamedText(start.to_s(TIMEFORMAT,), "start",),);
    a.append(new XMLNamedText(end.to_s(TIMEFORMAT,), "finish",),);
    a.append(new XMLNamedText(asMoney(ref.charge.amount,), "Cost",),);
    a.append(new XMLNamedText("0", "PercentWorkComplete",),);

    // `Charge#turnover` spreads onStart/onEnd/perDiem over the periods.
    for (const [ps, pe,] of this.dailyPeriods(start, end,)) {
      const amount = ref.charge.turnover(new TimeInterval(ps, pe,),);
      if (amount === 0) continue;
      this.appendCostTimephased(a, uid, ps, pe, amount,);
    }
  }

  /**
   * Fraction of the material quantity consumed in each period.
   *
   * `onstart`/`onend` concentrate everything in the first/last slice; the other
   * modifiers are spread evenly (no `DistributionContext`).
   */
  private materialShares(
    allocation: MaterialAllocation,
    count: number,
  ): number[] {
    if (count === 0) return [];
    const shares = new Array<number>(count,).fill(
      allocation.quantity / count,
    );
    if (allocation.modifier === "onstart") {
      shares.fill(0,);
      shares[0] = allocation.quantity;
    } else if (allocation.modifier === "onend") {
      shares.fill(0,);
      shares[count - 1] = allocation.quantity;
    }
    return shares;
  }

  /** Cost `<TimephasedData>` per period (`Type` 6, §7.1). */
  private appendCostTimephased(
    a: XMLElement,
    uid: number,
    start: TjTime,
    end: TjTime,
    cost: number,
  ): void {
    const td = new XMLElement("TimephasedData",);
    a.append(td,);
    td.append(new XMLNamedText(String(uid,), "UID",),);
    td.append(new XMLNamedText(TIMEPHASED_COST, "Type",),);
    td.append(new XMLNamedText(start.to_s(TIMEFORMAT,), "Start",),);
    td.append(
      new XMLNamedText(end.subSeconds(1,).to_s(TIMEFORMAT,), "Finish",),
    );
    td.append(new XMLNamedText(TIMEPHASED_UNIT, "Unit",),);
    td.append(new XMLNamedText(asMoney(cost,), "Value",),);
  }

  /** Daily slices of `[start, end)` clamped to the report interval. */
  private dailyPeriods(
    start: TjTime,
    end: TjTime,
  ): Array<[TjTime, TjTime,]> {
    const reportStart = this.a("start",) as TjTime | null;
    const reportEnd = this.a("end",) as TjTime | null;
    const periods: Array<[TjTime, TjTime,]> = [];
    let t = start.midnight();
    while (t.lessThan(end,)) {
      const tn = t.sameTimeNextDay();
      let ps = t.lessThan(start,) ? start : t;
      if (reportStart && ps.lessThan(reportStart,)) ps = reportStart;
      let pe = tn.greaterThan(end,) ? end : tn;
      if (reportEnd && pe.greaterThan(reportEnd,)) pe = reportEnd;
      periods.push([ps, pe,],);
      t = tn;
    }
    return periods;
  }

  /**
   * `<DurationFormat>` of the leaf task (§2.2/§8, 14C.4.5).
   *
   * A duration is “elapsed” (`8`) when the task consumes no non-productive time:
   * the calendar interval equals the effort — typical of 24×7 calendars. The
   * one-working-day guard avoids classifying short tasks (8 h in 8 h) as `ed`.
   * `9` (weeks) is never used for `ed`.
   */
  private durationFormatFor(
    task: Task,
    start: TjTime,
    end: TjTime,
    sc: number,
  ): string {
    const effort = task.getForScenario("effort", sc,) as number | null;
    if (!effort || effort <= 0) return DURATION_FORMAT_DAYS;
    const dailySeconds = this.project.dailyWorkingHours() * 3600;
    const wallClock = end.diff(start,);
    // `effort` is stored in slots, not in seconds.
    const workSeconds = effort * this.granularity();
    return wallClock === workSeconds && wallClock > dailySeconds
      ? DURATION_FORMAT_ELAPSED_DAYS
      : DURATION_FORMAT_DAYS;
  }

  /** `<ActualWork>`/`<RemainingWork>`/`<ActualCost>`/`<RemainingCost>` of the task. */
  private appendTaskProgress(
    t: XMLElement,
    task: Task,
    sc: number,
    end: TjTime,
  ): void {
    const effort = (task.getForScenario("effort", sc,) as number) ?? 0;
    const done = (task.getForScenario("effortdone", sc,) as number) ?? 0;
    if (effort <= 0 || done <= 0) return;
    // `effort`/`effortdone` are stored in slots, not in days.
    const granularity = this.granularity();
    const actualWork = done * granularity;
    const remainingWork = Math.max(0, effort - done,) * granularity;
    t.append(new XMLNamedText(durationToMsp(actualWork,), "ActualWork",),);
    t.append(
      new XMLNamedText(durationToMsp(remainingWork,), "RemainingWork",),
    );
    const actualCost = this.costEvents(task, "actual",);
    const plannedCost = this.costEvents(task, "planned",);
    if (actualCost > 0 || plannedCost > 0) {
      t.append(new XMLNamedText(asDecimal(actualCost,), "ActualCost",),);
      t.append(
        new XMLNamedText(
          asDecimal(Math.max(0, plannedCost - actualCost,),),
          "RemainingCost",
        ),
      );
    }
    // `end` stays in the contract for future per-period cost slices.
    void end;
  }

  /** Progress of a human assignment (proportional to the task effort). */
  private appendAssignmentProgress(
    a: XMLElement,
    task: Task,
    resource: Resource,
    start: TjTime,
    end: TjTime,
    sc: number,
  ): void {
    const effort = (task.getForScenario("effort", sc,) as number) ?? 0;
    const done = (task.getForScenario("effortdone", sc,) as number) ?? 0;
    if (effort <= 0 || done <= 0) return;
    const ratio = Math.min(1, done / effort,);
    const work = this.assignmentWork(resource, task, start, end, sc,) *
      this.project.dailyWorkingHours() * 3600;
    a.append(
      new XMLNamedText(durationToMsp(work * ratio,), "ActualWork",),
    );
    a.append(
      new XMLNamedText(durationToMsp(work * (1 - ratio),), "RemainingWork",),
    );
    const actualCost = this.costEvents(task, "actual", resource,);
    const plannedCost = this.costEvents(task, "planned", resource,);
    if (actualCost > 0 || plannedCost > 0) {
      a.append(new XMLNamedText(asDecimal(actualCost,), "ActualCost",),);
      a.append(
        new XMLNamedText(
          asDecimal(Math.max(0, plannedCost - actualCost,),),
          "RemainingCost",
        ),
      );
    }
  }

  /**
   * Sum of the `CostEvent`s of the task (8.2) by mode and, optionally, resource.
   */
  private costEvents(
    task: Task,
    mode: "planned" | "actual",
    resource?: Resource,
  ): number {
    let sum = 0;
    for (const event of this.project.costEvents) {
      if (event.scenarioIdx !== this.scenarioIdx) continue;
      if (event.mode !== mode || event.task !== task) continue;
      if (resource && event.resource !== resource) continue;
      sum += event.amount;
    }
    return sum;
  }
}

/** Converts a duration in seconds to the MSP `PT{H}H{M}M{S}S` form. */
export function durationToMsp(duration: number,): string {
  const hours = Math.floor(duration / (60 * 60),);
  const minutes = Math.floor((duration - hours * 60 * 60) / 60,);
  const seconds = Math.floor(duration % 60,);
  return `PT${hours}H${minutes}M${seconds}S`;
}

/** Converts seconds since midnight to `HH:MM:SS`. */
export function daytimeToS(t: number,): string {
  const h = Math.floor(t / (60 * 60),);
  const m = Math.floor((t - h * 60 * 60) / 60,);
  const s = Math.floor(t % 60,);
  return `${pad2(h,)}:${pad2(m,)}:${pad2(s,)}`;
}

function pad2(n: number,): string {
  return n.toString().padStart(2, "0",);
}

/** Value equality check of a `[task, onEnd]` pair. */
function predsInclude(
  preds: [Task | null, boolean,][],
  dt: Task,
  onEnd: boolean,
): boolean {
  for (const [task, flag,] of preds) {
    if (task === dt && flag === onEnd) return true;
  }
  return false;
}
