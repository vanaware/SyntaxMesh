/**
 * ICalReport (Fase 14.19.2) — relatório que gera um arquivo iCalendar.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/ICalReport.rb`. Para
 * cada tarefa gera um `VTODO`; para tarefas-folha não-milestone (quando
 * `novevents` é explicitamente `false`) gera um `VEVENT` adicional. As entradas
 * de `journal` geram `VJOURNAL` (o armazenamento de journal é Fase 16; aqui é
 * tratado de forma defensiva quando indisponível).
 *
 * ⚠️ Browser (ADR 027): `to_iCal()` retorna a string; nenhuma escrita a disco.
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
import { Event, ICalendar, Journal, Todo, } from "./i-calendar.ts";
import { registerContentFactory, } from "../model/report-content.ts";

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

export class ICalReport extends ReportBase {
  private taskList!: PropertyList<Task>;
  private resourceList!: PropertyList<Resource>;
  private query!: Query;
  private ical: ICalendar;

  constructor(report: Report,) {
    super(report,);
    this.ical = new ICalendar("",);
  }

  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();

    // Prepara a lista de tarefas (filtrada).
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

    // Prepara a lista de recursos.
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
    // Data de criação: o mais antigo entre o início do projeto e agora.
    this.ical.creationDate = minTime(
      this.project.get("start",) as TjTime,
      TjTime.now(),
    );
    // Última modificação: a data 'now' do projeto.
    this.ical.lastModified = this.project.get("now",) as TjTime;

    // Consideramos apenas o primeiro cenário solicitado.
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

      // Converte a prioridade TJ (1-1000) para iCalendar (0-9).
      const priority =
        (task.getForScenario("priority", scenarioIdx,) as number) ?? 500;
      todo.priority = Math.trunc((priority - 1) / 100,);

      const parentUid = task.parent ? uidMap.get(task.parent as Task,) : null;
      if (task.parent && parentUid) todo.relatedTo = parentUid;

      const note = task.get("note",);
      const noteStr = note ? richTextToString(note,) : null;
      if (noteStr) todo.description = noteStr;

      // Organizador: primeiro responsável com email, se reportado.
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

      // Recursos atribuídos viram participantes (attendees).
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

      // VEVENT adicional para folhas não-milestone.
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

      // VJOURNAL para as entradas de journal da tarefa (Fase 16).
      this.generateJournals(task, uidMap, scenarioIdx,);
    }
  }

  private generateJournals(
    task: Task,
    uidMap: Map<Task, string>,
    scenarioIdx: number,
  ): void {
    void scenarioIdx;
    // `journal` é um campo do Project (não um atributo `get()`); o acesso por
    // tarefa (`entriesByTask`) é Fase 16, então tratamos defensivamente.
    const journal = this.project.journal as unknown as JournalSource | null;
    if (!journal || typeof journal.entriesByTask !== "function") {
      // Armazenamento de journal é Fase 16; sem ele, não há VJOURNAL.
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

  /** Converte o formato intermediário em uma string iCalendar (CRLF). */
  to_iCal(): string {
    return this.ical.to_s();
  }
}

/** Ruby: VEVENTs só são gerados quando `novevents` foi explicitamente posto a `false`. */
function noEventsDisabled(report: Report,): boolean {
  if (!report.provided("novevents",)) return false;
  const value = report.get("novevents",);
  const bool = Array.isArray(value,) ? value[0] : value;
  return bool === false;
}

/** `to_s` de RichText (ou string simples). */
function richTextToString(value: unknown,): string {
  if (value === null || value === undefined) return "";
  const maybe = value as { to_s?: () => string };
  if (typeof maybe.to_s === "function") return maybe.to_s();
  return String(value,);
}

function minTime(a: TjTime, b: TjTime,): TjTime {
  return a.compareTo(b,) <= 0 ? a : b;
}

// Registra o conteúdo de `ical` na fábrica (14.11).
registerContentFactory(
  "ical",
  (report: unknown,): ICalReport => new ICalReport(report as Report,),
);
