/**
 * TimeSheetReport — gerador de templates de time sheet em sintaxe TJP.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/reports/TimeSheetReport.rb`.
 *
 * O relatório não produz tabela: ele emite um **formulário** `.tji` por recurso,
 * com o trabalho planejado do período pré-preenchido e comentários explicando
 * como preencher. O `SheetSender` (18.6) o usa para gerar os templates e o
 * `SheetReceiver` (18.7) faz o caminho inverso.
 *
 * ⚠️ Browser (ADR 027): nada é escrito em disco; o texto sai em `to_tjp()` e o
 * chamador decide onde guardá-lo (`FileStore`).
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

/** Agregado por recurso no formato intermediário (Ruby `TSResourceRecord`). */
export interface TSResourceRecord {
  resource: Resource;
  /** Total de horas de folga do período, já formatado (Ruby `query.to_s`). */
  vacationHours: string;
  /** Percentual de folga sobre os dias úteis do período. */
  vacationPercent: number;
  tasks: TSTaskRecord[];
}

/** Uma tarefa alocada ao recurso no período (Ruby `TSTaskRecord`). */
export interface TSTaskRecord {
  task: Task;
  workDays: number;
  workPercent: number;
  /** Esforço restante em dias (tarefa de esforço), ou `null`. */
  remaining: string | null;
  /** Fim planejado (tarefa de duração), ou `null`. */
  endDate: TjTime | null;
  /**
   * Materiais alocados à tarefa (extensão 18.17.4): viram um esqueleto
   * comentado `material <id> { work/unitprice }` no formulário.
   */
  materials: MaterialAllocation[];
}

/** Cabeçalho fixo do formulário (Ruby `to_tjp` l.77-87). */
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

/** Bloco de ajuda fixo ao fim de cada folha (Ruby `to_tjp` l.129-155). */
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

/** Cabeçalho da lista de tarefas futuras (Ruby `to_tjp` l.158-164). */
const FUTURE_HELP = `  #
  # Your upcoming tasks for the next period
  # Please check them carefully and discuss any necessary
  # changes with your manager or project manager!
  #
`;

/**
 * Formata um número como o `Float#to_s` do Ruby: inteiros ganham `.0`
 * (o Ruby imprime `50.0`, não `50`).
 */
function rubyFloat(value: number,): string {
  return Number.isInteger(value,) ? `${value}.0` : String(value,);
}

/**
 * Gerador de templates de time sheet (Ruby `TimeSheetReport < ReportBase`).
 */
export class TimeSheetReport extends ReportBase {
  /** Registros do período reportado. */
  private current: TSResourceRecord[] = [];
  /** Registros do período seguinte (tarefas futuras). */
  private future: TSResourceRecord[] = [];

  constructor(report: Report,) {
    super(report,);
  }

  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    const from = this.a("start",) as TjTime;
    const to = this.a("end",) as TjTime;
    this.current = this.collectRecords(from, to,);
    // Ruby (l.69-71): o `newEnd` é calculado e **descartado** — resíduo.
    // O período futuro usa a mesma duração do período reportado.
    this.future = this.collectRecords(
      to,
      to.addSeconds(to.toSeconds() - from.toSeconds(),),
    );
  }

  /** Templates em sintaxe TJP, um bloco `timesheet` por recurso. */
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
          // Extensão 18.17.4: materiais alocados à tarefa entram no formulário
          // como esqueleto comentado — o executor descomenta e preenche a
          // quantidade realmente consumida.
          for (const allocation of taskRecord.materials) {
            file += `    # Material: ${allocation.material.name}\n`;
            file += `    # material ${allocation.material.fullId} {\n`;
            file += `    #   work ${rubyFloat(allocation.quantity,)}` +
              "\n";
            // 18.17.10: `unitprice` só é reemitido quando a alocação declara
            // um preço próprio — folhas sem preço continuam idênticas.
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
   * Monta os registros do período `[from, to)` (Ruby `collectRecords`).
   *
   * Percorre os recursos visíveis (folhas apenas), consulta `timeoffdays` e,
   * para cada tarefa alocada que cruza o período, o `effort` do intervalo.
   */
  private collectRecords(
    from: TjTime,
    to: TjTime,
  ): TSResourceRecord[] {
    const project = this.project;

    // Recursos visíveis, na ordem pedida pelo relatório.
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

    // Modelo da Query usada para consultar todo mundo.
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

    // Tarefas visíveis, na ordem pedida pelo relatório.
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
      // Folhas de ponto só fazem sentido para recursos folha que trabalham.
      if (!resource.leaf()) continue;

      const record: TSResourceRecord = {
        resource,
        vacationHours: "",
        vacationPercent: 0,
        tasks: [],
      };
      records.push(record,);

      // Dias de folga do período → horas e percentual.
      const vacationQuery = new Query(queryAttrs as never,);
      vacationQuery.property = resource;
      vacationQuery.attributeId = "timeoffdays";
      vacationQuery.process();
      record.vacationHours = vacationQuery.to_s();
      record.vacationPercent = ((vacationQuery.to_num() ?? 0) /
        (weeksToReport * weeklyWorkingDays)) * 100.0;

      // Tarefas às quais o recurso está alocado no período.
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
        // `Query#to_num` de um esforço devolve sempre dias.
        const workDays = query.to_num() ?? 0;
        const workPercent = (workDays / (weeksToReport * weeklyWorkingDays)) *
          100.0;

        let remaining: string | null = null;
        let endDate: TjTime | null = null;
        if (
          ((task.getForScenario("effort", scenarioIdx,) as number) ?? 0) > 0
        ) {
          // Tarefa de esforço: esforço restante após o período.
          query.start = to;
          query.end = taskEnd ?? to;
          query.loadUnit = "days";
          query.process();
          remaining = query.to_s();
        } else {
          // Tarefa de duração: fim planejado.
          endDate = taskEnd;
        }

        record.tasks.push({
          task,
          workDays,
          workPercent,
          remaining,
          endDate,
          // Extensão 18.17.4: alocações de material da tarefa (o formulário
          // mostra um esqueleto para o executor preencher).
          materials:
            (task.getForScenario("materialallocations", scenarioIdx,) ??
              []) as MaterialAllocation[],
        },);
      }
    }

    return records;
  }
}

// Registra o conteúdo de `timesheetreport` na fábrica (14.11).
registerContentFactory(
  "timesheet",
  (report: unknown,): TimeSheetReport => new TimeSheetReport(report as Report,),
);
