/**
 * 17.8.1 — `Element`: base of every drawable element (`Painter/Element.rb`).
 *
 * Ports `TaskJuggler::Painter::Element`: it holds the tag type, the list of
 * accepted attributes, the given values and an optional text; `to_svg()`
 * produces the `XMLElement` tree already in SVG syntax.
 *
 * Notes from the Ruby oracle (2026-11-04, `.tmp/element_ruby_check.rb`):
 * - `Element.new('foo', [:a, :b], {a: 1, b: 2}).to_svg.to_s` ==
 *   `"<foo a=\"1\" b=\"2\"></foo>"` — Ruby does **not** collapse the tag into
 *   `<foo/>` (`selfClosing` stays `false`), and the attributes come out
 *   **sorted** (17.1 rule), not in the order of the source hash.
 * - Unknown attribute → `ArgumentError: Unsupported attribute c`.
 * - `@text = ''` **is** truthy in Ruby (`if @text`), so `XMLText.new('')` is
 *   appended as a child and serializes empty: `<foo></foo>`. The port uses
 *   `text !== null`, not `if (text)`, to preserve that.
 * - **Divergence from the plan**: the plan asks for `abstract class Element`,
 *   but Ruby instantiates `Element` directly (there is no
 *   `private_class_method new`) and the tests of this phase use bare instances.
 *   It stays a concrete class.
 * - `values` is typed as `SVGValues` (not `Record<string, unknown>`): the Painter
 *   values are always a number, a string or an object with `to_s()`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Element.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.8)
 */

import { TjArgumentError, } from "../model/errors.ts";
import { XMLElement, XMLText, } from "../xml/xml-element.ts";
import { type SVGValues, valuesToSVG, } from "./svg-support.ts";

/**
 * Contract of everything the Painter knows how to nest: `Element` and `Group`
 * (in Ruby the `@elements` list is dynamic — a `Group` accepts another `Group`
 * inside).
 */
export interface Drawable {
  /**
   * Converts the drawable into an SVG element tree.
   *
   * @returns The element in SVG syntax.
   */
  to_svg(): XMLElement;
}

/** Base drawable element of the SVG painter. */
export class Element {
  /** Name of the SVG tag (Ruby `@type`): `line`, `rect`, `text`, … */
  protected type: string;
  /** Keys accepted by this element (`@attributes`). */
  protected attributes: string[];
  /** Attributes actually supplied (`@values`). */
  protected values: SVGValues;
  /** Element text (`@text`); `null` means no text (Ruby `nil`). */
  protected text: string | null;

  /**
   * Ruby `initialize(type, attrs, values)` — every key of `values` must be in
   * `attrs`, otherwise the element raises `ArgumentError`.
   *
   * @param type Name of the SVG tag.
   * @param attrs Attribute names the element accepts.
   * @param values Attribute values to set.
   * @throws TjArgumentError When a value key is not an accepted attribute.
   */
  constructor(type: string, attrs: string[], values: SVGValues,) {
    this.type = type;
    this.attributes = attrs;
    this.values = {};
    this.text = null;

    for (const [key, value,] of Object.entries(values,)) {
      if (!this.attributes.includes(key,)) {
        throw new TjArgumentError(`Unsupported attribute ${key}`,);
      }
      this.values[key] = value;
    }
  }

  /**
   * Converts the element into an `XMLElement` in SVG syntax.
   *
   * @returns The SVG element, with its text child when there is one.
   */
  to_svg(): XMLElement {
    const el = new XMLElement(this.type, valuesToSVG(this.values,),);
    // Ruby `if @text`: '' is truthy, only nil is left out.
    if (this.text !== null && this.text !== undefined) {
      el.append(new XMLText(this.text,),);
    }
    return el;
  }
}
