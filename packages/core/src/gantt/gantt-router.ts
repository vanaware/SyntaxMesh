/**
 * GanttRouter (phase 15.3) — routes the dependency lines of the Gantt chart.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/GanttRouter.rb`.
 *
 * The chart is a rectangular `width` × `height` area. Each graphic element
 * registers "don't-cross-zones" (`addZone`) that block horizontal lines,
 * vertical lines or both. `route()` returns an orthogonal path (never diagonal)
 * of `[x, y]` points, starting at the source and ending at the target.
 *
 * ## Odd Ruby behaviours (cheat sheet §12)
 *
 * - **Category A** — `Math.asin(PI/2 - sinus)` in the `adjLeg < 0` branch leaves
 *   the domain of `asin` and raises `Math::DomainError` in Ruby. Fixed by
 *   clamping the argument: identical to every case where Ruby works.
 * - **Category A** — the `raise "Routing failed" unless ySeg|x1|x2` guards are
 *   unreachable: `placeLine` always returns an integer.
 * - **Category B** — in the horizontal branch of `addLineTo` Ruby tests
 *   `x1 >= @height` (likely a typo for `y1 >= @height`), which discards
 *   legitimate zones. Replicated under `compat.keepRubyBugs`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.3)
 */
import { compat, } from "../compat.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { CollisionDetector, type LineSegment, } from "./collision-detector.ts";

/** Minimum distance between the start point and the first bend. */
export const MinStartGap = 5;
/** Minimum distance between the last bend and the arrow tip. */
export const MinEndGap = 10;

/** One point of a routed path. */
export type RoutePoint = [number, number,];

/** `[startX, startY, endX, endY, id?]` tuple accepted by `routeLines`. */
export type FromToPoint = [number, number, number, number, number?,];

/** Route being processed (equivalent to the Ruby Hash). */
interface RouteDef {
  readonly startX: number;
  readonly startY: number;
  readonly endX: number;
  readonly endY: number;
  readonly id?: number;
  distance: number;
  angle: number;
}

/**
 * Minimal contract consumed by the Gantt elements. In Ruby they receive the
 * `GanttRouter` and call only `addZone`.
 */
export interface ZoneRouter {
  /**
   * Registers an area the routed lines must not cross.
   *
   * @param x Left offset of the area, in pixels.
   * @param y Top offset of the area, in pixels.
   * @param w Width of the area, in pixels.
   * @param h Height of the area, in pixels.
   * @param horiz Whether horizontal lines are blocked.
   * @param vert Whether vertical lines are blocked.
   */
  addZone(
    x: number,
    y: number,
    w: number,
    h: number,
    horiz: boolean,
    vert: boolean,
  ): void;
}

/** Router of dependency lines over a `width` × `height` area. */
export class GanttRouter implements ZoneRouter {
  private readonly width: number;
  private readonly height: number;
  private readonly detector: CollisionDetector;

  /**
   * Creates a router for a chart of the given size.
   *
   * @param width Width of the routed area, in pixels.
   * @param height Height of the routed area, in pixels.
   */
  constructor(width: number, height: number,) {
    this.width = Math.trunc(width,);
    this.height = Math.trunc(height,);
    this.detector = new CollisionDetector(this.width, this.height,);
  }

  /**
   * Registers an area the lines must not cross (Ruby `addZone`).
   *
   * @param x Left offset of the area, in pixels.
   * @param y Top offset of the area, in pixels.
   * @param w Width of the area, in pixels.
   * @param h Height of the area, in pixels.
   * @param horiz Whether horizontal lines are blocked.
   * @param vert Whether vertical lines are blocked.
   */
  addZone(
    x: number,
    y: number,
    w: number,
    h: number,
    horiz: boolean,
    vert: boolean,
  ): void {
    this.detector.addBlockedZone(x, y, w, h, horiz, vert,);
  }

  /**
   * Routes a batch of arrows. The order is deterministic: decreasing angle in
   * buckets of 5 degrees and, inside a bucket, decreasing distance (Ruby
   * `routeLines`).
   *
   * @param fromToPoints Arrows to route, as `[startX, startY, endX, endY, id?]`.
   * @returns One orthogonal path of `[x, y]` points per arrow, in the same
   * order as the input after sorting.
   */
  routeLines(fromToPoints: readonly FromToPoint[],): RoutePoint[][] {
    const routes: RouteDef[] = fromToPoints.map((t,) => ({
      startX: t[0],
      startY: t[1],
      endX: t[2],
      endY: t[3],
      id: t[4],
      distance: 0,
      angle: 0,
    }));

    for (const r of routes) {
      const adjLeg = (r.endX - MinEndGap) - (r.startX + MinStartGap);
      const oppLeg = Math.abs(r.startY - r.endY,);
      r.distance = Math.sqrt(adjLeg ** 2 + oppLeg ** 2,);
      // Sine of the angle between the vertical through the task end and the
      // start→end line; converted to degrees (0–90).
      const sinus = Math.abs(oppLeg,) / r.distance;
      if (adjLeg < 0) {
        // RUBY-COMPAT-FIX: Ruby uses asin(PI/2 - sinus), whose argument leaves
        // [-1, 1] and raises Math::DomainError. The clamp keeps the same result
        // in every case where Ruby does not break.
        const arg = Math.min(1, Math.max(-1, Math.PI / 2 - sinus,),);
        r.angle = (Math.PI / 2 + Math.asin(arg,)) / (Math.PI / (2 * 90));
      } else {
        r.angle = Math.asin(sinus,) / (Math.PI / (2 * 90));
      }
    }

    routes.sort((r1, r2,) => {
      // Ruby: -(r1 <=> r2) → descending order on both criteria.
      if (Math.trunc(r1.angle / 5,) === Math.trunc(r2.angle / 5,)) {
        return r2.distance - r1.distance;
      }
      return r2.angle - r1.angle;
    },);

    return routes.map((r,) => this.route(r.startX, r.startY, r.endX, r.endY,));
  }

  /**
   * Orthogonal path from `(startX, startY)` to `(endX, endY)`. It tries a
   * direct 3-point route; when the corridor does not fit or is blocked, it
   * falls back to the 6-point route (Ruby `route`).
   *
   * @param startX X coordinate the path starts at.
   * @param startY Y coordinate the path starts at.
   * @param endX X coordinate the path ends at.
   * @param endY Y coordinate the path ends at.
   * @returns The waypoints of the orthogonal path, first point first.
   */
  route(
    startX: number,
    startY: number,
    endX: number,
    endY: number,
  ): RoutePoint[] {
    const points: RoutePoint[] = [[startX, startY,],];

    if (endX - startX > MinStartGap + MinEndGap + 2) {
      const xSeg = this.placeLine(
        [startY + (startY < endY ? 1 : -1), endY,],
        false,
        startX + MinStartGap,
        1,
      );
      // Ruby: `if xSeg && xSeg < endX - endGap`. `placeLine` never returns nil
      // and 0 is truthy in Ruby, so only the comparison remains.
      if (xSeg < endX - MinEndGap) {
        this.addLineTo(points, xSeg, startY,);
        this.addLineTo(points, xSeg, endY,);
        this.addLineTo(points, endX, endY,);
        return points;
      }
    }

    // Complex route: walk up/down to a free line, move horizontally and then
    // walk down/up to the target.
    const deltaY = startY < endY ? 1 : -1;
    const ySeg = this.placeLine(
      [0, this.width - 1,],
      true,
      startY + 2 * deltaY,
      deltaY,
    );
    // RUBY-COMPAT-DOC: the Ruby `raise "Routing failed"` guards are unreachable
    // because `placeLine` always returns an integer.
    const x1 = this.placeLine(
      [startY + deltaY, ySeg,],
      false,
      startX + MinStartGap,
      1,
    );
    const x2 = this.placeLine(
      [ySeg + deltaY, endY,],
      false,
      endX - MinEndGap,
      -1,
    );

    this.addLineTo(points, x1, startY,);
    if (x1 !== x2) {
      this.addLineTo(points, x1, ySeg,);
      this.addLineTo(points, x2, ySeg,);
    }
    this.addLineTo(points, x2, endY,);
    this.addLineTo(points, endX, endY,);

    return points;
  }

  /**
   * Serializes the vertical blocks as white lines (debug).
   *
   * @returns The white lines representing the vertical blocks.
   */
  to_html(): XMLElementLike[] {
    return this.detector.to_html();
  }

  /**
   * First free coordinate for `segment` on line/column `start`, walking by
   * `delta`. Returns the border of the area when nothing is free (Ruby
   * `placeLine`).
   *
   * @param segment Segment that would be drawn.
   * @param horizontal Whether the line is horizontal.
   * @param start Coordinate to start the search from.
   * @param delta Step applied on each try (must not be 0).
   * @returns The first free coordinate, or the border of the area.
   * @throws Error When `delta` is 0.
   */
  private placeLine(
    segment: LineSegment,
    horizontal: boolean,
    start: number,
    delta: number,
  ): number {
    if (delta === 0) throw new Error("delta may not be 0",);

    let pos = Math.trunc(start,);
    if (pos < 0) pos = 0;
    const max = (horizontal ? this.height : this.width) - 1;
    if (pos > max) pos = max;

    // Ruby `segment.sort!` — the segment must be in ascending order.
    segment.sort((a, b,) => a - b);

    while (this.detector.collision(pos, segment, horizontal,)) {
      pos += delta;
      if (delta < 0) {
        if (pos < 0) break;
      } else {
        if (pos >= (horizontal ? this.height : this.width)) break;
      }
    }
    return pos;
  }

  /**
   * Appends a waypoint and marks a 2px zone on each side of the segment, so
   * that parallel lines do not stick together (Ruby `addLineTo`).
   *
   * @param points Waypoints collected so far.
   * @param x2 X coordinate of the new waypoint.
   * @param y2 Y coordinate of the new waypoint.
   * @throws Error When `points` is empty.
   */
  private addLineTo(points: RoutePoint[], x2: number, y2: number,): void {
    if (points.length === 0) {
      throw new Error("Point list may not be empty",);
    }

    const [x1, y1,] = points[points.length - 1]!;
    points.push([x2, y2,],);

    if (x1 === x2) {
      // Vertical line.
      if (x1 < 0 || x1 >= this.width) return;
      const [x, y, w, h,] = justify(x1 - 2, y1, 5, y2 - y1 + 1,);
      this.addZone(x, y, w, h, false, true,);
    } else {
      // Horizontal line.
      if (compat.keepRubyBugs) {
        // RUBY-COMPAT: Ruby tests `x1 >= @height` (typo for `y1 >= @height`),
        // discarding legitimate horizontal zones and changing the routing.
        if (y1 < 0 || x1 >= this.height) return;
      } else {
        if (y1 < 0 || y1 >= this.height) return;
      }
      const [x, y, w, h,] = justify(x1, y1 - 2, x2 - x1 + 1, 5,);
      this.addZone(x, y, w, h, true, false,);
    }
  }
}

/**
 * Normalizes a rectangle to positive coordinates (Ruby `justify`). Note that
 * `x` uses the already positive `w`.
 *
 * @param x Left offset of the rectangle.
 * @param y Top offset of the rectangle.
 * @param w Width; a negative value flips the rectangle horizontally.
 * @param h Height; a negative value flips the rectangle vertically.
 * @returns The normalized `[x, y, w, h]` tuple with non-negative sizes.
 */
export function justify(
  x: number,
  y: number,
  w: number,
  h: number,
): [number, number, number, number,] {
  if (w < 0) {
    w = -w;
    x = x - w + 1;
  }
  if (h < 0) {
    h = -h;
    y = y - h + 1;
  }
  return [x, y, w, h,];
}
