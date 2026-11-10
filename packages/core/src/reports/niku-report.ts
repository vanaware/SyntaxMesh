/**
 * NikuReport (phase 14.20.1) — exports resource allocations in XOG format
 * (Clarity/CA PPM).
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/reports/NikuReport.rb`. The Niku XOG
 * format targets a narrow use case: moving the per-project resource allocation
 * into Clarity. It requires three custom attributes: `ClarityRID` (Resource),
 * `ClarityPID` and `ClarityPName` (Task). The logic follows Ruby in three steps:
 * `computeResourceTotals`, `collectProjects`, `computeProjectAllocations`; the
 * outputs (`to_html`, `to_niku`, `to_csv`) produce the expected structure
 * without byte fidelity (header comment, ordering by id/name, empty cells when
 * the value is zero).
 *
 * ⚠️ Browser (ADR 027): `to_niku()` returns a string; nothing is written to
 * disk.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.20.1)
 * @see docs/taskjuggler/lib/taskjuggler/reports/NikuReport.rb
 */
import { Report, } from "../model/report.ts";
import type { Project, } from "../model/project.ts";
import type { Task, } from "../model/task.ts";
import type { Resource, } from "../model/resource.ts";
import { PropertyList, } from "../model/property-list.ts";
import { Query, } from "../query/query.ts";
import { TjTime, } from "../time/tj-time.ts";
import { AppConfig, } from "../app-config.ts";
import { ReportBase, } from "./report-base.ts";
import {
  XMLBlob,
  XMLComment,
  XMLElement,
  XMLNamedText,
} from "../xml/xml-element.ts";
import { XMLDocument, } from "../xml/xml-document.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { registerContentFactory, } from "../model/report-content.ts";
import type { RealFormat, } from "../format/real-format.ts";

/** A Clarity project (aggregates the tasks sharing the same `ClarityPID`). */
export class NikuProject {
  /** Tasks of the project. */
  readonly tasks: Task[] = [];
  /** Allocation of every `ClarityRID` resource in the project. */
  readonly resources: Map<string, NikuResource> = new Map();

  /**
   * Creates a Clarity project.
   *
   * @param id `ClarityPID` shared by the tasks of the project.
   * @param name `ClarityPName` shared by the tasks of the project.
   */
  constructor(readonly id: string, readonly name: string,) {}
}

/** Allocation of one resource in a `NikuProject`. */
export class NikuResource {
  /** Allocated resource-days accumulated for the resource. */
  sum = 0.0;

  /**
   * Creates a resource allocation.
   *
   * @param id `ClarityRID` of the resource.
   */
  constructor(readonly id: string,) {}
}

/**
 * The Niku (Clarity XOG) exporter.
 *
 * The generator is registered under the `niku` report type.
 */
export class NikuReport extends ReportBase {
  /** Clarity projects collected from the tasks. */
  readonly projects = new Map<string, NikuProject>();
  /** Exported resources, keyed by `ClarityRID`. */
  readonly resources = new Map<string, Resource>();
  /** Days of a resource not allocated to any project, keyed by `ClarityRID`. */
  readonly resourcesFreeWork = new Map<string, number>();
  /** Total effort considered for a resource (working days as a floor). */
  readonly resourcesTotalEffort = new Map<string, number>();
  /** Scenario the values are read from. */
  private scenarioIdx!: number;

  /**
   * Creates the Niku exporter of a report.
   *
   * @param report Report node the exporter renders.
   */
  constructor(report: Report,) {
    super(report,);
  }

  /** Computes the resource totals, collects the projects and their allocations. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    const scenarios = (this.a("scenarios",) as number[]) ?? [];
    this.scenarioIdx = scenarios[0] ?? 0;

    this.computeResourceTotals();
    this.collectProjects();
    this.computeProjectAllocations();
  }

  /**
   * Allocation share (day by day) of a resource in a project, in resource-days.
   *
   * @param projectId `ClarityPID` of the project.
   * @param resourceId `ClarityRID` of the resource.
   * @returns The allocation, or `0` when the project, the resource or its total
   *   effort is unknown.
   */
  sum(projectId: string, resourceId: string,): number {
    const project = this.projects.get(projectId,);
    if (!project) return 0.0;
    const resource = project.resources.get(resourceId,);
    const total = this.resourcesTotalEffort.get(resourceId,);
    if (!resource || !total) return 0.0;
    return resource.sum / total;
  }

  /**
   * Total allocation of a resource across every project.
   *
   * @param resourceId `ClarityRID` of the resource.
   * @returns Sum of the per-project shares of the resource.
   */
  resourceTotal(resourceId: string,): number {
    let total = 0.0;
    for (const projectId of this.projects.keys()) {
      total += this.sum(projectId, resourceId,);
    }
    return total;
  }

  /**
   * Total allocation of a project across every resource.
   *
   * @param projectId `ClarityPID` of the project.
   * @returns Sum of the per-resource shares of the project.
   */
  projectTotal(projectId: string,): number {
    let total = 0.0;
    for (const resourceId of this.resources.keys()) {
      total += this.sum(projectId, resourceId,);
    }
    return total;
  }

  /** Grand total of the allocation matrix, in resource-days. */
  total(): number {
    let total = 0.0;
    for (const projectId of this.projects.keys()) {
      for (const resourceId of this.resources.keys()) {
        total += this.sum(projectId, resourceId,);
      }
    }
    return total;
  }

  /** Header/body cell of the HTML table (the equivalent of `htmlTabCell`). */
  htmlTabCell(
    text: string,
    headerCell = false,
    align = "right",
  ): XMLElementLike {
    const td = new XMLElement("td", {
      class: headerCell ? "tabhead" : "taskcell1",
    },);
    const div = new XMLElement("div", {
      class: headerCell ? "headercelldiv" : "celldiv",
      style: `text-align:${align}`,
    },);
    div.append(text,);
    td.append(div,);
    return td;
  }

  /** Renders the allocation matrix as an HTML table. */
  to_html(): XMLElementLike {
    const tableFrame = this.generateHtmlTableFrame() as XMLElement;
    const tr0 = new XMLElement("tr",);
    const td0 = new XMLElement("td",);
    const table = new XMLElement("table", {
      class: "tj_table",
      cellspacing: "1",
    },);
    td0.append(table,);
    tr0.append(td0,);
    tableFrame.append(tr0,);

    const thead = new XMLElement("thead",);
    const projectIds = [...this.projects.keys(),].sort();
    const numberFormat = this.numberFormat();

    // Row 1: project names.
    const tr1 = new XMLElement("tr", { class: "tabline", },);
    tr1.append(this.htmlTabCell("Project", true, "right",),);
    for (const projectId of projectIds) {
      if (this.projectTotal(projectId,) <= 0.0) continue;
      const name = this.projects.get(projectId,)!.name;
      const shown = name.length > 15 ?
        "..." + name.slice(name.length - 15,) :
        name;
      tr1.append(this.htmlTabCell(shown, true, "center",),);
    }
    tr1.append(this.htmlTabCell("", true,),);
    thead.append(tr1,);

    // Row 2: project ids.
    const tr2 = new XMLElement("tr", { class: "tabline", },);
    tr2.append(this.htmlTabCell("Resource", true, "left",),);
    for (const projectId of projectIds) {
      if (this.projectTotal(projectId,) <= 0.0) continue;
      tr2.append(this.htmlTabCell(projectId, true, "center",),);
    }
    tr2.append(this.htmlTabCell("Total", true, "center",),);
    thead.append(tr2,);
    table.append(thead,);

    const tbody = new XMLElement("tbody",);
    const resourceIds = [...this.resourcesTotalEffort.keys(),].sort();
    for (const resourceId of resourceIds) {
      const tr = new XMLElement("tr", { class: "tabline", },);
      const res = this.resources.get(resourceId,);
      tr.append(
        this.htmlTabCell(`${res?.name ?? ""} (${resourceId})`, true, "left",),
      );
      for (const projectId of projectIds) {
        if (this.projectTotal(projectId,) <= 0.0) continue;
        const value = this.sum(projectId, resourceId,);
        const formatted = numberFormat ?
          numberFormat.format(value,) :
          String(value,);
        tr.append(
          this.htmlTabCell(parseFloat(formatted,) === 0.0 ? "" : formatted,),
        );
      }
      const rt = this.resourceTotal(resourceId,);
      tr.append(
        this.htmlTabCell(
          numberFormat ? numberFormat.format(rt,) : String(rt,),
          true,
        ),
      );
      tbody.append(tr,);
    }

    // Totals row per project.
    const trTot = new XMLElement("tr", { class: "tabline", },);
    trTot.append(this.htmlTabCell("Total", true, "left",),);
    for (const projectId of projectIds) {
      const pTotal = this.projectTotal(projectId,);
      if (pTotal <= 0.0) continue;
      trTot.append(
        this.htmlTabCell(
          numberFormat ? numberFormat.format(pTotal,) : String(pTotal,),
          true,
          "right",
        ),
      );
    }
    const grand = this.total();
    trTot.append(
      this.htmlTabCell(
        numberFormat ? numberFormat.format(grand,) : String(grand,),
        true,
        "right",
      ),
    );
    tbody.append(trTot,);
    table.append(tbody,);

    return tableFrame;
  }

  /** Renders the allocation matrix as a Niku XOG (Clarity) document. */
  to_niku(): string {
    const xml = new XMLDocument();
    xml.append(
      new XMLComment(
        `Generated by ${AppConfig.softwareName} v${AppConfig.version} on ` +
          `${String(TjTime.now(),)}\n` +
          `For more information about ${AppConfig.softwareName} see ` +
          `${AppConfig.contact}.\n` +
          `Project: ${String(this.project.get("name",),)}\n` +
          `Date:    ${String(this.project.get("now",),)}\n`,
      ),
    );
    const nikuDataBus = new XMLElement("NikuDataBus", {
      "xmlns:xsi": "http://www.w3.org/2001/XMLSchema-instance",
      "xsi:noNamespaceSchemaLocation": "../xsd/nikuxog_project.xsd",
    },);
    xml.append(nikuDataBus,);
    nikuDataBus.append(
      new XMLElement("Header", {
        action: "write",
        externalSource: "NIKU",
        objectType: "project",
        version: "7.5.0",
      },),
    );
    const projects = new XMLElement("Projects",);
    nikuDataBus.append(projects,);

    const timeFormat = "%Y-%m-%dT%H:%M:%S";
    const numberFormat = this.numberFormat();
    const start = this.a("start",) as TjTime;
    const end = this.a("end",) as TjTime;

    for (const projectId of [...this.projects.keys(),].sort()) {
      const prj = this.projects.get(projectId,)!;
      const project = new XMLElement("Project", {
        name: prj.name,
        projectID: prj.id,
      },);
      projects.append(project,);
      const resources = new XMLElement("Resources",);
      project.append(resources,);
      for (const clarityRID of [...this.resources.keys(),].sort()) {
        const resource = new XMLElement("Resource", {
          resourceID: clarityRID,
          defaultAllocation: "0",
        },);
        resources.append(resource,);
        const allocCurve = new XMLElement("AllocCurve",);
        resource.append(allocCurve,);
        const s = this.sum(prj.id, clarityRID,);
        allocCurve.append(
          new XMLElement("Segment", {
            start: start.to_s(timeFormat,),
            finish: end.subSeconds(1,).to_s(timeFormat,),
            sum: numberFormat ? numberFormat.format(s,) : String(s,),
          },),
        );
      }
      // The report title is used as a custom XML blob (Ruby).
      const title = this.a("title",);
      if (title && String(title,).length > 0) {
        project.append(new XMLBlob(String(title,),),);
      }
    }

    return xml.to_s();
  }

  /** Renders the allocation matrix as an array-of-arrays (CSV form). */
  to_csv(): unknown[][] {
    const table: unknown[][] = [];
    const projectIds = [...this.projects.keys(),].sort();

    const rowNames: unknown[] = ["",];
    for (const projectId of projectIds) {
      rowNames.push(this.projects.get(projectId,)?.name ?? "",);
    }
    table.push(rowNames,);

    const rowIds: unknown[] = ["Resource",];
    for (const projectId of projectIds) rowIds.push(projectId,);
    table.push(rowIds,);

    for (const resourceId of [...this.resourcesTotalEffort.keys(),].sort()) {
      const row: unknown[] = [
        `${this.resources.get(resourceId,)?.name ?? ""} (${resourceId})`,
      ];
      for (const projectId of projectIds) {
        row.push(this.sum(projectId, resourceId,),);
      }
      table.push(row,);
    }
    return table;
  }

  /** Number format declared by the report, or `null` for the default one. */
  private numberFormat(): RealFormat | null {
    return (this.a("numberFormat",) as RealFormat | null) ?? null;
  }

  /**
   * Sums the total effort of every leaf resource with a `ClarityRID` in the
   * reported period and derives the "free work" (days without allocation).
   *
   * @throws Error When no resource declares the `ClarityRID` attribute.
   */
  private computeResourceTotals(): void {
    const project = this.project as Project;

    let resourceList = new PropertyList<Resource>(project.resources,);
    resourceList.setSorting(
      (this.a("sortResources",) as Array<[string, boolean, number,]>) ?? [],
    );
    resourceList = this.filterResourceList(
      resourceList,
      null,
      this.a("hideResource",) as never,
      this.a("rollupResource",) as never,
      this.a("openNodes",) as never,
    );

    const query = this.newQuery(project,);

    // Working days in the reported interval.
    const start = this.a("start",) as TjTime;
    const end = this.a("end",) as TjTime;
    const workingDays = Math.max(
      project.workingDays({
        start: project.dateToIdx(start,),
        end: project.dateToIdx(end,),
      },),
      1,
    );

    for (const resource of resourceList.toArray()) {
      if (!resource.leaf()) continue;
      const resourceIdRaw = resource.get("ClarityRID",);
      if (resourceIdRaw === null || resourceIdRaw === undefined) continue;
      const resourceId = String(resourceIdRaw,);
      if (resourceId === "") continue;

      query.property = resource;
      query.attributeId = "effort";
      query.scenarioIdx = this.scenarioIdx;
      query.start = start;
      query.end = end;
      query.process();
      const effort = (query.to_num() ?? 0) / 86400; // seconds -> days

      // Effort above the working days is treated as unpaid overtime.
      let total = effort;
      if (total >= workingDays) {
        this.resourcesFreeWork.set(resourceId, 0.0,);
      } else {
        this.resourcesFreeWork.set(resourceId, workingDays - total,);
        total = workingDays;
      }
      this.resources.set(resourceId, resource,);
      this.resourcesTotalEffort.set(resourceId, total,);
    }

    if (this.resourcesTotalEffort.size === 0) {
      throw new Error(
        "No resources with the custom attribute ClarityRID were found!",
      );
    }
  }

  /**
   * Builds one `NikuProject` per distinct `ClarityPID` and validates the
   * `ClarityPName` consistency. When `timeOffId`/`timeOffName` are set, an extra
   * project is created for the time off.
   *
   * @throws Error When a task lacks the Clarity attributes, when two tasks
   *   disagree on `ClarityPName`, or when no task declares them at all.
   */
  private collectProjects(): void {
    const project = this.project as Project;

    let taskList = new PropertyList<Task>(project.tasks,);
    taskList.setSorting(
      (this.a("sortTasks",) as Array<[string, boolean, number,]>) ?? [],
    );
    taskList = this.filterTaskList(
      taskList,
      null,
      this.a("hideTask",) as never,
      this.a("rollupTask",) as never,
      this.a("openNodes",) as never,
    );

    for (const task of taskList.toArray()) {
      const assigned = (task.getForScenario(
        "assignedresources",
        this.scenarioIdx,
      ) as Resource[]) ?? [];
      // Ruby: `next unless task.leaf? || assigned.empty?`
      if (!task.leaf() && assigned.length === 0) continue;

      const idRaw = task.get("ClarityPID",);
      if (idRaw === null || idRaw === undefined) continue;
      const id = String(idRaw,);
      if (id === "") {
        throw new Error(
          `ClarityPID of task ${task.fullId} may not be empty`,
        );
      }
      const nameRaw = task.get("ClarityPName",);
      if (nameRaw === null || nameRaw === undefined) {
        throw new Error(
          `ClarityPName of task ${task.fullId} has not been set!`,
        );
      }
      const name = String(nameRaw,);
      if (name === "") {
        throw new Error(
          `ClarityPName of task ${task.fullId} may not be empty!`,
        );
      }

      let prj = this.projects.get(id,);
      if (!prj) {
        prj = new NikuProject(id, name,);
        this.projects.set(id, prj,);
      } else {
        const first = prj.tasks[0];
        const firstName = first ?
          String(first.get("ClarityPName",) ?? "",) :
          name;
        if (firstName !== name) {
          throw new Error(
            `Task ${task.fullId} and task ${first?.fullId ?? ""} have same ` +
              `ClarityPID (${id}) but different ClarityPName (${name}/` +
              `${firstName})`,
          );
        }
      }
      prj.tasks.push(task,);
    }

    if (this.projects.size === 0) {
      throw new Error(
        "No tasks with the custom attributes ClarityPID and ClarityPName " +
          "were found!",
      );
    }

    const timeOffIdRaw = this.report.get("timeOffId",);
    const timeOffNameRaw = this.report.get("timeOffName",);
    if (timeOffIdRaw && timeOffNameRaw) {
      const id = String(timeOffIdRaw,);
      const name = String(timeOffNameRaw,);
      const p = new NikuProject(id, name,);
      this.projects.set(id, p,);
      for (const [resourceId,] of this.resources) {
        const nr = new NikuResource(resourceId,);
        nr.sum = this.resourcesFreeWork.get(resourceId,) ?? 0.0;
        p.resources.set(resourceId, nr,);
      }
    }
  }

  /** Sums the effort allocated per resource in each Clarity project. */
  private computeProjectAllocations(): void {
    const project = this.project as Project;
    const query = this.newQuery(project,);

    const timeOffIdRaw = this.report.get("timeOffId",);
    const timeOffId = timeOffIdRaw ? String(timeOffIdRaw,) : null;
    const start = this.a("start",) as TjTime;
    const end = this.a("end",) as TjTime;

    for (const prj of this.projects.values()) {
      if (timeOffId !== null && prj.id === timeOffId) continue;
      for (const task of prj.tasks) {
        const assigned = (task.getForScenario(
          "assignedresources",
          this.scenarioIdx,
        ) as Resource[]) ?? [];
        for (const resource of assigned) {
          const ridRaw = resource.get("ClarityRID",);
          if (!ridRaw) continue;
          const rid = String(ridRaw,);
          if (!this.resources.has(rid,)) continue;

          query.property = task;
          query.scopeProperty = resource;
          query.attributeId = "effort";
          query.scenarioIdx = this.scenarioIdx;
          query.start = start;
          query.end = end;
          query.process();
          const work = (query.to_num() ?? 0) / 86400;
          if (work <= 0.0) continue;

          let rec = prj.resources.get(rid,);
          if (!rec) {
            rec = new NikuResource(rid,);
            prj.resources.set(rid, rec,);
          }
          rec.sum += work;
        }
      }
    }
  }

  /**
   * Creates a query pre-configured with the report formatting options.
   *
   * @param project Project the query runs against.
   * @returns A fresh query bound to the report scenario.
   */
  private newQuery(project: Project,): Query {
    return new Query({
      project,
      scopeProperty: null,
      scenarioIdx: this.scenarioIdx,
      loadUnit: (this.a("loadUnit",) as string | null) ?? null,
      numberFormat: this.numberFormat(),
      timeFormat: (this.a("timeFormat",) as string | null) ?? null,
      currencyFormat: (this.a("currencyFormat",) as RealFormat | null) ?? null,
      start: this.a("start",) as TjTime,
      end: this.a("end",) as TjTime,
      journalMode: (this.a("journalMode",) as string | null) ?? null,
      journalAttributes: (this.a("journalAttributes",) as string[] | null) ??
        null,
      costAccount: (this.a("costaccount",) as string | null) ?? null,
      revenueAccount: (this.a("revenueaccount",) as string | null) ?? null,
    },);
  }
}

// Registers the `niku` content factory (14.11 dispatch).
registerContentFactory(
  "niku",
  (report: unknown,): NikuReport => new NikuReport(report as Report,),
);
