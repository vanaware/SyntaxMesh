/**
 * GanttTaskBar (phase 15.4) — bar of a leaf task with a progress bar.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/GanttTaskBar.rb`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.4)
 */
import { rectToHTML, } from "./html-graphics.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { ZoneRouter, } from "./gantt-router.ts";

/** Minimal query contract used to read the `complete` attribute (phase 11). */
export interface GanttBarQuery {
  /** Attribute requested from the query (`"complete"` here). */
  attributeId: string | null;
  /** Resolves the requested attribute for the current property. */
  process(): void;
  /** Value produced by the last `process()` call. */
  result(): unknown;
}

/** Half height of the bar, in pixels. */
const SIZE = 6;

/** Leaf task bar on the Gantt chart. */
export class GanttTaskBar {
  /** Ruby `@@size`: half height of the bar (centre → top/bottom). */
  static readonly SIZE: number = SIZE;

  private readonly query: GanttBarQuery | null;
  private readonly lineHeight: number;
  private readonly start: number;
  private readonly end: number;
  private readonly y: number;

  /**
   * Creates a leaf task bar.
   *
   * @param query Query used for the `complete` attribute, or `null`.
   * @param lineHeight Height of the chart line the bar sits in, in pixels.
   * @param xStart Left end of the bar, in pixels.
   * @param xEnd Right end of the bar, in pixels.
   * @param y Top offset of the chart line, in pixels.
   */
  constructor(
    query: GanttBarQuery | null,
    lineHeight: number,
    xStart: number,
    xEnd: number,
    y: number,
  ) {
    this.query = query;
    this.lineHeight = lineHeight;
    this.start = xStart;
    this.end = xEnd;
    this.y = y;
  }

  /**
   * Where dependency lines leaving the start of the bar begin.
   *
   * @returns The `[x, y]` anchor point of the arrows.
   */
  startDepLineStart(): [number, number,] {
    return [this.start + 1, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Where dependency lines arriving at the start of the bar end.
   *
   * @returns The `[x, y]` anchor point of the arrows.
   */
  startDepLineEnd(): [number, number,] {
    return [this.start - 1, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Where dependency lines leaving the end of the bar begin.
   *
   * @returns The `[x, y]` anchor point of the arrows.
   */
  endDepLineStart(): [number, number,] {
    return [this.end + 1, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Where dependency lines arriving at the end of the bar end.
   *
   * @returns The `[x, y]` anchor point of the arrows.
   */
  endDepLineEnd(): [number, number,] {
    return [this.end - 1, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Marks the zones the router cannot cross (Ruby `addBlockedZones`).
   *
   * @param router Router receiving the blocked rectangles.
   */
  addBlockedZones(router: ZoneRouter,): void {
    const centerY = this.y + Math.trunc(this.lineHeight / 2,);
    // Horizontal block of the whole bar.
    router.addZone(
      this.start,
      centerY - SIZE - 1,
      this.end - this.start + 1,
      2 * SIZE + 3,
      true,
      false,
    );
    // Blocks the arrow tip.
    router.addZone(this.start - 9, centerY - 7, 10, 15, true, true,);
    // Vertical block of the edges.
    router.addZone(this.start - 2, this.y, 5, this.lineHeight, false, true,);
    router.addZone(this.end - 2, this.y, 5, this.lineHeight, false, true,);
  }

  /**
   * Converts the abstract bar into `<div>`s (Ruby `to_html`).
   *
   * @returns The invisible frame, the bar frame, its fill and the progress bar.
   */
  to_html(): XMLElementLike[] {
    const xStart = Math.trunc(this.start,);
    const yCenter = Math.trunc(this.lineHeight / 2,);
    const width = Math.trunc(this.end,) - Math.trunc(this.start,) + 1;

    const html: XMLElementLike[] = [];

    // Invisible frame that triggers the tooltips.
    html.push(
      rectToHTML(xStart, 0, width, this.lineHeight, "tj_gantt_frame",),
    );

    // Frame of the bar.
    html.push(
      rectToHTML(xStart, yCenter - SIZE, width, 2 * SIZE, "taskbarframe",),
    );

    // Fill.
    html.push(
      rectToHTML(
        xStart + 1,
        yCenter - SIZE + 1,
        width - 2,
        2 * SIZE - 2,
        "taskbar",
      ),
    );

    // Progress bar; without a query Ruby assumes 50%.
    let completion: number;
    if (this.query) {
      this.query.attributeId = "complete";
      this.query.process();
      const res = this.query.result();
      // Ruby `res ? res / 100.0 : 0.0` — `complete` is numeric or null.
      completion = typeof res === "number" ? res / 100 : 0;
    } else {
      completion = 0.5;
    }
    html.push(
      rectToHTML(
        xStart + 1,
        yCenter - Math.trunc(SIZE / 2,),
        (width - 2) * completion,
        SIZE,
        "progressbar",
      ),
    );

    return html;
  }
}
