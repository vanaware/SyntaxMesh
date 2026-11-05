/**
 * 17.7.1 — `Color`: cor do Painter (`Painter/Color.rb`).
 *
 * Porta `TaskJuggler::Painter::Color`: um triple RGB 0-255 com nomes
 * conhecidos, conversão HSV e serialização `#rrggbb` para SVG/HTML.
 *
 * Divergências e particularidades (conferidas contra o oráculo Ruby em
 * 2026-11-04, `.tmp/painter_ruby_check.rb`):
 * - **Categoria A**: no Ruby `NamedColors` é indexado por Symbol, então
 *   `Color.new('red')` LEVANTA `RuntimeError: Unknown color name red` — só
 *   `Color.new(:red)` funciona. Em TS a tabela tem chaves string, que é o
 *   formato canônico do port (`new Color("red")`). Os nomes permanecem
 *   minúsculos e exatos (147 entradas, não as 155 estimadas no plano).
 * - **Categoria C**: `hsvToRgb` NÃO trunca o componente `v` na tabela final
 *   (`[[v, t, p], ...]`), apenas `p`, `q` e `t` passam por `.to_i`. Assim
 *   `new Color(40, 200, 240.5, "hsv").to_rgb()` devolve `[240.5, 177, 51]`.
 *   `to_s` continua truncando, como `format("%02x", 240.5)` → `f0`.
 * - **Categoria C**: o 4º argumento do construtor HSV é ignorado por `Color`
 *   (`ChartPlotter` chama `Color.new(h, s, v, :hsv)` — o `:hsv` é apenas um
 *   marcador do chamador). Não é validado de forma alguma.
 * - **Categoria C**: limites assimétricos — RGB aceita `v >= 0 && v < 256`
 *   (255.5 passa), já HSV exige `s <= 255` e `v <= 255`, e hue `h < 360`.
 * - Aridade inválida → `ArgumentError` sem mensagem (no Ruby `e.message` é o
 *   nome da classe). Reproduzido como `TjArgumentError("ArgumentError")`.
 * - `raise "Unknown color name …"` é `RuntimeError` puro no Ruby; aqui é
 *   `Error` simples, como nos demais `raise "string"` do port.
 * - Nota TS: os ramos numéricos verificam `typeof === "number"`; um valor
 *   não numérico levantaria `TypeError` no Ruby e aqui levanta
 *   `TjArgumentError` com a mesma mensagem de faixa.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Color.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.7.1)
 */

import { TjArgumentError, } from "../model/errors.ts";

/** Triple de números: RGB ou HSV, dependendo do método. */
export type ColorTriple = [number, number, number,];

/** Argumentos aceitos pelo construtor variádico (Ruby `initialize(*args)`). */
export type ColorArg = string | number;

/**
 * Cores nomeadas (`Color::NamedColors`). Mesma ordem do Ruby; as chaves são
 * strings porque não há tabela Symbol-keyed idiomática em TS (Categoria A).
 */
export const NamedColors: Record<string, ColorTriple> = {
  aliceblue: [240, 248, 255,],
  antiquewhite: [250, 235, 215,],
  aqua: [0, 255, 255,],
  aquamarine: [127, 255, 212,],
  azure: [240, 255, 255,],
  beige: [245, 245, 220,],
  bisque: [255, 228, 196,],
  black: [0, 0, 0,],
  blanchedalmond: [255, 235, 205,],
  blue: [0, 0, 255,],
  blueviolet: [138, 43, 226,],
  brown: [165, 42, 42,],
  burlywood: [222, 184, 135,],
  cadetblue: [95, 158, 160,],
  chartreuse: [127, 255, 0,],
  chocolate: [210, 105, 30,],
  coral: [255, 127, 80,],
  cornflowerblue: [100, 149, 237,],
  cornsilk: [255, 248, 220,],
  crimson: [220, 20, 60,],
  cyan: [0, 255, 255,],
  darkblue: [0, 0, 139,],
  darkcyan: [0, 139, 139,],
  darkgoldenrod: [184, 134, 11,],
  darkgray: [169, 169, 169,],
  darkgreen: [0, 100, 0,],
  darkgrey: [169, 169, 169,],
  darkkhaki: [189, 183, 107,],
  darkmagenta: [139, 0, 139,],
  darkolivegreen: [85, 107, 47,],
  darkorange: [255, 140, 0,],
  darkorchid: [153, 50, 204,],
  darkred: [139, 0, 0,],
  darksalmon: [233, 150, 122,],
  darkseagreen: [143, 188, 143,],
  darkslateblue: [72, 61, 139,],
  darkslategray: [47, 79, 79,],
  darkslategrey: [47, 79, 79,],
  darkturquoise: [0, 206, 209,],
  darkviolet: [148, 0, 211,],
  deeppink: [255, 20, 147,],
  deepskyblue: [0, 191, 255,],
  dimgray: [105, 105, 105,],
  dimgrey: [105, 105, 105,],
  dodgerblue: [30, 144, 255,],
  firebrick: [178, 34, 34,],
  floralwhite: [255, 250, 240,],
  forestgreen: [34, 139, 34,],
  fuchsia: [255, 0, 255,],
  gainsboro: [220, 220, 220,],
  ghostwhite: [248, 248, 255,],
  gold: [255, 215, 0,],
  goldenrod: [218, 165, 32,],
  gray: [128, 128, 128,],
  grey: [128, 128, 128,],
  green: [0, 128, 0,],
  greenyellow: [173, 255, 47,],
  honeydew: [240, 255, 240,],
  hotpink: [255, 105, 180,],
  indianred: [205, 92, 92,],
  indigo: [75, 0, 130,],
  ivory: [255, 255, 240,],
  khaki: [240, 230, 140,],
  lavender: [230, 230, 250,],
  lavenderblush: [255, 240, 245,],
  lawngreen: [124, 252, 0,],
  lemonchiffon: [255, 250, 205,],
  lightblue: [173, 216, 230,],
  lightcoral: [240, 128, 128,],
  lightcyan: [224, 255, 255,],
  lightgoldenrodyellow: [250, 250, 210,],
  lightgray: [211, 211, 211,],
  lightgreen: [144, 238, 144,],
  lightgrey: [211, 211, 211,],
  lightpink: [255, 182, 193,],
  lightsalmon: [255, 160, 122,],
  lightseagreen: [32, 178, 170,],
  lightskyblue: [135, 206, 250,],
  lightslategray: [119, 136, 153,],
  lightslategrey: [119, 136, 153,],
  lightsteelblue: [176, 196, 222,],
  lightyellow: [255, 255, 224,],
  lime: [0, 255, 0,],
  limegreen: [50, 205, 50,],
  linen: [250, 240, 230,],
  magenta: [255, 0, 255,],
  maroon: [128, 0, 0,],
  mediumaquamarine: [102, 205, 170,],
  mediumblue: [0, 0, 205,],
  mediumorchid: [186, 85, 211,],
  mediumpurple: [147, 112, 219,],
  mediumseagreen: [60, 179, 113,],
  mediumslateblue: [123, 104, 238,],
  mediumspringgreen: [0, 250, 154,],
  mediumturquoise: [72, 209, 204,],
  mediumvioletred: [199, 21, 133,],
  midnightblue: [25, 25, 112,],
  mintcream: [245, 255, 250,],
  mistyrose: [255, 228, 225,],
  moccasin: [255, 228, 181,],
  navajowhite: [255, 222, 173,],
  navy: [0, 0, 128,],
  oldlace: [253, 245, 230,],
  olive: [128, 128, 0,],
  olivedrab: [107, 142, 35,],
  orange: [255, 165, 0,],
  orangered: [255, 69, 0,],
  orchid: [218, 112, 214,],
  palegoldenrod: [238, 232, 170,],
  palegreen: [152, 251, 152,],
  paleturquoise: [175, 238, 238,],
  palevioletred: [219, 112, 147,],
  papayawhip: [255, 239, 213,],
  peachpuff: [255, 218, 185,],
  peru: [205, 133, 63,],
  pink: [255, 192, 203,],
  plum: [221, 160, 221,],
  powderblue: [176, 224, 230,],
  purple: [128, 0, 128,],
  red: [255, 0, 0,],
  rosybrown: [188, 143, 143,],
  royalblue: [65, 105, 225,],
  saddlebrown: [139, 69, 19,],
  salmon: [250, 128, 114,],
  sandybrown: [244, 164, 96,],
  seagreen: [46, 139, 87,],
  seashell: [255, 245, 238,],
  sienna: [160, 82, 45,],
  silver: [192, 192, 192,],
  skyblue: [135, 206, 235,],
  slateblue: [106, 90, 205,],
  slategray: [112, 128, 144,],
  slategrey: [112, 128, 144,],
  snow: [255, 250, 250,],
  springgreen: [0, 255, 127,],
  steelblue: [70, 130, 180,],
  tan: [210, 180, 140,],
  teal: [0, 128, 128,],
  thistle: [216, 191, 216,],
  tomato: [255, 99, 71,],
  turquoise: [64, 224, 208,],
  violet: [238, 130, 238,],
  wheat: [245, 222, 179,],
  white: [255, 255, 255,],
  whitesmoke: [245, 245, 245,],
  yellow: [255, 255, 0,],
  yellowgreen: [154, 205, 50,],
};

export class Color {
  /** Equivalente ao `Color::NamedColors` do Ruby, acessível como estático. */
  static readonly NamedColors = NamedColors;

  private readonly r: number;
  private readonly g: number;
  private readonly b: number;

  /**
   * Ruby `initialize(*args)`: 1 argumento = nome; 3 = RGB; 4 = HSV (o 4º
   * argumento é ignorado); qualquer outra aridade levanta `ArgumentError`.
   */
  constructor(...args: ColorArg[]) {
    let rgb: ColorTriple;
    if (args.length === 1) {
      const name = args[0];
      const named = typeof name === "string" &&
          Object.hasOwn(NamedColors, name,) ?
        NamedColors[name] :
        undefined;
      if (!named) {
        throw new Error(`Unknown color name ${name}`,);
      }
      rgb = named;
    } else if (args.length === 3) {
      for (const v of args) {
        if (typeof v !== "number" || !(v >= 0 && v < 256)) {
          throw new TjArgumentError(
            `RGB values (${args.join(", ",)}) must be between 0 and 255.`,
          );
        }
      }
      rgb = [args[0] as number, args[1] as number, args[2] as number,];
    } else if (args.length === 4) {
      const h = args[0];
      const s = args[1];
      const v = args[2];
      if (typeof h !== "number" || !(h >= 0 && h < 360)) {
        throw new TjArgumentError("Hue value must be between 0 and 360",);
      }
      if (typeof s !== "number" || !(s >= 0 && s <= 255)) {
        throw new TjArgumentError(
          `Saturation value (${s}) must be between 0 and 255`,
        );
      }
      if (typeof v !== "number" || !(v >= 0 && v <= 255)) {
        throw new TjArgumentError(
          `Color value (${v}) must be between 0 and 255`,
        );
      }
      rgb = this.hsvToRgb(h, s, v,);
    } else {
      throw new TjArgumentError("ArgumentError",);
    }
    [this.r, this.g, this.b,] = rgb;
  }

  /** Triple RGB `[r, g, b]` (valores preservados, inclusive fracionários). */
  to_rgb(): ColorTriple {
    return [this.r, this.g, this.b,];
  }

  /** Triple HSV `[h, s, v]` com `h` em graus e `s`/`v` em 0-255. */
  to_hsv(): ColorTriple {
    return this.rgbToHsv(this.r, this.g, this.b,);
  }

  /** Formato HTML/SVG `#rrggbb` (minúsculas, truncamento como `%02x`). */
  to_s(): string {
    return `#${hex(this.r,)}${hex(this.g,)}${hex(this.b,)}`;
  }

  /** Ruby `hsvToRgb` — `hi` pelo sextante e a tabela `[v, t, p] … [v, p, q]`. */
  private hsvToRgb(h: number, s: number, v: number,): ColorTriple {
    const hi = Math.floor(h / 60.0,) % 6;
    const f = h / 60.0 - Math.floor(h / 60.0,);
    const p = Math.trunc(v * (1.0 - s / 255.0),);
    const q = Math.trunc(v * (1.0 - (f * s / 255.0)),);
    const t = Math.trunc(v * (1.0 - ((1.0 - f) * s / 255.0)),);
    return [
      [v, t, p,],
      [q, v, p,],
      [p, v, t,],
      [p, q, v,],
      [t, p, v,],
      [v, p, q,],
    ][hi] as ColorTriple;
  }

  /** Ruby `rgbToHsv` — truncamento em `.to_i` (não arredondamento). */
  private rgbToHsv(r: number, g: number, b: number,): ColorTriple {
    const rgb = [r, g, b,];
    const max = Math.max(...rgb,);
    const min = Math.min(...rgb,);
    const chroma = max - min;
    const v = max;
    const s = max !== 0.0 ? chroma / max * 255.0 : 0.0;

    let h = 0.0;
    if (s !== 0.0) {
      if (r === max) {
        h = (g - b) / chroma;
      } else if (g === max) {
        h = 2.0 + (b - r) / chroma;
      } else {
        h = 4.0 + (r - g) / chroma;
      }
      h *= 60.0;
      if (h < 0.0) h += 360.0;
    }

    return [Math.trunc(h,), Math.trunc(s,), Math.trunc(v,),];
  }
}

/** Ruby `format("%02x", value)`: trunca em direção a zero e completa com `0`. */
function hex(value: number,): string {
  return Math.trunc(value,).toString(16,).padStart(2, "0",);
}
