/**
 * CollisionDetector (phase 15.2) — blocked zones for the Gantt routing.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/CollisionDetector.rb`.
 *
 * Zones are stored as an array of segments per line: horizontal blocks in
 * `hLines[y]`, vertical blocks in `vLines[x]`. Each segment is `[start, end]`
 * and both ends belong to the segment. Overlapping or directly adjacent
 * segments are merged on insertion, which keeps the lists ordered and short for
 * the binary search of `collision()`.
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.2)
 */
import { lineToHTML, } from "./html-graphics.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";

/** Blocked segment `[start, end]` (inclusive at both ends). */
export type LineSegment = [number, number,];

/** Collision detector per horizontal (`y`) and vertical (`x`) line. */
export class CollisionDetector {
  private readonly width: number;
  private readonly height: number;
  /** Horizontal blocks per `y`: `hLines[y] = [[start, end], …]`. */
  private readonly hLines: LineSegment[][];
  /** Vertical blocks per `x`: `vLines[x] = [[start, end], …]`. */
  private readonly vLines: LineSegment[][];

  /**
   * Creates the detector for a chart of the given size.
   *
   * @param width Width of the routed area, in pixels.
   * @param height Height of the routed area, in pixels.
   */
  constructor(width: number, height: number,) {
    this.width = width;
    this.height = height;
    this.hLines = Array.from({ length: height, }, () => [] as LineSegment[],);
    this.vLines = Array.from({ length: width, }, () => [] as LineSegment[],);
  }

  /**
   * Registers an area as a "don't-cross zone". `horiz` blocks horizontal lines;
   * `vert` blocks vertical ones (Ruby `addBlockedZone`).
   *
   * @param x Left offset of the area, in pixels.
   * @param y Top offset of the area, in pixels.
   * @param w Width of the area, in pixels.
   * @param h Height of the area, in pixels.
   * @param horiz Whether horizontal lines are blocked.
   * @param vert Whether vertical lines are blocked.
   */
  addBlockedZone(
    x: number,
    y: number,
    w: number,
    h: number,
    horiz: boolean,
    vert: boolean,
  ): void {
    // Clips the rectangle to the area controlled by the router.
    const cx = this.clip(Math.trunc(x,), this.width - 1,);
    const cy = this.clip(Math.trunc(y,), this.height - 1,);
    const cw = this.clip(Math.trunc(w,), this.width - cx,);
    const ch = this.clip(Math.trunc(h,), this.height - cy,);

    // Empty zones can be ignored.
    if (cw === 0 || ch === 0) return;

    if (horiz) {
      for (let i = cy; i <= cy + ch - 1; i++) {
        this.addSegment(this.hLines[i]!, [cx, cx + cw - 1,],);
      }
    }
    if (vert) {
      for (let i = cx; i <= cx + cw - 1; i++) {
        this.addSegment(this.vLines[i]!, [cy, cy + ch - 1,],);
      }
    }
  }

  /**
   * Tells whether line `pos` is blocked for the given `segment`. Uses binary
   * search (Ruby `collision?`): the lists stay ordered by `start`.
   *
   * @param pos Coordinate of the line to test.
   * @param segment Segment that would be drawn on that line.
   * @param horizontal Whether the line is horizontal.
   * @returns `true` when the segment hits a blocked zone.
   */
  collision(
    pos: number,
    segment: LineSegment,
    horizontal: boolean,
  ): boolean {
    const lines = horizontal ? this.hLines : this.vLines;
    // Outside the router area there is no block (Ruby would blow up; here it is
    // treated as empty to keep the router robust on degenerate charts).
    const line = lines[pos] ?? [];
    let l = 0;
    let u = line.length - 1;
    while (l <= u) {
      const p = l + Math.trunc((u - l) / 2,);
      const candidate = line[p]!;
      if (this.overlaps(candidate, segment,)) return true;
      if (segment[0] > candidate[1]) {
        l = p + 1;
      } else {
        u = p - 1;
      }
    }
    return false;
  }

  /**
   * Serializes the **vertical** blocks as white lines (debug). Ruby has an
   * `if true` with the horizontal branch disabled; only the active branch is
   * kept here.
   *
   * @returns The white lines representing the vertical blocks.
   */
  to_html(): XMLElementLike[] {
    const html: XMLElementLike[] = [];
    this.vLines.forEach((line, x,) => {
      for (const segment of line) {
        html.push(lineToHTML(x, segment[0], x, segment[1], "white",),);
      }
    },);
    return html;
  }

  /**
   * Clamps `v` to the `[0, max]` interval (Ruby `clip`).
   *
   * @param v Value to clamp.
   * @param max Upper bound of the interval.
   * @returns The clamped value.
   */
  private clip(v: number, max: number,): number {
    if (v < 0) return 0;
    if (v > max) return max;
    return v;
  }

  /**
   * Inserts `newSegment` into `line`, merging it with overlapping or adjacent
   * segments (Ruby `addSegment`).
   *
   * @param line Ordered list of segments of one line.
   * @param newSegment Segment to insert.
   */
  private addSegment(line: LineSegment[], newSegment: LineSegment,): void {
    let i = 0;
    while (i < line.length) {
      const segment = line[i]!;
      if (this.mergeable(newSegment, segment,)) {
        // Merges the existing segment into the new one and restarts at the same
        // position.
        this.merge(newSegment, segment,);
        line.splice(i, 1,);
        continue;
      } else if (segment[0] > newSegment[1]) {
        // Ascending list: insert before the first larger segment.
        line.splice(i, 0, newSegment,);
        return;
      }
      i++;
    }
    line.push(newSegment,);
  }

  /**
   * Tells whether `s1` and `s2` overlap (ends included).
   *
   * @param s1 First segment.
   * @param s2 Second segment.
   * @returns `true` when the segments share at least one point.
   */
  private overlaps(s1: LineSegment, s2: LineSegment,): boolean {
    return (s1[0] <= s2[0] && s2[0] <= s1[1]) ||
      (s2[0] <= s1[0] && s1[0] <= s2[1]);
  }

  /**
   * Tells whether `s1` and `s2` overlap or are directly adjacent.
   *
   * @param s1 First segment.
   * @param s2 Second segment.
   * @returns `true` when the segments can be merged.
   */
  private mergeable(s1: LineSegment, s2: LineSegment,): boolean {
    return this.overlaps(s1, s2,) ||
      (s1[1] + 1 === s2[0]) ||
      (s2[1] + 1 === s1[0]);
  }

  /**
   * Extends `dst` so that it also covers `seg` (Ruby `merge`).
   *
   * @param dst Segment being extended.
   * @param seg Segment absorbed into `dst`.
   */
  private merge(dst: LineSegment, seg: LineSegment,): void {
    if (seg[0] < dst[0]) dst[0] = seg[0];
    if (seg[1] > dst[1]) dst[1] = seg[1];
  }
}
