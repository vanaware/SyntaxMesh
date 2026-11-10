/**
 * ChartPlotter (phase 14.22.2) — line chart rendered as SVG from the trace
 * table.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/ChartPlotter.rb`.
 * Receives the `[['Date', ...labels], [TjTime, v1, v2, ...], ...]` table (the
 * `TraceReport`), transposes it into columns, validates the types (dates in the
 * first column; Y columns all `number` **or** all `TjTime`), computes the
 * geometry and draws grid + series + legend over a {@link Painter} (17.15: the
 * minimal `PainterMin` of phase 14.22 was replaced by the real Painter from
 * `src/painter/`).
 *
 * `Painter::FontMetrics` exists since 17.11, but `ChartPlotter.rb` uses its own
 * estimates for the layout ("10pt x ~0.55/char"); the deterministic
 * approximations of the port are kept, faithful to the Ruby behaviour.
 *
 * Invalid data raises {@link ChartPlotterError} (Ruby `ChartPlotterError`),
 * caught by `TraceReport.to_html` and reported as a warning (faithful to the
 * `rescue`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/reports/ChartPlotter.rb
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.22.2)
 */

import { Color, } from "./painter/color.ts";
import { Group, } from "./painter/group.ts";
import type { Point, } from "./painter/points.ts";
import { Painter, } from "./painter/painter.ts";
import { TjTime, } from "./time/tj-time.ts";

const DAY_SECONDS = 60 * 60 * 24;

/** Raised on invalid chart data (equivalent to the Ruby exception). */
export class ChartPlotterError extends Error {}

/** Value of a Y cell: a date, a number, or missing. */
export type CellValue = TjTime | number | null | undefined;

/**
 * Font metric estimate (minimal replacement for `Painter::FontMetrics`).
 * Deterministic and independent of any font backend.
 */
function textWidth(fontSize: number, str: string,): number {
  return Math.round(str.length * fontSize * 0.55,);
}
function textHeight(fontSize: number,): number {
  return Math.round(fontSize * 1.16,);
}

/**
 * ChartPlotter — plots one line series per column of the trace table.
 *
 * @see docs/taskjuggler/lib/taskjuggler/reports/ChartPlotter.rb
 */
export class ChartPlotter {
  /** Width of the canvas in pixels. */
  readonly width: number;
  /** Height of the canvas in pixels. */
  readonly height: number;
  private readonly data: unknown[][];

  // Legend margins and geometry (literal values from the Ruby original).
  private readonly topMargin = 30;
  private readonly bottomMargin = 30;
  private readonly leftMargin = 70;
  private readonly rightMargin: number;
  private readonly legendGap = 20;
  private readonly markerWidth = 20;
  private readonly markerX: number;
  private readonly markerGap = 5;
  private readonly labelX: number;
  private labelHeight = 24;

  // Origin (0,0) of the chart coordinate system.
  private readonly x0: number;
  private readonly y0: number;

  private labels: string[] = [];
  private yData: CellValue[][] = [];
  private xData: TjTime[] | null = null;
  private dataType: "date" | "number" | null = null;
  private xMinDate: TjTime | null = null;
  private xMaxDate: TjTime | null = null;
  private yMinDate: TjTime | null = null;
  private yMaxDate: TjTime | null = null;
  private yMinVal: number | null = null;
  private yMaxVal: number | null = null;

  private dateLabelWidth = 0;
  private noXLabels = 0;
  private noYLabels = 0;

  private painter: Painter | null = null;

  /**
   * Creates a plotter for a canvas of the given size.
   *
   * @param width Width of the canvas in pixels.
   * @param height Height of the canvas in pixels.
   * @param data Trace table: header row followed by one row per data point.
   */
  constructor(width: number, height: number, data: unknown[][],) {
    this.width = width;
    this.height = height;
    this.data = data;
    this.rightMargin = Math.floor(width * 0.382,);
    this.markerX = width - this.rightMargin + this.legendGap;
    this.labelX = this.markerX + this.markerWidth + this.markerGap;
    this.x0 = this.leftMargin;
    this.y0 = height - this.bottomMargin;
  }

  // ——— Derived state (inspection/testing) ———
  /**
   * Labels of the plotted series.
   *
   * @returns The header labels of the Y columns.
   */
  getLabels(): readonly string[] {
    return this.labels;
  }
  /**
   * Values of every plotted series.
   *
   * @returns One array of cell values per series.
   */
  getYData(): readonly CellValue[][] {
    return this.yData;
  }
  /**
   * X axis dates.
   *
   * @returns The dates of the first column, or `null` before analysis.
   */
  getXData(): readonly TjTime[] | null {
    return this.xData;
  }
  /**
   * Data type detected for the Y columns.
   *
   * @returns `'date'`, `'number'`, or `null` before analysis.
   */
  getDataType(): "date" | "number" | null {
    return this.dataType;
  }
  /**
   * Range of the X axis.
   *
   * @returns The minimum and maximum date, or `null` for an empty range.
   */
  getXRange(): [TjTime | null, TjTime | null,] {
    return [this.xMinDate, this.xMaxDate,];
  }
  /**
   * Numeric range of the Y axis.
   *
   * @returns The minimum and maximum value, or `null` for an empty range.
   */
  getYNumericRange(): [number | null, number | null,] {
    return [this.yMinVal, this.yMaxVal,];
  }
  /**
   * Number of labels drawn on the X axis.
   *
   * @returns The label count computed by the geometry pass.
   */
  getNoXLabels(): number {
    return this.noXLabels;
  }
  /**
   * Number of labels drawn on the Y axis.
   *
   * @returns The label count computed by the geometry pass.
   */
  getNoYLabels(): number {
    return this.noYLabels;
  }

  /** Builds the chart in a `Painter` from the table data. */
  generate(): void {
    this.analyzeData();
    this.calcChartGeometry();
    const painter = new Painter(this.width, this.height,);
    this.painter = painter;
    this.drawGrid(painter,);
    for (let ci = 0; ci < this.yData.length; ci++) {
      // Primary hue (60° apart) + per-round shift + decreasing saturation.
      const round = Math.floor(ci / 6,);
      const hue = (60 * (ci % 6) + Math.floor(60 / (1 + round),)) % 360;
      const sat = 255 - Math.floor(ci / 8,);
      // Ruby `Painter::Color.new(h, s, v, :hsv)` — the 4th argument is ignored
      // in Ruby and in the port (HSV mode comes from the 4-argument arity).
      const color = painter.color(hue, sat, 230, "hsv",);
      this.drawDataGraph(painter, ci, color,);
      this.drawLegendEntry(painter, ci, color,);
    }
  }

  /**
   * Serializes the chart to SVG. The chart is generated on demand.
   *
   * @returns The SVG markup as a string.
   */
  to_svg(): string {
    if (!this.painter) this.generate();
    return (this.painter as Painter).to_svg().toHTML();
  }

  // ——— Coordinate conversions (public for tests) ———

  /**
   * Converts a chart X coordinate to the canvas.
   *
   * @param x X coordinate in the chart system.
   * @returns The corresponding canvas X.
   */
  x2c(x: number,): number {
    return this.x0 + x;
  }
  /**
   * Converts a chart Y coordinate to the canvas (Y axis is inverted).
   *
   * @param y Y coordinate in the chart system.
   * @returns The corresponding canvas Y.
   */
  y2c(y: number,): number {
    return this.y0 - y;
  }
  /**
   * Converts a date to a canvas X coordinate.
   *
   * @param date Position along the X axis.
   * @returns The corresponding canvas X.
   */
  xDate2c(date: TjTime,): number {
    const xMin = this.xMinDate as TjTime;
    const xMax = this.xMaxDate as TjTime;
    const px = this.width - (this.leftMargin + this.rightMargin);
    return this.x2c((date.diff(xMin,) * px) / xMax.diff(xMin,),);
  }
  /**
   * Converts a date to a canvas Y coordinate.
   *
   * @param date Position along the Y axis.
   * @returns The corresponding canvas Y.
   */
  yDate2c(date: TjTime,): number {
    const yMin = this.yMinDate as TjTime;
    const yMax = this.yMaxDate as TjTime;
    const px = this.height - (this.topMargin + this.bottomMargin);
    return this.y2c((date.diff(yMin,) * px) / yMax.diff(yMin,),);
  }
  /**
   * Converts a numeric value to a canvas Y coordinate.
   *
   * @param number Position along the numeric Y axis.
   * @returns The corresponding canvas Y.
   */
  yNum2c(number: number,): number {
    const yMin = this.yMinVal as number;
    const yMax = this.yMaxVal as number;
    const px = this.height - (this.topMargin + this.bottomMargin);
    return this.y2c(((number - yMin) * px) / (yMax - yMin),);
  }

  /**
   * Transposes the table and validates the column types.
   *
   * @throws ChartPlotterError When the data is inconsistent.
   */
  private analyzeData(): void {
    // Transposes rows into columns.
    const columns: unknown[][] = [];
    let ri = 0;
    for (const row of this.data) {
      let ci = 0;
      for (const col of row) {
        if (ri === 0) columns.push([],);
        if (ci >= columns.length) {
          this.error(`Row ${ri} contains more elements than the header row`,);
        }
        (columns[ci] as unknown[])[ri] = col;
        ci += 1;
      }
      ri += 1;
    }

    // First column: the 'Date' header followed by TjTime dates.
    let sawHeader = false;
    let line = 1;
    for (const date of columns[0] as unknown[]) {
      if (!sawHeader) {
        if (date !== "Date") {
          this.error(
            `First column must have a 'Date' header instead of '${date}'`,
          );
        }
        sawHeader = true;
      } else {
        if (!(date instanceof TjTime)) {
          this.error(
            `First colum (${date}) of line ${line} must be all dates`,
          );
        }
        const d = date as TjTime;
        if (this.xMinDate === null || d.lessThan(this.xMinDate,)) {
          this.xMinDate = d;
        }
        if (this.xMaxDate === null || d.greaterThan(this.xMaxDate,)) {
          this.xMaxDate = d;
        }
      }
      line += 1;
    }

    if (!(this.xMinDate && this.xMaxDate)) {
      this.error("First column does not contain valid dates.",);
    }

    this.xData = (columns[0] as unknown[]).slice(1,) as TjTime[];

    // Remaining columns: validate type consistency and accumulate min/max.
    for (let colIdx = 1; colIdx < columns.length; colIdx++) {
      const col = columns[colIdx] as unknown[];
      let badCol = false;
      for (const cell of col.slice(1,)) {
        if (cell === null || cell === undefined || cell === "") continue;
        if (cell instanceof TjTime) {
          if (this.dataType && this.dataType !== "date") {
            this.error(
              `Column ${colIdx} contains non-date (${cell}). The columns ` +
                "will be ignored.",
            );
            badCol = true;
            break;
          }
          this.dataType = "date";
          const d = cell as TjTime;
          if (this.yMinDate === null || d.lessThan(this.yMinDate,)) {
            this.yMinDate = d;
          }
          if (this.yMaxDate === null || d.greaterThan(this.yMaxDate,)) {
            this.yMaxDate = d;
          }
        } else if (typeof cell === "number") {
          if (this.dataType && this.dataType !== "number") {
            this.error(
              `Column ${colIdx} contains non-number (${cell}). The columns ` +
                "will be ignored.",
            );
            badCol = true;
            break;
          }
          this.dataType = "number";
          const n = cell as number;
          if (this.yMinVal === null || n < this.yMinVal) this.yMinVal = n;
          if (this.yMaxVal === null || n > this.yMaxVal) this.yMaxVal = n;
        } else {
          this.error(
            `Column ${colIdx} contains invalid data (${cell}). The columns ` +
              "will be ignored.",
          );
          badCol = true;
          break;
        }
      }
      this.labels.push(col[0] as string,);
      if (!badCol) this.yData.push(col.slice(1,) as CellValue[],);
    }

    if (this.dataType === null || this.yData.length === 0) {
      this.error("Columns don't contain any valid dates.",);
    }
  }

  /**
   * Computes the label counts, the date widths and the axis ranges.
   *
   * @throws ChartPlotterError When the data type is unsupported.
   */
  private calcChartGeometry(): void {
    const xAxisPixels = this.width - (this.rightMargin + this.leftMargin);
    this.dateLabelWidth = textWidth(10.0, "2000-01-01",);
    this.labelHeight = textHeight(10.0,);
    const labelPadding = 10;
    this.noXLabels = Math.floor(
      xAxisPixels / (this.dateLabelWidth + labelPadding),
    );

    const yAxisPixels = this.height - (this.topMargin + this.bottomMargin);
    this.noYLabels = Math.floor(
      yAxisPixels / (this.labelHeight + labelPadding),
    );
    if (this.noYLabels > 10) this.noYLabels = 10;

    this.xMinDate = (this.xMinDate as TjTime).midnight();
    const minIntervalX = DAY_SECONDS * this.noXLabels;
    if ((this.xMaxDate as TjTime).diff(this.xMinDate,) < minIntervalX) {
      this.xMaxDate = this.xMinDate.addSeconds(minIntervalX,);
    }

    if (this.dataType === "date") {
      this.yMinDate = (this.yMinDate as TjTime).midnight();
      const minIntervalY = DAY_SECONDS * this.noYLabels;
      if ((this.yMaxDate as TjTime).diff(this.yMinDate,) < minIntervalY) {
        this.yMaxDate = this.yMinDate.addSeconds(minIntervalY,);
      }
    } else if (this.dataType === "number") {
      if (this.yMinVal === this.yMaxVal) this.yMinVal = 0;
      if (
        ((this.yMaxVal as number) - (this.yMinVal as number)) < this.noYLabels
      ) {
        this.yMaxVal = (this.yMinVal as number) + this.noYLabels;
      }
    } else {
      throw new ChartPlotterError(`Unsupported dataType: ${this.dataType}`,);
    }
  }

  /**
   * Draws the date labels of the X axis.
   *
   * @param painter Group that receives the labels.
   */
  private xLabels(painter: Group,): void {
    const xMin = this.xMinDate as TjTime;
    const xMax = this.xMaxDate as TjTime;
    const labelInterval = xMax.diff(xMin,) / this.noXLabels;
    let date = xMin.addSeconds(labelInterval / 2,);
    painter.group(
      {
        font_family: "LiberationSans, Arial",
        font_size: 10.0,
        stroke: painter.color("black",),
        stroke_width: 1,
        fill: painter.color("black",),
      },
      (gp,) => {
        for (let i = 0; i < this.noXLabels; i++) {
          const x = this.xDate2c(date,);
          gp.text(
            x - this.dateLabelWidth / 2,
            this.y2c(-5 - this.labelHeight,),
            date.to_s("%Y-%m-%d",),
            { stroke_width: 0, },
          );
          gp.line(x, this.y2c(0,), x, this.y2c(-4,),);
          date = date.addSeconds(labelInterval,);
        }
      },
    );
  }

  /**
   * Draws the labels of the Y axis (dates or numbers).
   *
   * @param painter Group that receives the labels.
   * @throws ChartPlotterError When the data type is unsupported.
   */
  private yLabels(painter: Group,): void {
    if (this.dataType === "date") {
      if (!(this.yMinDate && this.yMaxDate)) return;
      const yMin = this.yMinDate as TjTime;
      const yMax = this.yMaxDate as TjTime;
      const labelInterval = yMax.diff(yMin,) / this.noYLabels;
      let date = yMin.addSeconds(labelInterval / 2,);
      painter.group(
        {
          font_family: "LiberationSans, Arial",
          font_size: 10.0,
          stroke: painter.color("black",),
          stroke_width: 1,
          fill: painter.color("black",),
        },
        (gp,) => {
          for (let i = 0; i < this.noYLabels; i++) {
            const y = this.yDate2c(date,);
            gp.text(0, y + this.labelHeight / 2 - 2, date.to_s("%Y-%m-%d",), {
              stroke_width: 0,
            },);
            gp.line(this.x2c(-4,), y, this.width - this.rightMargin, y,);
            date = date.addSeconds(labelInterval,);
          }
        },
      );
      return;
    }

    if (this.dataType === "number") {
      if (!(this.yMinVal !== null && this.yMaxVal !== null)) return;
      const yInterval = (this.yMaxVal as number) - (this.yMinVal as number);
      let labelInterval = yInterval / this.noYLabels;
      // Rounds the interval to 1, 2 or 5 as the most significant digit.
      const factor = 10 ** Math.floor(Math.log10(labelInterval,),);
      let msd = Math.ceil(labelInterval / factor,);
      if (msd === 3 || msd === 4) msd = 5;
      else if (msd > 5) msd = 10;
      labelInterval = msd * factor;
      this.noYLabels = Math.floor(yInterval / labelInterval,);

      let val = (this.yMinVal as number) + labelInterval;
      painter.group(
        {
          font_family: "LiberationSans, Arial",
          font_size: 10.0,
          stroke: painter.color("black",),
          stroke_width: 1,
          fill: painter.color("black",),
        },
        (gp,) => {
          for (let i = 0; i < this.noYLabels; i++) {
            const y = this.yNum2c(val,);
            const labelText = String(val,);
            const labelWidth = textWidth(10.0, labelText,);
            gp.text(
              this.leftMargin - 7 - labelWidth,
              y + this.labelHeight / 2 - 3,
              labelText,
              { stroke_width: 0, },
            );
            gp.line(this.x2c(-4,), y, this.width - this.rightMargin, y,);
            val += labelInterval;
          }
        },
      );
      return;
    }

    throw new ChartPlotterError(`Unsupported dataType ${this.dataType}`,);
  }

  /**
   * Draws both axes and their labels.
   *
   * @param painter Painter that receives the grid.
   */
  private drawGrid(painter: Painter,): void {
    painter.group({ stroke: painter.color("black",), font_size: 11, }, (p,) => {
      p.line(
        this.x2c(0,),
        this.y2c(0,),
        this.x2c(this.width - (this.leftMargin + this.rightMargin),),
        this.y2c(0,),
      );
      p.line(
        this.x2c(0,),
        this.y2c(0,),
        this.x2c(0,),
        this.y2c(this.height - (this.topMargin + this.bottomMargin),),
      );
      this.yLabels(p,);
      this.xLabels(p,);
    },);
  }

  /**
   * Draws one series as a polyline with markers.
   *
   * @param painter Painter that receives the series.
   * @param ci Index of the series.
   * @param color Color of the series.
   */
  private drawDataGraph(
    painter: Painter,
    ci: number,
    color: Color,
  ): void {
    const values = this.yData[ci] as CellValue[];
    const xData = this.xData as TjTime[];
    painter.group(
      { stroke_width: 3, stroke: color, fill: color, },
      (p,) => {
        let lastX: number | null = null;
        let lastY: number | null = null;
        for (let i = 0; i < values.length; i++) {
          const v = values[i];
          if (v === null || v === undefined) continue;
          const xc = this.xDate2c(xData[i]!,);
          const yc = v instanceof TjTime
            ? this.yDate2c(v,)
            : this.yNum2c(v as number,);
          if (lastY !== null && lastY !== undefined) {
            p.line(lastX as number, lastY, xc, yc,);
          }
          this.setMarker(p, ci, xc, yc,);
          lastX = xc;
          lastY = yc;
        }
      },
    );
  }

  /**
   * Draws the legend entry of one series.
   *
   * @param painter Painter that receives the entry.
   * @param ci Index of the series.
   * @param color Color of the series.
   */
  private drawLegendEntry(
    painter: Painter,
    ci: number,
    color: Color,
  ): void {
    painter.group(
      { stroke_width: 3, stroke: color, fill: color, font_size: 11, },
      (p,) => {
        const labelY = this.topMargin + this.labelHeight / 2 +
          ci * (this.labelHeight + 4);
        const markerY = labelY + (this.labelHeight + 4) / 2;
        this.setMarker(p, ci, this.markerX + this.markerWidth / 2, markerY,);
        p.line(
          this.markerX,
          markerY,
          this.markerX + this.markerWidth,
          markerY,
        );
        p.text(
          this.labelX,
          labelY + this.labelHeight,
          this.labels[ci] as string,
          {
            stroke: p.color("black",),
            stroke_width: 0,
            fill: p.color("black",),
          },
        );
      },
    );
  }

  /**
   * Draws the marker shape of one series, rotating through five shapes.
   *
   * @param p Group that receives the marker.
   * @param type Index of the series, used to pick the shape.
   * @param x Canvas X of the marker.
   * @param y Canvas Y of the marker.
   */
  private setMarker(
    p: Group,
    type: number,
    x: number,
    y: number,
  ): void {
    const r = 4;
    switch (Math.floor(type / 5,) % 5) {
      case 0: {
        // Diamond.
        const points: Point[] = [
          [x - r, y,],
          [x, y + r,],
          [x + r, y,],
          [x, y - r,],
          [x - r, y,],
        ];
        p.polyline(points,);
        break;
      }
      case 1: {
        // Square.
        const rr = Math.floor(r / Math.sqrt(2.0,),);
        p.rect(x - rr, y - rr, 2 * rr, 2 * rr,);
        break;
      }
      case 2: {
        // Downward triangle.
        const points: Point[] = [
          [x - r, y - r,],
          [x, y + r,],
          [x + r, y - r,],
          [x - r, y - r,],
        ];
        p.polyline(points,);
        break;
      }
      case 3: {
        // Upward triangle.
        const points: Point[] = [
          [x - r, y + r,],
          [x, y - r,],
          [x + r, y + r,],
          [x - r, y + r,],
        ];
        p.polyline(points,);
        break;
      }
      default:
        p.circle(x, y, r,);
    }
  }

  /**
   * Raises a {@link ChartPlotterError} for invalid data.
   *
   * @param msg Description of the problem.
   * @throws ChartPlotterError Always.
   */
  private error(msg: string,): never {
    throw new ChartPlotterError(msg,);
  }
}
