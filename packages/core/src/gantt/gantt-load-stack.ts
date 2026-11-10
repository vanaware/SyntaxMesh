/**
 * GanttLoadStack (phase 15.7) — load stack normalized by the line height.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/GanttLoadStack.rb`.
 * Used for resources (and for tasks nested in resources): it shows the fraction
 * of allocated work per colour category.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.7)
 */
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { ZoneRouter, } from "./gantt-router.ts";

/**
 * Contract `GanttLoadStack` expects from the line hosting it. In Ruby it calls
 * `@line.lineToHTML`/`@line.rectToHTML` (the `HTMLGraphics` mix-in); `GanttLine`
 * (15.10) implements both methods.
 */
export interface LoadStackHost {
  /** Height of the line in pixels (Ruby `line.height`). */
  readonly height: number;
  /** Y coordinate of the top of the line (Ruby `line.y`). */
  readonly y: number;
  /**
   * Draws a line between two points.
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
  ): XMLElementLike;
  /**
   * Draws a filled rectangle.
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
  ): XMLElementLike;
}

/** Load stack of one Gantt line. */
export class GanttLoadStack {
  private readonly line: LoadStackHost;
  private readonly lineHeight: number;
  private readonly x: number;
  private readonly y: number;
  private readonly w: number;
  private readonly drawFrame: boolean;
  private readonly categories: ReadonlyArray<string | null>;
  /** Tiles in Y coordinates; `null` when the sum of the values is 0. */
  private readonly yLevels: number[] | null;

  /**
   * Builds the stack from the per-category values.
   *
   * @param line Line hosting the stack.
   * @param x Left offset of the stack, in pixels.
   * @param w Width of the stack, in pixels (values `<= 0` become 1).
   * @param values Load value of each category.
   * @param categories CSS class of each category, or `null` for the background.
   * @throws Error When `values` and `categories` have different lengths.
   */
  constructor(
    line: LoadStackHost,
    x: number,
    w: number,
    values: readonly number[],
    categories: ReadonlyArray<string | null>,
  ) {
    this.line = line;
    this.lineHeight = line.height;
    this.x = x;
    this.y = line.y;
    // Widths <= 0 become 1px.
    this.w = w <= 0 ? 1 : w;
    let drawFrame = false;
    if (values.length !== categories.length) {
      throw new Error(
        "Values and categories must have the same number of entries!",
      );
    }
    this.categories = categories;
    for (let i = 0; i < categories.length; i++) {
      // An uncoloured category with a value above 0 lets the background show
      // through → draw the frame.
      if (categories[i] === null && (values[i] ?? 0) > 0) {
        drawFrame = true;
        break;
      }
    }

    let sum = 0;
    for (const v of values) sum += v;
    if (sum === 0) {
      // Sum 0: nothing to stack, but the frame is still drawn.
      this.yLevels = null;
      drawFrame = true;
    } else {
      // Leaves 1px on top, 1px at the bottom and 1px for the frame.
      // RUBY-COMPAT-DOC: Ruby divides integers with `Integer#/` (floor); the
      // real values come from `getEffectiveWork` (Float), so the real TS
      // division preserves the observable behaviour.
      this.yLevels = values.map((v,) => (this.lineHeight - 4) * v / sum);
    }
    this.drawFrame = drawFrame;
  }

  /**
   * Marks the horizontal zone of the stack (Ruby `addBlockedZones`).
   *
   * @param router Router receiving the blocked rectangle.
   */
  addBlockedZones(router: ZoneRouter,): void {
    router.addZone(
      this.x - 2,
      this.y,
      this.w + 4,
      this.lineHeight,
      true,
      false,
    );
  }

  /**
   * Converts the abstract stack into `<div>`s (Ruby `to_html`).
   *
   * @returns The frame plus the stacked bars, or `null` when there is nothing
   * to draw.
   */
  to_html(): XMLElementLike[] | null {
    // Nothing to draw when every value is 0.
    const levels = this.yLevels;
    if (!levels) return null;

    const html: XMLElementLike[] = [];
    const top = 1;
    const bottom = this.lineHeight - 2;
    if (this.drawFrame) {
      // Explicit frame (4 lines) to preserve the background when the stack does
      // not fill the whole line.
      html.push(
        this.line.lineToHTML(this.x, top, this.x + this.w - 1, top, FRAME,),
      );
      html.push(
        this.line.lineToHTML(
          this.x,
          bottom,
          this.x + this.w - 1,
          bottom,
          FRAME,
        ),
      );
      html.push(this.line.lineToHTML(this.x, top, this.x, bottom, FRAME,),);
      html.push(
        this.line.lineToHTML(
          this.x + this.w - 1,
          top,
          this.x + this.w - 1,
          bottom,
          FRAME,
        ),
      );
    } else {
      html.push(
        this.line.rectToHTML(this.x, top, this.w, bottom, FRAME,),
      );
    }

    let yPos = 2;
    // Slightly narrower bars, stacked from the bottom up.
    for (let i = levels.length - 1; i >= 0; i--) {
      const level = levels[i]!;
      if (level <= 0) continue;
      const category = this.categories[i];
      if (category) {
        html.push(
          this.line.rectToHTML(
            this.x + 1,
            Math.trunc(yPos,),
            this.w - 2,
            Math.trunc(yPos + level,) - Math.trunc(yPos,),
            category,
          ),
        );
      }
      yPos += level;
    }

    return html;
  }
}

/** CSS class of the stack frame. */
const FRAME = "loadstackframe";
