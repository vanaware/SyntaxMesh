/**
 * MspXmlRE (Fase 14.18.3) — exporta dados do projeto em Microsoft Project XML.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/MspXmlRE.rb`. Devido a
 * limitações do MS Project e desta implementação, apenas um subconjunto dos
 * dados núcleo é exportado (projeto já escalonado, com atribuição recurso/tarefa).
 *
 * ⚠️ Browser (ADR 027): `to_mspxml()` retorna a string; nenhuma escrita a disco.
 * Usa o subconjunto mínimo de nós XML de `xml-node.ts` (o `XMLElement` completo
 * é Fase 17). A serialização é compacta (sem a indentação byte-a-byte do Ruby);
 * os testes verificam estrutura/elementos, não a igualdade byte exata.
 *
 * **14C.4 (Fase 14 Complemento):** além do subconjunto do Ruby, exportamos as
 * entidades que só existem no SyntaxMesh — recursos de material e de custo,
 * `<Assignment>` com `Units`/`Cost` e série de custo, `<ActualWork>`/
 * `<RemainingWork>` (`effortdone`), `<Notes>`, `<Exceptions>` de calendário e
 * `<LinkLag>`/`<LagFormat>`. Essas extensões **não têm oracle** no tj3: são
 * validadas por testes estruturais e pelo snapshot `reports-extensions.golden`.
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
  XMLDocument,
  XMLElement,
  XMLNamedText,
} from "./xml-node.ts";

/** Formato de data/hora do MSP XML (`%Y-%m-%dT%H:%M:%S`). */
const TIMEFORMAT = "%Y-%m-%dT%H:%M:%S";

/** Mapa `loadUnit` → código `WorkFormat` do MSP (fiel a Ruby). */
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
 * `<Resource><Type>` — esquema MSPDI (2007), `Type` sob `Resource`:
 * `0` = material (consumível), `1` = trabalho (pessoas/equipamentos),
 * `2` = custo.
 *
 * ⚠️ `docs/tj3-engine/mspdi.md` §3.1 invertia material (2) e custo (0) —
 * corrigido em 2026-11-01; a tabela oficial do esquema (e o `MspXmlRE.rb`, que
 * já usa `1` para trabalho) prevalece. Ver 14C.4.2 na tabela de evidências.
 */
export const RESOURCE_TYPE_MATERIAL = "0";
export const RESOURCE_TYPE_WORK = "1";
export const RESOURCE_TYPE_COST = "2";

/** `<DurationFormat>`/`<LagFormat>` (§2.2): `7` = dias úteis, `8` = dias corridos. */
export const DURATION_FORMAT_DAYS = "7";
export const DURATION_FORMAT_ELAPSED_DAYS = "8";

/** `<TimephasedData><Type>`: `1` = trabalho restante, `6` = custo real. */
const TIMEPHASED_WORK = "1";
const TIMEPHASED_COST = "6";

/** `<TimephasedData><Unit>`: `2` = dias (valor em `PT{H}H{M}M{S}S`). */
const TIMEPHASED_UNIT = "2";

/** Converte um valor de atributo em string (respeita `to_s` de RichText). */
function asString(value: unknown,): string {
  if (value === null || value === undefined) return "";
  const maybe = value as { to_s?: () => string };
  if (typeof maybe.to_s === "function") return maybe.to_s();
  return String(value,);
}

/**
 * Formata um número como decimal MSPDI.
 *
 * O Ruby serializa `Float#to_s` (`1.0`, `0.0`, `62.5`); o JS escreveria `1`,
 * `0`. O MS Project espera taxas/unidades decimais (mspdi §3.2/§4.1), então
 * inteiros ganham o sufixo `.0` para casar com o oracle tj3.
 */
export function asDecimal(value: number,): string {
  if (!Number.isFinite(value,)) return String(value,);
  return Number.isInteger(value,) ? `${value}.0` : String(value,);
}

/**
 * Formata um valor **monetário** como decimal MSPDI, arredondado a centavos.
 *
 * As séries `TimephasedData` de custo distribuem o total do período por
 * fatias (`200/3`), e a aritmética binária do JS vazaria ruído
 * (`166.66666666666669`) para o XML. Moeda no MSPDI é decimal — duas casas.
 */
export function asMoney(value: number,): string {
  return asDecimal(Math.round(value * 100,) / 100,);
}

/** Recurso material derivado de um `Material` (14C.4.2). */
interface MaterialResource {
  uid: string;
  material: Material;
}

/** Recurso de custo derivado de um `Charge` de tarefa (14C.4.4). */
interface CostResource {
  uid: string;
  task: Task;
  charge: Charge;
  index: number;
}

export class MspXmlRE extends ReportBase {
  private readonly scenarioIdx: number;
  /**
   * Cenário usado como linha de base (`baseline <scenario>`, 14C.10) ou `null`.
   * Com ele o documento ganha `<Baseline>` do projeto e por tarefa; sem ele a
   * saída é idêntica à anterior (oracle `mspdi.golden.json` intocado).
   */
  private readonly baselineIdx: number | null;
  private calendarUIDs: Record<string, string> = {};
  private query!: Query;
  private resourceList!: PropertyList<Resource>;
  private taskList!: PropertyList<Task>;
  private file!: XMLDocument;
  /** Recursos material/custo (espaço de UID global, após os humanos). */
  private materialResources: MaterialResource[] = [];
  private costResources: CostResource[] = [];

  constructor(report: Report,) {
    super(report,);
    // Este tipo de relatório suporta apenas um cenário: usa o primeiro.
    const scenarios = (this.a("scenarios",) as number[]) ?? [];
    this.scenarioIdx = scenarios[0] ?? 0;
    const baseline = this.a("baseline",);
    this.baselineIdx = typeof baseline === "number" ? baseline : null;
  }

  /** Não há formato intermediário para o exportador MSP. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
  }

  /** Retorna os dados do projeto em Microsoft Project XML. */
  to_mspxml(): string {
    this.query = this.currentQuery().dup();

    // Prepara a lista de recursos.
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

    // Prepara a lista de tarefas. O MSP exige ordem de 'árvore'; ignoramos os
    // critérios de ordenação do usuário de propósito.
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

    // Recursos material/custo derivados das entidades SyntaxMesh (14C.4.2–4.4).
    // A lista é vazia quando o projeto não usa materiais/charges, de modo que o
    // subconjunto fiel ao `MspXmlRE.rb` permanece inalterado (oracle 14C.4.14).
    this.collectExtensionResources();

    this.file = new XMLDocument();
    this.file.push(
      new XMLBlob(
        '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>',
      ),
    );
    this.file.push(
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
    this.file.push(project,);

    const calendars = this.generateProjectAttributes(project,);
    if (this.baselineIdx !== null) this.generateProjectBaseline(project,);
    this.generateTasks(project,);
    this.generateResources(project, calendars,);
    this.generateAssignments(project,);

    return this.file.to_s();
  }

  // ------------------------------------------------------------------
  // Seções do documento
  // ------------------------------------------------------------------

  private generateProjectAttributes(p: XMLElement,): XMLElement {
    p.push(new XMLNamedText("14", "SaveVersion",),);
    p.push(new XMLNamedText(this.report.name + ".xml", "Name",),);
    p.push(
      new XMLNamedText(TjTime.now().to_s(TIMEFORMAT,), "CreationDate",),
    );
    p.push(new XMLNamedText("1", "ScheduleFromStart",),);
    p.push(
      new XMLNamedText(
        (this.project.get("start",) as TjTime).to_s(TIMEFORMAT,),
        "StartDate",
      ),
    );
    p.push(
      new XMLNamedText(
        (this.project.get("end",) as TjTime).to_s(TIMEFORMAT,),
        "FinishDate",
      ),
    );
    p.push(new XMLNamedText("09:00:00", "DefaultStartTime",),);
    p.push(new XMLNamedText("17:00:00", "DefaultFinishTime",),);
    p.push(new XMLNamedText("1", "CalendarUID",),);
    p.push(
      new XMLNamedText(
        Math.floor(this.project.dailyWorkingHours() * 60,).toString(),
        "MinutesPerDay",
      ),
    );
    p.push(
      new XMLNamedText(
        Math.floor(
          this.project.weeklyWorkingDays() *
            this.project.dailyWorkingHours() * 60,
        ).toString(),
        "MinutesPerWeek",
      ),
    );
    p.push(
      new XMLNamedText(
        String(this.project.yearlyWorkingDays() / 12,),
        "DaysPerMonth",
      ),
    );
    p.push(
      new XMLNamedText(
        (this.project.get("now",) as TjTime).to_s(TIMEFORMAT,),
        "CurrentDate",
      ),
    );
    p.push(
      new XMLNamedText(
        (this.project.get("now",) as TjTime).to_s(TIMEFORMAT,),
        "StatusDate",
      ),
    );
    const loadUnit = String(this.a("loadUnit",) ?? "days",);
    p.push(
      new XMLNamedText(
        String(LOAD_UNITS_MAP[loadUnit] ?? 3,),
        "WorkFormat",
      ),
    );
    p.push(new XMLNamedText("1", "NewTasksAreManual",),);
    p.push(new XMLNamedText("0", "SpreadPercentComplete",),);
    const rate = asDecimal(
      (this.project.get("rate",) as number) /
        this.project.dailyWorkingHours(),
    );
    p.push(new XMLNamedText(rate, "StandardRate",),);
    p.push(new XMLNamedText(rate, "OvertimeRate",),);
    p.push(
      new XMLNamedText(
        asString(this.project.get("currency",),),
        "CurrencySymbol",
      ),
    );
    p.push(
      new XMLNamedText(
        asString(this.project.get("currency",),),
        "CurrencyCode",
      ),
    );

    const calendars = new XMLElement("Calendars",);
    p.push(calendars,);
    this.generateCalendar(
      calendars,
      this.project.get("workinghours",) as WorkingHours,
      "Standard",
      this.projectLeaves(),
    );

    return calendars;
  }

  private generateTasks(project: XMLElement,): void {
    const tasks = new XMLElement("Tasks",);
    project.push(tasks,);
    for (const task of this.taskList.toArray()) {
      this.generateTask(tasks, task,);
    }
  }

  /**
   * `<Baseline>` do **projeto** (`Number` 0), a partir das datas agendadas no
   * cenário de linha de base (adendo §10 / 14C.10.4).
   *
   * O intervalo vem do primeiro início e do último fim entre as tarefas
   * agendadas; o custo é a soma dos `CostEvent` do cenário quando existirem.
   * Sem nenhuma tarefa agendada o elemento é omitido com aviso — o exportador
   * nunca inventa datas.
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
   * Datas agendadas de `task` no cenário `scIdx`, ou `null` quando o cenário
   * não foi escalonado para ela.
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
   * Custo do cenário `scIdx` (Σ `CostEvent` do cenário), restrito a `task`
   * quando fornecida. `null` quando não há eventos — o `<Cost>` é omitido.
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

  /** Anexa `<Baseline Number="0">` com `Start`/`Finish` e `Cost` opcional. */
  private appendBaseline(
    parent: XMLElement,
    start: TjTime,
    end: TjTime,
    cost: number | null,
  ): void {
    const b = new XMLElement("Baseline",);
    parent.push(b,);
    b.push(new XMLNamedText("0", "Number",),);
    b.push(new XMLNamedText(start.to_s(TIMEFORMAT,), "Start",),);
    b.push(new XMLNamedText(end.to_s(TIMEFORMAT,), "Finish",),);
    if (cost !== null) {
      b.push(new XMLNamedText(asDecimal(cost,), "Cost",),);
    }
  }

  private generateResources(
    project: XMLElement,
    calendars: XMLElement,
  ): void {
    const resources = new XMLElement("Resources",);
    project.push(resources,);
    for (const resource of this.resourceList.toArray()) {
      this.generateResource(resources, resource, calendars,);
    }
    // Recursos material e custo ocupam UIDs após os recursos humanos.
    for (const ref of this.materialResources) {
      this.generateMaterialResource(resources, ref,);
    }
    for (const ref of this.costResources) {
      this.generateCostResource(resources, ref,);
    }
  }

  private generateAssignments(project: XMLElement,): void {
    const assignments = new XMLElement("Assignments",);
    project.push(assignments,);
    let i = 0;
    for (const task of this.taskList.toArray()) {
      // Só geramos assignments para folhas e contêineres enrollados.
      if (!this.inAssignmentScope(task,)) continue;
      for (const resource of task.assignedResources(this.scenarioIdx,)) {
        this.generateAssignment(assignments, task, resource, i,);
        i++;
      }
      // Materiais alocados (14C.4.3): Units = quantidade, Cost = qtd × preço.
      for (const allocation of this.taskMaterialAllocations(task,)) {
        const ref = this.materialResources.find((r,) =>
          r.material === allocation.material
        );
        if (!ref) continue;
        this.generateMaterialAssignment(assignments, task, allocation, ref, i,);
        i++;
      }
      // Charges flat da tarefa (14C.4.4): recurso de custo com `<Cost>` direto.
      for (const ref of this.costResources) {
        if (ref.task !== task) continue;
        this.generateCostAssignment(assignments, task, ref, i,);
        i++;
      }
    }
  }

  private generateCalendar(
    calendars: XMLElement,
    workinghours: WorkingHours,
    name: string,
    exceptions: Leave[] = [],
  ): void {
    const cal = new XMLElement("Calendar",);
    calendars.push(cal,);
    const uid = String(Object.keys(this.calendarUIDs,).length,);
    this.calendarUIDs[name] = uid;
    cal.push(new XMLNamedText(uid, "UID",),);
    cal.push(new XMLNamedText(name, "Name",),);
    cal.push(new XMLNamedText("1", "IsBaseCalendar",),);
    cal.push(new XMLNamedText("-1", "BaseCalendarUID",),);

    const weekdays = new XMLElement("WeekDays",);
    cal.push(weekdays,);
    let d = 1;
    for (const day of workinghours.days) {
      const weekday = new XMLElement("WeekDay",);
      weekdays.push(weekday,);
      weekday.push(new XMLNamedText(String(d,), "DayType",),);
      d++;
      if (day.length === 0) {
        weekday.push(new XMLNamedText("0", "DayWorking",),);
      } else {
        weekday.push(new XMLNamedText("1", "DayWorking",),);
        const workingtimes = new XMLElement("WorkingTimes",);
        weekday.push(workingtimes,);
        for (const iv of day) {
          const worktime = new XMLElement("WorkingTime",);
          workingtimes.push(worktime,);
          worktime.push(
            new XMLNamedText(daytimeToS(iv[0],), "FromTime",),
          );
          worktime.push(new XMLNamedText(daytimeToS(iv[1],), "ToTime",),);
        }
      }
    }

    // Feriados/licenças do projeto viram `<Exception>` do calendário base
    // (14C.4.9). O `MspXmlRE.rb` não emite este bloco: mantemos apenas no
    // calendário base e somente quando `Project.leaves` tem entradas.
    if (exceptions.length > 0) {
      const exs = new XMLElement("Exceptions",);
      cal.push(exs,);
      exceptions.forEach((leave, idx,) => {
        const from = this.leaveBound(leave, "start",);
        const to = this.leaveBound(leave, "end",);
        if (!from || !to) return;
        const ex = new XMLElement("Exception",);
        exs.push(ex,);
        ex.push(new XMLNamedText(String(idx + 1,), "Index",),);
        const reason = leave.reason && leave.reason !== ""
          ? `${leave.type}: ${leave.reason}`
          : leave.type;
        ex.push(new XMLNamedText(reason, "Name",),);
        const period = new XMLElement("TimePeriod",);
        ex.push(period,);
        period.push(new XMLNamedText(from.to_s(TIMEFORMAT,), "FromDate",),);
        period.push(new XMLNamedText(to.to_s(TIMEFORMAT,), "ToDate",),);
        ex.push(new XMLNamedText("0", "DayWorking",),);
      },);
    }
  }

  private generateTask(tasks: XMLElement, task: Task,): void {
    const sc = this.scenarioIdx;
    this.query.property = task;
    task.scenarioData(sc,).calcCompletion();
    const percentComplete = (task.getForScenario("complete", sc,) as number) ??
      0;

    const t = new XMLElement("Task",);
    tasks.push(t,);
    const index = String(task.get("index",),);
    t.push(new XMLNamedText(index, "UID",),);
    t.push(new XMLNamedText(index, "ID",),);
    t.push(new XMLNamedText("1", "Active",),);
    t.push(new XMLNamedText("0", "Type",),);
    t.push(new XMLNamedText("0", "IsNull",),);
    t.push(new XMLNamedText(task.name, "Name",),);
    const bsi = asString(task.get("bsi",),);
    t.push(new XMLNamedText(bsi, "WBS",),);
    t.push(new XMLNamedText(bsi, "OutlineNumber",),);
    const taskroot = this.a("taskroot",) as Task | null;
    t.push(
      new XMLNamedText(
        String(task.level - (taskroot ? taskroot.level : 0),),
        "OutlineLevel",
      ),
    );
    t.push(
      new XMLNamedText(
        String(task.getForScenario("priority", sc,) ?? 0,),
        "Priority",
      ),
    );
    const start = task.getForScenario("start", sc,) as TjTime;
    const end = task.getForScenario("end", sc,) as TjTime;
    const startStr = start.to_s(TIMEFORMAT,);
    const endStr = end.to_s(TIMEFORMAT,);
    t.push(new XMLNamedText(startStr, "Start",),);
    t.push(new XMLNamedText(endStr, "Finish",),);
    t.push(new XMLNamedText(startStr, "ManualStart",),);
    t.push(new XMLNamedText(endStr, "ManualFinish",),);
    t.push(new XMLNamedText(startStr, "ActualStart",),);
    t.push(new XMLNamedText(endStr, "ActualFinish",),);
    t.push(new XMLNamedText("2", "ConstraintType",),);
    t.push(new XMLNamedText(startStr, "ConstraintDate",),);
    t.push(new XMLNamedText("3", "FixedCostAccrual",),);

    const note = task.get("note",);
    if (note) t.push(new XMLNamedText(asString(note,), "Notes",),);

    const responsible = this.responsibleNames(task, sc,);
    if (responsible !== "") {
      t.push(new XMLNamedText(responsible, "Contact",),);
    }

    if (task.container()) {
      const rollupTask = this.a("rollupTask",);
      t.push(new XMLNamedText(rollupTask ? "1" : "0", "Manual",),);
      const rolled = rollupTask
        ? (rollupTask as { eval: (q: unknown,) => boolean }).eval(this.query,)
        : false;
      t.push(new XMLNamedText(rolled ? "0" : "1", "Summary",),);
    } else {
      t.push(new XMLNamedText("1", "Manual",),);
      t.push(new XMLNamedText("0", "Summary",),);
      t.push(new XMLNamedText("0", "Estimated",),);
      // 7 = dias úteis; 8 = dias corridos (`ed`, mspdi §8).
      t.push(
        new XMLNamedText(
          this.durationFormatFor(task, start, end, sc,),
          "DurationFormat",
        ),
      );
      if (task.getForScenario("milestone", sc,)) {
        t.push(new XMLNamedText("1", "Milestone",),);
      } else {
        const duration = end.diff(start,);
        t.push(new XMLNamedText(durationToMsp(duration,), "Duration",),);
        t.push(new XMLNamedText(durationToMsp(duration,), "Work",),);
        t.push(new XMLNamedText("0", "Milestone",),);
        t.push(new XMLNamedText("1", "EffortDriven",),);
        const pct = String(Math.trunc(percentComplete,),);
        t.push(new XMLNamedText(pct, "PercentComplete",),);
        t.push(new XMLNamedText(pct, "PercentWorkComplete",),);
      }
      this.appendTaskProgress(t, task, sc, end,);
    }

    this.appendPredecessors(t, task, true,);
    this.appendPredecessors(t, task, false,);

    // `<Baseline>` por tarefa (14C.10.5): só quando o cenário de linha de base
    // tem datas agendadas para ela.
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
   * Anexa os `PredecessorLink` de uma lista de precedências (start ou end).
   * `fromStart` indica a semântica do tipo (startpreds vs endpreds).
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
      t.push(pl,);
      const canon = this.taskList.find(dt,) ?? dt;
      pl.push(
        new XMLNamedText(String(canon.get("index",),), "PredecessorUID",),
      );
      // startpreds: onEnd ? 1 (FS) : 3 (SS); endpreds: onEnd ? 0 : 2.
      const type = fromStart ? (onEnd ? "1" : "3") : (onEnd ? "0" : "2");
      pl.push(new XMLNamedText(type, "Type",),);
      this.appendLag(pl, task, canon, onEnd, fromStart,);
    }
  }

  /**
   * Emite `<LinkLag>`/`<LagFormat>` da dependência com lag (14C.4.11).
   *
   * A dependência vive no atributo `depends`/`precedes` do próprio nó, então
   * procuramos o par (tarefa, onEnd) na lista correspondente. `gaplength` é
   * tempo de trabalho (dias úteis → `LagFormat` 7); `gapduration` é tempo de
   * calendário (dias corridos → `LagFormat` 8). `<LinkLag>` é expresso em
   * décimos de minuto, como no esquema MSPDI.
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
      // `gapLength` é armazenado em slots (segundos ÷ granularidade).
      const gapSeconds = dep.gapLength * this.granularity();
      const days = gapSeconds / (this.project.dailyWorkingHours() * 3600);
      pl.push(
        new XMLNamedText(
          String(Math.round(days * dailyMinutes * 10,),),
          "LinkLag",
        ),
      );
      pl.push(new XMLNamedText(DURATION_FORMAT_DAYS, "LagFormat",),);
      return;
    }
    if (dep.gapDuration > 0) {
      const days = dep.gapDuration / (24 * 60 * 60);
      pl.push(
        new XMLNamedText(String(Math.round(days * 24 * 60 * 10,),), "LinkLag",),
      );
      pl.push(new XMLNamedText(DURATION_FORMAT_ELAPSED_DAYS, "LagFormat",),);
    }
  }

  private generateResource(
    resources: XMLElement,
    resource: Resource,
    calendars: XMLElement,
  ): void {
    // O MS Project só lida com lista plana de recursos; não exportamos grupos.
    if (!resource.leaf()) return;

    const sc = this.scenarioIdx;
    const r = new XMLElement("Resource",);
    resources.push(r,);
    r.push(new XMLNamedText(String(resource.get("index",),), "UID",),);
    // Cada recurso TJ é pessoa ou equipamento.
    r.push(new XMLNamedText(RESOURCE_TYPE_WORK, "Type",),);
    r.push(new XMLNamedText(resource.name, "Name",),);
    r.push(new XMLNamedText(resource.id, "Initials",),);
    const rate = asDecimal(
      (resource.getForScenario("rate", sc,) as number) /
        this.project.dailyWorkingHours(),
    );
    r.push(new XMLNamedText(rate, "StandardRate",),);
    r.push(new XMLNamedText(rate, "OvertimeRate",),);
    r.push(
      new XMLNamedText(
        asDecimal((resource.getForScenario("efficiency", sc,) as number) ?? 0,),
        "MaxUnits",
      ),
    );
    const email = resource.get("email",);
    if (email) r.push(new XMLNamedText(asString(email,), "EmailAddress",),);
    const note = resource.get("note",);
    if (note) r.push(new XMLNamedText(asString(note,), "Notes",),);
    if (resource.parent) {
      r.push(
        new XMLNamedText(
          asString((resource.parent as Resource).name,),
          "Group",
        ),
      );
    }
    // Gera um calendário para este recurso e atribui-o.
    const calName = `Calendar ${resource.name}`;
    this.generateCalendar(
      calendars,
      resource.getForScenario("workinghours", sc,) as WorkingHours,
      calName,
      this.resourceLeaves(resource, sc,),
    );
    r.push(
      new XMLNamedText(this.calendarUIDs[calName] ?? "0", "CalendarUID",),
    );
  }

  private generateAssignment(
    assignments: XMLElement,
    task: Task,
    resource: Resource,
    uid: number,
  ): void {
    const sc = this.scenarioIdx;
    const a = new XMLElement("Assignment",);
    assignments.push(a,);
    a.push(new XMLNamedText(String(uid,), "UID",),);
    a.push(
      new XMLNamedText(String(task.get("index",),), "TaskUID",),
    );
    a.push(
      new XMLNamedText(String(resource.get("index",),), "ResourceUID",),
    );
    a.push(
      new XMLNamedText(
        asDecimal((resource.getForScenario("efficiency", sc,) as number) ?? 0,),
        "Units",
      ),
    );
    const taskStart = task.getForScenario("start", sc,) as TjTime;
    const taskEnd = task.getForScenario("end", sc,) as TjTime;
    a.push(new XMLNamedText(taskStart.to_s(TIMEFORMAT,), "start",),);
    a.push(new XMLNamedText(taskEnd.to_s(TIMEFORMAT,), "finish",),);
    a.push(new XMLNamedText("100.0", "Cost",),);
    a.push(new XMLNamedText("8", "WorkContour",),);
    // O PercentWorkComplete deve ser 0 para o MS Project não ignorar o trabalho.
    a.push(new XMLNamedText("0", "PercentWorkComplete",),);
    const responsible = this.responsibleNames(task, sc,);
    if (responsible !== "") {
      a.push(new XMLNamedText(responsible, "AssnOwner",),);
    }
    this.appendAssignmentProgress(a, task, resource, taskStart, taskEnd, sc,);

    // Configura a query para esta tarefa e recurso.
    this.query.property = resource;
    this.query.scopeProperty = task;
    this.query.attributeId = "effort";
    this.query.scenarioIdx = sc;
    this.query.start = taskStart;
    this.query.end = taskEnd;
    this.query.process();

    const reportStart = this.a("start",) as TjTime;
    const reportEnd = this.a("end",) as TjTime;

    // Dados timephased por dia: o trabalho de cada dia entre início e fim.
    let t = taskStart.midnight();
    const tEnd = taskEnd;
    while (t.lessThan(tEnd,)) {
      const tn = t.sameTimeNextDay();
      // Garante que os intervalos ficam dentro dos limites da tarefa e do
      // relatório.
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
      a.push(td,);
      td.push(new XMLNamedText(String(uid,), "UID",),);
      // O Type deve ser 1; caso contrário o MS Project demora muito a carregar.
      td.push(new XMLNamedText(TIMEPHASED_WORK, "Type",),);
      td.push(new XMLNamedText(tc.to_s(TIMEFORMAT,), "Start",),);
      td.push(
        new XMLNamedText(tnc.subSeconds(1,).to_s(TIMEFORMAT,), "Finish",),
      );
      td.push(new XMLNamedText(TIMEPHASED_UNIT, "Unit",),);
      td.push(
        new XMLNamedText(durationToMsp(workSeconds,), "Value",),
      );
      t = tn;
    }
  }

  /** Nomes dos responsáveis da tarefa, unidos por vírgula. */
  private responsibleNames(task: Task, sc: number,): string {
    const list = (task.getForScenario("responsible", sc,) as Resource[]) ??
      [];
    return list.map((r,) => r.name).join(", ",);
  }

  /**
   * Trabalho efetivo (em dias) do recurso na tarefa dentro de `[start, end)`.
   *
   * O Ruby obtém o mesmo número via `Query#to_num`, que despacha para
   * `ResourceScenario#query_effort` → `getEffectiveWork(startIdx, endIdx,
   * scopeProperty)`. Chamamos o método do modelo diretamente: o `query_effort`
   * concreto ainda não está portado (Fase 11) e devolvia 0, zerando toda a
   * série `TimephasedData` (14C.4.8).
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
  // Extensões SyntaxMesh (14C.4.2–4.9)
  // ------------------------------------------------------------------

  /**
   * Coleta os recursos material/custo do relatório (14C.4.2/14C.4.4).
   *
   * Os UIDs continuam o maior UID dos recursos humanos: o MSPDI exige um
   * espaço de UID único em `<Resources>`.
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

  /** Maior UID entre os recursos humanos exportados (folhas). */
  private maxResourceUid(): number {
    let max = 0;
    for (const resource of this.resourceList.toArray()) {
      if (!resource.leaf()) continue;
      max = Math.max(max, Number(resource.get("index",) ?? 0,),);
    }
    return max;
  }

  /**
   * A tarefa recebe `<Assignment>`? Folhas sim; contêineres só com `rollupTask`.
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

  /** Alocações de material da tarefa no cenário do relatório. */
  private taskMaterialAllocations(task: Task,): MaterialAllocation[] {
    return (task.getForScenario("materialallocations", this.scenarioIdx,) ??
      []) as MaterialAllocation[];
  }

  /** Charges flat declarados na tarefa (`charge`, cenário do relatório). */
  private taskCharges(task: Task,): Charge[] {
    return (task.getForScenario("charge", this.scenarioIdx,) ?? []) as Charge[];
  }

  /** `hideMaterial` (14C.4.10/14C.6.8) aplicado a um material. */
  private hiddenMaterial(material: Material,): boolean {
    return this.hiddenBy("hideMaterial", material,);
  }

  /** Granularidade do scoreboard (segundos por slot), usada para converter
   * `effort`/`effortdone`/`gapLength` (armazenados em slots) em segundos. */
  private granularity(): number {
    return (this.project.get("scheduleGranularity",) as number | null) ?? 3600;
  }

  /** `<Exception>` do calendário base: leaves/feriados do projeto (14C.4.9). */
  private projectLeaves(): Leave[] {
    return (this.project.get("leaves",) ?? []) as Leave[];
  }

  /** Leaves/feriados do recurso (viram `<Exception>` do calendário dele). */
  private resourceLeaves(resource: Resource, sc: number,): Leave[] {
    return (resource.getForScenario("leaves", sc,) ?? []) as Leave[];
  }

  /**
   * Início/fim de um leave como `TjTime`.
   *
   * `Leave.interval` pode ser um `ScoreboardInterval` (índices de slot); nesse
   * caso a data sai de `sbStart + índice × slotDuration`.
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

  /** `<Resource>` de um `Material` (14C.4.2). */
  private generateMaterialResource(
    resources: XMLElement,
    ref: MaterialResource,
  ): void {
    const material = ref.material;
    const r = new XMLElement("Resource",);
    resources.push(r,);
    r.push(new XMLNamedText(ref.uid, "UID",),);
    r.push(new XMLNamedText(RESOURCE_TYPE_MATERIAL, "Type",),);
    r.push(new XMLNamedText(asString(material.name,), "Name",),);
    r.push(new XMLNamedText(material.id, "Initials",),);
    // §3.2: rótulo de unidade e preço unitário entram em MaterialLabel/rate.
    r.push(new XMLNamedText(material.unitValue(), "MaterialLabel",),);
    r.push(
      new XMLNamedText(asDecimal(material.unitPriceValue(),), "StandardRate",),
    );
    const note = material.get("note",);
    if (note) r.push(new XMLNamedText(asString(note,), "Notes",),);
  }

  /** `<Resource>` de custo para um `Charge` flat da tarefa (14C.4.4). */
  private generateCostResource(
    resources: XMLElement,
    ref: CostResource,
  ): void {
    const r = new XMLElement("Resource",);
    resources.push(r,);
    r.push(new XMLNamedText(ref.uid, "UID",),);
    r.push(new XMLNamedText(RESOURCE_TYPE_COST, "Type",),);
    r.push(
      new XMLNamedText(`Charges ${ref.task.id} #${ref.index + 1}`, "Name",),
    );
    r.push(new XMLNamedText(`charge${ref.index + 1}`, "Initials",),);
    // Sem taxa: o valor vai direto em `<Cost>` da atribuição (§3.2).
    r.push(
      new XMLNamedText(asDecimal(ref.charge.amount,), "StandardRate",),
    );
    // O modelo não marca recursos orçamentários: um charge é despesa.
    r.push(new XMLNamedText("0", "IsBudget",),);
  }

  /** `<Assignment>` de material: `Units` = quantidade, `Cost` = qtd × preço. */
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
    assignments.push(a,);
    a.push(new XMLNamedText(String(uid,), "UID",),);
    a.push(new XMLNamedText(String(task.get("index",),), "TaskUID",),);
    a.push(new XMLNamedText(ref.uid, "ResourceUID",),);
    a.push(new XMLNamedText(asDecimal(allocation.quantity,), "Units",),);
    a.push(new XMLNamedText(start.to_s(TIMEFORMAT,), "start",),);
    a.push(new XMLNamedText(end.to_s(TIMEFORMAT,), "finish",),);
    a.push(
      new XMLNamedText(
        asMoney(allocation.quantity * unitPrice,),
        "Cost",
      ),
    );
    a.push(new XMLNamedText("0", "PercentWorkComplete",),);

    // Série de custo por dia (§7.1): `quantityIn` depende de `attach()` (não
    // chamado pelo scheduler), então distribuímos pela ordem cronológica.
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

  /** `<Assignment>` de custo: `Cost` direto do charge (14C.4.4). */
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
    assignments.push(a,);
    a.push(new XMLNamedText(String(uid,), "UID",),);
    a.push(new XMLNamedText(String(task.get("index",),), "TaskUID",),);
    a.push(new XMLNamedText(ref.uid, "ResourceUID",),);
    a.push(new XMLNamedText(asDecimal(1,), "Units",),);
    a.push(new XMLNamedText(start.to_s(TIMEFORMAT,), "start",),);
    a.push(new XMLNamedText(end.to_s(TIMEFORMAT,), "finish",),);
    a.push(new XMLNamedText(asMoney(ref.charge.amount,), "Cost",),);
    a.push(new XMLNamedText("0", "PercentWorkComplete",),);

    // `Charge#turnover` distribui onStart/onEnd/perDiem por período.
    for (const [ps, pe,] of this.dailyPeriods(start, end,)) {
      const amount = ref.charge.turnover(new TimeInterval(ps, pe,),);
      if (amount === 0) continue;
      this.appendCostTimephased(a, uid, ps, pe, amount,);
    }
  }

  /**
   * Fração da quantidade de material consumida em cada período.
   *
   * `onstart`/`onend` concentram tudo na primeira/última fatia; os demais
   * modificadores são distribuídos uniformemente (sem `DistributionContext`).
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

  /** `<TimephasedData>` de custo por período (`Type` 6, §7.1). */
  private appendCostTimephased(
    a: XMLElement,
    uid: number,
    start: TjTime,
    end: TjTime,
    cost: number,
  ): void {
    const td = new XMLElement("TimephasedData",);
    a.push(td,);
    td.push(new XMLNamedText(String(uid,), "UID",),);
    td.push(new XMLNamedText(TIMEPHASED_COST, "Type",),);
    td.push(new XMLNamedText(start.to_s(TIMEFORMAT,), "Start",),);
    td.push(
      new XMLNamedText(end.subSeconds(1,).to_s(TIMEFORMAT,), "Finish",),
    );
    td.push(new XMLNamedText(TIMEPHASED_UNIT, "Unit",),);
    td.push(new XMLNamedText(asMoney(cost,), "Value",),);
  }

  /** Fatias diárias de `[start, end)` clampadas ao intervalo do relatório. */
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
   * `<DurationFormat>` da tarefa folha (§2.2/§8, 14C.4.5).
   *
   * Uma duração é “corrida” (`8`) quando a tarefa não consome tempo
   * não-produtivo: o intervalo de calendário é igual ao esforço — típico de
   * calendários 24×7. O guarda de um dia útil evita classificar tarefas
   * curtas (8 h em 8 h) como `ed`. Nunca usamos `9` (semanas) para `ed`.
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
    // `effort` é armazenado em slots, não em segundos.
    const workSeconds = effort * this.granularity();
    return wallClock === workSeconds && wallClock > dailySeconds
      ? DURATION_FORMAT_ELAPSED_DAYS
      : DURATION_FORMAT_DAYS;
  }

  /** `<ActualWork>`/`<RemainingWork>`/`<ActualCost>`/`<RemainingCost>` da tarefa. */
  private appendTaskProgress(
    t: XMLElement,
    task: Task,
    sc: number,
    end: TjTime,
  ): void {
    const effort = (task.getForScenario("effort", sc,) as number) ?? 0;
    const done = (task.getForScenario("effortdone", sc,) as number) ?? 0;
    if (effort <= 0 || done <= 0) return;
    // `effort`/`effortdone` são armazenados em slots, não em dias.
    const granularity = this.granularity();
    const actualWork = done * granularity;
    const remainingWork = Math.max(0, effort - done,) * granularity;
    t.push(new XMLNamedText(durationToMsp(actualWork,), "ActualWork",),);
    t.push(
      new XMLNamedText(durationToMsp(remainingWork,), "RemainingWork",),
    );
    const actualCost = this.costEvents(task, "actual",);
    const plannedCost = this.costEvents(task, "planned",);
    if (actualCost > 0 || plannedCost > 0) {
      t.push(new XMLNamedText(asDecimal(actualCost,), "ActualCost",),);
      t.push(
        new XMLNamedText(
          asDecimal(Math.max(0, plannedCost - actualCost,),),
          "RemainingCost",
        ),
      );
    }
    // `end` permanece no contrato para futuras fatias de custo por período.
    void end;
  }

  /** Progresso de uma atribuição humana (proporcional ao esforço da tarefa). */
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
    a.push(
      new XMLNamedText(durationToMsp(work * ratio,), "ActualWork",),
    );
    a.push(
      new XMLNamedText(durationToMsp(work * (1 - ratio),), "RemainingWork",),
    );
    const actualCost = this.costEvents(task, "actual", resource,);
    const plannedCost = this.costEvents(task, "planned", resource,);
    if (actualCost > 0 || plannedCost > 0) {
      a.push(new XMLNamedText(asDecimal(actualCost,), "ActualCost",),);
      a.push(
        new XMLNamedText(
          asDecimal(Math.max(0, plannedCost - actualCost,),),
          "RemainingCost",
        ),
      );
    }
  }

  /**
   * Soma dos `CostEvent` da tarefa (8.2) por modo e, opcionalmente, recurso.
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

/** Converte uma duração em segundos para o formato `PT{H}H{M}M{S}S` do MSP. */
export function durationToMsp(duration: number,): string {
  const hours = Math.floor(duration / (60 * 60),);
  const minutes = Math.floor((duration - hours * 60 * 60) / 60,);
  const seconds = Math.floor(duration % 60,);
  return `PT${hours}H${minutes}M${seconds}S`;
}

/** Converte segundos desde a meia-noite para `HH:MM:SS`. */
export function daytimeToS(t: number,): string {
  const h = Math.floor(t / (60 * 60),);
  const m = Math.floor((t - h * 60 * 60) / 60,);
  const s = Math.floor(t % 60,);
  return `${pad2(h,)}:${pad2(m,)}:${pad2(s,)}`;
}

function pad2(n: number,): string {
  return n.toString().padStart(2, "0",);
}

/** Verificação de igualdade por valor de um par `[tarefa, onEnd]`. */
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
