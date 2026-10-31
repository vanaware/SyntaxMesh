/**
 * ResourceListRE (Fase 14.15) — relatório de listagem de recursos.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/ResourceListRE.rb`.
 * Especialização de `TableReport` que gera uma lista de recursos com as
 * tarefas atribuídas aninhadas sob cada linha de recurso.
 *
 * O conteúdo é registrado na fábrica de conteúdo (14.11) sob `resourcereport`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.15)
 */
import type { Report, } from "../model/report.ts";
import { PropertyList, } from "../model/property-list.ts";
import type { Task, } from "../model/task.ts";
import type { Resource, } from "../model/resource.ts";
import { ReportTable, } from "./report-table.ts";
import { TableReport, } from "./table-report.ts";
import { registerContentFactory, } from "../model/report-content.ts";

export class ResourceListRE extends TableReport {
  constructor(report: Report,) {
    super(report,);
    // TableReport define `report.content = this`; aqui criamos a tabela
    // intermediária real (14.6) que acumulará linhas e colunas.
    this.table = new ReportTable();
    this.table.selfcontained = !!this.a("selfcontained",);
    this.table.auxDir = (this.a("auxdir",) as string | undefined) ?? "";
  }

  /** Constrói o formato intermediário (tabela) linha a linha. */
  override generateIntermediateFormat(): void {
    // Propaga o Query corrente aos blocos de RichText (ReportBase).
    super.generateIntermediateFormat();

    // Prepara a lista de recursos (filtrada).
    let resourceList = new PropertyList<Resource>(this.project.resources,);
    resourceList.setSorting(
      this.a("sortResources",) as Array<[string, boolean, number,]>,
    );
    resourceList.query = this.currentQuery();
    resourceList = this.filterResourceList(
      resourceList,
      null,
      this.a("hideResource",) as never,
      this.a("rollupResource",) as never,
      this.a("openNodes",) as never,
    );
    resourceList.sort();

    // Prepara a lista de tarefas. NÃO a filtramos ainda: isso quebraria as
    // funções lógicas `*_()` usadas nas células.
    const taskList = new PropertyList<Task>(this.project.tasks,);
    taskList.setSorting(
      this.a("sortTasks",) as Array<[string, boolean, number,]>,
    );
    taskList.query = this.currentQuery();
    taskList.sort();

    // União das tarefas atribuídas a algum recurso reportado.
    const assignedTaskList: Task[] = [];
    for (const resource of resourceList.toArray()) {
      const assigned = this.filterTaskList(
        taskList,
        resource,
        this.a("hideTask",) as never,
        this.a("rollupTask",) as never,
        this.a("openNodes",) as never,
      );
      for (const task of assigned.toArray()) {
        if (!assignedTaskList.includes(task,)) assignedTaskList.push(task,);
      }
    }

    // Gera o cabeçalho da tabela (uma coluna de cada vez).
    for (const columnDef of this.columnList()) {
      this.adjustColumnPeriod(
        columnDef,
        assignedTaskList,
        this.scenarioList(),
      );
      this.generateHeaderCell(columnDef,);
    }

    // Gera a lista em si.
    this.generateResourceList(resourceList, taskList, null,);
  }
}

// Registra o conteúdo de `resourcereport` na fábrica (14.11).
registerContentFactory(
  "resourcereport",
  (report: unknown,): ResourceListRE => new ResourceListRE(report as Report,),
);
