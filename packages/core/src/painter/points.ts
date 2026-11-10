/**
 * 17.7.2 — `Points`: coordinate list for SVG (`Painter/Points.rb`).
 *
 * Ports `TaskJuggler::Painter::Points`: it holds `[x, y]` pairs after validating
 * each element and serializes them in the SVG `points` format.
 *
 * Particularities (Ruby oracle, 2026-11-04):
 * - **`to_s` ends with a space**: each point is concatenated as
 *   `"#{x},#{y} "`, so `[[1,2],[3,4]]` becomes `"1,2 3,4 "` (with the trailing
 *   space). The plan suggested `"x,y x,y"` without a space; the Ruby behaviour
 *   wins.
 * - Empty list → empty string.
 * - The validation accepts any 2-element `Array` (it does not check for
 *   numbers): `[[nil, nil]]` passes and serializes `", "` (`nil.to_s`). Here
 *   `null`/`undefined` also serialize empty, through `?? ""`.
 * - Ruby stores the received reference (`@points = arr`) without copying — the
 *   port does the same, to keep the behaviour for callers that mutate the list.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Points.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.7.2)
 */

import { TjArgumentError, } from "../model/errors.ts";

/** `[x, y]` pair (numbers in the port; Ruby only requires a 2-element Array). */
export type Point = [number, number,];

/** Ordered list of `[x, y]` pairs rendered as the SVG `points` attribute. */
export class Points {
  private readonly points: Point[];

  /**
   * Ruby `initialize(arr)` — rejects any element that is not a pair.
   *
   * @param arr Points of the list; stored by reference.
   * @throws TjArgumentError When an element is not a 2-coordinate Array.
   */
  constructor(arr: Point[],) {
    for (const point of arr) {
      if (!Array.isArray(point,) || point.length !== 2) {
        throw new TjArgumentError(
          "Points must be an Array with 2 coordinates",
        );
      }
    }
    this.points = arr;
  }

  /**
   * `"x,y x,y "` — SVG `points`, with a space after each pair (as in Ruby).
   *
   * @returns The serialized coordinate list.
   */
  to_s(): string {
    let str = "";
    for (const point of this.points) {
      const [x, y,] = point;
      str += `${x ?? ""},${y ?? ""} `;
    }
    return str;
  }
}
