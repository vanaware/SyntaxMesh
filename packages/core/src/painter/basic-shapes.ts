/**
 * 17.9.1 — basic shapes of the Painter (`Painter/BasicShapes.rb`).
 *
 * Each class is an `Element` with a fixed tag and the list of accepted
 * attributes exactly as in Ruby. No extra behaviour: the value lies in the
 * validation done by `Element` and in the SVG serialization.
 *
 * Attribute sets (Ruby `Primitives`): `StrokeAttrs`, `FillAttrs`,
 * `FillAndStrokeAttrs` and `TextAttrs` live here (and in `text.ts`) instead of
 * `primitives.ts` to keep the module graph acyclic — `Primitives` must import
 * these classes, and `Element`/the shapes cannot import `Primitives`. Content
 * and order are the Ruby ones.
 *
 * Outputs checked against the oracle (2026-11-04,
 * `.tmp/shapes_ruby_check.rb`):
 * - `Circle.new({fill: 'red'}).to_svg.to_s` == `<circle fill="red"></circle>`.
 * - Attributes always come out **sorted** (`<circle cx cy fill fill-opacity r
 *   stroke stroke-opacity stroke-width>`), a rule inherited from 17.1.
 * - `Circle.new` without an argument raises `ArgumentError` in Ruby (arity); in
 *   TS the parameter is mandatory, so the compiler already rejects it.
 * - `PolyLine` accepts a `Points` object **or** (through the primitives) an
 *   array of pairs, which is converted into `Points`. Passing a raw array
 *   straight to `PolyLine` would produce `points="[1, 2]"` in Ruby
 *   (`Array#to_s`); the port has no such path because the type does not accept
 *   a bare array.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/BasicShapes.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.9.1)
 */

import { Element, } from "./element.ts";
import { type SVGValues, } from "./svg-support.ts";

/** Stroke attributes (Ruby `Primitives::StrokeAttrs`). */
export const StrokeAttrs: readonly string[] = [
  "stroke",
  "stroke_opacity",
  "stroke_width",
];

/** Fill attributes (Ruby `Primitives::FillAttrs`). */
export const FillAttrs: readonly string[] = ["fill", "fill_opacity",];

/** Stroke plus fill (Ruby `Primitives::FillAndStrokeAttrs`). */
export const FillAndStrokeAttrs: readonly string[] = [
  ...StrokeAttrs,
  ...FillAttrs,
];

/** Circle: centre `cx`, `cy` and radius `r`. */
export class Circle extends Element {
  /**
   * Ruby `initialize(attrs)`.
   *
   * @param attrs Geometry (`cx`, `cy`, `r`) and paint attributes.
   * @throws TjArgumentError When a key is not accepted by circle.
   */
  constructor(attrs: SVGValues,) {
    super("circle", [...["cx", "cy", "r",], ...FillAndStrokeAttrs,], attrs,);
  }
}

/** Ellipse: centre `cx`, `cy` and radii `rx`, `ry`. */
export class Ellipse extends Element {
  /**
   * Ruby `initialize(attrs)`.
   *
   * @param attrs Geometry (`cx`, `cy`, `rx`, `ry`) and paint attributes.
   * @throws TjArgumentError When a key is not accepted by ellipse.
   */
  constructor(attrs: SVGValues,) {
    super(
      "ellipse",
      [...["cx", "cy", "rx", "ry",], ...FillAndStrokeAttrs,],
      attrs,
    );
  }
}

/** Straight line from `(x1, y1)` to `(x2, y2)` — stroke only, no fill. */
export class Line extends Element {
  /**
   * Ruby `initialize(attrs)`.
   *
   * @param attrs Endpoints (`x1`, `y1`, `x2`, `y2`) and stroke attributes.
   * @throws TjArgumentError When a key is not accepted by line.
   */
  constructor(attrs: SVGValues,) {
    super("line", [...["x1", "y1", "x2", "y2",], ...StrokeAttrs,], attrs,);
  }
}

/** Rectangle at `x`, `y` with `width`/`height` (and `rx`/`ry` corners). */
export class Rect extends Element {
  /**
   * Ruby `initialize(attrs)`.
   *
   * @param attrs Geometry (`x`, `y`, `width`, `height`, `rx`, `ry`) and paint
   *   attributes.
   * @throws TjArgumentError When a key is not accepted by rect.
   */
  constructor(attrs: SVGValues,) {
    super(
      "rect",
      [
        ...["x", "y", "width", "height", "rx", "ry",],
        ...FillAndStrokeAttrs,
      ],
      attrs,
    );
  }
}

/** Polyline described by a `Points` object. */
export class PolyLine extends Element {
  /**
   * Ruby `initialize(attrs)`.
   *
   * @param attrs `points` (a `Points` instance) and paint attributes.
   * @throws TjArgumentError When a key is not accepted by polyline.
   */
  constructor(attrs: SVGValues,) {
    super("polyline", [...["points",], ...FillAndStrokeAttrs,], attrs,);
  }
}
