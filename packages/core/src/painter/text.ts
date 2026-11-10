/**
 * 17.9.2 — `Text`: text element of the Painter (`Painter/Text.rb`).
 *
 * Ports `TaskJuggler::Painter::Text`: an `Element` with tag `text`, the `x`/`y`
 * coordinates plus the text attributes (`TextAttrs`); the content is stored in
 * `@text` and comes out between the tags.
 *
 * Definition of `TextAttrs` (Ruby `Primitives::TextAttrs`):
 * `FillAndStrokeAttrs + [:font_family, :font_size]`. It lives here — and not in
 * `primitives.ts` — to keep the module graph acyclic: `Primitives` imports
 * `Text`, so `Text` cannot import `Primitives`. The content and the order are
 * the Ruby ones.
 *
 * Outputs checked against the oracle (2026-11-04,
 * `.tmp/shapes_ruby_check.rb`):
 * - `Text.new('hi', {x: 1, y: 2}).to_svg.to_s` == `<text x="1" y="2">hi</text>`.
 * - `font_family`/`font_size` accepted: `<text font-family="Arial"
 *   font-size="10pt" x="1" y="2">hi</text>`.
 * - Empty string and `nil` both produce `<text x="1" y="2"></text>`: in Ruby `''`
 *   is truthy and enters as `XMLText.new('')` (serializes empty), while `nil` is
 *   left out. The textual result is identical — the port uses `text !== null`,
 *   as in `Element`.
 * - Unlisted key → `ArgumentError: Unsupported attribute z` (inherited from the
 *   `Element` constructor).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Text.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.9.2)
 */

import { FillAndStrokeAttrs, } from "./basic-shapes.ts";
import { Element, } from "./element.ts";
import { type SVGValues, } from "./svg-support.ts";

/** Text attributes (Ruby `Primitives::TextAttrs`), in the Ruby order. */
export const TextAttrs: readonly string[] = [
  ...FillAndStrokeAttrs,
  "font_family",
  "font_size",
];

/** `<text>` element carrying a string between its tags. */
export class Text extends Element {
  /**
   * Ruby `initialize(str, attrs)` — `str` is the textual content.
   *
   * @param str Text drawn inside the element.
   * @param attrs Position and text attributes (`x`, `y`, font, colours).
   * @throws TjArgumentError When a key is not a text attribute.
   */
  constructor(str: string, attrs: SVGValues,) {
    super("text", [...["x", "y",], ...TextAttrs,], attrs,);
    this.text = str;
  }
}
