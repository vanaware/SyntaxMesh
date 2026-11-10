/**
 * 17.7.3 — `SVGSupport`: conversion of the attributes to SVG
 * (`Painter/SVGSupport.rb`).
 *
 * In Ruby it is a `module` mixed into `Element` and `Group`, which reads
 * `@values` and returns a hash ready for `XMLElement.new(type, values)`. Since
 * both consumers carry the `values` field, the port exposes a free function
 * (`valuesToSVG(values)`) called by both.
 *
 * Rules of the Ruby oracle (2026-11-04):
 * - Underscores become dashes: `stroke_width` → `stroke-width`.
 * - Only `font_size` gets the `pt` unit (the comparison uses the original key,
 *   before the `gsub`). `font-size` in other shapes does not exist.
 * - Values go through `v.to_s`, so `Color` (which responds `to_s`) comes out as
 *   `#rrggbb` and `2.5` as `"2.5"`.
 * - Key order is the insertion order of the source hash — there is no sorting.
 * - TS note: Ruby distinguishes `Integer` from `Float` (`1` vs `1.0`); here both
 *   are `number` and serialize as `String(1)` = `"1"`. Recorded in the 17.16
 *   goldens when a real case shows up.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/SVGSupport.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.7.3)
 */

/** Value of a Painter attribute: number, string or object with `to_s()`. */
export type SVGValue = string | number | { to_s(): string };

/** Painter attribute map (keys in `snake_case`, as in Ruby). */
export type SVGValues = Record<string, SVGValue>;

/** Converts the attributes to the SVG syntax (Ruby `SVGSupport#valuesToSVG`). */
export function valuesToSVG(values: SVGValues,): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [key, value,] of Object.entries(values,)) {
    const unit = key === "font_size" ? "pt" : "";
    out[key.replace(/_/g, "-",)] = svgString(value,) + unit;
  }
  return out;
}

/** Ruby `v.to_s` for the values accepted by Painter. */
function svgString(value: SVGValue,): string {
  return typeof value === "object" ? value.to_s() : String(value,);
}
