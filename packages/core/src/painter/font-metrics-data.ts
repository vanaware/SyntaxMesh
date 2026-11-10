/**
 * 17.11.1 — `FontMetricsData` (`Painter/FontMetricsData.rb`).
 *
 * Ports `TaskJuggler::Painter::FontMetricsData`: holds the pre-computed metrics
 * of a font (per-glyph width plus kerning deltas) and exposes them. The glyph
 * set is US-ASCII (indices 32–126).
 *
 * **Port operation mode**: in Ruby the constructor has two modes — either it
 * receives all the data (used at runtime, through `FontData.rb`), or it gets
 * only the font name and uses the `prawn` gem to **generate** the metrics
 * (`generateMetrics`, `GeneratorMode = false` in production). The browser has
 * neither `prawn` nor a filesystem (ADR 027 / 038), so the port implements only
 * the **data mode**; `generateMetrics` is not ported. `toRuby()` remains (it is
 * plain text, used by an offline generator).
 *
 * Oracle particularities (2026-11-04, `.tmp/fontmetrics_probe.rb`):
 * - `averageWidth` returns **0** when the object is built from data (Ruby only
 *   fills `@averageWidth` in `generateMetrics`; in the constructor it is
 *   initialized with `0.0`). `(0.0 * 3/4).to_i == 0`. This is the real value
 *   used by `FontMetrics#width` as the fallback for a missing glyph.
 * - `glyphWidth(c)` returns `nil` (here `null`) for a character outside the
 *   set.
 * - `charWidth` has **95** entries (32–126) and `kerningDelta` about 96 in the
 *   normal case.
 * - `MIN_GLYPH_INDEX = 32`, `MAX_GLYPH_INDEX = 126`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/FontMetricsData.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.11.1)
 */

/** Index of the first supported glyph (space). */
export const MIN_GLYPH_INDEX = 32;
/** Index of the last supported glyph (`~`). */
export const MAX_GLYPH_INDEX = 126;

/** Font styles (Ruby `:normal`… symbols become strings). */
export type FontType = "normal" | "italic" | "bold" | "bold_italic";

/** Width of each glyph, keyed by the character (Ruby hash keys). */
export type GlyphWidths = Record<string, number>;
/** Kerning delta of each glyph pair, keyed as in Ruby. */
export type KerningDeltas = Record<string, number>;

/** Pre-computed metrics of a font: glyph widths and kerning deltas. */
export class FontMetricsData {
  /** Name of the font, as reported to the SVG consumer. */
  readonly fontName: string;
  /** Style of the font (normal, italic, bold or bold italic). */
  readonly type: FontType;
  /** Size of the font, in points. */
  readonly ptSize: number;
  /** Height of the font line, in points. */
  readonly height: number;
  /** Width of each glyph, keyed by character. */
  readonly charWidth: GlyphWidths;
  /** Kerning delta of each glyph pair. */
  readonly kerningDelta: KerningDeltas;

  /**
   * Ruby `@averageWidth`: filled only by `generateMetrics`. In data mode it
   * stays `0.0` — replicated as a private field without a setter.
   */
  private readonly averageWidthRaw = 0.0;

  /**
   * Ruby `initialize(fontName, type, ptSize, height, wData, kData)` — data
   * mode (the only one supported in the browser).
   *
   * @param fontName Name of the font.
   * @param type Style of the font.
   * @param ptSize Size of the font, in points.
   * @param height Height of the font line, in points.
   * @param charWidth Width of each glyph, keyed by character.
   * @param kerningDelta Kerning delta of each glyph pair.
   */
  constructor(
    fontName: string,
    type: FontType,
    ptSize: number,
    height: number,
    charWidth: GlyphWidths,
    kerningDelta: KerningDeltas,
  ) {
    this.fontName = fontName;
    this.type = type;
    this.ptSize = ptSize;
    this.height = height;
    this.charWidth = charWidth;
    this.kerningDelta = kerningDelta;
  }

  /**
   * Ruby `glyphWidth(c)` — `null` when the glyph is not in the set.
   *
   * @param c Character whose width is requested.
   * @returns The glyph width, or `null` for an unsupported character.
   */
  glyphWidth(c: string,): number | null {
    const w = this.charWidth[c];
    return w === undefined ? null : w;
  }

  /**
   * Ruby `averageWidth` — `(raw * 3/4).to_i`; always 0 in data mode.
   *
   * @returns The average glyph width, in the same unit as `points`.
   */
  averageWidth(): number {
    return Math.trunc(this.averageWidthRaw * (3.0 / 4.0),);
  }

  /**
   * Ruby `to_ruby`: emits the Ruby source that (re)creates this object. Used
   * only by an offline generator (with `prawn`); in the port it is dead text at
   * runtime, but it is implemented for fidelity and test coverage.
   *
   * @returns The Ruby snippet that rebuilds these metrics.
   */
  toRuby(): string {
    const indent = " ".repeat(6,);
    const varName = `Font_${this.fontName.replace(/-/g, "_",)}_${this.type}`;
    let s = `${indent}${varName} = ` +
      `Painter::FontMetricsData.new('${this.fontName}', :${this.type}, ` +
      `${this.ptSize}, ${this.height.toFixed(3,)},\n`;
    s += `${indent}  @charWidth = {`;
    s += this.entries(Object.entries(this.charWidth,), indent, true,);
    s += `\n${indent}  },\n`;
    s += `${indent}  @kerningDelta = {`;
    s += this.entries(Object.entries(this.kerningDelta,), indent, false,);
    s += `\n${indent}  }\n${indent})\n`;
    return s;
  }

  /**
   * Formats a hash of entries four per line, as Ruby does.
   *
   * @param pairs Key/value pairs to format.
   * @param indent Indentation of the enclosing block.
   * @param escape Whether the keys must be escaped for a single-quoted string.
   * @returns The formatted entries, starting with a newline.
   */
  private entries(
    pairs: [string, number,][],
    indent: string,
    escape: boolean,
  ): string {
    let s = "";
    pairs.forEach(([key, value,], i,) => {
      s += i % 4 === 0 ? `\n${indent}    ` : " ";
      const k = escape ? this.escapeRubyChars(key,) : key;
      s += `'${k}' => ${value.toFixed(3,)},`;
    },);
    return s;
  }

  /**
   * Ruby `escapedChars`: escapes backslashes and single quotes for `'…'`.
   *
   * @param c Text to escape.
   * @returns The escaped text.
   */
  private escapeRubyChars(c: string,): string {
    return c.replace(/\\/g, "\\\\",).replace(/'/g, "\\'",);
  }
}
