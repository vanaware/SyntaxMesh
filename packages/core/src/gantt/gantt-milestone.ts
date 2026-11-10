/**
 * GanttMilestone (phase 15.5) — the diamond of a milestone.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/GanttMilestone.rb`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.5)
 */
import { diamondToHTML, rectToHTML, } from "./html-graphics.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { ZoneRouter, } from "./gantt-router.ts";

/** Half width/height of the diamond, in pixels. */
const SIZE = 6;

/** A milestone on the Gantt chart. */
export class GanttMilestone {
  /** Ruby `@@size`: distance from the centre to the tips of the diamond. */
  static readonly SIZE: number = SIZE;

  private readonly lineHeight: number;
  private readonly x: number;
  private readonly y: number;

  /**
   * Creates a milestone marker.
   *
   * @param lineHeight Height of the chart line the marker sits in, in pixels.
   * @param x Horizontal centre of the diamond, in pixels.
   * @param y Top offset of the chart line, in pixels.
   */
  constructor(lineHeight: number, x: number, y: number,) {
    this.lineHeight = lineHeight;
    this.x = x;
    this.y = y;
  }

  /**
   * Where dependency lines leaving the start of the milestone begin.
   *
   * @returns The `[x, y]` anchor point of the arrows.
   */
  startDepLineStart(): [number, number,] {
    return [this.x + SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Where dependency lines arriving at the start of the milestone end.
   *
   * @returns The `[x, y]` anchor point of the arrows.
   */
  startDepLineEnd(): [number, number,] {
    return [this.x - SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Where dependency lines leaving the end of the milestone begin.
   *
   * @returns The `[x, y]` anchor point of the arrows.
   */
  endDepLineStart(): [number, number,] {
    return [this.x + SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Where dependency lines arriving at the end of the milestone end.
   *
   * RUBY-COMPAT-DOC: Ruby uses `@x + @@size` (the same right tip of the diamond
   * as `startDepLineStart`), not `@x - @@size`. Kept for output parity.
   *
   * @returns The `[x, y]` anchor point of the arrows.
   */
  endDepLineEnd(): [number, number,] {
    return [this.x + SIZE, this.y + Math.trunc(this.lineHeight / 2,),];
  }

  /**
   * Marks the zones the router cannot cross (Ruby `addBlockedZones`).
   *
   * @param router Router receiving the blocked rectangles.
   */
  addBlockedZones(router: ZoneRouter,): void {
    const centerY = this.y + Math.trunc(this.lineHeight / 2,);
    // Area of the diamond.
    router.addZone(
      this.x - SIZE - 2,
      centerY - SIZE - 2,
      2 * SIZE + 5,
      2 * SIZE + 5,
      true,
      true,
    );
    // Blocks the arrow tip.
    router.addZone(this.x - SIZE - 9, centerY - 7, 10, 15, true, true,);
  }

  /**
   * Converts the abstract milestone into `<div>`s (Ruby `to_html`).
   *
   * @returns The invisible frame that triggers the tooltip, plus the diamond.
   */
  to_html(): XMLElementLike[] {
    const html: XMLElementLike[] = [];

    // Invisible frame that triggers the tooltips.
    const half = Math.trunc(this.lineHeight / 2,);
    html.push(
      rectToHTML(
        this.x - half,
        0,
        this.lineHeight,
        this.lineHeight,
        "tj_gantt_frame",
      ),
    );

    // Diamond (two overlapping `<div>`s).
    html.push(...diamondToHTML(this.x, half,),);

    return html;
  }
}
