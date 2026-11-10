/**
 * GanttLine (phase 15.10) — one (property) line of the Gantt chart.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/GanttLine.rb`.
 *
 * Each line represents a property. Depending on its type and context:
 * - standalone task → `GanttTaskBar`, `GanttMilestone` or `GanttContainer`;
 * - task nested in a resource → `GanttLoadStack` (work inside the scope);
 * - resource (nested or not) → `GanttLoadStack`.
 *
 * The `chart` is consumed through a **structural interface** (`GanttLineChart`)
 * to break the circular reference with `GanttChart` (15.11). As in Ruby, the
 * calls to `getEffectiveWork`/`getEffectiveFreeWork`/`getScenario` are
 * polymorphic (there via `PropertyTreeNode#method_missing`): here the property
 * is seen as `GanttLineProperty`, whose `scenarioData(scIdx)` exposes the three
 * methods used by the line.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.10)
 */
import type { Query, } from "../query/query.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import { Task, } from "../model/task.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { CellSettingPatternList, } from "../reports/table-column-definition.ts";
import {
  lineToHTML as graphicsLineToHTML,
  rectToHTML as graphicsRectToHTML,
} from "./html-graphics.ts";
import type { TjTime, } from "../time/tj-time.ts";
import type { ZoneRouter, } from "./gantt-router.ts";
import { GanttMilestone, } from "./gantt-milestone.ts";
import { GanttContainer, } from "./gantt-container.ts";
import { GanttLoadStack, type LoadStackHost, } from "./gantt-load-stack.ts";
import { GanttTaskBar, } from "./gantt-task-bar.ts";

/** Interval returned by `collectTimeOffIntervals` (`[start, end]`). */
export interface TimeOffInterval {
  /** First instant of the off-time interval. */
  readonly start: TjTime;
  /** Last instant of the off-time interval. */
  readonly end: TjTime;
}

/** Subset of `*Scenario` used by `GanttLine` (Ruby `method_missing`). */
export interface GanttLineScenario {
  /**
   * Ruby `getEffectiveWork(startIdx, endIdx[, scope])`: in `TaskScenario` it is
   * the *effective work* of the task (with `scope` = resource); in
   * `ResourceScenario` it is the allocated work (with `scope` = task).
   *
   * @param startIdx First slot index of the period.
   * @param endIdx Last slot index of the period.
   * @param scope Property restricting the computation, when applicable.
   * @returns The effective work of the period.
   */
  getEffectiveWork(
    startIdx: number,
    endIdx: number,
    scope?: GanttLineProperty,
  ): number;
  /**
   * Ruby `getEffectiveFreeWork(startIdx, endIdx)` (resources only).
   *
   * @param startIdx First slot index of the period.
   * @param endIdx Last slot index of the period.
   * @returns The free work of the period.
   */
  getEffectiveFreeWork(startIdx: number, endIdx: number,): number;
  /**
   * Ruby `collectTimeOffIntervals(iv, minDuration)`.
   *
   * @param iv Period the off-time intervals are collected from.
   * @param minDuration Ignore intervals shorter than this, in seconds.
   * @returns The off-time intervals of the period.
   */
  collectTimeOffIntervals(
    iv: TimeOffInterval,
    minDuration: number,
  ): readonly TimeOffInterval[];
}

/** Property (`Task`/`Resource`) as seen by the line. */
export interface GanttLineProperty {
  /**
   * Ruby `property['id', scenarioIdx]`.
   *
   * @param id Attribute id to read.
   * @param scenarioIdx Scenario the value is read from.
   * @returns The attribute value.
   */
  getForScenario(id: string, scenarioIdx: number,): unknown;
  /** Ruby `property.container?`. */
  container(): boolean;
  /**
   * Ruby `property.getScenario(scenarioIdx)` (via `method_missing`).
   *
   * @param scenarioIdx Scenario to return.
   * @returns The scenario view of the property.
   */
  scenarioData(scenarioIdx: number,): GanttLineScenario;
}

/** Project as seen by the line. */
export interface GanttLineProject {
  /**
   * Ruby `project['start']` / `project['end']`.
   *
   * @param id Attribute id to read.
   * @returns The attribute value.
   */
  get(id: string,): unknown;
  /**
   * Ruby `project.dateToIdx(date)`.
   *
   * @param date Date to convert.
   * @returns The slot index of the date.
   */
  dateToIdx(date: TjTime,): number;
  /** Ruby `project.reportContexts` (used by `rollupTask`). */
  readonly reportContexts: ReadonlyArray<{
    readonly report: { get(id: string,): unknown };
  }>;
}

/** Legend of the `TableReport` (phase 14.14). */
export interface GanttLineLegend {
  /** Whether the fixed Gantt symbols are shown in the legend. */
  showGanttItems: boolean;
  /**
   * Adds one symbol to the legend.
   *
   * @param label Text shown next to the symbol.
   * @param category CSS class of the colored box.
   */
  addGanttItem(label: string, category: string,): void;
}

/** Header consumed by the line (15.9). */
export interface GanttLineHeader {
  /** Height of the header, in pixels. */
  readonly height: number;
  /** X coordinates of the grid lines. */
  readonly gridLines: readonly number[];
  /** Start dates of the small-scale cells. */
  readonly cellStartDates: readonly TjTime[];
  /** X of the "now" line, or `null` when outside the chart. */
  readonly nowLineX: number | null;
  /** X of the `markdate` line, or `null` when outside the chart. */
  readonly markdateLineX: number | null;
}

/** Chart consumed by the line (15.11), in structural form. */
export interface GanttLineChart {
  /** Width of the chart, in pixels. */
  readonly width: number;
  /** First date of the reported period. */
  readonly start: TjTime;
  /** Last date of the reported period. */
  readonly end: TjTime;
  /** Header of the chart. */
  readonly header: GanttLineHeader;
  /** Current scale: only `minTimeOff` matters here. */
  readonly scale: { readonly minTimeOff: number };
  /** Table owning the chart, or `null` when there is none. */
  readonly table: { readonly legend: GanttLineLegend } | null;
  /**
   * Ruby `chart.dateToX(date)` (already truncated).
   *
   * @param date Date to map onto the X axis.
   * @returns The X coordinate, in pixels.
   */
  dateToX(date: TjTime,): number;
  /**
   * Ruby `chart.addLine(line)` (registers the line).
   *
   * @param line Line to register.
   */
  addLine(line: GanttLine,): void;
  /**
   * Ruby `chart.addTask(task, line)` (primary task lines).
   *
   * @param task Task the line belongs to.
   * @param line Line to register.
   */
  addTask(task: PropertyTreeNode, line: GanttLine,): void;
}

/** Content element of a line (bar, milestone, container, stack). */
export interface GanttContent {
  /**
   * Renders the content element.
   *
   * @returns The HTML elements, or `null` when nothing is drawn.
   */
  to_html(): XMLElementLike[] | null;
  /**
   * Registers the zones the routed lines must not cross.
   *
   * @param router Router receiving the blocked rectangles.
   */
  addBlockedZones(router: ZoneRouter,): void;
}

/**
 * Content that exposes the anchors of the dependency arrows (15.11):
 * `GanttTaskBar`, `GanttMilestone` and `GanttContainer`.
 */
export interface DepLineContent extends GanttContent {
  /**
   * Where arrows leaving the start anchor begin.
   *
   * @returns The `[x, y]` point.
   */
  startDepLineStart(): [number, number,];
  /**
   * Where arrows arriving at the start anchor end.
   *
   * @returns The `[x, y]` point.
   */
  startDepLineEnd(): [number, number,];
  /**
   * Where arrows leaving the end anchor begin.
   *
   * @returns The `[x, y]` point.
   */
  endDepLineStart(): [number, number,];
  /**
   * Where arrows arriving at the end anchor end.
   *
   * @returns The `[x, y]` point.
   */
  endDepLineEnd(): [number, number,];
}

/** Logical expression of `rollupTask` (phase 11). */
interface RollupExpression {
  eval(query: Query,): boolean;
}

/** One line of the Gantt chart. */
export class GanttLine implements LoadStackHost {
  private readonly chart: GanttLineChart;
  /** Query holding the property and the scenario of the line. */
  readonly query: Query;
  private readonly tooltip: CellSettingPatternList | null;
  /** Background colour of the line (`taskcellN`/`resourcecellN`). */
  private category: string | null = null;
  /** Absolute Y of the top of the line (header already included). */
  readonly y: number;
  /** Height of the line, in pixels. */
  readonly height: number;
  private readonly lineIndex: number;
  /** Off-time zones as `[startX, width]`. */
  private timeOffZones: Array<[number, number,]> = [];
  private content: GanttContent[] = [];

  /**
   * Creates a line, registers it on the chart and generates its content.
   *
   * @param chart Chart the line belongs to.
   * @param query Query holding the property and the scenario of the line.
   * @param y Top offset reported by the table, in pixels.
   * @param height Height of the line, in pixels.
   * @param lineIndex Index of the line inside the table.
   * @param tooltip Tooltip definition of the column, or `null`.
   */
  constructor(
    chart: GanttLineChart,
    query: Query,
    y: number,
    height: number,
    lineIndex: number,
    tooltip: CellSettingPatternList | null,
  ) {
    this.chart = chart;
    // Registers the line on the chart (before anything else, as Ruby does).
    this.chart.addLine(this,);

    this.query = query;
    this.tooltip = tooltip;
    this.category = null;
    this.y = y + chart.header.height + 1;
    this.height = height;
    this.lineIndex = lineIndex;
    this.timeOffZones = [];

    this.generate();
  }

  /**
   * Converts the abstract line into `<div>`s (Ruby `to_html`).
   *
   * @returns The line element with its zones, content and reference lines.
   */
  to_html(): XMLElementLike {
    const div = new XMLElement("div", {
      class: this.category ?? "",
      style: "margin:0px; padding:0px; position:absolute; " +
        `left:0px; top:${this.y}px; ` +
        `width:${Math.trunc(this.chart.width,)}px; ` +
        `height:${this.height}px; ` +
        "font-size:10px;",
    },);
    // Off-time zones.
    for (const zone of this.timeOffZones) {
      div.append(
        this.rectToHTML(zone[0], 0, zone[1], this.height, "offduty",),
      );
    }

    // Grid lines (large scale of the header).
    for (const line of this.chart.header.gridLines) {
      div.append(this.rectToHTML(line, 0, 1, this.height, "tabvline",),);
    }

    // Content (bars, milestones, load stacks).
    for (const c of this.content) {
      const html = c.to_html();
      if (html && html[0]) {
        this.addHtmlTooltip(this.tooltip, this.query, html[0], div,);
        for (const el of html) div.append(el,);
      }
    }

    // "now" line.
    const nowLineX = this.chart.header.nowLineX;
    if (nowLineX !== null) {
      div.append(this.rectToHTML(nowLineX, 0, 1, this.height, "nowline",),);
    }

    // "markdate" line.
    const markdateLineX = this.chart.header.markdateLineX;
    if (markdateLineX !== null) {
      div.append(
        this.rectToHTML(markdateLineX, 0, 1, this.height, "markdateline",),
      );
    }

    return div;
  }

  /**
   * Only meaningful for primary task lines (Ruby `getTask`).
   *
   * @returns The single content element of the line, or `null` when the line
   * does not hold exactly one.
   */
  getTask(): GanttContent | null {
    return this.content.length === 1 ? this.content[0]! : null;
  }

  /**
   * Delegates the registration of the blocked zones to the content (Ruby does
   * the same).
   *
   * @param router Router receiving the blocked rectangles.
   */
  addBlockedZones(router: ZoneRouter,): void {
    for (const c of this.content) c.addBlockedZones(router,);
  }

  /**
   * Ruby `HTMLGraphics#lineToHTML` (used by the `GanttLoadStack`s).
   *
   * @param xs Start X coordinate, in pixels.
   * @param ys Start Y coordinate, in pixels.
   * @param xe End X coordinate, in pixels.
   * @param ye End Y coordinate, in pixels.
   * @param category CSS class of the line.
   * @returns The line element.
   */
  lineToHTML(
    xs: number,
    ys: number,
    xe: number,
    ye: number,
    category: string,
  ): XMLElementLike {
    return graphicsLineToHTML(xs, ys, xe, ye, category,);
  }

  /**
   * Ruby `HTMLGraphics#rectToHTML` (used by the `GanttLoadStack`s).
   *
   * @param x Left offset, in pixels.
   * @param y Top offset, in pixels.
   * @param w Width, in pixels.
   * @param h Height, in pixels.
   * @param category CSS class of the rectangle.
   * @returns The rectangle element.
   */
  rectToHTML(
    x: number,
    y: number,
    w: number,
    h: number,
    category: string,
  ): XMLElementLike {
    return graphicsRectToHTML(x, y, w, h, category,);
  }

  /** Generates the abstract content of this line (Ruby `generate`). */
  private generate(): void {
    this.content = [];
    this.generateTimeOffZones();

    if (this.isTask()) {
      this.generateTask();
    } else {
      this.generateResource();
    }
  }

  /**
   * `true` when the property is a `Task` (Ruby `is_a?(Task)`).
   *
   * @returns Whether the line represents a task.
   */
  private isTask(): boolean {
    return this.query.property instanceof Task;
  }

  /** Query property as a source of work. */
  private get property(): GanttLineProperty {
    return asGanttProperty(this.propertyNode,)!;
  }

  /** Real property node (for the model APIs and for the chart). */
  private get propertyNode(): PropertyTreeNode {
    const node = this.query.property;
    if (node === null) {
      throw new Error("GanttLine requires a property in the query",);
    }
    return node;
  }

  /** Scope property (resource or task), when there is one. */
  private get scopeProperty(): GanttLineProperty | null {
    return asGanttProperty(this.query.scopeProperty,);
  }

  /** Project of the query (the Gantt always runs inside a project). */
  private get project(): GanttLineProject {
    const project = this.query.project;
    if (project === null) {
      throw new Error("GanttLine requires a project in the query",);
    }
    return project as unknown as GanttLineProject;
  }

  /** Scenario index of the query (0 when absent, as in `TableReport`). */
  private get scenarioIdx(): number {
    return this.query.scenarioIdx ?? 0;
  }

  /** Abstract form of a task line (Ruby `generateTask`). */
  private generateTask(): void {
    this.category = `taskcell${(this.lineIndex + 1) % 2 + 1}`;

    const project = this.project;
    const property = this.property;
    const scopeProperty = this.scopeProperty;
    const scIdx = this.scenarioIdx;
    const taskStart = (property.getForScenario("start", scIdx,) ??
      project.get("start",)) as TjTime;
    const taskEnd = (property.getForScenario("end", scIdx,) ??
      project.get("end",)) as TjTime;

    if (scopeProperty) {
      // Task nested in a resource: load stack relative to the scope.
      let x: number | null = null;
      let startDate: TjTime | null = null;
      let endDate: TjTime | null = null;
      const categories: Array<string | null> = ["busy", null,];

      for (const date of this.chart.header.cellStartDates) {
        if (x === null) {
          endDate = date;
          x = Math.trunc(this.chart.dateToX(endDate,),);
          continue;
        }
        const xNew = Math.trunc(this.chart.dateToX(date,),);
        let w = xNew - x;
        startDate = endDate!;
        endDate = date;

        // Only stacks overlapping the scope task interval matter.
        if (!taskStart.lessThan(endDate,) || !startDate.lessThan(taskEnd,)) {
          continue;
        }
        if (startDate.lessThan(taskStart,) && taskStart.lessThan(endDate,)) {
          // Aligns the left edge of the first stack with the scope start.
          startDate = taskStart;
          x = this.chart.dateToX(startDate,);
          w = xNew - x + 1;
        } else if (
          startDate.lessThan(taskEnd,) && taskEnd.lessThan(endDate,)
        ) {
          // Aligns the right edge of the last stack with the scope end.
          endDate = taskEnd;
          w = this.chart.dateToX(endDate,) - x;
        }
        const startIdx = project.dateToIdx(startDate,);
        const endIdx = project.dateToIdx(endDate,);
        const scopeScenario = scopeProperty.scenarioData(scIdx,);

        const overallWork = scopeScenario.getEffectiveWork(startIdx, endIdx,) +
          scopeScenario.getEffectiveFreeWork(startIdx, endIdx,);
        const workThisTask = property.scenarioData(scIdx,).getEffectiveWork(
          startIdx,
          endIdx,
          scopeProperty,
        );
        // No work on either side: draw an empty frame.
        const values = overallWork === 0 && workThisTask === 0
          ? [0, 1,]
          : [workThisTask, overallWork - workThisTask,];
        this.content.push(
          new GanttLoadStack(this, x + 1, w - 2, values, categories,),
        );

        x = xNew;
      }
      if (this.chart.table) {
        this.chart.table.legend.addGanttItem(
          "Resource assigned to task(s)",
          "busy",
        );
      }
      return;
    }

    // Primary task: classic bar, milestone or container.
    const xStart = this.chart.dateToX(taskStart,);
    const xEnd = this.chart.dateToX(taskEnd,);
    // The chart indexes the lines by the real node (`@tasks.include?(task)`).
    this.chart.addTask(this.propertyNode, this,);

    if (property.getForScenario("milestone", scIdx,)) {
      this.content.push(new GanttMilestone(this.height, xStart, this.y,),);
    } else if (property.container() && !this.isRollupTask()) {
      this.content.push(
        new GanttContainer(this.height, xStart, xEnd, this.y,),
      );
    } else {
      this.content.push(
        new GanttTaskBar(this.query, this.height, xStart, xEnd, this.y,),
      );
    }

    // Makes sure the legend includes the Gantt symbols.
    if (this.chart.table) {
      this.chart.table.legend.showGanttItems = true;
      this.chart.table.legend.addGanttItem("Off-duty period", "offduty",);
    }
  }

  /**
   * `true` when the report's `rollupTask` matches this property (in that case a
   * container becomes a bar). Port of `!rollupExpr.eval(@query)` with Ruby's
   * `nil?`.
   *
   * @returns Whether the task is rolled up by the report.
   */
  private isRollupTask(): boolean {
    const contexts = this.project.reportContexts;
    const last = contexts[contexts.length - 1];
    // RUBY-COMPAT-FIX: Ruby would blow up on `nil.report`; without a report
    // context there is no `rollupTask`, hence no rollup.
    if (!last) return false;
    const rollupExpr = last.report.get("rollupTask",);
    // RUBY-COMPAT-FIX: Ruby would blow up on `nil.report`; without `rollupTask`
    // the task is not rolled up.
    if (rollupExpr === null || rollupExpr === undefined) return false;
    return (rollupExpr as RollupExpression).eval(this.query,);
  }

  /** Abstract form of a resource line (Ruby `generateResource`). */
  private generateResource(): void {
    this.category = `resourcecell${(this.lineIndex + 1) % 2 + 1}`;

    const project = this.project;
    const property = this.property;
    const scopeProperty = this.scopeProperty;
    const scIdx = this.scenarioIdx;

    let categories: Array<string | null>;
    let taskStart: TjTime | null = null;
    let taskEnd: TjTime | null = null;

    // Resource nested in a task: assigned to this task, to others, or free.
    if (scopeProperty) {
      categories = ["assigned", "busy", "free",];
      taskStart = (scopeProperty.getForScenario("start", scIdx,) ??
        project.get("start",)) as TjTime;
      taskEnd = (scopeProperty.getForScenario("end", scIdx,) ??
        project.get("end",)) as TjTime;

      if (this.chart.table) {
        this.chart.table.legend.addGanttItem(
          "Resource assigned to this task",
          "assigned",
        );
        this.chart.table.legend.addGanttItem(
          "Resource assigned to task(s)",
          "busy",
        );
        this.chart.table.legend.addGanttItem("Resource available", "free",);
        this.chart.table.legend.addGanttItem("Off-duty period", "offduty",);
      }
    } else {
      categories = ["busy", "free",];
      if (this.chart.table) {
        this.chart.table.legend.addGanttItem(
          "Resource assigned to task(s)",
          "busy",
        );
        this.chart.table.legend.addGanttItem("Resource available", "free",);
        this.chart.table.legend.addGanttItem("Off-duty period", "offduty",);
      }
    }

    // The last element of `cellStartDates` is the end of the last cell: the
    // shift guarantees each stack uses the [start, end] of its cell.
    let startDate: TjTime | null = null;
    let endDate: TjTime | null = null;
    for (const date of this.chart.header.cellStartDates) {
      if (endDate === null) {
        endDate = date;
        continue;
      }
      startDate = endDate;
      endDate = date;

      let values: number[];
      if (scopeProperty && taskStart && taskEnd) {
        // Only stacks overlapping the scope task interval matter.
        if (!taskStart.lessThan(endDate,) || !startDate.lessThan(taskEnd,)) {
          continue;
        }
        if (startDate.lessThan(taskStart,)) startDate = taskStart;
        if (taskEnd.lessThan(endDate,)) endDate = taskEnd;

        const startIdx = project.dateToIdx(startDate,);
        const endIdx = project.dateToIdx(endDate,);
        const scenario = property.scenarioData(scIdx,);

        const taskWork = scenario.getEffectiveWork(
          startIdx,
          endIdx,
          scopeProperty,
        );
        const overallWork = scenario.getEffectiveWork(startIdx, endIdx,);
        const freeWork = scenario.getEffectiveFreeWork(startIdx, endIdx,);
        values = [taskWork, overallWork - taskWork, freeWork,];
      } else {
        const startIdx = project.dateToIdx(startDate,);
        const endIdx = project.dateToIdx(endDate,);
        const scenario = property.scenarioData(scIdx,);

        values = [
          scenario.getEffectiveWork(startIdx, endIdx,),
          scenario.getEffectiveFreeWork(startIdx, endIdx,),
        ];
      }

      const x = this.chart.dateToX(startDate,);
      const w = this.chart.dateToX(endDate,) - x + 1;
      this.content.push(
        new GanttLoadStack(this, x + 1, w - 2, values, categories,),
      );
    }
  }

  /**
   * Marks the off-time zones of the property (Ruby `generateTimeOffZones`).
   * Only periods at least `minTimeOff` long for the scale are shown.
   */
  private generateTimeOffZones(): void {
    const iv: TimeOffInterval = {
      start: this.chart.start,
      end: this.chart.end,
    };
    const minTimeOff = this.chart.scale.minTimeOff;
    // Coarse scales (quarter/year) disable the zones.
    if (minTimeOff <= 0) return;

    const zones = this.property.scenarioData(this.scenarioIdx,)
      .collectTimeOffIntervals(iv, minTimeOff,);
    // Converts dates into `[startX, width]`.
    const result: Array<[number, number,]> = [];
    for (const zone of zones) {
      const s = this.chart.dateToX(zone.start,);
      result.push([s, this.chart.dateToX(zone.end,) - s,],);
    }
    this.timeOffZones = result;
  }

  /**
   * Appends the tooltip of the content (Ruby `addHtmlTooltip`): an `onclick`
   * with `TagToTip` plus the `div.tj_tooltip_box`.
   *
   * @param tooltip Tooltip definition of the column, or `null`.
   * @param query Query used to resolve the tooltip pattern.
   * @param trigger Element that receives the `onclick` handler.
   * @param hook Element the tooltip box is appended to (defaults to `trigger`).
   */
  private addHtmlTooltip(
    tooltip: CellSettingPatternList | null,
    query: Query,
    trigger: XMLElementLike,
    hook: XMLElementLike | null = null,
  ): void {
    if (!tooltip) return;

    const pattern = tooltip.getPattern(query,);
    if (pattern === null || pattern === undefined) return;
    if (typeof pattern === "string" && pattern.length === 0) return;

    if (
      typeof (pattern as { functionHandler?: unknown }).functionHandler ===
        "function"
    ) {
      (pattern as { setQuery(q: Query,): void }).setQuery(query,);
    }
    let title = "";
    if (query) {
      query.attributeId = "name";
      query.process();
      title = query.to_s();
    }

    const id = objectId(trigger,);
    trigger.attrs["onclick"] = `TagToTip('ID${id}', TITLE, '${
      title.replace(/'/g, "&apos;",)
    }')`;
    trigger.attrs["style"] = (trigger.attrs["style"] ?? "") + "cursor:help; ";

    const hookEl = hook ?? trigger;
    const ltDiv = new XMLElement("div", {
      class: "tj_tooltip_box",
      id: `ID${id}`,
    },);
    const content = typeof (pattern as { to_html?: unknown }).to_html ===
        "function"
      ? (pattern as { to_html(): XMLElementLike | string }).to_html()
      : String(pattern,);
    ltDiv.append(
      typeof content === "string" ? content : content ?? "",
    );
    hookEl.append(ltDiv,);
  }
}

let idCounter = 0;
const idMap = new WeakMap<object, number>();

/**
 * Adapts a property (`Task`/`Resource`) to the structural view of the line.
 *
 * RUBY-COMPAT-DOC: in Ruby this is `PropertyTreeNode#method_missing`, which
 * forwards any unknown method to the `*Scenario` of the scenario. Here the
 * delegation is explicit: `effWorkInPeriod` (Task) and `getEffectiveWork`
 * (Resource) have the same semantics as seen by the line.
 *
 * @param node Property to adapt, or `null`.
 * @returns The `GanttLineProperty` view, or `null` when `node` is `null`.
 */
export function asGanttProperty(
  node: PropertyTreeNode | null,
): GanttLineProperty | null {
  if (node === null) return null;
  const source: GanttLineProperty = {
    getForScenario: (id, scenarioIdx,) => node.getForScenario(id, scenarioIdx,),
    container: () => node.container(),
    scenarioData: (scenarioIdx,) =>
      adaptScenario(node.scenarioData(scenarioIdx,),),
  };
  // The model expects the real node (`Task`/`Resource`) in the scope arguments.
  nodes.set(source, node,);
  return source;
}

/** Wrapper → real model node (to forward scopes to the model APIs). */
const nodes = new WeakMap<GanttLineProperty, PropertyTreeNode>();

/** Interface of the `*Scenario` the line actually uses. */
interface ScenarioLike {
  effWorkInPeriod?(
    startIdx: number,
    endIdx: number,
    resource: GanttLineProperty | null,
  ): number;
  getEffectiveWork(
    startIdx: number,
    endIdx: number,
    task?: GanttLineProperty | null,
  ): number;
  getEffectiveFreeWork(startIdx: number, endIdx: number,): number;
  collectTimeOffIntervals(
    iv: TimeOffInterval,
    minDuration: number,
  ): readonly TimeOffInterval[];
}

/** Adapts the model's `*Scenario` to the view used by the line. */
function adaptScenario(sd: unknown,): GanttLineScenario {
  const s = sd as ScenarioLike;
  return {
    // TaskScenario: `effWorkInPeriod`; ResourceScenario: `getEffectiveWork`.
    // The scopes go back to the real node (the model calls `ptn()` on them).
    getEffectiveWork: (startIdx, endIdx, scope,) => {
      const scopeNode = scope ? nodes.get(scope,) ?? null : null;
      return s.effWorkInPeriod
        ? s.effWorkInPeriod(
          startIdx,
          endIdx,
          scopeNode as GanttLineProperty | null,
        )
        : s.getEffectiveWork(
          startIdx,
          endIdx,
          scopeNode as GanttLineProperty | null,
        );
    },
    getEffectiveFreeWork: (startIdx, endIdx,) =>
      s.getEffectiveFreeWork(startIdx, endIdx,),
    collectTimeOffIntervals: (iv, minDuration,) =>
      s.collectTimeOffIntervals(iv, minDuration,),
  };
}

/**
 * Unique and stable id per object (equivalent to Ruby's `object_id`), used only
 * to match the `onclick` with the `id` of the tooltip `div`.
 *
 * @param obj Object to identify.
 * @returns The stable numeric id of the object.
 */
function objectId(obj: object,): number {
  let id = idMap.get(obj,);
  if (id === undefined) {
    id = ++idCounter;
    idMap.set(obj, id,);
  }
  return id;
}
