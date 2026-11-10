/**
 * 17.8.6 — `Group`: groups elements under common attributes
 * (`Painter/Group.rb`).
 *
 * Ports `TaskJuggler::Painter::Group`: it validates the keys against the fixed
 * list of inheritable attributes, accumulates the elements produced by the
 * primitives (`Primitives`, 17.9) and serializes as `<g>`.
 *
 * Notes from the Ruby oracle (2026-11-04, `.tmp/element_ruby_check.rb`):
 * - The error message differs from the `Element` one: it carries the suggested
 *   list — `"Unsupported attribute bogus. Use one of fill, font_family,
 *   font_size, stroke, stroke_width."` (Ruby symbols become text without `:`).
 * - `@values = values`: the Group **aliases** the received hash (it does not
 *   copy, unlike `Element`). Mutating the object after construction changes the
 *   SVG — replicated in the port, which keeps the same reference.
 * - `to_svg` with one child: `"<g fill=\"red\"><foo a=\"1\"></foo></g>"` — no
 *   line break (17.1 rule: `\n` only with 2+ non-`XMLText` children).
 * - **Divergence (Category A)**: Ruby accepts an arity-0 block via
 *   `instance_eval` (with `method_missing` delegated to the original `self`) and
 *   an arity-1 block via `yield self`. TS has no `instance_eval`, so the block
 *   always receives the group as a parameter (`(g) => { g.line(…) }`), which is
 *   the path the port's `Painter` already uses.
 *
 * Integration with `Primitives` (17.9): in Ruby `Group` includes `Primitives`,
 * hence `Group extends Primitives` here. The `elements` field (which feeds
 * `to_svg`) and the shapes (`line`, `rect`, `group`, …) come from the base;
 * `newGroup` is the hook returning a `Group` while keeping `primitives.ts` free
 * of a value dependency on `group.ts`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Group.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.8)
 */

import { TjArgumentError, } from "../model/errors.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import { Primitives, } from "./primitives.ts";
import { type SVGValues, valuesToSVG, } from "./svg-support.ts";

/** Ruby block (`&block`): receives the group being built. */
export type GroupBlock = (group: Group,) => void;

/** Attributes a `<g>` can inherit (Ruby `@attributes`, in order). */
export const GROUP_ATTRS: readonly string[] = [
  "fill",
  "font_family",
  "font_size",
  "stroke",
  "stroke_width",
];

/** A `<g>` element grouping drawables under common attributes. */
export class Group extends Primitives {
  /** Keys accepted in a group (`@attributes`). */
  protected readonly attributes: readonly string[] = GROUP_ATTRS;
  /** Group attributes — aliased from the argument, as in Ruby. */
  protected values: SVGValues;

  /**
   * Ruby `initialize(values, &block)`.
   *
   * @param values Attributes of the group; stored by reference.
   * @param block Callback that populates the group.
   * @throws TjArgumentError When a key is not an inheritable attribute.
   */
  constructor(values: SVGValues, block?: GroupBlock,) {
    super();
    for (const key of Object.keys(values,)) {
      if (!this.attributes.includes(key,)) {
        throw new TjArgumentError(
          `Unsupported attribute ${key}. Use one of ` +
            `${this.attributes.join(", ",)}.`,
        );
      }
    }

    this.values = values;

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
   * `<g …>children</g>` — Ruby `XMLElement.new('g', valuesToSVG) { … }`.
   *
   * @returns The SVG group element with all collected children.
   */
  to_svg(): XMLElement {
    return new XMLElement(
      "g",
      valuesToSVG(this.values,),
      false,
      () => this.elements.map((element,) => element.to_svg()),
    );
  }
}
