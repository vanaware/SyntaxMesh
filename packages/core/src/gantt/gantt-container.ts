/**
 * GanttContainer (phase 15.6) — the bar of a container task (with subtasks).
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/GanttContainer.rb`.
 * The bar is drawn with "jags" (brackets) at both ends, which is why it extends
 * `SIZE` pixels beyond `start`/`end`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.6)
 */
import { jagToHTML, rectToHTML, } from "./html-graphics.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { ZoneRouter, } from "./gantt-router.ts";

/** Half height of the bar, in pixels. */
const SIZE = 5;

/** Container task bar on the Gantt chart. */
export class GanttContainer {
  /** Ruby `@@size`: half height of the bar (centre → top/bottom). */
  static readonly SIZE: number = SIZE;

  private readonly lineHeight: number;
  private readonly start: number;
  private readonly end: number;
  private readonly y: number;

  /**
   * Creates a container bar.
   *
   * @param lineHeight Height of the chart line the bar sits in, in pixels.
   * @param xStart Left end of the bar, in pixels.
   * @param xEnd Right end of the bar, in pixels.
   * @param y Top offset of the chart line, in pixels.
   */
  constructor(lineHeight: number, xStart: number, xEnd: number, y: number,) {
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
    return [this.start, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Where dependency lines arriving at the start of the bar end.
   *
   * @returns The `[x, y]` anchor point of the arrows.
   */
  startDepLineEnd(): [number, number,] {
    return [this.start - SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Where dependency lines leaving the end of the bar begin.
   *
   * @returns The `[x, y]` anchor point of the arrows.
   */
  endDepLineStart(): [number, number,] {
    return [this.end + SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Where dependency lines arriving at the end of the bar end.
   *
   * @returns The `[x, y]` anchor point of the arrows.
   */
  endDepLineEnd(): [number, number,] {
    return [this.end, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Marks the zones the router cannot cross (Ruby `addBlockedZones`).
   *
   * @param router Router receiving the blocked rectangles.
   */
  addBlockedZones(router: ZoneRouter,): void {
    const centerY = this.y + Math.trunc(this.lineHeight / 2,);
    // Horizontal block of the bar (jags included).
    router.addZone(
      this.start - SIZE,
      centerY - SIZE - 2,
      this.end - this.start + 1 + 2 * SIZE,
      2 * SIZE + 5,
      true,
      false,
    );
    // Blocks the arrow tip.
    router.addZone(this.start - SIZE - 9, centerY - 7, 10, 15, true, true,);
    // Vertical block of the edges.
    router.addZone(
      this.start - SIZE - 2,
      this.y,
      2 * SIZE + 5,
      this.lineHeight,
      false,
      true,
    );
    router.addZone(
      this.end - SIZE - 2,
      this.y,
      2 * SIZE + 5,
      this.lineHeight,
      false,
      true,
    );
  }

  /**
   * Converts the abstract container into `<div>`s (Ruby `to_html`).
   *
   * @returns The invisible frame, the bar and its two jags.
   */
  to_html(): XMLElementLike[] {
    const xStart = Math.trunc(this.start,);
    const yCenter = Math.trunc(this.lineHeight / 2,);
    const width = Math.trunc(this.end,) - Math.trunc(this.start,) + 1;

    const html: XMLElementLike[] = [];

    // Invisible frame that triggers the tooltips.
    html.push(
      rectToHTML(
        xStart - SIZE,
        0,
        width + 2 * SIZE,
        this.lineHeight,
        "tj_gantt_frame",
      ),
    );

    // The bar.
    html.push(
      rectToHTML(
        xStart - SIZE,
        yCenter - SIZE,
        width + 2 * SIZE,
        SIZE,
        "containerbar",
      ),
    );
    // Left jag.
    html.push(jagToHTML(xStart, yCenter,),);
    // Right jag.
    html.push(jagToHTML(xStart + width, yCenter,),);

    return html;
  }
}
