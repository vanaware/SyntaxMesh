/**
 * 17.9.3 — `Primitives`: creation mix-in (`Painter/Primitives.rb`).
 *
 * In Ruby it is a `module` included by `Painter`, `Group` and `Element`. It
 * exposes factories (`color`, `points`) and shape builders (`group`, `circle`,
 * `ellipse`, `line`, `polyline`, `rect`, `text`) that **append the created
 * element to `@elements`** and return it. Only `Painter` and `Group` have
 * `@elements`, so they are the only places where the shapes work (`Element`
 * includes the module just to see the `StrokeAttrs` constants — here they are
 * TS modules).
 *
 * Port strategy (avoids the `primitives ↔ group` cycle): `Primitives` is an
 * **abstract class** that keeps `elements` and the shapes but does NOT know
 * `Group`. The only method that would need `Group` (`group`) delegates creation
 * to a `protected abstract newGroup(...)` hook, implemented by `Group` and
 * `Painter`. That way `primitives.ts` imports `Group`/`GroupBlock` only as a
 * **type** (erased at runtime) and there is no value dependency back into
 * `group.ts`.
 *
 * Oracle particularities (2026-11-04, `.tmp/primitives_probe.rb`):
 * - `line`/`rect`/`circle`/… **mutate the caller's `attrs` hash** (Ruby
 *   `attrs[:x1] = x1`). This is Category C replicated: the coordinates are
 *   written into the received object before the element is created.
 *   `G_MUTATES` confirmed `{stroke: 'red', x1: 1, y1: 2, x2: 3, y2: 4}` after
 *   `g.line(1,2,3,4,attrs)`.
 * - `polyline(points, attrs)` accepts `Point[]` (converted into `Points`) **or**
 *   an already built `Points`; both give `points="1,2 3,4 "`.
 * - `color(*args)` → `new Color(...)`; `points(arr)` → `new Points(arr)`.
 * - `group` without a block returns an empty `<g>`: `G_GROUP_EMPTY` =
 *   `<g><g></g></g>`.
 * - Returned types (`G_RET`): Line, Group, Rect, PolyLine, Text, Circle,
 *   Ellipse.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Primitives.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.9.3)
 */

import { Circle, Ellipse, Line, PolyLine, Rect, } from "./basic-shapes.ts";
import { Color, type ColorArg, } from "./color.ts";
import { type Drawable, } from "./element.ts";
import { type Point, Points, } from "./points.ts";
import { type SVGValues, } from "./svg-support.ts";
import { Text, } from "./text.ts";
import type { Group, GroupBlock, } from "./group.ts";

/** Base class providing the shape builders shared by `Painter` and `Group`. */
export abstract class Primitives {
  /** Accumulator of the elements created by the shapes (Ruby `@elements`). */
  protected readonly elements: Drawable[] = [];

  /**
   * Factory injected for `group()`: `Group` and `Painter` supply their own
   * group class, keeping `primitives.ts` free of a value dependency on
   * `group.ts`.
   *
   * @param attrs Attributes of the new group.
   * @param block Callback that populates the new group.
   * @returns The new group.
   */
  protected abstract newGroup(
    attrs: SVGValues,
    block?: GroupBlock,
  ): Group;

  /**
   * Ruby `color(*args)` — `Color.new(*args)`.
   *
   * @param args Colour channels, exactly as accepted by the `Color`
   *   constructor.
   * @returns The new colour.
   */
  color(...args: ColorArg[]): Color {
    return new Color(...args,);
  }

  /**
   * Ruby `points(arr)` — `Points.new(arr)`.
   *
   * @param arr Coordinate pairs of the polyline.
   * @returns The new coordinate list.
   */
  points(arr: Point[],): Points {
    return new Points(arr,);
  }

  /**
   * Ruby `group(attrs = {}, &block)` — builds, registers and returns the
   * `Group`.
   *
   * @param attrs Attributes of the new group.
   * @param block Callback that populates the new group.
   * @returns The new group, already attached to this canvas.
   */
  group(attrs: SVGValues = {}, block?: GroupBlock,): Group {
    const g = this.newGroup(attrs, block,);
    this.elements.push(g,);
    return g;
  }

  /**
   * Ruby `circle(cx, cy, r, attrs = {})` — appends a `<circle>`.
   *
   * @param cx X coordinate of the centre.
   * @param cy Y coordinate of the centre.
   * @param r Radius.
   * @param attrs Paint attributes; mutated with the coordinates.
   * @returns The created circle.
   */
  circle(cx: number, cy: number, r: number, attrs: SVGValues = {},): Circle {
    attrs.cx = cx;
    attrs.cy = cy;
    attrs.r = r;
    const c = new Circle(attrs,);
    this.elements.push(c,);
    return c;
  }

  /**
   * Ruby `ellipse(cx, cy, rx, ry, attrs = {})` — appends an `<ellipse>`.
   *
   * @param cx X coordinate of the centre.
   * @param cy Y coordinate of the centre.
   * @param rx Horizontal radius.
   * @param ry Vertical radius.
   * @param attrs Paint attributes; mutated with the coordinates.
   * @returns The created ellipse.
   */
  ellipse(
    cx: number,
    cy: number,
    rx: number,
    ry: number,
    attrs: SVGValues = {},
  ): Ellipse {
    attrs.cx = cx;
    attrs.cy = cy;
    attrs.rx = rx;
    attrs.ry = ry;
    const e = new Ellipse(attrs,);
    this.elements.push(e,);
    return e;
  }

  /**
   * Ruby `line(x1, y1, x2, y2, attrs = {})` — appends a `<line>`.
   *
   * @param x1 X coordinate of the start point.
   * @param y1 Y coordinate of the start point.
   * @param x2 X coordinate of the end point.
   * @param y2 Y coordinate of the end point.
   * @param attrs Stroke attributes; mutated with the coordinates.
   * @returns The created line.
   */
  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    attrs: SVGValues = {},
  ): Line {
    attrs.x1 = x1;
    attrs.y1 = y1;
    attrs.x2 = x2;
    attrs.y2 = y2;
    const l = new Line(attrs,);
    this.elements.push(l,);
    return l;
  }

  /**
   * Ruby `polyline(points, attrs = {})` — appends a `<polyline>`.
   *
   * @param points Coordinate pairs, either as a bare array or already wrapped
   *   in `Points`.
   * @param attrs Paint attributes; mutated with the serialized `points`.
   * @returns The created polyline.
   */
  polyline(
    points: Point[] | Points,
    attrs: SVGValues = {},
  ): PolyLine {
    attrs.points = Array.isArray(points,) ? new Points(points,) : points;
    const l = new PolyLine(attrs,);
    this.elements.push(l,);
    return l;
  }

  /**
   * Ruby `rect(x, y, width, height, attrs = {})` — appends a `<rect>`.
   *
   * @param x X coordinate of the top-left corner.
   * @param y Y coordinate of the top-left corner.
   * @param width Width of the rectangle.
   * @param height Height of the rectangle.
   * @param attrs Paint attributes; mutated with the geometry.
   * @returns The created rectangle.
   */
  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    attrs: SVGValues = {},
  ): Rect {
    attrs.x = x;
    attrs.y = y;
    attrs.width = width;
    attrs.height = height;
    const r = new Rect(attrs,);
    this.elements.push(r,);
    return r;
  }

  /**
   * Ruby `text(x, y, str, attrs = {})` — appends a `<text>`.
   *
   * @param x X coordinate of the text anchor.
   * @param y Y coordinate of the text anchor.
   * @param str Content drawn between the tags.
   * @param attrs Text attributes; mutated with the position.
   * @returns The created text element.
   */
  text(x: number, y: number, str: string, attrs: SVGValues = {},): Text {
    attrs.x = x;
    attrs.y = y;
    const t = new Text(str, attrs,);
    this.elements.push(t,);
    return t;
  }
}
