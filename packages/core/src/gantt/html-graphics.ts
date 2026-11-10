/**
 * HTMLGraphics (phase 15.1) — graphical primitives as absolute `<div>`s.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/HTMLGraphics.rb`. The TaskJuggler
 * Gantt uses neither SVG nor Canvas: lines, rectangles, jags, diamonds and
 * arrow heads are `div`s with `position: absolute` and a CSS category `class`.
 * Coordinates are truncated like `to_i` in Ruby (cheat sheet §3:
 * `Math.trunc`).
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.1)
 */
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";

/** Truncates to an integer like Ruby's `Integer#to_i`. */
function toI(v: number,): number {
  return Math.trunc(v,);
}

/**
 * Renders a horizontal or vertical line as a 1px `<div>`.
 *
 * Ruby `HTMLGraphics#lineToHTML`. Diagonal lines are not supported (the Gantt
 * routing is strictly orthogonal) and throw an error.
 */
export function lineToHTML(
  xs: number,
  ys: number,
  xe: number,
  ye: number,
  category: string,
): XMLElementLike {
  let x0 = toI(xs,);
  let y0 = toI(ys,);
  let x1 = toI(xe,);
  let y1 = toI(ye,);
  let style: string;
  if (y0 === y1) {
    // Linha horizontal.
    if (x1 < x0) [x0, x1,] = [x1, x0,];
    style = `left:${x0}px; top:${y0}px; ` +
      `width:${x1 - x0 + 1}px; height:1px;`;
  } else if (x0 === x1) {
    // Linha vertical.
    if (y1 < y0) [y0, y1,] = [y1, y0,];
    style = `left:${x0}px; top:${y0}px; ` +
      `width:1px; height:${y1 - y0 + 1}px;`;
  } else {
    throw new Error(
      `Can't draw diagonal line ${x0}/${y0} to ${x1}/${y1}!`,
    );
  }
  return new XMLElement("div", { class: category, style, },);
}

/** Renders a filled rectangle (Ruby `rectToHTML`). */
export function rectToHTML(
  x: number,
  y: number,
  w: number,
  h: number,
  category: string,
): XMLElementLike {
  const style = `left:${toI(x,)}px; top:${toI(y,)}px; ` +
    `width:${toI(w,)}px; height:${toI(h,)}px;`;
  return new XMLElement("div", { class: category, style, },);
}

/** Renders the "jag" (bracket) of a container bar. */
export function jagToHTML(x: number, y: number,): XMLElementLike {
  return new XMLElement("div", {
    class: "tj_gantt_jag",
    style: `left:${toI(x,) - 5}px; top:${toI(y,)}px;`,
  },);
}

/** Renders a diamond (milestone) as two overlapping `<div>` elements. */
export function diamondToHTML(x: number, y: number,): XMLElementLike[] {
  return [
    new XMLElement("div", {
      class: "tj_diamond_top",
      style: `left:${toI(x,) - 6}px; top:${toI(y,) - 7}px;`,
    },),
    new XMLElement("div", {
      class: "tj_diamond_bottom",
      style: `left:${toI(x,) - 6}px; top:${toI(y,)}px;`,
    },),
  ];
}

/** Renders the arrow head of a dependency. */
export function arrowHeadToHTML(x: number, y: number,): XMLElementLike {
  return new XMLElement("div", {
    class: "tj_arrow_head",
    style: `left:${toI(x,) - 5}px; top:${toI(y,) - 5}px;`,
  },);
}
