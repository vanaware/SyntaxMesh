/**
 * ReportContext — the report generation context (phase 14.2).
 *
 * Faithful port of `reports/ReportContext.rb`. The `Project` pushes a
 * `ReportContext` for every report being generated; reports may be nested, but
 * only the top one (`project.reportContexts.last`) is the current context. It
 * carries the `Query` derived from the report settings and the `tasks`/
 * `resources` lists the report works on.
 *
 * In Ruby `@project.tasks` is a `PropertyList`; here `project.tasks` is a
 * `PropertySet`, so `.dup` becomes `new PropertyList(set)` (a copy of the items).
 *
 * @see docs/taskjuggler/lib/taskjuggler/reports/ReportContext.rb
 * @see docs/syntaxmesh/fases/fase-14-relatorios.md (14.2)
 */
import { type Project, } from "../model/project.ts";
import { type Report, } from "../model/report.ts";
import { type Task, } from "../model/task.ts";
import { type Resource, } from "../model/resource.ts";
import { PropertyList, } from "../model/property-list.ts";
import { Query, } from "../query/query.ts";
import type { AttributeBase, } from "../attributes/attribute-base.ts";
import type { RealFormat, } from "../format/real-format.ts";

/** Attribute backup used by dynamic reports (phase 14.11). */
export type AttributeBackup = [
  Map<string, AttributeBase<unknown>>,
  Map<string, AttributeBase<unknown>>[],
] | null;

/**
 * The generation context of one report.
 *
 * A new instance is stacked on `project.reportContexts` when the report starts
 * and popped when it finishes.
 */
export class ReportContext {
  /** Project the report belongs to. */
  readonly project: Project;
  /** Report being generated. */
  readonly report: Report;
  /** Query derived from the report settings. */
  readonly query: Query;
  /** Unique id of the (possibly nested) dynamic report instance. */
  readonly dynamicReportId: string;
  /** Counter of the dynamic child reports already created. */
  childReportCounter: number;
  /** Working task list of the report. */
  tasks: PropertyList<Task>;
  /** Working resource list of the report. */
  resources: PropertyList<Resource>;
  /** Attribute backup restored after a dynamic report finishes. */
  attributeBackup: AttributeBackup;

  /**
   * Creates a report context.
   *
   * When another context is already stacked, its id and lists are inherited and
   * its child counter is incremented; otherwise the context becomes the root
   * with id `0`.
   *
   * @param project Project the report belongs to.
   * @param report Report being generated.
   */
  constructor(project: Project, report: Report,) {
    this.project = project;
    this.report = report;
    this.childReportCounter = 0;
    this.attributeBackup = null;

    this.query = new Query({
      project,
      loadUnit: report.get("loadUnit",) as string | null,
      numberFormat: report.get("numberFormat",) as RealFormat | null,
      timeFormat: report.get("timeFormat",) as string | null,
      currencyFormat: report.get("currencyFormat",) as RealFormat | null,
      start: report.get("start",) as never,
      end: report.get("end",) as never,
      hideJournalEntry: report.get("hideJournalEntry",),
      // SyntaxMesh extension (14C.6.5): companions of `hideJournalEntry`.
      hideMaterial: report.get("hideMaterial",),
      rollupMaterial: report.get("rollupMaterial",),
      hidePicture: report.get("hidePicture",),
      journalMode: report.get("journalMode",) as string | null,
      journalAttributes: report.get("journalAttributes",) as string[] | null,
      sortJournalEntries: report.get("sortJournalEntries",),
      costAccount: report.get("costaccount",) as string | null,
      revenueAccount: report.get("revenueaccount",) as string | null,
    },);

    const parent = project.reportContexts.at(-1,) ?? null;
    if (parent) {
      // Unique id inside the composite report: the counters from the root down
      // to the leaf, separated by '.'.
      this.dynamicReportId = parent.dynamicReportId + "." +
        parent.childReportCounter;
      parent.childReportCounter += 1;
      // Inherits the lists of the parent context as starting values.
      this.tasks = new PropertyList<Task>(parent.tasks,);
      this.resources = new PropertyList<Resource>(parent.resources,);
    } else {
      // The root is always "0"; the first child "0.0", the second "0.1", …
      this.dynamicReportId = "0";
      this.tasks = new PropertyList<Task>(project.tasks,);
      this.resources = new PropertyList<Resource>(project.resources,);
    }
  }
}
