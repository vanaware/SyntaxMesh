/**
 * 17.11.1 — `FontMetricsData` (`Painter/FontMetricsData.rb`).
 *
 * Porta `TaskJuggler::Painter::FontMetricsData`: guarda as métricas pré-
 * calculadas de uma fonte (largura por glifo + deltas de kerning) e as
 * expõe. O conjunto de glifos é US-ASCII (índices 32–126).
 *
 * **Modo de operação do port**: no Ruby o construtor tem dois modos — ou recebe
 * todos os dados (usado em runtime, via `FontData.rb`), ou só o nome da fonte e
 * usa a gem `prawn` para **gerar** as métricas (`generateMetrics`, `GeneratorMode
 * = false` em produção). O navegador não tem `prawn` nem filesystem (ADR 027 /
 * 038), então o port só implementa o **modo de dados**; `generateMetrics` não é
 * portado. `toRuby()` permanece (é só texto, usado por um gerador offline).
 *
 * Particularidades do oráculo (2026-11-04, `.tmp/fontmetrics_probe.rb`):
 * - `averageWidth` devolve **0** quando o objeto é montado a partir de dados
 *   (o Ruby só preenche `@averageWidth` em `generateMetrics`; no construtor é
 *   inicializado com `0.0`). `(0.0 * 3/4).to_i == 0`. É o valor real usado por
 *   `FontMetrics#width` como fallback de glifo ausente.
 * - `glyphWidth(c)` devolve `nil` (aqui `null`) para caractere fora do set.
 * - `charWidth` tem **95** entradas (32–126) e `kerningDelta` ~96 no normal.
 * - `MIN_GLYPH_INDEX = 32`, `MAX_GLYPH_INDEX = 126`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/FontMetricsData.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.11.1)
 */

/** Índice do primeiro glifo (espaço) suportado. */
export const MIN_GLYPH_INDEX = 32;
/** Índice do último glifo (`~`) suportado. */
export const MAX_GLYPH_INDEX = 126;

/** Estilos de fonte (símbolos `:normal`… do Ruby viram strings). */
export type FontType = "normal" | "italic" | "bold" | "bold_italic";

/** Largura por glifo e delta por par de glifos (chaves do Ruby). */
export type GlyphWidths = Record<string, number>;
export type KerningDeltas = Record<string, number>;

export class FontMetricsData {
  readonly fontName: string;
  readonly type: FontType;
  readonly ptSize: number;
  readonly height: number;
  readonly charWidth: GlyphWidths;
  readonly kerningDelta: KerningDeltas;

  /**
   * Ruby `@averageWidth`: preenchido só por `generateMetrics`. No modo de
   * dados fica `0.0` — replicado como campo privado sem setter.
   */
  private readonly averageWidthRaw = 0.0;

  /**
   * Ruby `initialize(fontName, type, ptSize, height, wData, kData)` — modo de
   * dados (o único suportado no navegador).
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

  /** Ruby `glyphWidth(c)` — `null` quando o glifo não existe no set. */
  glyphWidth(c: string,): number | null {
    const w = this.charWidth[c];
    return w === undefined ? null : w;
  }

  /** Ruby `averageWidth` — `(raw * 3/4).to_i`; sempre 0 no modo de dados. */
  averageWidth(): number {
    return Math.trunc(this.averageWidthRaw * (3.0 / 4.0),);
  }

  /**
   * Ruby `to_ruby`: emite a fonte Ruby que (re)cria este objeto. Usado só por
   * um gerador offline (com `prawn`); no port é texto morto em runtime, mas é
   * implementado para fidelidade e cobertura de teste.
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

  /** Formata um hash de entradas em 4 por linha, como o Ruby. */
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

  /** Ruby `escapedChars`: backslash e aspas simples escapados p/ `'…'`. */
  private escapeRubyChars(c: string,): string {
    return c.replace(/\\/g, "\\\\",).replace(/'/g, "\\'",);
  }
}
