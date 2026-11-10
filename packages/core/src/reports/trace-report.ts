/**
 * TraceReport (phase 14.20.2) — periodic snapshot of attributes as CSV.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/TraceReport.rb`.
 * On every run it builds a `[Date, ...account/resource/task columns]` header,
 * reuses the previous table (reordering columns through `TableColumnSorter`
 * when the headers changed) and appends or updates the row of the current date
 * (`project['now'].midnight()`).
 *
 * ⚠️ Browser (ADR 027): the Ruby variant reads the previous CSV from disk via
 * `File.exist?(@fileName) && CSVFile.new(...).read(...)`. Here the filesystem is
 * never touched; the previous table is injected through `previousTableSource`
 * (default `null` → first run). The caller (UI/phase 19 — Storage) is
 * responsible for persisting and reloading the CSV between runs.
 *
 * `to_html()` renders the SVG chart through `ChartPlotter` (phase 14.22); chart
 * data errors become warnings, mirroring Ruby's `rescue ChartPlotterError`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.20.2)
 */

import type { Report, } from "../model/report.ts";
import type { Account, } from "../model/account.ts";
import type { Resource, } from "../model/resource.ts";
import type { Task, } from "../model/task.ts";
import type { Material, } from "../model/material.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import { PropertyList, } from "../model/property-list.ts";
import { Query, } from "../query/query.ts";
import { SimpleQueryExpander, } from "../query/simple-query-expander.ts";
import { TjTime, } from "../time/tj-time.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import type { LogicalExpression, } from "../logic/logical-expression.ts";
import { TableColumnDefinition, } from "./table-column-definition.ts";
import { TableColumnSorter, } from "./table-column-sorter.ts";
import { ReportBase, } from "./report-base.ts";
import type { OpenNodes, } from "./report-base.ts";
import { ChartPlotter, ChartPlotterError, } from "../chart-plotter.ts";
import { XMLBlob, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/** Short ISO date form (`YYYY-MM-DD`) used for the CSV round-trip. */
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Table snapshot loaded from a previous run. Every row is an array of cells and
 * the first row holds the headers. Cells may be `string` (the raw CSV form) —
 * the report converts them to `TjTime`/`null` during
 * `generateIntermediateFormat`.
 */
export type TraceTable = unknown[][];

/**
 * The `tracereport` generator: one CSV row per traced date, with the attributes
 * requested by the report columns.
 */
export class TraceReport extends ReportBase {
  /** Intermediate table (header plus one row per traced date). */
  private table: TraceTable | null = null;
  /**
   * Optional source of the previous table (the Ruby equivalent of the CSV on
   * disk). Returns `null` when there is no history — the first run.
   */
  previousTableSource: (() => TraceTable | null) | null = null;

  /**
   * Creates a trace report.
   *
   * @param report Report definition being rendered.
   */
  constructor(report: Report,) {
    super(report,);
  }

  /** Table after `generateIntermediateFormat` (for inspection and tests). */
  getTable(): TraceTable | null {
    return this.table;
  }

  /** Builds the intermediate table: headers, history merge and current row. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();

    // Query shared by every cell (load unit, formats, journal and accounts).
    const queryAttrs = {
      project: this.project,
      scopeProperty: null,
      loadUnit: this.a("loadUnit",) as string | null,
      numberFormat: this.a("numberFormat",) as never,
      // TraceReport always uses the hard-coded %Y-%m-%d for dates.
      timeFormat: "%Y-%m-%d",
      currencyFormat: this.a("currencyFormat",) as never,
      start: this.a("start",) as TjTime,
      end: this.a("end",) as TjTime,
      hideJournalEntry: this.a("hideJournalEntry",),
      journalMode: this.a("journalMode",) as string | null,
      journalAttributes: this.a("journalAttributes",) as string[] | null,
      sortJournalEntries: this.a("sortJournalEntries",),
      costAccount: this.a("costaccount",) as string | null,
      revenueAccount: this.a("revenueaccount",) as string | null,
    };
    const query = new Query(queryAttrs,);

    // Sorted and filtered account list.
    let accountList = new PropertyList<Account>(this.project.accounts,);
    accountList.setSorting(
      (this.a("sortAccounts",) as Array<[string, boolean, number,]>) ?? [],
    );
    accountList.query = query;
    accountList = this.filterAccountList(
      accountList,
      this.a("hideAccount",) as LogicalExpression | null,
      this.a("rollupAccount",) as LogicalExpression | null,
      this.a("openNodes",) as OpenNodes | null,
    );
    accountList.sort();

    // Resource list (the Ruby variant calls `filterTaskList` by mistake; we use
    // `filterResourceList` — semantically equivalent and correct).
    let resourceList = new PropertyList<Resource>(this.project.resources,);
    resourceList.setSorting(
      (this.a("sortResources",) as Array<[string, boolean, number,]>) ?? [],
    );
    resourceList.query = query;
    resourceList = this.filterResourceList(
      resourceList,
      null,
      this.a("hideResource",) as LogicalExpression | null,
      this.a("rollupResource",) as LogicalExpression | null,
      this.a("openNodes",) as OpenNodes | null,
    );
    resourceList.sort();

    // Task list including adopted tasks, filtered as in TaskListRE.
    let taskList = new PropertyList<Task>(this.project.tasks,);
    taskList.includeAdopted();
    taskList.setSorting(
      (this.a("sortTasks",) as Array<[string, boolean, number,]>) ?? [],
    );
    taskList.query = query;
    taskList = this.filterTaskList(
      taskList,
      null,
      this.a("hideTask",) as LogicalExpression | null,
      this.a("rollupTask",) as LogicalExpression | null,
      this.a("openNodes",) as OpenNodes | null,
    );
    taskList.sort();

    // Materials (SyntaxMesh extension — 14C.1.14). `Query.process` already
    // resolves material attributes (14C.1.20), so the `<-%...%->` columns work;
    // without materials the list is empty and the header does not change. The
    // `hidematerial`/`rollupmaterial` filters arrive in 14C.6.
    const materialList = new PropertyList<Material>(this.project.materials,);
    materialList.query = query;

    // Header: the Date column plus the account/resource/task/material columns.
    const headers: string[] = [
      "Date",
      ...this.generatePropertyListHeader(accountList, query,),
      ...this.generatePropertyListHeader(resourceList, query,),
      ...this.generatePropertyListHeader(taskList, query,),
      ...this.generatePropertyListHeader(materialList, query,),
    ];

    let discontinuedColumns = 0;
    const previous = this.previousTableSource ?
      this.previousTableSource() :
      null;
    if (previous && previous.length > 0) {
      this.table = previous;
      const oldHeaders = this.table[0] as unknown[];
      if (!headersEqual(oldHeaders, headers,)) {
        // Columns changed: reorder and move the discontinued ones to the end.
        const sorter = new TableColumnSorter(this.table,);
        this.table = sorter.sort(headers,);
        discontinuedColumns = sorter.discontinuedColumns ?? 0;
      }
    } else {
      this.table = [[...headers,],];
    }

    // Normalizes history cells: "" → null; `YYYY-MM-DD` → TjTime.
    for (const line of this.table) {
      for (let i = 0; i < line.length; i++) {
        const cell = line[i];
        if (cell === "") {
          line[i] = null;
        } else if (typeof cell === "string" && DATE_RE.test(cell,)) {
          line[i] = TjTime.fromString(cell,);
        }
      }
    }

    // Row of the current date — replaces an existing one, appends otherwise.
    const ctxQuery = this.currentQuery().dup();
    const dateTag = (this.project.get("now",) as TjTime).midnight();

    let idx = this.table.findIndex(
      (line,) =>
        line[0] instanceof TjTime &&
        (line[0] as TjTime).equals(dateTag,),
    );
    let discColumnValues: unknown[] = discontinuedColumns > 0
      ? new Array(discontinuedColumns,).fill(null,)
      : [];

    if (idx >= 0) {
      // Date already traced: preserves the old values of discontinued columns.
      if (discontinuedColumns > 0) {
        discColumnValues = (this.table[idx] as unknown[]).slice(
          headers.length,
        );
      }
      this.table[idx] = [];
    } else {
      this.table.push([],);
      idx = this.table.length - 1;
    }
    (this.table[idx] as unknown[]).push(dateTag,);

    this.generatePropertyListValues(idx, accountList, ctxQuery,);
    this.generatePropertyListValues(idx, resourceList, ctxQuery,);
    this.generatePropertyListValues(idx, taskList, ctxQuery,);
    this.generatePropertyListValues(idx, materialList, ctxQuery,);

    // Fills the discontinued columns with the old values or null.
    (this.table[idx] as unknown[]).push(...discColumnValues,);

    // Sorts by ascending date, keeping the (string) header on top.
    this.table.sort((l1, l2,) => {
      const a = l1[0];
      const b = l2[0];
      if (typeof a === "string") return -1;
      if (typeof b === "string") return 1;
      if (a instanceof TjTime && b instanceof TjTime) {
        return a.lessThan(b,) ? -1 : a.equals(b,) ? 0 : 1;
      }
      return 0;
    },);
  }

  /**
   * Chart HTML (phase 14.22 — ChartPlotter). Draws the SVG over the trace table;
   * data errors become warnings (mirroring `rescue ChartPlotterError`).
   */
  to_html(): XMLElementLike[] {
    if (!this.table) this.generateIntermediateFormat();
    const html: XMLElementLike[] = [];
    const header = this.rt_to_html("header",);
    if (header) html.push(header,);
    try {
      const plotter = new ChartPlotter(
        (this.a("width",) as number) ?? 640,
        (this.a("height",) as number) ?? 480,
        this.table as unknown[][],
      );
      plotter.generate();
      html.push(new XMLBlob(plotter.to_svg(),),);
    } catch (e) {
      if (e instanceof ChartPlotterError) {
        MessageHandlerInstance.instance.warning(
          "chartPlotterError",
          e.message,
          this.report.sourceFileInfo,
        );
      } else {
        throw e;
      }
    }
    const footer = this.rt_to_html("footer",);
    if (footer) html.push(footer,);
    return html;
  }

  /** Table as CSV: `TjTime` → `YYYY-MM-DD`, `null` → `''`. */
  to_csv(): unknown[][] {
    if (!this.table) this.generateIntermediateFormat();
    const out: unknown[][] = [];
    for (const line of this.table!) {
      const copy: unknown[] = [];
      for (const cell of line) {
        if (cell === null || cell === undefined) {
          copy.push("",);
        } else if (cell instanceof TjTime) {
          copy.push(cell.to_s("%Y-%m-%d",),);
        } else {
          copy.push(cell,);
        }
      }
      out.push(copy,);
    }
    return out;
  }

  /** Builds the headers of a property list through `SimpleQueryExpander`. */
  private generatePropertyListHeader<T extends PropertyTreeNode,>(
    propertyList: PropertyList<T>,
    query: Query,
  ): string[] {
    const headers: string[] = [];
    const columns =
      (this.a("columns",) as TableColumnDefinition[] | undefined) ??
        [];
    const scenarios = (this.a("scenarios",) as number[] | undefined) ?? [];
    for (const columnDescr of columns) {
      query.attributeId = columnDescr.id;
      for (const scenarioIdx of scenarios) {
        query.scenarioIdx = scenarioIdx;
        for (const property of propertyList.toArray()) {
          query.property = property as unknown as PropertyTreeNode;
          const header = new SimpleQueryExpander(
            columnDescr.title ?? "",
            query,
            this.report.sourceFileInfo,
          ).expand();
          if (headers.includes(header,)) {
            MessageHandlerInstance.instance.error(
              "trace_columns_not_uniq",
              `The column title '${header}' is already used by a previous ` +
                "column. Column titles must be unique!",
              this.report.sourceFileInfo,
            );
          }
          headers.push(header,);
        }
      }
    }
    return headers;
  }

  /** Fills row `idx` with the values of the property list. */
  private generatePropertyListValues<T extends PropertyTreeNode,>(
    idx: number,
    propertyList: PropertyList<T>,
    query: Query,
  ): void {
    const columns =
      (this.a("columns",) as TableColumnDefinition[] | undefined) ??
        [];
    const scenarios = (this.a("scenarios",) as number[] | undefined) ?? [];
    const row = this.table![idx] as unknown[];
    for (const columnDescr of columns) {
      query.attributeId = columnDescr.id;
      for (const scenarioIdx of scenarios) {
        query.scenarioIdx = scenarioIdx;
        for (const property of propertyList.toArray()) {
          query.property = property as unknown as PropertyTreeNode;
          query.process();
          row.push(query.result(),);
        }
      }
    }
  }
}

/** `true` when the old header array matches the new one (cell by cell). */
function headersEqual(oldHeaders: unknown[], newHeaders: string[],): boolean {
  if (oldHeaders.length !== newHeaders.length) return false;
  for (let i = 0; i < newHeaders.length; i++) {
    if (oldHeaders[i] !== newHeaders[i]) return false;
  }
  return true;
}

// Registers the `tracereport` content in the factory (14.11).
registerContentFactory(
  "tracereport",
  (report: unknown,): TraceReport => new TraceReport(report as Report,),
);
