/**
 * TaskListRE (Fase 14.14) — relatório de listagem de tarefas.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/TaskListRE.rb`.
 * Especialização de `TableReport` que gera uma lista de tarefas, opcionalmente
 * com os recursos alocados aninhados sob cada linha de tarefa.
 *
 * O conteúdo é registrado na fábrica de conteúdo (14.11) sob `taskreport`,
 * permitindo que `Report.generateIntermediateFormat` o instancie.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.14)
 */
import type { Report, } from "../model/report.ts";
import { PropertyList, } from "../model/property-list.ts";
import type { Task, } from "../model/task.ts";
import type { Resource, } from "../model/resource.ts";
import { ReportTable, } from "./report-table.ts";
import { TableReport, } from "./table-report.ts";
import { registerContentFactory, } from "../model/report-content.ts";

export class TaskListRE extends TableReport {
  constructor(report: Report,) {
    super(report,);
    // O construtor de TableReport define `report.content = this`; aqui criamos
    // a tabela intermediária real (14.6) que acumulará linhas e colunas.
    this.table = new ReportTable();
    this.table.selfcontained = !!this.a("selfcontained",);
    this.table.auxDir = (this.a("auxdir",) as string | undefined) ?? "";
  }

  /** Constrói o formato intermediário (tabela) linha a linha. */
  override generateIntermediateFormat(): void {
    // Propaga o Query corrente aos blocos de RichText (ReportBase).
    super.generateIntermediateFormat();

    // Prepara a lista de tarefas.
    let taskList = new PropertyList<Task>(this.project.tasks,);
    taskList.includeAdopted();
    taskList.setSorting(
      this.a("sortTasks",) as Array<[string, boolean, number,]>,
    );
    taskList.query = this.currentQuery();
    taskList = this.filterTaskList(
      taskList,
      null,
      this.a("hideTask",) as never,
      this.a("rollupTask",) as never,
      this.a("openNodes",) as never,
    );
    taskList.sort();
    taskList.checkForDuplicates(this.report.sourceFileInfo as never,);

    // Prepara a lista de recursos. NÃO a filtramos ainda: isso quebraria as
    // funções lógicas `*_()` usadas nas células.
    const resourceList = new PropertyList<Resource>(this.project.resources,);
    resourceList.setSorting(
      this.a("sortResources",) as Array<[string, boolean, number,]>,
    );
    resourceList.query = this.currentQuery();
    resourceList.sort();

    // Gera o cabeçalho da tabela (uma coluna de cada vez).
    for (const columnDef of this.columnList()) {
      this.adjustColumnPeriod(
        columnDef,
        taskList.toArray(),
        this.scenarioList(),
      );
      this.generateHeaderCell(columnDef,);
    }

    // Gera a lista em si.
    this.generateTaskList(taskList, resourceList, null,);
  }
}

// Registra o conteúdo de `taskreport` na fábrica (14.11).
registerContentFactory(
  "taskreport",
  (report: unknown,): TaskListRE => new TaskListRE(report as Report,),
);
