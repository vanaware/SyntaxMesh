/**
 * TaskListRE (phase 14.14) — task list report.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/TaskListRE.rb`. A specialization of
 * `TableReport` that renders a list of tasks, optionally with the allocated
 * resources nested under each task line.
 *
 * The content is registered in the content factory (14.11) under `taskreport`,
 * so `Report.generateIntermediateFormat` can instantiate it.
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

/** Renders the `taskreport` list of tasks. */
export class TaskListRE extends TableReport {
  /**
   * Creates the task list generator.
   *
   * @param report Report node the generator renders.
   */
  constructor(report: Report,) {
    super(report,);
    // The TableReport constructor sets `report.content = this`; here we create
    // the real intermediate table (14.6) that accumulates rows and columns.
    this.table = new ReportTable();
    this.table.selfcontained = !!this.a("selfcontained",);
    this.table.auxDir = (this.a("auxdir",) as string | undefined) ?? "";
  }

  /** Builds the intermediate format (the table) row by row. */
  override generateIntermediateFormat(): void {
    // Propagates the current Query to the RichText blocks (ReportBase).
    super.generateIntermediateFormat();

    // Prepares the task list.
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

    // Prepares the resource list. It is NOT filtered yet: doing so would break
    // the `*_()` logical functions used inside the cells.
    const resourceList = new PropertyList<Resource>(this.project.resources,);
    resourceList.setSorting(
      this.a("sortResources",) as Array<[string, boolean, number,]>,
    );
    resourceList.query = this.currentQuery();
    resourceList.sort();

    // Generates the table header (one column at a time).
    for (const columnDef of this.columnList()) {
      this.adjustColumnPeriod(
        columnDef,
        taskList.toArray(),
        this.scenarioList(),
      );
      this.generateHeaderCell(columnDef,);
    }

    // Generates the list itself.
    this.generateTaskList(taskList, resourceList, null,);
  }
}

// Registers the `taskreport` content in the factory (14.11).
registerContentFactory(
  "taskreport",
  (report: unknown,): TaskListRE => new TaskListRE(report as Report,),
);
