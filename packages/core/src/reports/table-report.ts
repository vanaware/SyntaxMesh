/**
 * TableReport (phase 14.12) — base class of every tabular report.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/TableReport.rb`.
 * It builds the intermediate format (`ReportTable`) line by line: it generates
 * the header columns, the account/task/resource lists and every cell (plain,
 * calculated or calendar). `to_html` assembles the HTML frame and `to_csv`
 * delegates to the table.
 *
 * The `chart` column (Gantt, phase 15) is handled by `generateHeaderCell` /
 * `generateTableCell`, which create the `GanttChart` and the `GanttLine`s.
 * Nothing is written to disk (ADR 027) — the outputs return structures/strings.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.12)
 */
import type { Report, } from "../model/report.ts";
import { Task, } from "../model/task.ts";
import { Resource, } from "../model/resource.ts";
import { Account, } from "../model/account.ts";
import { Material, } from "../model/material.ts";
import type { MaterialAllocation, } from "../model/material-allocation.ts";
import type { MaterialBooking, } from "../model/material-booking.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { PropertyList, } from "../model/property-list.ts";
import type { PropertySet, } from "../model/property-set.ts";
import { AttributeType, } from "../attributes/attribute-type.ts";
import { Query, } from "../query/query.ts";
import { TjTime, } from "../time/tj-time.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { RichText, } from "../richtext/rich-text.ts";
import type { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import { XMLComment, XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { ReportBase, } from "./report-base.ts";
import { markdownSections, } from "./markdown.ts";
import { ReportTable, } from "./report-table.ts";
import { ReportTableColumn, } from "./report-table-column.ts";
import { ReportTableLine, } from "./report-table-line.ts";
import {
  PlaceHolderCell,
  ReportTableCell,
  type SpecialCell,
} from "./report-table-cell.ts";
import { ReportTableLegend, } from "./report-table-legend.ts";
import { ColumnTable, } from "./column-table.ts";
import type { TableColumnDefinition, } from "./table-column-definition.ts";
import { TableReportColumn, } from "./table-report-column.ts";
import { GanttChart, } from "../gantt/gantt-chart.ts";
import { GanttLine, } from "../gantt/gantt-line.ts";

/** Column alignment (subset of `CellAlignment` used by the tables). */
type ColumnAlign = "left" | "right";

/** Callback advancing a `TjTime` to the next column interval. */
type SameTimeNext = (t: TjTime,) => TjTime;

/**
 * Base class of the tabular reports (`taskreport`, `resourcereport`,
 * `accountreport`, `materialreport`, …).
 *
 * A subclass supplies the entity lists and the collected values; this class
 * owns the column metadata, the cell generation and the serialization.
 */
export abstract class TableReport extends ReportBase {
  /** Metadata per predefined column: [title, indent, alignment, per-scenario]. */
  static readonly propertiesById: Map<
    string,
    [string, boolean, ColumnAlign, boolean,]
  > = new Map<string, [string, boolean, ColumnAlign, boolean,]>([
    ["activetasks", ["Active Tasks", true, "right", true,],],
    ["annualleave", ["Annual Leave", true, "right", true,],],
    ["annualleavebalance", ["Annual Leave Balance", false, "right", true,],],
    ["annualleavelist", ["Annual Leave List", false, "left", true,],],
    ["alert", ["Alert", true, "left", false,],],
    ["alertmessages", ["Alert Messages", false, "left", false,],],
    ["alertsummaries", ["Alert Summaries", false, "left", false,],],
    ["alerttrend", ["Alert Trend", false, "left", false,],],
    ["balance", ["Balance", true, "right", true,],],
    ["bsi", ["BSI", false, "left", false,],],
    ["children", ["Children", false, "left", false,],],
    ["closedtasks", ["Closed Tasks", true, "right", true,],],
    ["competitorcount", ["Competitor count", true, "right", true,],],
    ["competitors", ["Competitors", true, "left", true,],],
    ["complete", ["Completion", false, "right", true,],],
    ["cost", ["Cost", true, "right", true,],],
    ["duration", ["Duration", true, "right", true,],],
    ["effort", ["Effort", true, "right", true,],],
    ["effortdone", ["Effort Done", true, "right", true,],],
    ["effortleft", ["Effort Left", true, "right", true,],],
    ["freetime", ["Free Time", true, "right", true,],],
    ["freework", ["Free Work", true, "right", true,],],
    ["followers", ["Followers", false, "left", true,],],
    ["fte", ["FTE", true, "right", true,],],
    ["headcount", ["Headcount", true, "right", true,],],
    ["id", ["Id", false, "left", false,],],
    ["inputs", ["Inputs", false, "left", true,],],
    ["journal", ["Journal", false, "left", false,],],
    ["journal_sub", ["Journal", false, "left", false,],],
    ["journalmessages", ["Journal Messages", false, "left", false,],],
    ["journalsummaries", ["Journal Summaries", false, "left", false,],],
    ["line", ["Line No.", false, "right", false,],],
    ["name", ["Name", true, "left", false,],],
    ["no", ["No.", false, "right", false,],],
    ["opentasks", ["Open Tasks", true, "right", true,],],
    ["precursors", ["Precursors", false, "left", true,],],
    ["rate", ["Rate", true, "right", true,],],
    ["resources", ["Resources", false, "left", true,],],
    ["responsible", ["Responsible", false, "left", true,],],
    ["revenue", ["Revenue", true, "right", true,],],
    ["scenario", ["Scenario", false, "left", true,],],
    ["scheduling", ["Scheduling Mode", true, "left", true,],],
    ["sickleave", ["Sick Leave", true, "right", true,],],
    ["specialleave", ["Special Leave", true, "right", true,],],
    ["status", ["Status", false, "left", true,],],
    ["targets", ["Targets", false, "left", true,],],
    ["unpaidleave", ["Unpaid Leave", true, "right", true,],],
  ],);

  /**
   * Metadata of the material-specific columns (SyntaxMesh extension, phase 14
   * complement C1). It is only consulted on lines whose `property` is a
   * `Material`, so it may share ids with task columns (`journal`, etc.) without
   * affecting the core reports.
   */
  static readonly materialPropertiesById: Map<
    string,
    [string, ColumnAlign,]
  > = new Map<string, [string, ColumnAlign,]>([
    ["allocations", ["Allocations", "left",],],
    ["actualcost", ["Actual Cost", "right",],],
    ["journal", ["Journal", "left",],],
    ["journal_sub", ["Journal", "left",],],
    ["journalmessages", ["Journal Messages", "left",],],
    ["journalsummaries", ["Journal Summaries", "left",],],
    ["scheduledcost", ["Scheduled Cost", "right",],],
    ["stockcost", ["Stock Cost", "right",],],
    ["stockquantity", ["Stock Quantity", "right",],],
    ["totalcost", ["Total Cost", "right",],],
    ["unit", ["Unit", "left",],],
    ["unitprice", ["Unit Price", "right",],],
  ],);

  /**
   * Material columns resolved by attribute/query (keyword → attributeId).
   * `unitprice` routes to the dedicated `query_unitprice` (effective unit price)
   * instead of the base `cost` attribute — that keeps `cost` free for the
   * `query_cost` (total planned cost) without hijacking the column (wave C).
   */
  static readonly materialAttributeColumns: Map<string, string> = new Map<
    string,
    string
  >([
    ["note", "note",],
    ["unit", "unit",],
    ["unitprice", "unitprice",],
  ],);

  /**
   * Calculated numeric material columns (right-aligned). `totalquantity` is
   * derived from the allocations since 14C.11.10; `stockcost`/`stockquantity`
   * are derived from the stock bookings since C18.
   */
  static readonly materialNumericColumns: Set<string> = new Set<string>([
    "actualcost",
    "scheduledcost",
    "stockcost",
    "stockquantity",
    "totalcost",
    "totalquantity",
  ],);

  /**
   * Journal columns. `journal_sub`, `journalmessages` and `journalsummaries` are
   * deprecated aliases of `journal` in the parser (`_journal_sub` etc. →
   * `_journal`), but they stay in the title map. All of them are resolved
   * through the same path (14C.1.7).
   */
  static readonly journalColumns: Set<string> = new Set<string>([
    "journal",
    "journal_sub",
    "journalmessages",
    "journalsummaries",
  ],);

  /**
   * Material columns on a task line (SyntaxMesh extension, 14C.1.11):
   * `materials` lists the allocations of the task and `materialcost` sums the
   * cost.
   */
  static readonly taskMaterialColumns: Set<string> = new Set<string>([
    "materials",
    "materialcost",
  ],);

  /** Default behaviour per attribute type: [indent, alignment]. */
  static readonly propertiesByType: Map<
    AttributeType,
    [boolean, ColumnAlign,]
  > = new Map<AttributeType, [boolean, ColumnAlign,]>([
    [AttributeType.Date, [false, "left",],],
    [AttributeType.Integer, [false, "right",],],
    [AttributeType.Float, [false, "right",],],
    [AttributeType.ResourceList, [false, "left",],],
    [AttributeType.RichText, [false, "left",],],
    // 14C.19.1 (ADR 039): `markdown` attribute columns in `extend` are rich
    // text like the `richtext` ones — without this line the alignment fell back
    // to "center" (the `alignment` fallback).
    [AttributeType.Markdown, [false, "left",],],
    [AttributeType.String, [false, "left",],],
  ],);

  /** Legend collected while the table is built (Gantt and calendar symbols). */
  legend: ReportTableLegend;
  /** Table built by the last `generateIntermediateFormat`. */
  protected table: ReportTable | null = null;
  /** Computed interval of each column definition. */
  protected columns: Map<TableColumnDefinition, TableReportColumn> = new Map();

  /**
   * Intermediate format (`ReportTable`) produced by
   * `generateIntermediateFormat`. Read-only exposure for the phase 14.23 golden
   * tests, which compare the table structure (not the markup) between the TS
   * engine and the Ruby tj3.
   */
  getTable(): ReportTable | null {
    return this.table;
  }

  /**
   * Creates a tabular report and registers it as the report content.
   *
   * @param report Report definition being rendered.
   */
  constructor(report: Report,) {
    super(report,);
    // This object becomes the intermediate content of the report.
    report.content = this as unknown as Report["content"];
    this.legend = new ReportTableLegend();
  }

  // ------------------------------------------------------------------
  // Static methods (14.12.2)
  // ------------------------------------------------------------------

  /**
   * Default title of the column `id` (`""` for special columns with no title and
   * `null` when the column is not predefined).
   *
   * Port of `TableReport::defaultColumnTitle` (Ruby l.156). The `null` is what
   * lets the parser fall back to the task/resource dictionary
   * (`ProjectFileParser#columnTitle`) — without it, `start`/`end`/`effort` would
   * have no header because `attributeName` returns `undefined` for them.
   */
  static defaultColumnTitle(id: string,): string | null {
    const specials = [
      "chart",
      "hourly",
      "daily",
      "weekly",
      "monthly",
      "quarterly",
      "yearly",
    ];
    if (specials.includes(id,)) return "";
    const entry = TableReport.propertiesById.get(id,);
    if (entry) return entry[0];
    // Columns exclusive to the materialreport (SyntaxMesh extension): the map is
    // consulted second because it may share ids with task columns (`journal`,
    // etc.) — the core takes precedence (C18).
    const material = TableReport.materialPropertiesById.get(id,);
    return material ? material[0] : null;
  }

  /** Should the column be indented? (per `colId` or per property type). */
  static indent(
    colId: string,
    propertyType: AttributeType | undefined,
  ): boolean {
    const byId = TableReport.propertiesById.get(colId,);
    if (byId) return byId[1];
    const byType = propertyType === undefined
      ? undefined
      : TableReport.propertiesByType.get(propertyType,);
    return byType ? byType[0] : false;
  }

  /** Alignment of the column. */
  static alignment(
    colId: string,
    attributeType: AttributeType | undefined,
  ): ColumnAlign | "center" {
    const byId = TableReport.propertiesById.get(colId,);
    if (byId) return byId[2];
    const byType = attributeType === undefined
      ? undefined
      : TableReport.propertiesByType.get(attributeType,);
    return byType ? byType[1] : "center";
  }

  /** Are the values of column `colId` calculated (not a direct attribute)? */
  static calculated(colId: string,): boolean {
    return TableReport.propertiesById.has(colId,);
  }

  /** Are the values of column `colId` scenario specific? */
  static scenarioSpecific(colId: string,): boolean {
    const entry = TableReport.propertiesById.get(colId,);
    return entry ? entry[3] : false;
  }

  // ------------------------------------------------------------------
  // Outputs (14.12.3)
  // ------------------------------------------------------------------

  /** Renders the report as a tree of HTML elements. */
  to_html(): XMLElementLike[] {
    const html: XMLElementLike[] = [];
    const ctx = this.project.reportContexts.at(-1,);
    html.push(
      new XMLComment(
        `Dynamic Report ID: ${ctx ? ctx.dynamicReportId : ""}`,
      ),
    );

    const header = this.rt_to_html("header",);
    if (header) html.push(header,);

    const tableFrame = this.generateHtmlTableFrame();
    html.push(tableFrame,);

    // The data table proper.
    if (this.table) {
      const td = new XMLElement("td",);
      td.append(this.table.to_html(),);
      tableFrame.append(this.generateHtmlTableRow(td,),);
    }

    // Caption embedded as RichText in the table footer.
    const caption = this.a("caption",) as {
      sectionNumbers: boolean;
      to_html(): XMLElementLike | null;
    } | null;
    if (caption) {
      const td = new XMLElement("td",);
      const div = new XMLElement("div", { class: "tj_table_caption", },);
      caption.sectionNumbers = false;
      const capHtml = caption.to_html();
      if (capHtml) div.append(capHtml,);
      td.append(div,);
      tableFrame.append(this.generateHtmlTableRow(td,),);
    }

    // The legend.
    const legendTd = new XMLElement("td",);
    const legendHtml = this.legend.to_html();
    if (legendHtml) legendTd.append(legendHtml,);
    tableFrame.append(this.generateHtmlTableRow(legendTd,),);

    const footer = this.rt_to_html("footer",);
    if (footer) html.push(footer,);

    return html;
  }

  /** Renders the table as an array of arrays. */
  to_csv(): unknown[][] {
    return (this.table ? this.table.to_csv() : [[],]) as unknown[][];
  }

  /**
   * Intermediate table as JSON (SyntaxMesh extension — 14C.0.3): columns plus
   * lines with normalized text; calendar cells become a descriptor; the legend
   * is not included. The structure is stable and documented in the block tests.
   */
  toJSON(): string {
    const table = this.table
      ? this.table.toJSON()
      : { columns: [], lines: [], };
    return JSON.stringify({ format: "table", ...table, }, null, 1,);
  }

  /**
   * Markdown document (SyntaxMesh extension — addendum §10): RichText header,
   * pipe table and RichText footer, without HTML.
   */
  to_markdown(): string {
    return markdownSections([
      this.rt_to_markdown("header",),
      this.table ? this.table.to_markdown() : null,
      this.rt_to_markdown("footer",),
    ],);
  }

  // ------------------------------------------------------------------
  // Protected helpers (14.12.4)
  // ------------------------------------------------------------------

  /**
   * Adjusts the column period when the user pinned no dates: it fits every task
   * and adds ~5% of margin on each side (for chart and calendar columns). The
   * result (adjusted or not) is stored in `@columns`.
   */
  protected adjustColumnPeriod(
    columnDef: TableColumnDefinition,
    tasks: Task[] = [],
    scenarios: number[] = [],
  ): void {
    let doNotAdjustStart = false;
    let doNotAdjustEnd = false;

    let rStart: TjTime | null;
    let rEnd: TjTime | null;
    if (columnDef.start) {
      rStart = columnDef.start;
      doNotAdjustStart = true;
    } else {
      rStart = this.a("start",) as TjTime;
      if (rStart !== (this.project.get("start",) as TjTime)) {
        doNotAdjustStart = true;
      }
    }
    if (columnDef.end) {
      rEnd = columnDef.end;
      doNotAdjustEnd = true;
    } else {
      rEnd = this.a("end",) as TjTime;
      if (rEnd !== (this.project.get("end",) as TjTime)) doNotAdjustEnd = true;
    }
    const origStart = rStart;
    const origEnd = rEnd;

    this.columns.set(columnDef, new TableReportColumn(rStart, rEnd,),);

    if (
      tasks.length === 0 || scenarios.length === 0 ||
      (doNotAdjustStart && doNotAdjustEnd)
    ) {
      return;
    }

    rStart = null;
    rEnd = null;
    for (const scenarioIdx of scenarios) {
      for (const task of tasks) {
        const s = (this.scenarioTime(task, "start", scenarioIdx,) ??
          this.project.get("start",)) as TjTime;
        if (rStart === null || s.compareTo(rStart,) < 0) rStart = s;
        const e = (this.scenarioTime(task, "end", scenarioIdx,) ??
          this.project.get("end",)) as TjTime;
        if (rEnd === null || e.compareTo(rEnd,) > 0) rEnd = e;
      }
    }
    if (!rStart || !rEnd) return;

    let margin = 0;
    let minWidth = rEnd.diff(rStart,) + 1;
    const mwMap: Record<string, [number, number, number,]> = {
      hour: [60 * 60, 18, 2,],
      day: [60 * 60 * 24, 18, 2,],
      week: [60 * 60 * 24 * 7, 6, 1,],
      month: [60 * 60 * 24 * 31, 10, 1,],
      quarter: [60 * 60 * 24 * 90, 6, 1,],
      year: [60 * 60 * 24 * 365, 4, 1,],
    };
    const calMap: Record<string, [number, number, number,]> = {
      hourly: [60 * 60, 18, 2,],
      daily: [60 * 60 * 24, 18, 2,],
      weekly: [60 * 60 * 24 * 7, 6, 1,],
      monthly: [60 * 60 * 24 * 31, 10, 1,],
      quarterly: [60 * 60 * 24 * 90, 6, 1,],
      yearly: [60 * 60 * 24 * 365, 4, 1,],
    };

    if (columnDef.id === "chart") {
      const entry = mwMap[columnDef.scale];
      if (!entry) throw new Error(`Unknown scale ${columnDef.scale}`,);
      margin = entry[0] * entry[2];
      if (minWidth < entry[0] * entry[1]) minWidth = entry[0] * entry[1];
    } else if (calMap[columnDef.id]) {
      const entry = calMap[columnDef.id]!;
      margin = entry[0] * entry[2];
      if (minWidth < entry[0] * entry[1]) minWidth = entry[0] * entry[1];
    } else {
      doNotAdjustStart = doNotAdjustEnd = true;
    }

    if (!(doNotAdjustStart && doNotAdjustEnd)) {
      if (minWidth > (rEnd.diff(rStart,) + 1)) {
        // RUBY-COMPAT-FIX: in Ruby `TjTime - TjTime` returns a **Float**
        // (`Time#-`), so this margin carries .5s when the remainder is odd and
        // the chart period is shifted by half a second (which `to_i` truncates
        // down). With integer division the left edge came out 1s larger than
        // tj3's and every pixel position slid along with it.
        margin = (minWidth - (rEnd.diff(rStart,) + 1)) / 2;
      }
      rStart = rStart.addSeconds(-margin,);
      rEnd = rEnd.addSeconds(margin,);
      if (doNotAdjustStart) rStart = origStart!;
      if (doNotAdjustEnd) rEnd = origEnd!;
      if (rStart.compareTo(rEnd,) >= 0) {
        rStart = origStart;
        rEnd = origEnd;
      }
      this.columns.set(columnDef, new TableReportColumn(rStart, rEnd,),);
    }
  }

  /** Emits the header cell of column `columnDef`. */
  protected generateHeaderCell(columnDef: TableColumnDefinition,): void {
    if (!this.table) return;
    const colInfo = this.columns.get(columnDef,);
    const rStart = colInfo!.start!;
    const rEnd = colInfo!.end!;

    switch (columnDef.id) {
      case "chart": {
        // For the `chart` column the header carries a `GanttChart`. The heights
        // are adjusted so the chart lines match the table lines.
        const gantt = new GanttChart(
          this.a("now",) as TjTime,
          this.a("weekStartsMonday",) as boolean,
          columnDef,
          // Ruby passes `self` (the report), not `@table`: it is where `legend`
          // for the `GanttLine` comes from.
          this,
          this.a("markdate",) as TjTime | null,
        );
        gantt.generateByScale(rStart, rEnd, columnDef.scale,);
        // The header has 2 lines separated by a 1px border.
        gantt.header!.height = this.table.headerLineHeight * 2 + 1;
        // Maximum chart width. If more space is needed a scrollbar appears (or
        // the chart is truncated, depending on the format).
        gantt.viewWidth = columnDef.width ?? 450;
        const column = new ReportTableColumn(this.table, columnDef, "",);
        column.cell1.special = gantt;
        column.cell2.hidden = true;
        column.scrollbar = gantt.hasScrollbar();
        this.table.equiLines = true;
        break;
      }
      case "hourly":
        this.genCalChartHeader(
          columnDef,
          rStart.midnight(),
          rEnd,
          (t,) => t.sameTimeNextHour(),
          "%A %Y-%m-%d",
          "%H",
        );
        break;
      case "daily":
        this.genCalChartHeader(
          columnDef,
          rStart.midnight(),
          rEnd,
          (t,) => t.sameTimeNextDay(),
          "%b %Y",
          "%d",
        );
        break;
      case "weekly":
        this.genCalChartHeader(
          columnDef,
          rStart.beginOfWeek(this.a("weekStartsMonday",) as boolean,),
          rEnd,
          (t,) => t.sameTimeNextWeek(),
          "%b %Y",
          "%d",
        );
        break;
      case "monthly":
        this.genCalChartHeader(
          columnDef,
          rStart.beginOfMonth(),
          rEnd,
          (t,) => t.sameTimeNextMonth(),
          "%Y",
          "%b",
        );
        break;
      case "quarterly":
        this.genCalChartHeader(
          columnDef,
          rStart.beginOfQuarter(),
          rEnd,
          (t,) => t.sameTimeNextQuarter(),
          "%Y",
          "Q%Q",
        );
        break;
      case "yearly":
        this.genCalChartHeader(
          columnDef,
          rStart.beginOfYear(),
          rEnd,
          (t,) => t.sameTimeNextYear(),
          null,
          "%Y",
        );
        break;
      default: {
        const column = new ReportTableColumn(
          this.table!,
          columnDef,
          columnDef.title ?? "",
        );
        column.cell1.rows = 2;
        column.cell2.hidden = true;
        if (columnDef.width !== null) column.cell1.width = columnDef.width;
        break;
      }
    }
  }

  /** Generates one table line per account of `accountList`. */
  protected generateAccountList(
    accountList: PropertyList<Account>,
    lineOffset: number,
    _mode: string,
  ): number {
    accountList.query = this.currentQuery().dup();
    const query = accountList.query!;
    accountList.sort();

    let no = lineOffset;
    let lineNo = lineOffset;
    let line: ReportTableLine | null = null;
    for (const account of accountList.toArray()) {
      query.property = account;
      no += 1;
      lineNo += 1;
      for (const scenarioIdx of this.scenarioList()) {
        query.scenarioIdx = scenarioIdx;
        line = new ReportTableLine(this.table!, account, null,);
        line.no = no;
        line.lineNo = lineNo;
        line.subLineNo = this.table!.linesCount();
        this.setIndent(
          line,
          this.a("accountroot",) as Account | null,
          accountList.treeMode(),
        );
        for (const columnDef of this.columnList()) {
          this.generateTableCell(line, columnDef, query,);
        }
      }
    }
    return lineNo;
  }

  /**
   * Emits one table line per material of `materialList` (SyntaxMesh extension,
   * phase 14 complement C1.4).
   */
  protected generateMaterialList(
    materialList: PropertyList<Material>,
    lineOffset: number,
  ): number {
    materialList.query = this.currentQuery().dup();
    const query = materialList.query!;
    materialList.sort();

    let no = lineOffset;
    let lineNo = lineOffset;
    let line: ReportTableLine | null = null;
    for (const material of materialList.toArray()) {
      query.property = material;
      no += 1;
      lineNo += 1;
      for (const scenarioIdx of this.scenarioList()) {
        query.scenarioIdx = scenarioIdx;
        line = new ReportTableLine(this.table!, material, null,);
        line.no = no;
        line.lineNo = lineNo;
        line.subLineNo = this.table!.linesCount();
        for (const columnDef of this.columnList()) {
          this.generateTableCell(line, columnDef, query,);
        }
      }
    }
    return lineNo;
  }

  /** Emits the task lines (and recursively those of the assigned resources). */
  protected generateTaskList(
    taskList: PropertyList<Task>,
    resourceList: PropertyList<Resource> | null,
    scopeLine: ReportTableLine | null,
  ): number {
    taskList.query = this.currentQuery().dup();
    const query = taskList.query!;
    query.scopeProperty = scopeLine ? scopeLine.property : null;
    taskList.sort();

    let no = 0;
    let lineNo = scopeLine ? (scopeLine.lineNo ?? 0) : 0;
    let line: ReportTableLine | null = null;
    for (const task of taskList.toArray()) {
      query.property = task;
      query.scopeProperty = scopeLine ? scopeLine.property : null;
      no += 1;
      lineNo += 1;
      for (const scenarioIdx of this.scenarioList()) {
        query.scenarioIdx = scenarioIdx;
        line = new ReportTableLine(this.table!, task, scopeLine,);
        if (!scopeLine) line.no = no;
        line.lineNo = lineNo;
        line.subLineNo = this.table!.linesCount();
        this.setIndent(
          line,
          this.a("taskroot",) as Task | null,
          taskList.treeMode(),
        );
        for (const columnDef of this.columnList()) {
          this.generateTableCell(line, columnDef, query,);
        }
      }

      if (resourceList) {
        resourceList.setSorting(
          this.a("sortResources",) as Array<[string, boolean, number,]>,
        );
        const assigned = this.filterResourceList(
          resourceList,
          task,
          this.a("hideResource",) as never,
          this.a("rollupResource",) as never,
          this.a("openNodes",) as never,
        );
        assigned.sort();
        lineNo = this.generateResourceList(assigned, null, line!,);
      }
    }
    return lineNo;
  }

  /** Generates the resource lines (and, recursively, the assigned tasks). */
  protected generateResourceList(
    resourceList: PropertyList<Resource>,
    taskList: PropertyList<Task> | null,
    scopeLine: ReportTableLine | null,
  ): number {
    resourceList.query = this.currentQuery().dup();
    const query = resourceList.query!;
    query.scopeProperty = scopeLine ? scopeLine.property : null;
    resourceList.sort();

    let no = 0;
    let lineNo = scopeLine ? (scopeLine.lineNo ?? 0) : 0;
    let line: ReportTableLine | null = null;
    for (const resource of resourceList.toArray()) {
      query.property = resource;
      query.scopeProperty = scopeLine ? scopeLine.property : null;
      no += 1;
      lineNo += 1;
      for (const scenarioIdx of this.scenarioList()) {
        query.scenarioIdx = scenarioIdx;
        line = new ReportTableLine(this.table!, resource, scopeLine,);
        if (!scopeLine) line.no = no;
        line.lineNo = lineNo;
        line.subLineNo = this.table!.linesCount();
        this.setIndent(
          line,
          this.a("resourceroot",) as Resource | null,
          resourceList.treeMode(),
        );
        for (const column of this.columnList()) {
          this.generateTableCell(line, column, query,);
        }
      }

      if (taskList) {
        taskList.setSorting(
          this.a("sortTasks",) as Array<[string, boolean, number,]>,
        );
        const assigned = this.filterTaskList(
          taskList,
          resource,
          this.a("hideTask",) as never,
          this.a("rollupTask",) as never,
          this.a("openNodes",) as never,
        );
        assigned.sort();
        lineNo = this.generateTaskList(assigned, null, line!,);
      }
    }
    return lineNo;
  }

  // ------------------------------------------------------------------
  // Private helpers (14.12.5 / 14.12.6)
  // ------------------------------------------------------------------

  /** Header of the calendar columns (hourly..yearly) in a ColumnTable. */
  private genCalChartHeader(
    columnDef: TableColumnDefinition,
    t: TjTime,
    rEnd: TjTime,
    sameTimeNext: SameTimeNext,
    timeformat1: string | null,
    timeformat2: string | null,
  ): void {
    const tableColumn = new ReportTableColumn(this.table!, columnDef, "",);
    if (columnDef.timeformat1) timeformat1 = columnDef.timeformat1;
    if (columnDef.timeformat2) timeformat2 = columnDef.timeformat2;

    this.table!.equiLines = true;
    tableColumn.scrollbar = true;

    const table = new ColumnTable();
    tableColumn.cell1.special = table as unknown as SpecialCell;
    table.equiLines = true;
    table.selfcontained = !!this.a("selfcontained",);
    tableColumn.cell2.hidden = true;
    table.viewWidth = columnDef.width !== null ? columnDef.width : 450;

    while (t.compareTo(rEnd,) < 0) {
      let cellsInInterval = 0;
      const currentInterval = timeformat1 ? t.to_s(timeformat1,) : null;
      let firstColumn: ReportTableColumn | null = null;
      while (
        t.compareTo(rEnd,) < 0 &&
        (timeformat1 === null || t.to_s(timeformat1,) === currentInterval)
      ) {
        const nextT = sameTimeNext(t,);
        const iv = new TimeInterval(t, nextT,);
        const column = new ReportTableColumn(table, null, "",);
        column.cell1.data = t.to_s(
          this.a("timeFormat",) as string | undefined,
        );
        if (firstColumn === null) {
          firstColumn = column;
          column.cell1.text = currentInterval ?? "";
        } else {
          column.cell1.hidden = true;
        }
        column.cell2.text = t.to_s(timeformat2 ?? undefined,);
        // ~7 pixels per character, minimum of 28 for a tidy look.
        const width = 8 + 7 * (column.cell2.text as string).length;
        column.cell2.width = width <= 28 ? 28 : width;
        if (!this.project.hasWorkingTime(this.project.dateToIdx(iv.start,),)) {
          column.cell2.category = "tabhead_offduty";
        }
        cellsInInterval += 1;
        t = nextT;
      }
      if (firstColumn) firstColumn.cell1.columns = cellsInInterval;
    }
  }

  /** Emits the cell (plain, calculated, calendar or chart) of `line`. */
  private generateTableCell(
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
    query: Query,
  ): boolean {
    const q = query.dup();
    q.attributeId = columnDef.id;
    q.start = this.columns.get(columnDef,)?.start ?? null;
    q.end = this.columns.get(columnDef,)?.end ?? null;
    q.listType = columnDef.listType;
    q.listItem = columnDef.listItem as string | null;

    let start: TjTime;
    let sameTimeNext: SameTimeNext;
    switch (columnDef.id) {
      case "chart": {
        // Hidden cell: the real content lives in the `GanttLine`/chart, not here.
        // Ruby assigns `cell.text = nil`; `""` is falsy in TS and yields the
        // same `null` in the CSV.
        const cell = new ReportTableCell(line, q, "",);
        cell.hidden = true;
        // The chart is reachable through the `special` variable of the column
        // header.
        const special = (columnDef.column as ReportTableColumn).cell1.special;
        // Ruby relies on dynamic `send`; here the precondition is checked.
        if (!(special instanceof GanttChart)) {
          throw new Error(
            `Column 'chart' has no GanttChart in its header cell`,
          );
        }
        const gantt = special;
        // RUBY-COMPAT-DOC: `subLineNo` already counts its own line (1-based),
        // so the first chart line lands at y = 0.
        const subLineNo = line.subLineNo ?? 0;
        new GanttLine(
          gantt.asLineChart(),
          q,
          (subLineNo - 1) * (line.height + 1),
          line.height,
          subLineNo,
          this.a("selfcontained",) ? null : columnDef.tooltip,
        );
        return true;
      }
      case "hourly":
        start = q.start!.midnight();
        sameTimeNext = (t,) => t.sameTimeNextHour();
        break;
      case "daily":
        start = q.start!.midnight();
        sameTimeNext = (t,) => t.sameTimeNextDay();
        break;
      case "weekly":
        start = q.start!.beginOfWeek(this.a("weekStartsMonday",) as boolean,);
        sameTimeNext = (t,) => t.sameTimeNextWeek();
        break;
      case "monthly":
        start = q.start!.beginOfMonth();
        sameTimeNext = (t,) => t.sameTimeNextMonth();
        break;
      case "quarterly":
        start = q.start!.beginOfQuarter();
        sameTimeNext = (t,) => t.sameTimeNextQuarter();
        break;
      case "yearly":
        start = q.start!.beginOfYear();
        sameTimeNext = (t,) => t.sameTimeNextYear();
        break;
      default:
        if (TableReport.journalColumns.has(columnDef.id,)) {
          return this.genJournalCell(q, line, columnDef,);
        }
        if (columnDef.id === "timebasis") {
          return this.genTimebasisCell(q, line, columnDef,);
        }
        if (
          line.property instanceof Task &&
          TableReport.taskMaterialColumns.has(columnDef.id,)
        ) {
          return this.genTaskMaterialCell(q, line, columnDef,);
        }
        if (line.property instanceof Material) {
          return this.genMaterialCell(q, line, columnDef,);
        }
        if (TableReport.calculated(columnDef.id,)) {
          return this.genCalculatedCell(q, line, columnDef,);
        }
        return this.genStandardCell(q, line, columnDef,);
    }

    // Calendar cells live in an embedded ColumnTable (through special).
    const embedded = (columnDef.column as ReportTableColumn).cell1
      .special as unknown as ColumnTable;
    const tcLine = new ReportTableLine(
      embedded,
      line.property,
      line.scopeLine,
    );
    new PlaceHolderCell(line, tcLine,);
    tcLine.subLineNo = line.subLineNo;

    const property = q.property;
    if (property instanceof Task) {
      this.genCalChartTaskCell(q, tcLine, columnDef, start, sameTimeNext,);
    } else if (property instanceof Resource) {
      this.genCalChartResourceCell(q, tcLine, columnDef, start, sameTimeNext,);
    } else if (property instanceof Account) {
      this.genCalChartAccountCell(q, tcLine, columnDef, start, sameTimeNext,);
    } else {
      throw new Error(`Unknown property type ${property?.constructor.name}`,);
    }
    return true;
  }

  /** Standard cell: value taken directly from a property attribute. */
  private genStandardCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
  ): boolean {
    const property = line.property;
    let propertyList: PropertySet;
    if (property instanceof Task) {
      propertyList = this.project.tasks;
    } else if (property instanceof Resource) {
      propertyList = this.project.resources;
    } else if (property instanceof Account) {
      propertyList = this.project.accounts;
    } else {
      throw new Error(`Unknown property type ${property?.constructor.name}`,);
    }

    const cell = this.newCell(query, line,);
    if (
      !this.setScenarioSettings(
        cell,
        query.scenarioIdx ?? 0,
        propertyList.scenarioSpecific?.(columnDef.id,) ?? false,
      )
    ) {
      return false;
    }
    this.setStandardCellAttributes(
      query,
      cell,
      columnDef,
      propertyList.attributeType(columnDef.id,),
      line,
    );

    const cdText = columnDef.cellText.getPattern(query,);
    if (cdText) {
      cell.text = this.cellTextForReport(String(cdText,),) as never;
    } else if (query.process()) {
      const rti = query.to_rti();
      cell.text = (rti
        ? this.rtiForReport(rti as RichTextIntermediate,)
        : query.to_s()) as never;
    }

    this.setCustomCellAttributes(cell, columnDef, query,);
    this.checkCellText(cell,);
    return true;
  }

  /** Calculated cell: derived value (alert icons, name, bsi, etc.). */
  private genCalculatedCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
  ): boolean {
    const cell = this.newCell(query, line,);
    if (columnDef.id === "bsi") cell.force_string = true;

    if (
      !this.setScenarioSettings(
        cell,
        query.scenarioIdx ?? 0,
        TableReport.scenarioSpecific(columnDef.id,),
      )
    ) {
      return false;
    }
    this.setStandardCellAttributes(query, cell, columnDef, undefined, line,);

    if (query.process()) {
      const rti = query.to_rti();
      cell.text = (rti
        ? this.rtiForReport(rti as RichTextIntermediate,)
        : query.to_s()) as never;
    }

    switch (columnDef.id) {
      case "alert": {
        const levels = this.project.get("alertLevels",) as Array<
          { id: string; color: string }
        >;
        const level = levels[query.to_sort() as number];
        if (level) {
          cell.icon = `flag-${level.id}`;
          cell.fontColor = level.color;
        }
        break;
      }
      case "alerttrend": {
        const icons = ["up", "flat", "down",];
        cell.icon = `trend-${icons[query.to_sort() as number]}`;
        break;
      }
      case "line":
        cell.text = String(line.lineNo,);
        break;
      case "name": {
        const property = query.property;
        cell.icon = property && property instanceof Task
          ? (property.container() ? "taskgroup" : "task")
          : property && property instanceof Resource
          ? (property.container() ? "resourcegroup" : "resource")
          : null;
        cell.iconTooltip = new RichText(
          `'''ID:''' ${property?.fullId ?? ""}`,
        ).generateIntermediateFormat();
        break;
      }
      case "no":
        cell.text = String(line.no,);
        break;
      case "bsi":
        if (line.scopeLine) cell.indent = 2;
        break;
      case "scenario":
        cell.text = this.project.scenario(query.scenarioIdx ?? 0,)?.name ?? "";
        break;
      default:
        break;
    }

    const cdText = columnDef.cellText.getPattern(query,);
    if (cdText) cell.text = this.cellTextForReport(String(cdText,),) as never;

    this.setCustomCellAttributes(cell, columnDef, query,);
    this.checkCellText(cell,);
    return true;
  }

  /**
   * Cell of the material columns on a task (14C.1.11): `materials` lists the
   * allocations of the task (`material (quantity)`) and `materialcost` sums the
   * `material_usage` `CostEvent`s of the task — falling back to
   * `quantity × price` when there are no events.
   */
  private genTaskMaterialCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
  ): boolean {
    const task = line.property as Task;
    const scIdx = query.scenarioIdx ?? 0;
    const cell = this.newCell(query, line,);
    if (!this.setScenarioSettings(cell, scIdx, false,)) {
      return false;
    }
    this.setStandardCellAttributes(
      query,
      cell,
      columnDef,
      columnDef.id === "materialcost" ? AttributeType.Float : undefined,
      line,
    );

    if (columnDef.id === "materials") {
      // `hidematerial`/`rollupmaterial` (14C.6.6/6.9): a hidden or rolled-up
      // material yields no entry of its own in the task list.
      const allocs = this.taskMaterialAllocations(task, scIdx,).filter((a,) =>
        !this.hiddenBy("hideMaterial", a.material,) &&
        !this.hiddenBy("rollupMaterial", a.material,)
      );
      cell.text = allocs
        .map((a,) => `${a.material.id} (${a.quantity})`)
        .join(", ",);
    } else {
      cell.text = this.formatMaterialNumber(
        this.taskMaterialCost(task, scIdx,),
      );
    }

    const cdText = columnDef.cellText.getPattern(query,);
    if (cdText) cell.text = this.cellTextForReport(String(cdText,),) as never;

    this.setCustomCellAttributes(cell, columnDef, query,);
    // `materials` accepts an empty list (task without materials).
    if (columnDef.id !== "materials") this.checkCellText(cell,);
    return true;
  }

  /**
   * Cell of the `timebasis` column (14C.1.9): it shows the canonical
   * `resolvedTimebasis` of the scenario (`duration`/`length`, resolved in
   * `TaskScenario.prepareScheduling`) rather than the raw attribute value —
   * which stays `nil` when the user declared nothing. Only tasks have a
   * timebasis; every other entity falls back to the standard cell.
   */
  private genTimebasisCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
  ): boolean {
    const property = query.property;
    if (!(property instanceof Task)) {
      return this.genStandardCell(query, line, columnDef,);
    }
    const cell = this.newCell(query, line,);
    if (!this.setScenarioSettings(cell, query.scenarioIdx ?? 0, true,)) {
      return false;
    }
    this.setStandardCellAttributes(query, cell, columnDef, undefined, line,);

    const scenarioData = property.data[query.scenarioIdx ?? 0] as unknown as {
      resolvedTimebasis?: string;
    };
    cell.text = scenarioData?.resolvedTimebasis ?? "duration";

    const cdText = columnDef.cellText.getPattern(query,);
    if (cdText) cell.text = cdText as never;

    this.setCustomCellAttributes(cell, columnDef, query,);
    this.checkCellText(cell,);
    return true;
  }

  /**
   * Journal cell (14C.1.7): ports Ruby's `query_journal` path to any entity —
   * task, resource, material and account. The mode comes from the `journalMode`
   * attribute of the report (default `journal`), as in Ruby.
   *
   * `journal_sub`, `journalmessages` and `journalsummaries` are deprecated
   * aliases of `journal` in the parser; when they arrive here through the API
   * they are resolved by the equivalent paths (`entriesByTaskR` and
   * `currentEntries`).
   */
  private genJournalCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
  ): boolean {
    const cell = this.newCell(query, line,);
    if (!this.setScenarioSettings(cell, query.scenarioIdx ?? 0, false,)) {
      return false;
    }
    this.setStandardCellAttributes(query, cell, columnDef, undefined, line,);

    const journal = this.project.journal;
    if (
      columnDef.id === "journalmessages" ||
      columnDef.id === "journalsummaries"
    ) {
      const property = query.property;
      const entries = property
        ? journal.currentEntries(
          query.end ?? null,
          property,
          0,
          query.start ?? null,
          query.hideJournalEntry,
        )
        : [];
      const rti = journal.messagesRti(
        entries,
        query,
        columnDef.id === "journalmessages",
      );
      if (rti) cell.text = rti as never;
    } else {
      query.journalMode = (this.a("journalMode",) as string | null) ??
        "journal";
      journal.to_rti(query,);
      if (query.rti) cell.text = query.rti as never;
    }

    const cdText = columnDef.cellText.getPattern(query,);
    if (cdText) cell.text = cdText as never;

    this.setCustomCellAttributes(cell, columnDef, query,);
    this.checkCellText(cell,);
    return true;
  }

  /**
   * Material cell (SyntaxMesh extension, phase 14 complement C1.4).
   * Attribute-backed columns (`unit`, `unitprice`→`cost`, `note`) reuse the
   * `Query`/`to_rti` pipeline for the canonical formatting; the calculated
   * columns (`no`, `id`, `name`, `totalquantity`, costs) are resolved here.
   * Since 14C.11.10 `totalquantity` is the sum of the allocations (the material
   * attribute was removed).
   */
  private genMaterialCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
  ): boolean {
    const material = line.property as Material;
    const scIdx = query.scenarioIdx ?? 0;
    const cell = this.newCell(query, line,);

    // Attribute-backed columns (the keyword may differ from the attributeId).
    const attrId = TableReport.materialAttributeColumns.get(columnDef.id,);
    if (attrId !== undefined) {
      const q = query.dup();
      q.attributeId = attrId;
      const scenarioSpecific =
        this.project.materials.scenarioSpecific?.(attrId,) ?? false;
      if (!this.setScenarioSettings(cell, scIdx, scenarioSpecific,)) {
        return false;
      }
      this.setStandardCellAttributes(
        q,
        cell,
        columnDef,
        this.project.materials.attributeType(attrId,),
        line,
      );
      if (q.process()) {
        const rti = q.to_rti();
        cell.text = (rti ? rti : q.to_s()) as never;
      }
      this.setCustomCellAttributes(cell, columnDef, q,);
      this.checkCellText(cell,);
      return true;
    }

    this.setStandardCellAttributes(
      query,
      cell,
      columnDef,
      TableReport.materialNumericColumns.has(columnDef.id,)
        ? AttributeType.Float
        : undefined,
      line,
    );

    switch (columnDef.id) {
      case "no":
        cell.text = String(line.no,);
        break;
      case "id":
        cell.text = material.id;
        break;
      case "name":
        cell.text = material.name as never;
        break;
      case "allocations": {
        const allocs = this.materialAllocations(material, scIdx,);
        cell.text = allocs
          .map((a,) => `${a.task.fullId} (${a.quantity})`)
          .join(", ",);
        break;
      }
      case "totalquantity":
        cell.text = this.formatMaterialNumber(
          this.materialAllocatedQuantity(material, scIdx,),
        );
        break;
      case "scheduledcost":
        cell.text = this.formatMaterialNumber(
          this.materialScheduledCost(material, scIdx,),
        );
        break;
      case "actualcost":
        cell.text = this.formatMaterialNumber(
          this.materialActualCost(material, scIdx,),
        );
        break;
      case "totalcost":
        cell.text = this.formatMaterialNumber(
          this.materialTotalCost(material, scIdx,),
        );
        break;
      // C18 (extra addendum §13.7): algebraic Σ of the stock bookings (movements
      // **without** a task, 14C.13.1) of the material whose date falls in the
      // report period — an inbound movement is positive, an outbound/reversal
      // negative.
      case "stockquantity":
        cell.text = this.formatMaterialNumber(
          this.materialStockQuantity(material, scIdx,),
        );
        break;
      case "stockcost":
        cell.text = this.formatMaterialNumber(
          this.materialStockCost(material, scIdx,),
        );
        break;
      default:
        if (query.process()) {
          const rti = query.to_rti();
          cell.text = (rti ? rti : query.to_s()) as never;
        }
        break;
    }

    this.setCustomCellAttributes(cell, columnDef, query,);
    // The `allocations` column accepts an empty list (material without
    // consumption); the other calculated columns require text.
    if (columnDef.id !== "allocations") this.checkCellText(cell,);
    return true;
  }

  /** Material allocations of `task` in scenario `scIdx` (14C.1.11). */
  private taskMaterialAllocations(
    task: Task,
    scIdx: number,
  ): MaterialAllocation[] {
    return (task.getForScenario("materialallocations", scIdx,) as
      | MaterialAllocation[]
      | null) ?? [];
  }

  /** (Actual consumption) material bookings of `task` (14C.11.3). */
  private taskMaterialBookings(
    task: Task,
    scIdx: number,
  ): MaterialBooking[] {
    return (task.getForScenario("materialbookings", scIdx,) as
      | MaterialBooking[]
      | null) ?? [];
  }

  /**
   * Cost of a booking at the effective unit price (14C.11.6): booking →
   * allocation of the same task and material → material.
   */
  private bookingCost(booking: MaterialBooking, scIdx: number,): number {
    const task = booking.task;
    const allocation = task
      ? this.taskMaterialAllocations(task, scIdx,)
        .find((a,) => a.material === booking.material) ?? null
      : null;
    return booking.cost(allocation,);
  }

  /**
   * Material cost of `task`: the `material_usage` `CostEvent`s of the task or,
   * without events, allocations (planned) plus bookings (actual), each line at
   * its effective unit price (14C.1.11 / 14C.11.6).
   */
  private taskMaterialCost(task: Task, scIdx: number,): number {
    let sum = 0;
    let hasEvents = false;
    for (const ce of this.project.costEvents) {
      if (
        ce.type !== "material_usage" || ce.task !== task ||
        ce.scenarioIdx !== scIdx
      ) {
        continue;
      }
      // A material hidden by `hidematerial` does not enter the cost (14C.6.6).
      const material = ce.material as Material | null;
      if (material && this.hiddenBy("hideMaterial", material,)) continue;
      sum += ce.amount;
      hasEvents = true;
    }
    if (hasEvents) return sum;
    for (const a of this.taskMaterialAllocations(task, scIdx,)) {
      if (this.hiddenBy("hideMaterial", a.material,)) continue;
      sum += a.quantity * a.unitPriceFor();
    }
    for (const booking of this.taskMaterialBookings(task, scIdx,)) {
      if (this.hiddenBy("hideMaterial", booking.material,)) continue;
      sum += this.bookingCost(booking, scIdx,);
    }
    return sum;
  }

  /**
   * Allocations of `material` on the project tasks for scenario `scIdx`, with
   * the `MaterialAllocation` itself (for the effective unit price).
   */
  private materialAllocations(
    material: Material,
    scIdx: number,
  ): Array<{
    task: Task;
    quantity: number;
    allocation: MaterialAllocation;
  }> {
    const out: Array<{
      task: Task;
      quantity: number;
      allocation: MaterialAllocation;
    }> = [];
    for (const node of this.project.tasks.toArray()) {
      if (!(node instanceof Task)) continue;
      for (const allocation of this.taskMaterialAllocations(node, scIdx,)) {
        if (allocation.material === material) {
          out.push({
            task: node,
            quantity: allocation.quantity,
            allocation,
          },);
        }
      }
    }
    return out;
  }

  /**
   * Quantity derived from the material (14C.11.10): Σ
   * `MaterialAllocation.quantity` in the report period. Without an allocation,
   * 0. It delegates to the single source `Material.allocatedQuantityInPeriod`
   * (wave C), shared with `MaterialScenario#query_effort`.
   */
  private materialAllocatedQuantity(
    material: Material,
    scIdx: number,
  ): number {
    const start = (this.a("start",) as TjTime | null) ?? null;
    const end = (this.a("end",) as TjTime | null) ?? null;
    return material.allocatedQuantityInPeriod(scIdx, start, end,);
  }

  /**
   * Planned cost: `planned` `CostEvent`s > allocations in the period. Without
   * an allocation the material has no planned cost (`totalquantity` was removed
   * in 14C.11.10). It delegates to the single source (wave C).
   */
  private materialScheduledCost(material: Material, scIdx: number,): number {
    const start = (this.a("start",) as TjTime | null) ?? null;
    const end = (this.a("end",) as TjTime | null) ?? null;
    return material.scheduledCostInPeriod(scIdx, start, end,);
  }

  /**
   * Actual cost: `actual` `CostEvent`s > bookings in the period. Without either,
   * 0. It delegates to the single source (wave C).
   */
  private materialActualCost(material: Material, scIdx: number,): number {
    const start = (this.a("start",) as TjTime | null) ?? null;
    const end = (this.a("end",) as TjTime | null) ?? null;
    return material.actualCostInPeriod(scIdx, start, end,);
  }

  /** Total cost: `CostEvent`s (planned + actual) > allocations + bookings. */
  private materialTotalCost(material: Material, scIdx: number,): number {
    const start = (this.a("start",) as TjTime | null) ?? null;
    const end = (this.a("end",) as TjTime | null) ?? null;
    return material.totalCostInPeriod(scIdx, start, end,);
  }

  /** `stockquantity`: algebraic Σ of the stock quantities in the period. */
  private materialStockQuantity(material: Material, scIdx: number,): number {
    const start = (this.a("start",) as TjTime | null) ?? null;
    const end = (this.a("end",) as TjTime | null) ?? null;
    return material.stockQuantityInPeriod(scIdx, start, end,);
  }

  /**
   * `stockcost`: algebraic Σ of the stock values in the period, at the effective
   * booking price (booking → material, through `unitPriceFor`).
   */
  private materialStockCost(material: Material, scIdx: number,): number {
    const start = (this.a("start",) as TjTime | null) ?? null;
    const end = (this.a("end",) as TjTime | null) ?? null;
    return material.stockCostInPeriod(scIdx, start, end,);
  }

  /** Formats material monetary values (the report `numberFormat`). */
  private formatMaterialNumber(value: number,): string {
    const fmt = this.a("numberFormat",) as
      | { format(n: number,): string }
      | null;
    if (fmt && typeof fmt.format === "function") return fmt.format(value,);
    // Same formatting as the core Float attributes (`AttributeBase#to_s`).
    return String(value,);
  }

  /** Calendar cells for accounts (attributeId 'balance'). */
  private genCalChartAccountCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
    t: TjTime,
    sameTimeNext: SameTimeNext,
  ): void {
    const q = query.dup();
    let firstCell: ReportTableCell | null = null;
    const endDate = q.end!;
    while (t.compareTo(endDate,) < 0) {
      const nextT = sameTimeNext(t,);
      q.attributeId = "balance";
      q.start = t;
      q.end = nextT;
      q.process();
      const cell = this.newCell(q, line,);
      cell.text = q.to_s();
      const cdText = columnDef.cellText.getPattern(q,);
      if (cdText) cell.text = cdText as never;
      cell.showTooltipHint = false;
      this.setAccountCellBgColor(q, line, cell,);
      this.setCustomCellAttributes(cell, columnDef, q,);
      this.tryCellMerging(cell, line, firstCell,);
      t = nextT;
      if (!firstCell) firstCell = cell;
    }
  }

  /** Calendar cells for tasks (caltask/calconttask category). */
  private genCalChartTaskCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
    t: TjTime,
    sameTimeNext: SameTimeNext,
  ): void {
    const task = line.property as Task;
    const taskStart = this.scenarioTime(task, "start", query.scenarioIdx ?? 0,);
    const taskEnd = this.scenarioTime(task, "end", query.scenarioIdx ?? 0,);
    const taskIv = new TimeInterval(
      (taskStart ?? this.project.get("start",)) as TjTime,
      (taskEnd ?? this.project.get("end",)) as TjTime,
    );
    const q = query.dup();
    let firstCell: ReportTableCell | null = null;
    const endDate = q.end!;
    while (t.compareTo(endDate,) < 0) {
      const nextT = sameTimeNext(t,);
      const cellIv = new TimeInterval(t, nextT,);
      let cell: ReportTableCell;
      if (columnDef.content === "empty") {
        cell = this.newCell(q, line,);
      } else if (columnDef.content === "load") {
        q.attributeId = "effort";
        q.start = t;
        q.end = nextT;
        q.process();
        cell = this.newCell(q, line,);
        if (q.to_num() !== 0) cell.text = q.to_s();
      } else {
        throw new Error(`Unknown column content ${columnDef.content}`,);
      }
      const cdText = columnDef.cellText.getPattern(q,);
      if (cdText) cell.text = cdText as never;
      cell.showTooltipHint = false;

      if (cellIv.overlaps(taskIv,)) {
        cell.category = task.container() ? "calconttask" : "caltask";
      } else if (
        !this.project.isWorkingTime(this.project.dateToIdx(cellIv.start,),)
      ) {
        cell.category = "offduty";
      } else {
        cell.category = "taskcell";
      }
      cell.category += (line.subLineNo! ?? 0) % 2 === 1 ? "1" : "2";

      this.setCustomCellAttributes(cell, columnDef, q,);
      this.tryCellMerging(cell, line, firstCell,);
      t = nextT;
      if (!firstCell) firstCell = cell;
    }
    this.legend.addCalendarItem("Container Task", "calconttask1",);
    this.legend.addCalendarItem("Task", "caltask1",);
    this.legend.addCalendarItem("Off duty time", "offduty",);
  }

  /** Calendar cells for resources (busy/loaded/free/offduty). */
  private genCalChartResourceCell(
    query: Query,
    line: ReportTableLine,
    columnDef: TableColumnDefinition,
    t: TjTime,
    sameTimeNext: SameTimeNext,
  ): void {
    let task: Task | null = null;
    let taskIv: TimeInterval | null = null;
    if (line.scopeLine && line.scopeLine.property instanceof Task) {
      task = line.scopeLine.property as Task;
      const taskStart = this.scenarioTime(
        task,
        "start",
        query.scenarioIdx ?? 0,
      );
      const taskEnd = this.scenarioTime(task, "end", query.scenarioIdx ?? 0,);
      taskIv = new TimeInterval(
        (taskStart ?? this.project.get("start",)) as TjTime,
        (taskEnd ?? this.project.get("end",)) as TjTime,
      );
    }
    const q = query.dup();
    let firstCell: ReportTableCell | null = null;
    const endDate = q.end!;
    while (t.compareTo(endDate,) < 0) {
      const cell = this.newCell(q, line,);
      const nextT = sameTimeNext(t,);
      const cellIv = new TimeInterval(t, nextT,);
      q.scopeProperty = null;
      q.attributeId = "effort";
      q.startIdx = this.project.dateToIdx(t,);
      q.endIdx = this.project.dateToIdx(nextT,);
      q.process();
      const workLoad = q.to_num() ?? 0;
      let scaledWorkLoad = q.to_s();
      let workLoadTask = 0;
      if (task) {
        q.scopeProperty = task;
        q.process();
        workLoadTask = q.to_num() ?? 0;
        scaledWorkLoad = q.to_s();
      }
      q.attributeId = "freework";
      q.process();
      const freeLoad = q.to_num() ?? 0;

      if (columnDef.content === "load") {
        const w = task ? workLoadTask : workLoad;
        if (w > 0) cell.text = scaledWorkLoad;
      } else if (columnDef.content !== "empty") {
        throw new Error(`Unknown column content ${columnDef.content}`,);
      }

      const cdText = columnDef.cellText.getPattern(q,);
      if (cdText) cell.text = cdText as never;
      cell.tooltip = (columnDef.tooltip.getPattern(q,) ?? null) as never;
      cell.showTooltipHint = false;

      if (task && taskIv) {
        if (cellIv.overlaps(taskIv,)) {
          if (workLoadTask > 0 && freeLoad === 0) cell.category = "busy";
          else if (workLoad === 0 && freeLoad === 0) {
            cell.tooltip = null;
            cell.category = "offduty";
          } else cell.category = "loaded";
        } else {
          if (freeLoad > 0) cell.category = "free";
          else if (workLoad === 0 && freeLoad === 0) {
            cell.tooltip = null;
            cell.category = "offduty";
          } else {
            cell.tooltip = null;
            cell.category = "resourcecell";
          }
        }
      } else {
        if (workLoad > 0 && freeLoad === 0) cell.category = "busy";
        else if (workLoad > 0 && freeLoad > 0) cell.category = "loaded";
        else if (workLoad === 0 && freeLoad === 0) {
          cell.tooltip = null;
          cell.category = "offduty";
        } else cell.category = "free";
      }
      cell.category += (line.subLineNo! ?? 0) % 2 === 1 ? "1" : "2";

      this.setCustomCellAttributes(cell, columnDef, q,);
      this.tryCellMerging(cell, line, firstCell,);
      t = nextT;
      if (!firstCell) firstCell = cell;
    }
    this.legend.addCalendarItem("Resource is fully loaded", "busy1",);
    this.legend.addCalendarItem("Resource is partially loaded", "loaded1",);
    this.legend.addCalendarItem("Resource is available", "free",);
    this.legend.addCalendarItem("Off duty time", "offduty",);
  }

  /** Applies the default indentation, alignment and background colour of the cell. */
  private setStandardCellAttributes(
    query: Query,
    cell: ReportTableCell,
    columnDef: TableColumnDefinition,
    attributeType: AttributeType | undefined,
    line: ReportTableLine,
  ): void {
    if (TableReport.indent(columnDef.id, attributeType,)) {
      cell.indent = line.indentation;
    }
    cell.alignment = TableReport.alignment(
      columnDef.id,
      attributeType,
    ) as never;

    if (line.property instanceof Task) {
      cell.category = "taskcell";
      cell.category += (line.subLineNo! ?? 0) % 2 === 1 ? "1" : "2";
    } else if (line.property instanceof Resource) {
      cell.category = "resourcecell";
      cell.category += (line.subLineNo! ?? 0) % 2 === 1 ? "1" : "2";
    } else if (line.property instanceof Account) {
      this.setAccountCellBgColor(query, line, cell,);
    }

    if (columnDef.width !== null) cell.width = columnDef.width;
  }

  /** Applies the user-defined colors/alignment/tooltips to the cell. */
  private setCustomCellAttributes(
    cell: ReportTableCell,
    columnDef: TableColumnDefinition,
    query: Query,
  ): void {
    const cellColor = columnDef.cellColor.getPattern(query,);
    if (cellColor) cell.cellColor = cellColor as string;
    const fontColor = columnDef.fontColor.getPattern(query,);
    if (fontColor) cell.fontColor = fontColor as string;
    const hAlign = columnDef.hAlign.getPattern(query,);
    if (hAlign) cell.alignment = hAlign as never;
    const cdTooltip = columnDef.tooltip.getPattern(query,);
    if (cdTooltip) cell.tooltip = cdTooltip as never;
  }

  /**
   * With multiple scenarios, attributes that are not scenario specific appear
   * only on the line of the first scenario (with a larger font); the others are
   * hidden.
   */
  private setScenarioSettings(
    cell: ReportTableCell,
    scenarioIdx: number,
    scenarioSpecific: boolean,
  ): boolean {
    const scenarios = this.scenarioList();
    if (scenarios.length > 1 && !scenarioSpecific) {
      if (scenarioIdx === scenarios[0]) {
        cell.fontSize = 15;
      } else {
        cell.hidden = true;
        return false;
      }
      cell.rows = scenarios.length;
    }
    return true;
  }

  /** Creates a new cell; cells of container lines are bold in bold lines. */
  private newCell(query: Query, line: ReportTableLine,): ReportTableCell {
    const cell = new ReportTableCell(line, query,);
    const property = line.property;
    if (property && property.container() && line.bold) cell.bold = true;
    return cell;
  }

  /** Sets the line indentation (level relative to the root; tree mode). */
  private setIndent(
    line: ReportTableLine,
    propertyRoot: PropertyTreeNode | null,
    treeMode: boolean,
  ): void {
    const property = line.property!;
    const scopeLine = line.scopeLine;
    const level = property.level - (propertyRoot ? propertyRoot.level : 0);
    if (scopeLine) line.indentation = (scopeLine.indentation ?? 0) + 1;
    if (treeMode) {
      line.indentation += level;
      line.bold = true;
    }
  }

  /** Background category of an account cell (cost/revenue + zebra). */
  private setAccountCellBgColor(
    query: Query,
    line: ReportTableLine,
    cell: ReportTableCell,
  ): void {
    const property = query.property;
    let prefix = "";
    const cost = query.costAccount;
    const revenue = query.revenueAccount;
    if (
      cost && property && (property.isChildOf(cost as never,) ||
        (property as unknown) === cost)
    ) {
      prefix = "cost";
    } else if (
      revenue && property && (property.isChildOf(revenue as never,) ||
        (property as unknown) === revenue)
    ) {
      prefix = "revenue";
    }
    cell.category = `${prefix}accountcell` +
      ((line.subLineNo! ?? 0) % 2 === 1 ? "1" : "2");
  }

  /** Guarantees valid text; flags the cell in red when it is missing. */
  private checkCellText(cell: ReportTableCell,): void {
    if (!cell.text) {
      cell.text = "<Error>";
      cell.fontColor = "#FF0000";
    }
  }

  /** Merges consecutive empty cells into a multi-column cell. */
  private tryCellMerging(
    cell: ReportTableCell,
    line: ReportTableLine,
    firstCell: ReportTableCell | null,
  ): void {
    if (cell.text === "" && firstCell) {
      const prev = line.last(1,) as ReportTableCell | null;
      if (prev === cell) {
        cell.hidden = true;
        prev.columns += 1;
      }
    }
  }

  // ------------------------------------------------------------------
  // Internal accessors of report attributes
  // ------------------------------------------------------------------

  /** Column definitions requested by the report, in declaration order. */
  protected columnList(): TableColumnDefinition[] {
    return (this.a("columns",) as TableColumnDefinition[] | undefined) ?? [];
  }

  /** Scenario indices requested by the report, in declaration order. */
  protected scenarioList(): number[] {
    return (this.a("scenarios",) as number[] | undefined) ?? [];
  }

  /**
   * Date attribute `id` of `node` in scenario `scIdx`, or `null` when unset.
   */
  private scenarioTime(
    node: Task | Resource | Account,
    id: string,
    scIdx: number,
  ): TjTime | null {
    return (node.getForScenario(id, scIdx,) as TjTime | null) ?? null;
  }
}
