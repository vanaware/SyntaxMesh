/**
 * GanttHeader (phase 15.9) — the two-row header of the Gantt chart.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/GanttHeader.rb`.
 *
 * The top row shows the large scale (month/year, year…) and the bottom row the
 * small scale (day, week…). The header also gives the chart the positions of the
 * grid lines (`gridLines`), the start dates of each small cell
 * (`cellStartDates`) and the `now`/`markdate` lines.
 *
 * ## Odd Ruby behaviour (cheat sheet §12, Category B)
 *
 * `genHeaderScale` tests `scale == @largeScale`; in Ruby `Array#==` compares
 * **content**, not identity. On the `year` scale (where the large scale stays
 * empty) the first item falls into the "large" branch: its date goes to
 * `gridLines` instead of `cellStartDates`. Replicated under
 * `compat.keepRubyBugs`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.9)
 */
import { compat, } from "../compat.ts";
import type { TableColumnDefinition, } from "../reports/table-column-definition.ts";
import { TjTime, } from "../time/tj-time.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { GanttHeaderScaleItem, } from "./gantt-header-scale-item.ts";

/** Minimal view of the chart consumed by the header. */
export interface GanttHeaderChart {
  /** First date of the reported period. */
  readonly start: TjTime;
  /** Last date of the reported period. */
  readonly end: TjTime;
  /** Date considered "today" (the `nowline`). */
  readonly now: TjTime;
  /** Reference date of the `markdateline`, or `null`. */
  readonly markdate: TjTime | null;
  /** Whether the weeks start on Monday. */
  readonly weekStartsMonday: boolean;
  /** Width of the chart, in pixels. */
  readonly width: number;
  /** Current scale; only its name is needed here. */
  readonly scale: { readonly name: string };
  /**
   * X coordinate of the chart for `date` (Ruby `GanttChart#dateToX`).
   *
   * Ruby never returns `nil` here: the formula is linear
   * (`((width / (end - start)) * (date - start)).to_i`). Dates outside the
   * period merely produce a negative or greater-than-width X.
   *
   * @param date Date to map onto the X axis.
   * @returns The X coordinate, in pixels.
   */
  dateToX(date: TjTime,): number;
}

/** Anchoring function of the start of a cell (Ruby `beginOfFunc`). */
type BeginOfFunc = (t: TjTime,) => TjTime;
/** Function that advances one cell (Ruby `sameTimeNextFunc`). */
type SameTimeNextFunc = (t: TjTime,) => TjTime;

/** Chart header: scales, grid lines and reference lines. */
export class GanttHeader {
  private readonly columnDef: TableColumnDefinition;
  private readonly chart: GanttHeaderChart;
  private readonly largeScale: GanttHeaderScaleItem[] = [];
  private readonly smallScale: GanttHeaderScaleItem[] = [];

  /** X of the vertical lines marking the large scale. */
  readonly gridLines: number[] = [];
  /** X of the "now" line; `null` when outside the chart. */
  nowLineX: number | null = null;
  /** X of the `markdate` line; `null` when outside the chart. */
  markdateLineX: number | null = null;
  /** Start dates of the small-scale cells (plus the end of the last one). */
  readonly cellStartDates: TjTime[] = [];
  /** Height of the header in pixels (mutable: the chart adjusts it later). */
  height = 39;

  /**
   * Builds the header scales for the chart.
   *
   * @param columnDef Column definition providing `timeformat1`/`timeformat2`.
   * @param chart Chart whose period, scale and width are used.
   * @throws Error When the chart scale is not a known one.
   */
  constructor(columnDef: TableColumnDefinition, chart: GanttHeaderChart,) {
    this.columnDef = columnDef;
    this.chart = chart;
    this.generate();
  }

  /**
   * Converts the header into `<div class="tabback">` (Ruby `to_html`).
   *
   * @returns The header element with both scale rows.
   */
  to_html(): XMLElementLike {
    const div = new XMLElement("div", {
      class: "tabback",
      style: "margin:0px; padding:0px; position:relative; " +
        `width:${Math.trunc(this.chart.width,)}px; ` +
        `height:${Math.trunc(this.height,)}px; ` +
        `font-size:${Math.trunc(this.height / 4,)}px; `,
    },);
    for (const s of this.largeScale) div.append(s.to_html(),);
    for (const s of this.smallScale) div.append(s.to_html(),);
    return div;
  }

  /** Picks the scales from `chart.scale.name` (Ruby `generate`). */
  private generate(): void {
    // The two header rows are separated by a 1px border.
    const h = Math.trunc((this.height - 1) / 2,);
    const fmt1 = (fallback: string,): string =>
      this.columnDef.timeformat1 ?? fallback;
    const fmt2 = (fallback: string,): string =>
      this.columnDef.timeformat2 ?? fallback;

    switch (this.chart.scale.name) {
      case "hour":
        this.genHeaderScale(
          this.largeScale,
          0,
          h,
          (t,) => t.midnight(),
          (t,) => t.sameTimeNextDay(),
          fmt1("%A %Y-%m-%d",),
        );
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.beginOfHour(),
          (t,) => t.sameTimeNextHour(),
          fmt2("%H",),
        );
        break;
      case "day":
        this.genHeaderScale(
          this.largeScale,
          0,
          h,
          (t,) => t.beginOfMonth(),
          (t,) => t.sameTimeNextMonth(),
          fmt1("%b %Y",),
        );
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.midnight(),
          (t,) => t.sameTimeNextDay(),
          fmt2("%d",),
        );
        break;
      case "week":
        this.genHeaderScale(
          this.largeScale,
          0,
          h,
          (t,) => t.beginOfMonth(),
          (t,) => t.sameTimeNextMonth(),
          fmt1("%b %Y",),
        );
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.beginOfWeek(this.chart.weekStartsMonday,),
          (t,) => t.sameTimeNextWeek(),
          fmt2("%d",),
        );
        break;
      case "month":
        this.genHeaderScale(
          this.largeScale,
          0,
          h,
          (t,) => t.beginOfYear(),
          (t,) => t.sameTimeNextYear(),
          fmt1("%Y",),
        );
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.beginOfMonth(),
          (t,) => t.sameTimeNextMonth(),
          fmt2("%b",),
        );
        break;
      case "quarter":
        this.genHeaderScale(
          this.largeScale,
          0,
          h,
          (t,) => t.beginOfYear(),
          (t,) => t.sameTimeNextYear(),
          fmt1("%Y",),
        );
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.beginOfQuarter(),
          (t,) => t.sameTimeNextQuarter(),
          fmt2("Q%Q",),
        );
        break;
      case "year":
        // Small scale only; the large one stays empty (see the Category B note).
        this.genHeaderScale(
          this.smallScale,
          h + 1,
          h,
          (t,) => t.beginOfYear(),
          (t,) => t.sameTimeNextYear(),
          fmt1("%Y",),
        );
        break;
      default:
        throw new Error(`Unknown scale: ${this.chart.scale.name}`,);
    }

    this.nowLineX = this.chart.dateToX(this.chart.now,);

    if (this.chart.markdate) {
      this.markdateLineX = this.chart.dateToX(this.chart.markdate,);
    }
  }

  /**
   * Generates the cells of one scale (Ruby `genHeaderScale`).
   *
   * @param scale Row receiving the cells.
   * @param y Top offset of the row, in pixels.
   * @param h Height of the row, in pixels.
   * @param beginOf Function anchoring the start of the first cell.
   * @param sameTimeNext Function advancing one cell.
   * @param timeformat Format used for the cell label.
   */
  private genHeaderScale(
    scale: GanttHeaderScaleItem[],
    y: number,
    h: number,
    beginOf: BeginOfFunc,
    sameTimeNext: SameTimeNextFunc,
    timeformat: string,
  ): void {
    let t = beginOf(this.chart.start,);
    while (t.lessThan(this.chart.end,)) {
      const nextT = sameTimeNext(t,);
      // End of the cell, keeping 1px for the border.
      const xR = this.xOf(nextT,) - 1;
      const x = this.xOf(t,);
      const w = xR - x;
      // Positions of the large scale become grid lines of the chart.
      if (this.isLargeScale(scale,)) {
        this.gridLines.push(xR,);
      } else {
        this.cellStartDates.push(t,);
      }
      scale.push(new GanttHeaderScaleItem(t.to_s(timeformat,), x, y, w, h,),);
      t = nextT;
    }
    // Closes the cell list with the end date of the last one.
    if (this.isSmallScale(scale,)) this.cellStartDates.push(t,);
  }

  /**
   * `true` when `scale` is the large scale. In Ruby the comparison is `==`
   * (content); see the Category B note at the top of the file.
   *
   * @param scale Row to identify.
   * @returns Whether the row is the large scale.
   */
  private isLargeScale(scale: GanttHeaderScaleItem[],): boolean {
    return compat.keepRubyBugs
      ? sameItems(scale, this.largeScale,)
      : scale === this.largeScale;
  }

  /**
   * `true` when `scale` is the small scale (same comparison rule).
   *
   * @param scale Row to identify.
   * @returns Whether the row is the small scale.
   */
  private isSmallScale(scale: GanttHeaderScaleItem[],): boolean {
    return compat.keepRubyBugs
      ? sameItems(scale, this.smallScale,)
      : scale === this.smallScale;
  }

  /**
   * Truncates `dateToX(t)` like Ruby's `to_i`.
   *
   * @param t Date to map onto the X axis.
   * @returns The truncated X coordinate, in pixels.
   */
  private xOf(t: TjTime,): number {
    return Math.trunc(this.chart.dateToX(t,),);
  }
}

/** Ruby `Array#==`: compares content with the identity of the elements. */
function sameItems<T,>(a: readonly T[], b: readonly T[],): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}
