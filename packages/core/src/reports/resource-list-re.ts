/**
 * ResourceListRE (phase 14.15) — resource list report.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/ResourceListRE.rb`. A specialization
 * of `TableReport` that renders a list of resources with the assigned tasks
 * nested under each resource line.
 *
 * The content is registered in the content factory (14.11) under
 * `resourcereport`.
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

/** Renders the `resourcereport` list of resources. */
export class ResourceListRE extends TableReport {
  /**
   * Creates the resource list generator.
   *
   * @param report Report node the generator renders.
   */
  constructor(report: Report,) {
    super(report,);
    // TableReport sets `report.content = this`; here we create the real
    // intermediate table (14.6) that accumulates rows and columns.
    this.table = new ReportTable();
    this.table.selfcontained = !!this.a("selfcontained",);
    this.table.auxDir = (this.a("auxdir",) as string | undefined) ?? "";
  }

  /** Builds the intermediate format (the table) row by row. */
  override generateIntermediateFormat(): void {
    // Propagates the current Query to the RichText blocks (ReportBase).
    super.generateIntermediateFormat();

    // Prepares the resource list (filtered).
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

    // Prepares the task list. It is NOT filtered yet: doing so would break the
    // `*_()` logical functions used inside the cells.
    const taskList = new PropertyList<Task>(this.project.tasks,);
    taskList.setSorting(
      this.a("sortTasks",) as Array<[string, boolean, number,]>,
    );
    taskList.query = this.currentQuery();
    taskList.sort();

    // Union of the tasks assigned to any reported resource.
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

    // Generates the table header (one column at a time).
    for (const columnDef of this.columnList()) {
      this.adjustColumnPeriod(
        columnDef,
        assignedTaskList,
        this.scenarioList(),
      );
      this.generateHeaderCell(columnDef,);
    }

    // Generates the list itself.
    this.generateResourceList(resourceList, taskList, null,);
  }
}

// Registers the `resourcereport` content in the factory (14.11).
registerContentFactory(
  "resourcereport",
  (report: unknown,): ResourceListRE => new ResourceListRE(report as Report,),
);
