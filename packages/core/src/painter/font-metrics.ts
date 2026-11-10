/**
 * 17.11.3 — `FontMetrics` (`Painter/FontMetrics.rb`).
 *
 * Ports `TaskJuggler::Painter::FontMetrics`: a map of font names →
 * `FontMetricsData`, with `height(font, ptSize)` and `width(font, ptSize, str)`
 * that scale the metrics (measured at the reference size of 24 pt) to the
 * requested size and convert points into screen pixels (factor `4/3`),
 * truncating.
 *
 * Only the runtime path is ported: in production `GeneratorMode = false`, and
 * the `if GeneratorMode` block (which requires `prawn` and writes `FontData.rb`)
 * is developer-only code, outside the browser (ADR 027 / 038).
 *
 * Oracle particularities (2026-11-04, `.tmp/fontmetrics_probe.rb`):
 * - `Arial`/`LiberationSans` and the italic/bold/bold-italic variants are
 *   **aliases** for the same 4 `FontData` objects (`Arial_eq_Lib == true`).
 * - `height('Arial', 12) == 17`, `height('Arial', 11) == 15` (truncation).
 * - `width('Arial', 12, 'Hello') == 36`, `'AW' == 25` (kerning `AW` -0.891),
 *   `'A' == 10`, `' ' == 4`; `width(..., '') == 0`.
 * - Unknown name → `ArgumentError: "Unknown font 'Times'!"`.
 * - **Ruby bug (Category B)**: the missing-glyph fallback is
 *   `cw || @font[font].averageWidth` — `@font` (no `s`) is `nil` and the line
 *   would raise `NoMethodError`. We implement the **intent** (`@fonts[font]
 *   .averageWidth()`, which is 0), so a glyph outside the set contributes 0
 *   instead of crashing. Harmless for ASCII text (all of 32–126 exist).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/FontMetrics.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.11.3)
 */

import { TjArgumentError, } from "../model/errors.ts";
import {
  Font_LiberationSans_bold,
  Font_LiberationSans_bold_italic,
  Font_LiberationSans_italic,
  Font_LiberationSans_normal,
} from "./font-data.ts";
import { type FontMetricsData, } from "./font-metrics-data.ts";

/** Font registry that measures text in the screen pixel unit used by SVG. */
export class FontMetrics {
  private readonly fonts: Record<string, FontMetricsData>;

  /**
   * Ruby `initialize` — registers LiberationSans under the Arial/Liberation
   * names.
   */
  constructor() {
    this.fonts = {
      "Arial": Font_LiberationSans_normal,
      "LiberationSans": Font_LiberationSans_normal,
      "Arial-Italic": Font_LiberationSans_italic,
      "LiberationSans-Italic": Font_LiberationSans_italic,
      "Arial-Bold": Font_LiberationSans_bold,
      "LiberationSans-Bold": Font_LiberationSans_bold,
      "Arial-BoldItalic": Font_LiberationSans_bold_italic,
      "LiberationSans-BoldItalic": Font_LiberationSans_bold_italic,
    };
  }

  /**
   * Ruby `height(font, ptSize)` — height in screen pixels (truncated).
   *
   * @param font Font name as registered in the constructor.
   * @param ptSize Requested size, in points.
   * @returns The line height in screen pixels.
   * @throws TjArgumentError When the font name is unknown.
   */
  height(font: string, ptSize: number,): number {
    this.checkFontName(font,);
    const data = this.fonts[font]!;
    return Math.trunc(
      data.height * (ptSize / data.ptSize) * (4.0 / 3.0),
    );
  }

  /**
   * Ruby `width(font, ptSize, str)` — width in screen pixels (truncated).
   *
   * @param font Font name as registered in the constructor.
   * @param ptSize Requested size, in points.
   * @param str Text whose width is measured.
   * @returns The advance width in screen pixels.
   * @throws TjArgumentError When the font name is unknown.
   */
  width(font: string, ptSize: number, str: string,): number {
    this.checkFontName(font,);
    const data = this.fonts[font]!;
    let w = 0;
    let lastC: string | null = null;
    for (const c of str) {
      const cw = data.glyphWidth(c,);
      w += cw ?? data.averageWidth();
      if (lastC !== null) {
        const delta = data.kerningDelta[lastC + c];
        if (delta !== undefined) w += delta;
      }
      lastC = c;
    }
    return Math.trunc(w * (ptSize / data.ptSize) * (4.0 / 3.0),);
  }

  /**
   * Ruby `checkFontName(font)` — `ArgumentError` for an unknown font.
   *
   * @param font Font name to validate.
   * @throws TjArgumentError When the font is not registered.
   */
  private checkFontName(font: string,): void {
    if (!Object.hasOwn(this.fonts, font,)) {
      throw new TjArgumentError(`Unknown font '${font}'!`,);
    }
  }
}
