/**
 * 17.11.3 — `FontMetrics` (`Painter/FontMetrics.rb`).
 *
 * Porta `TaskJuggler::Painter::FontMetrics`: mapa de nomes de fonte →
 * `FontMetricsData`, com `height(font, ptSize)` e `width(font, ptSize, str)`
 * que escalonam as métricas (medidas em pt de referência 24) para o tamanho
 * pedido e convertem pontos em pixels de tela (fator `4/3`), truncando.
 *
 * Só o caminho de runtime é portado: em produção `GeneratorMode = false`, o
 * bloco `if GeneratorMode` (que exige `prawn` e escreve `FontData.rb`) é código
 * de desenvolvedor, fora do navegador (ADR 027 / 038).
 *
 * Particularidades do oráculo (2026-11-04, `.tmp/fontmetrics_probe.rb`):
 * - `Arial`/`LiberationSans` e variantes itálico/negrito/negrito-itálico são
 *   **aliases** para os mesmos 4 objetos `FontData` (`Arial_eq_Lib == true`).
 * - `height('Arial', 12) == 17`, `height('Arial', 11) == 15` (truncamento).
 * - `width('Arial', 12, 'Hello') == 36`, `'AW' == 25` (kerning `AW` -0.891),
 *   `'A' == 10`, `' ' == 4`; `width(..., '') == 0`.
 * - Nome desconhecido → `ArgumentError: "Unknown font 'Times'!"`.
 * - **Bug Ruby (Categoria B)**: o fallback de glifo ausente é
 *   `cw || @font[font].averageWidth` — `@font` (sem `s`) é `nil` e a linha
 *   levantaria `NoMethodError`. Implementamos a **intenção** (`@fonts[font]
 *   .averageWidth()`, que é 0), então um glifo fora do set contribui 0 em vez
 *   de quebrar. Inofensivo para texto ASCII (todas as 32–126 existem).
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

export class FontMetrics {
  private readonly fonts: Record<string, FontMetricsData>;

  /** Ruby `initialize` — registra LiberationSans sob os nomes Arial/Liberation. */
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

  /** Ruby `height(font, ptSize)` — altura em pixels de tela (truncada). */
  height(font: string, ptSize: number,): number {
    this.checkFontName(font,);
    const data = this.fonts[font]!;
    return Math.trunc(
      data.height * (ptSize / data.ptSize) * (4.0 / 3.0),
    );
  }

  /** Ruby `width(font, ptSize, str)` — largura em pixels de tela (truncada). */
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

  /** Ruby `checkFontName(font)` — `ArgumentError` para fonte desconhecida. */
  private checkFontName(font: string,): void {
    if (!Object.hasOwn(this.fonts, font,)) {
      throw new TjArgumentError(`Unknown font '${font}'!`,);
    }
  }
}
