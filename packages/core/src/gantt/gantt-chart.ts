/**
 * GanttChart (phase 15.11) — abstract chart of a `chart` column.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/GanttChart.rb`.
 *
 * The chart is generated in two steps, as in Ruby:
 * 1. `generateByScale(start, end, scale)` sets the period, the scale and the
 *    width and creates the `GanttHeader`;
 * 2. the `GanttLine`s are created by whoever consumes the chart (`TableReport`,
 *    15.12) and registered through `addLine`/`addTask`;
 * 3. `to_html()` calls `completeChart()` (lazy) — it computes the height, routes
 *    the dependency lines and deduplicates the arrow heads — and returns the
 *    `<td>`.
 *
 * The output is plain HTML+CSS (ADR 028).
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.11)
 */
import type { SpecialCell, } from "../reports/report-table-cell.ts";
import type { TableColumnDefinition, } from "../reports/table-column-definition.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { Task, } from "../model/task.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { TjTime, } from "../time/tj-time.ts";
import {
  arrowHeadToHTML,
  lineToHTML as graphicsLineToHTML,
} from "./html-graphics.ts";
import { GanttHeader, } from "./gantt-header.ts";
import type { GanttHeaderChart, } from "./gantt-header.ts";
import type {
  DepLineContent,
  GanttLine,
  GanttLineChart,
  GanttLineLegend,
} from "./gantt-line.ts";
import { GanttRouter, } from "./gantt-router.ts";
import type { FromToPoint, RoutePoint, } from "./gantt-router.ts";

/** `TjTime` method that counts the steps between two dates (Ruby `:sym`). */
export type StepsToFunc =
  | "hoursTo"
  | "daysTo"
  | "weeksTo"
  | "monthsTo"
  | "quartersTo"
  | "yearsTo";

/** One horizontal scale of the chart (Ruby hash of `@@scales`). */
export interface GanttScale {
  /** Scale name as written in the report column (`hour`, `day`, …). */
  readonly name: string;
  /** Width of one step of the scale, in pixels. */
  readonly stepSize: number;
  /** `TjTime` method that counts the steps between period start and end. */
  readonly stepsToFunc: StepsToFunc;
  /**
   * Minimum duration (seconds) of an off-time interval to be drawn. `<= 0`
   * disables the zones on this scale (`GanttLine#generateTimeOffZones`).
   */
  readonly minTimeOff: number;
}

/** The `TableReport` as seen by the chart (only the legend is used here). */
export interface GanttChartTable {
  /** Legend where the chart symbols are collected. */
  readonly legend: GanttLineLegend;
}

/**
 * Gantt chart: one whole column of the report table.
 *
 * It implements `SpecialCell` (phase 14) so it can be plugged in as a special
 * cell. After `generateByScale` it structurally satisfies `GanttHeaderChart`
 * (15.9) and `GanttLineChart` (15.10); before that, `start`/`end`/`scale`/
 * `header` are `null`, exactly like the `nil`s in Ruby.
 */
export class GanttChart implements SpecialCell {
  /** Height of a horizontal scrollbar in the HTML. */
  static readonly SCROLLBARHEIGHT = 20;

  /**
   * Possible scales, from the finest to the coarsest (Ruby `@@scales`).
   *
   * `stepSize` is the width of one step in pixels; `stepsToFunc` the `TjTime`
   * method that counts the steps; `minTimeOff` the smallest visible off-time.
   */
  static readonly SCALES: readonly GanttScale[] = [
    { name: "hour", stepSize: 20, stepsToFunc: "hoursTo", minTimeOff: 5 * 60, },
    {
      name: "day",
      stepSize: 20,
      stepsToFunc: "daysTo",
      minTimeOff: 6 * 60 * 60,
    },
    {
      name: "week",
      stepSize: 20,
      stepsToFunc: "weeksTo",
      minTimeOff: 24 * 60 * 60,
    },
    {
      name: "month",
      stepSize: 35,
      stepsToFunc: "monthsTo",
      minTimeOff: 5 * 24 * 60 * 60,
    },
    {
      name: "quarter",
      stepSize: 28,
      stepsToFunc: "quartersTo",
      minTimeOff: -1,
    },
    { name: "year", stepSize: 20, stepsToFunc: "yearsTo", minTimeOff: -1, },
  ];

  /** Start of the reported period (`null` before generating). */
  start: TjTime | null = null;
  /** End of the reported period (`null` before generating). */
  end: TjTime | null = null;
  /** Date used as "today" (the `nowline` vertical line). */
  readonly now: TjTime;
  /** `true` when weeks start on Monday. */
  readonly weekStartsMonday: boolean;
  /** Header of the chart (created by `generateByScale`). */
  header: GanttHeader | null = null;
  /** Width of the chart, in pixels. */
  width = 0;
  /** Current scale (`null` before generating, as in Ruby). */
  scale: GanttScale | null = null;
  /** `TableReport` owning the chart (used for the legend). */
  table: GanttChartTable | null = null;
  /** Reference date of the `markdateline` line (optional). */
  readonly markdate: TjTime | null;
  /** Visible width; smaller than `width` → scrollbar. */
  viewWidth: number | null = null;

  private readonly columnDef: TableColumnDefinition;
  /** Height of the chart (without the header), computed in `completeChart`. */
  private height = 0;
  /** Width of one step of the current scale. */
  private stepSize = 0;
  /** Chart lines, in creation order. */
  private lines: GanttLine[] = [];
  /** Router of the dependency lines (created in `completeChart`). */
  private router: GanttRouter | null = null;
  /** Primary task lines, indexed by `Task` (Ruby `@tasks`). */
  private tasks = new Map<PropertyTreeNode, GanttLine[]>();
  /** Routed dependency paths (pairs of points). */
  private depArrows: RoutePoint[][] = [];
  /** Arrow heads, deduplicated by coordinate. */
  private arrowHeads: RoutePoint[] = [];
  /** Idempotency guard of `completeChart`. */
  private completed = false;

  /**
   * Creates the chart without generating it: period and scale are still
   * missing.
   *
   * @param now Date considered "today".
   * @param weekStartsMonday Whether the weeks start on Monday.
   * @param columnDef Column definition this chart renders.
   * @param table `TableReport` owning the chart, or `null`.
   * @param markdate Date of the reference line, or `null`.
   */
  constructor(
    now: TjTime,
    weekStartsMonday: boolean,
    columnDef: TableColumnDefinition,
    table: GanttChartTable | null = null,
    markdate: TjTime | null = null,
  ) {
    this.now = now;
    this.columnDef = columnDef;
    this.table = table;
    this.markdate = markdate;
    this.weekStartsMonday = weekStartsMonday;
  }

  /**
   * Available scales (Ruby `attr_reader :scales`).
   *
   * @returns The static list of scales.
   */
  get scales(): readonly GanttScale[] {
    return GanttChart.SCALES;
  }

  /**
   * Registers a primary task line (Ruby `addTask`). Multi-scenario reports
   * produce several lines for the same `Task`.
   *
   * @param task Task the line belongs to.
   * @param line Chart line to register.
   */
  addTask(task: PropertyTreeNode, line: GanttLine,): void {
    const lines = this.tasks.get(task,);
    if (lines) {
      lines.push(line,);
    } else {
      this.tasks.set(task, [line,],);
    }
  }

  /**
   * Generation by width (Ruby `generateByWidth`). In Ruby this is only a TODO:
   * it sets the period and the width, without scale or header.
   *
   * @param periodStart First date of the reported period.
   * @param periodEnd Last date of the reported period.
   * @param width Width of the chart, in pixels.
   */
  generateByWidth(
    periodStart: TjTime,
    periodEnd: TjTime,
    width: number,
  ): void {
    this.start = periodStart;
    this.end = periodEnd;
    this.width = width;
    // Faithful to Ruby: here neither the scale nor the `GanttHeader` is set.
  }

  /**
   * Generates the chart from the period and the scale name (Ruby
   * `generateByScale`). Must be called **before** creating the `GanttLine`s.
   *
   * @param periodStart First date of the reported period.
   * @param periodEnd Last date of the reported period.
   * @param scaleName Name of the scale (`hour`, `day`, `week`, …).
   * @throws Error When `scaleName` is not one of the known scales.
   */
  generateByScale(
    periodStart: TjTime,
    periodEnd: TjTime,
    scaleName: string,
  ): void {
    this.start = periodStart;
    this.end = periodEnd;
    this.scale = this.scaleByName(scaleName,);
    this.stepSize = this.scale.stepSize;
    const steps = periodStart[this.scale.stepsToFunc](periodEnd,);
    this.width = this.stepSize * steps;

    // `this` only satisfies `GanttHeaderChart` once `scale` is set; the cast
    // documents that precondition (Ruby relies on it at runtime).
    this.header = new GanttHeader(
      this.columnDef,
      this as unknown as GanttHeaderChart,
    );
  }

  /**
   * Converts the chart into a `<td>` with the two nested `div`s (Ruby
   * `to_html`).
   *
   * @returns The table cell holding the whole chart.
   */
  to_html(): XMLElementLike {
    this.completeChart();

    const scrollbar = this.hasScrollbar();
    // The cell covers the whole height of the table: one row per chart line,
    // plus the header row, plus the scrollbar row (when present).
    const td = new XMLElement("td", {
      rowspan: `${Math.trunc(2 + this.lines.length + (scrollbar ? 1 : 0),)}`,
      style: "padding:0px; vertical-align:top;",
    },);

    // Outer `div`: the "view". It gains `SCROLLBARHEIGHT` px when there is a
    // scrollbar.
    const scrollDiv = new XMLElement("div", {
      class: "tabback",
      style: "position:relative; overflow:auto; " +
        `width:${scrollbar ? this.viewWidth : this.width}px; ` +
        `height:${
          this.height + (scrollbar ? GanttChart.SCROLLBARHEIGHT : 0)
        }px;`,
    },);
    td.append(scrollDiv,);
    // Inner `div`: the chart itself, in absolute coordinates.
    const div = new XMLElement("div", {
      style: "margin:0px; padding:0px; position:absolute; overflow:hidden; " +
        "top:0px; left:0px; " +
        `width:${this.width}px; ` +
        `height:${this.height}px; ` +
        "font-size:10px;",
    },);
    scrollDiv.append(div,);

    // Header and lines.
    const header = this.header;
    if (header !== null) div.append(header.to_html(),);
    for (const line of this.lines) div.append(line.to_html(),);

    // Dependency lines: each consecutive pair of the path becomes a `depline`.
    for (const arrow of this.depArrows) {
      let xx: number | null = null;
      let yy = 0;
      for (const [x, y,] of arrow) {
        if (xx !== null) {
          div.append(
            graphicsLineToHTML(xx, yy, x, y, "depline",),
          );
        }
        xx = x;
        yy = y;
      }
    }
    // And the matching arrow heads.
    for (const [x, y,] of this.arrowHeads) {
      div.append(arrowHeadToHTML(x, y,),);
    }

    return td;
  }

  /**
   * The Gantt is never exported to CSV (Ruby `to_csv` returns 0).
   *
   * @param _csv Destination table; unused.
   * @param _startColumn First column of the cell; unused.
   * @returns Always 0, meaning no column was written.
   */
  to_csv(_csv: unknown[][], _startColumn: number,): number {
    return 0;
  }

  /**
   * Converts a date into an X coordinate of the chart (Ruby `dateToX`):
   * `((width / (end - start)) * (date - start)).to_i`.
   *
   * @param date Date to map onto the X axis.
   * @returns The X coordinate, in pixels.
   * @throws Error When the chart has not been generated yet.
   */
  dateToX(date: TjTime,): number {
    const start = this.start;
    const end = this.end;
    if (start === null || end === null) {
      throw new Error(
        "generateByScale or generateByWidth must be called first",
      );
    }
    return Math.trunc(
      (this.width / end.diff(start,)) * date.diff(start,),
    );
  }

  /**
   * Registers a line in the chart (Ruby `addLine`).
   *
   * @param line Chart line to register.
   * @throws Error When the chart has not been generated yet.
   */
  addLine(line: GanttLine,): void {
    if (this.scale === null) {
      throw new Error(
        "generateByScale or generateByWidth must be called first",
      );
    }
    this.lines.push(line,);
  }

  /**
   * Structural view of the chart for the consumers (`GanttLineChart`, 15.10).
   *
   * Ruby does not need this: `GanttChart` already satisfies the contract at
   * runtime. In TS the fields are nullable before `generateByScale`, so the
   * precondition ("chart already generated") is checked in a single place
   * instead of being spread over casts in the callers.
   *
   * @returns This chart, narrowed to the `GanttLineChart` contract.
   * @throws Error When the chart has not been generated yet.
   */
  asLineChart(): GanttLineChart {
    if (
      this.start === null || this.end === null ||
      this.scale === null || this.header === null
    ) {
      throw new Error(
        "generateByScale or generateByWidth must be called first",
      );
    }
    return this as unknown as GanttLineChart;
  }

  /**
   * `true` when the `view` is narrower than the chart (Ruby `hasScrollbar?`).
   *
   * @returns Whether the chart needs a horizontal scrollbar.
   */
  hasScrollbar(): boolean {
    return this.viewWidth !== null && this.viewWidth < this.width;
  }

  /**
   * Looks up a scale by name (Ruby `scaleByName`).
   *
   * @param name Name of the scale.
   * @returns The matching scale.
   * @throws Error When no scale has that name.
   */
  private scaleByName(name: string,): GanttScale {
    for (const scale of GanttChart.SCALES) {
      if (scale.name === name) return scale;
    }
    throw new Error(`Unknown scale ${name}`,);
  }

  /**
   * Computes the height, creates the router, blocks the forbidden zones and
   * generates the dependency arrows (Ruby `completeChart`).
   *
   * Ruby runs this on every `to_html` call; the `completed` guard avoids
   * duplicating `depArrows`/`arrowHeads` (the chart is immutable after the
   * first output).
   */
  private completeChart(): void {
    if (this.completed) return;

    for (const line of this.lines) {
      const bottom = line.y + line.height;
      if (bottom > this.height) this.height = bottom;
    }

    // Dependency lines are routed by a `GanttRouter` that only receives the
    // start and end points of each arrow.
    const router = new GanttRouter(this.width, this.height,);
    this.router = router;

    // Bars must not be crossed by horizontal lines; milestones must not be
    // crossed in any direction.
    for (const line of this.lines) line.addBlockedZones(router,);

    // Protects the "now" line from other vertical lines.
    const header = this.header;
    const nowLineX = header?.nowLineX ?? null;
    if (nowLineX !== null) {
      router.addZone(nowLineX - 1, 0, 3, this.height - 1, false, true,);
    }

    // Same for the reference date (`markdate`).
    const markdateLineX = header?.markdateLineX ?? null;
    if (markdateLineX !== null) {
      router.addZone(markdateLineX - 1, 0, 3, this.height - 1, false, true,);
    }

    // Dependency arrows of every visible task.
    for (const [task, lines,] of this.tasks) {
      this.generateDepLines(task as Task, lines,);
    }

    // A single arrow head per end point, even when several lines reach the
    // same point (`Array#include?` compares by value).
    for (const line of this.depArrows) {
      const endPoint = line[line.length - 1];
      if (!endPoint) continue;
      if (!this.arrowHeads.some((p,) => samePoint(p, endPoint,))) {
        this.arrowHeads.push(endPoint,);
      }
    }

    this.completed = true;
  }

  /**
   * Generates the dependency arrows of one task (Ruby `generateDepLines`).
   * Multi-scenario reports have one line per scenario.
   *
   * @param task Task whose successors are drawn.
   * @param lines Chart lines of the task, one per scenario.
   */
  private generateDepLines(task: Task, lines: GanttLine[],): void {
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (!line) continue;
      const scenarioIdx = line.query.scenarioIdx ?? 0;
      const content = depLineContent(line,);
      // Ruby assumes `line.getTask` is non-nil (only task lines enter `@tasks`);
      // in TS the return value is nullable.
      if (content === null) continue;

      // Dependencies on the task start…
      this.generateTaskDepLines(
        "startsuccs",
        task,
        scenarioIdx,
        lineIndex,
        content.startDepLineStart(),
      );
      // ...and on its end.
      this.generateTaskDepLines(
        "endsuccs",
        task,
        scenarioIdx,
        lineIndex,
        content.endDepLineStart(),
      );
    }
  }

  /**
   * Generates the arrows of the dependencies at the start (`startsuccs`) or at
   * the end (`endsuccs`) of `task` (Ruby `generateTaskDepLines`).
   *
   * @param kind Which dependency list of the task is drawn.
   * @param task Task whose successors are drawn.
   * @param scenarioIdx Scenario the dependency list is read from.
   * @param lineIndex Index of the line to anchor the arrows to.
   * @param anchor `[x, y]` point the arrows start at.
   */
  private generateTaskDepLines(
    kind: "startsuccs" | "endsuccs",
    task: Task,
    scenarioIdx: number,
    lineIndex: number,
    [startX, startY,]: [number, number,],
  ): void {
    const touples: FromToPoint[] = [];
    const taskScenario = task.scenarioData(scenarioIdx,);
    const successors = kind === "startsuccs"
      ? taskScenario.startsuccs()
      : taskScenario.endsuccs();

    for (const [successor, onEnd,] of successors) {
      if (successor === null) continue;
      // Ignores inherited dependencies and tasks outside the chart. The
      // inheritance test looks at the scenario of the **current** task (`task`).
      const parent = successor.parent as Task | null;
      if (
        (parent !== null &&
          taskScenario.hasDependency(kind, parent, onEnd,)) ||
        !this.tasks.has(successor,)
      ) {
        continue;
      }
      const successorLines = this.tasks.get(successor,);
      const successorLine = successorLines?.[lineIndex];
      const content = successorLine ? depLineContent(successorLine,) : null;
      if (content === null) continue;

      const [endX, endY,] = onEnd
        ? content.endDepLineEnd()
        : content.startDepLineEnd();
      touples.push([startX, startY, endX, endY,],);
    }

    const router = this.router;
    if (touples.length > 0 && router !== null) {
      this.depArrows.push(...router.routeLines(touples,),);
    }
  }
}

/** Compares two coordinates by value (Ruby `Array#==`). */
function samePoint(a: RoutePoint, b: RoutePoint,): boolean {
  return a[0] === b[0] && a[1] === b[1];
}

/** Line content as a source of dependency anchors. */
function depLineContent(line: GanttLine,): DepLineContent | null {
  return line.getTask() as DepLineContent | null;
}
