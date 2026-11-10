/**
 * GanttHeaderScaleItem (phase 15.8) — one cell of a header scale.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/GanttHeaderScaleItem.rb`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.8)
 */
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";

/**
 * A scale cell (e.g. "Jan 2027" on the large row, "07" on the small one).
 *
 * Note: Ruby also declares `attr_reader :pos`, but `@pos` is never assigned (a
 * dead reader) and no consumer uses it — omitted here.
 */
export class GanttHeaderScaleItem {
  /** Text drawn inside the cell. */
  readonly label: string;
  /** Width of the cell, in pixels. */
  readonly width: number;
  private readonly x: number;
  private readonly y: number;
  private readonly height: number;

  /**
   * Creates a scale cell.
   *
   * @param label Text drawn inside the cell.
   * @param x Left offset of the cell, in pixels.
   * @param y Top offset of the cell, in pixels.
   * @param width Width of the cell, in pixels.
   * @param height Height of the cell, in pixels.
   */
  constructor(
    label: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ) {
    this.label = label;
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  /**
   * Converts the cell into a `<div class="tabhead">` (Ruby `to_html`).
   *
   * @returns The positioned header cell element.
   */
  to_html(): XMLElementLike {
    // The trailing spaces in the styles are part of the Ruby string.
    const div = new XMLElement("div", {
      class: "tabhead",
      style: "font-weight:bold; position:absolute; " +
        `left:${this.x}px; top:${this.y}px; ` +
        `width:${this.width}px; height:${this.height}px; `,
    },);
    const div1 = new XMLElement("div", { style: "padding:3px; ", },);
    div1.append(`${this.label}`,);
    div.append(div1,);
    return div;
  }
}
