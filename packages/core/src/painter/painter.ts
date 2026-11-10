/**
 * 17.10 — `Painter`: the SVG canvas (`Painter.rb`).
 *
 * Ports `TaskJuggler::Painter`: a `width × height` rectangle that accumulates
 * elements (through `Primitives`) and serializes the root
 * `<svg width="…px" height="…px">…</svg>`.
 *
 * Port structure: `Painter extends Primitives` (in Ruby it is `include
 * Primitives`) and implements `newGroup` by returning a `Group`. The shapes
 * (`rect`, `line`, `text`, `group`, …) already come from the base and push into
 * the same `@elements`.
 *
 * Outputs checked against the oracle (2026-11-04,
 * `.tmp/painter_ruby_check.rb`):
 * - `Painter.new(100, 50).to_svg.to_s` == `<svg height="50px" width="100px"></svg>`
 *   — `height` comes **before** `width` (XMLElement sorts the keys, 17.1 rule).
 * - 1 child: `<svg …><line …></line></svg>` (no break).
 * - 2 children: `\n` + a one-space indent before each child (17.1 rule).
 * - `group` and a nested `group` serialize `<g>` inside the `<svg>`.
 * - **Divergence (Category B/C, documented)**: Ruby does `"#{@width}px"`; for
 *   whole Floats (`50.0`) that gives `"50.0px"`, while `String(50.0)` in TS is
 *   `"50"`. `100.5` → `"100.5px"` in both. Only the whole-Float case differs;
 *   the `ChartPlotter` passes `Integer`, so it never shows up in the real
 *   goldens.
 * - **Divergence (Category A)**: as in `Group`, `instance_eval` (an arity-0
 *   block) does not exist in TS; the block always receives the `Painter`
 *   (`yield self`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.10)
 */

import { XMLElement, } from "../xml/xml-element.ts";
import { Group, type GroupBlock, } from "./group.ts";
import { Primitives, } from "./primitives.ts";
import { type SVGValues, } from "./svg-support.ts";

/** Constructor block (Ruby `&block`): receives the `Painter` being built. */
export type PainterBlock = (painter: Painter,) => void;

/** SVG canvas that collects drawables and renders the `<svg>` root. */
export class Painter extends Primitives {
  private readonly width: number;
  private readonly height: number;

  /**
   * Ruby `initialize(width, height, &block)`.
   *
   * @param width Width of the canvas, in pixels.
   * @param height Height of the canvas, in pixels.
   * @param block Callback that populates the canvas.
   */
  constructor(width: number, height: number, block?: PainterBlock,) {
    super();
    this.width = width;
    this.height = height;
    block?.(this,);
  }

  /**
   * Hook of `Primitives#group`: a child group is a new `Group`.
   *
   * @param attrs Attributes of the child group.
   * @param block Callback that populates the child group.
   * @returns The new child group.
   */
  protected newGroup(attrs: SVGValues, block?: GroupBlock,): Group {
    return new Group(attrs, block,);
  }

  /**
   * Root `<svg width="…px" height="…px">` holding every element.
   *
   * @returns The SVG root element.
   */
  to_svg(): XMLElement {
    return new XMLElement(
      "svg",
      { height: `${this.height}px`, width: `${this.width}px`, },
      false,
      () => this.elements.map((element,) => element.to_svg()),
    );
  }
}
