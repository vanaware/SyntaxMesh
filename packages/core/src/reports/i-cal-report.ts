/**
 * ICalReport (phase 14.19.2) — report that produces an iCalendar file.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/ICalReport.rb`.
 * Every task yields a `VTODO`; non-milestone leaf tasks (when `novevents` is
 * explicitly `false`) also yield a `VEVENT`. Journal entries yield `VJOURNAL`
 * (journal storage belongs to phase 16, so its absence is handled defensively
 * here).
 *
 * ⚠️ Browser (ADR 027): `to_iCal()` returns the string; there is no disk write.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.19.2)
 */
import type { Report, } from "../model/report.ts";
import type { Task, } from "../model/task.ts";
import type { Resource, } from "../model/resource.ts";
import { PropertyList, } from "../model/property-list.ts";
import type { Query, } from "../query/query.ts";
import { TjTime, } from "../time/tj-time.ts";
import { AppConfig, } from "../app-config.ts";
import { ReportBase, } from "./report-base.ts";
import { Event, ICalendar, Journal, Todo, } from "../ical/mod.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/**
 * Structural view of `Project.journal`, which is only complete from phase 16
 * on. The report calls it defensively while the storage is missing.
 */
interface JournalSource {
  entriesByTask?(
    task: Task,
    start: unknown,
    end: unknown,
    hide: unknown,
  ): Array<{
    headline: string;
    date: TjTime;
    summary: unknown;
    details: unknown;
    author: Resource | null;
  }>;
}

/**
 * The `ical` generator: one `VTODO` per task, plus the optional `VEVENT` and
 * `VJOURNAL` entries.
 */
export class ICalReport extends ReportBase {
  private taskList!: PropertyList<Task>;
  private resourceList!: PropertyList<Resource>;
  private query!: Query;
  private ical: ICalendar;

  /**
   * Creates an iCalendar report.
   *
   * @param report Report definition being rendered.
   */
  constructor(report: Report,) {
    super(report,);
    this.ical = new ICalendar("",);
  }

  /** Fills the calendar with one `VTODO` per task and the optional extras. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();

    // Prepares the (filtered) task list.
    this.taskList = new PropertyList<Task>(this.project.tasks,);
    this.taskList.setSorting(
      (this.a("sortTasks",) as Array<[string, boolean, number,]>) ?? [],
    );
    this.taskList = this.filterTaskList(
      this.taskList,
      null,
      this.a("hideTask",) as never,
      this.a("rollupTask",) as never,
      this.a("openNodes",) as never,
    );
    this.taskList.sort();

    // Prepares the resource list.
    this.resourceList = new PropertyList<Resource>(this.project.resources,);
    this.resourceList.setSorting(
      (this.a("sortResources",) as Array<[string, boolean, number,]>) ?? [],
    );
    this.resourceList = this.filterResourceList(
      this.resourceList,
      null,
      this.a("hideResource",) as never,
      this.a("rollupResource",) as never,
      this.a("openNodes",) as never,
    );
    this.resourceList.sort();

    this.query = this.currentQuery().dup();

    this.ical = new ICalendar(
      `${AppConfig.packageName}-${String(this.project.get("projectid",),)}`,
    );
    // Creation date: the earliest of the project start and now.
    this.ical.creationDate = minTime(
      this.project.get("start",) as TjTime,
      TjTime.now(),
    );
    // Last modification: the 'now' date of the project.
    this.ical.lastModified = this.project.get("now",) as TjTime;

    // Only the first requested scenario is considered.
    const scenarios = (this.a("scenarios",) as number[]) ?? [];
    const scenarioIdx = scenarios[0] ?? 0;
    const allowEvents = noEventsDisabled(this.report,);

    const uidMap = new Map<Task, string>();
    for (const task of this.taskList.toArray()) {
      const uid = `${
        String(
          task.getForScenario("projectid", scenarioIdx,),
        )
      }-${task.fullId}`;
      const todo = new Todo(
        this.ical,
        uid,
        task.name,
        task.getForScenario("start", scenarioIdx,) as TjTime,
        task.getForScenario("end", scenarioIdx,) as TjTime,
      );
      uidMap.set(task, todo.uid,);

      this.query.property = task;
      this.query.attributeId = "complete";
      this.query.scenarioIdx = scenarioIdx;
      this.query.process();
      todo.percentComplete = Math.trunc(this.query.to_num() ?? 0,);

      // Converts the TJ priority (1-1000) to iCalendar's (0-9).
      const priority =
        (task.getForScenario("priority", scenarioIdx,) as number) ?? 500;
      todo.priority = Math.trunc((priority - 1) / 100,);

      const parentUid = task.parent ? uidMap.get(task.parent as Task,) : null;
      if (task.parent && parentUid) todo.relatedTo = parentUid;

      const note = task.get("note",);
      const noteStr = note ? richTextToString(note,) : null;
      if (noteStr) todo.description = noteStr;

      // Organizer: first responsible resource with an email, if reported.
      const responsible =
        (task.getForScenario("responsible", scenarioIdx,) as Resource[]) ??
          [];
      let organizer: Resource | null = null;
      if (responsible.length > 0) {
        organizer = responsible[0] ?? null;
        const email = organizer?.get("email",);
        if (organizer && this.resourceList.includes(organizer,) && email) {
          todo.setOrganizer(organizer.name, String(email,),);
        }
      }

      // Assigned resources become attendees.
      const attendees: Resource[] = [];
      const assigned = (task.getForScenario(
        "assignedresources",
        scenarioIdx,
      ) as Resource[]) ??
        [];
      for (const resource of assigned) {
        if (!this.resourceList.includes(resource,)) continue;
        const email = resource.get("email",);
        if (!email) continue;
        attendees.push(resource,);
        todo.addAttendee(resource.name, String(email,),);
      }

      // Extra VEVENT for non-milestone leaves.
      const milestone = task.getForScenario("milestone", scenarioIdx,);
      if (task.leaf() && !milestone && allowEvents) {
        const event = new Event(
          this.ical,
          uid,
          task.name,
          task.getForScenario("start", scenarioIdx,) as TjTime,
          task.getForScenario("end", scenarioIdx,) as TjTime,
        );
        if (noteStr) event.description = noteStr;
        if (organizer) {
          event.setOrganizer(
            organizer.name,
            String(organizer.get("email",) ?? "",),
          );
        }
        for (const attendee of attendees) {
          event.addAttendee(
            attendee.name,
            String(attendee.get("email",) ?? "",),
          );
        }
      }

      // VJOURNAL for the journal entries of the task (phase 16).
      this.generateJournals(task, uidMap, scenarioIdx,);
    }
  }

  /**
   * Emits the `VJOURNAL` entries of one task.
   *
   * @param task Task whose journal entries are exported.
   * @param uidMap UID already assigned to each task.
   * @param scenarioIdx Index of the reported scenario.
   */
  private generateJournals(
    task: Task,
    uidMap: Map<Task, string>,
    scenarioIdx: number,
  ): void {
    void scenarioIdx;
    // `journal` is a field of `Project` (not a `get()` attribute); the per-task
    // access (`entriesByTask`) belongs to phase 16, so it is handled
    // defensively.
    const journal = this.project.journal as unknown as JournalSource | null;
    if (!journal || typeof journal.entriesByTask !== "function") {
      // Journal storage belongs to phase 16; without it there is no VJOURNAL.
      return;
    }
    const entries = journal.entriesByTask(
      task,
      this.a("start",),
      this.a("end",),
      this.a("hideJournalEntry",),
    ) ?? [];
    for (const entry of entries) {
      const j = new Journal(
        this.ical,
        `${String(task.getForScenario("projectid", scenarioIdx,),)}-` +
          task.fullId,
        entry.headline,
        entry.date,
      );
      j.relatedTo = uidMap.get(task,) ?? null;
      j.description = richTextToString(entry.summary,) +
        richTextToString(entry.details,);
      const author = entry.author;
      if (author && this.resourceList.includes(author,)) {
        const email = author.get("email",);
        if (email) j.setOrganizer(author.name, String(email,),);
      }
    }
  }

  /** Renders the intermediate format as an iCalendar string (CRLF). */
  to_iCal(): string {
    return this.ical.to_s();
  }
}

/** Ruby: `VEVENT`s are only generated when `novevents` was explicitly set to `false`. */
function noEventsDisabled(report: Report,): boolean {
  if (!report.provided("novevents",)) return false;
  const value = report.get("novevents",);
  const bool = Array.isArray(value,) ? value[0] : value;
  return bool === false;
}

/** `to_s` of a RichText value (or a plain string). */
function richTextToString(value: unknown,): string {
  if (value === null || value === undefined) return "";
  const maybe = value as { to_s?: () => string };
  if (typeof maybe.to_s === "function") return maybe.to_s();
  return String(value,);
}

function minTime(a: TjTime, b: TjTime,): TjTime {
  return a.compareTo(b,) <= 0 ? a : b;
}

// Registers the `ical` content in the factory (14.11).
registerContentFactory(
  "ical",
  (report: unknown,): ICalReport => new ICalReport(report as Report,),
);
