/**
 * 17.7.1 — `Color`: colour of the Painter (`Painter/Color.rb`).
 *
 * Ports `TaskJuggler::Painter::Color`: an RGB triple in 0-255 with known
 * names, HSV conversion and `#rrggbb` serialization for SVG/HTML.
 *
 * Divergences and particularities (checked against the Ruby oracle on
 * 2026-11-04, `.tmp/painter_ruby_check.rb`):
 * - **Category A**: in Ruby `NamedColors` is keyed by Symbol, so
 *   `Color.new('red')` RAISES `RuntimeError: Unknown color name red` — only
 *   `Color.new(:red)` works. In TS the table has string keys, which is the
 *   canonical format of the port (`new Color("red")`). The names stay
 *   lowercase and exact (147 entries, not the 155 guessed in the plan).
 * - **Category C**: `hsvToRgb` does NOT truncate the `v` component in the
 *   final table (`[[v, t, p], ...]`); only `p`, `q` and `t` go through
 *   `.to_i`. Hence `new Color(40, 200, 240.5, "hsv").to_rgb()` returns
 *   `[240.5, 177, 51]`. `to_s` still truncates, like
 *   `format("%02x", 240.5)` → `f0`.
 * - **Category C**: the 4th argument of the HSV constructor is ignored by
 *   `Color` (`ChartPlotter` calls `Color.new(h, s, v, :hsv)` — the `:hsv` is
 *   just a marker for the caller). It is not validated in any way.
 * - **Category C**: asymmetric limits — RGB accepts `v >= 0 && v < 256`
 *   (255.5 passes), while HSV requires `s <= 255` and `v <= 255`, and hue
 *   `h < 360`.
 * - Invalid arity → `ArgumentError` with no message (in Ruby `e.message` is
 *   the class name). Reproduced as `TjArgumentError("ArgumentError")`.
 * - `raise "Unknown color name …"` is a plain `RuntimeError` in Ruby; here it
 *   is a plain `Error`, like the other `raise "string"` calls of the port.
 * - TS note: the numeric branches check `typeof === "number"`; a non-numeric
 *   value would raise `TypeError` in Ruby and raises `TjArgumentError` here
 *   with the same range message.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Color.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.7.1)
 */

import { TjArgumentError, } from "../model/errors.ts";

/** Triple of numbers: RGB or HSV, depending on the method. */
export type ColorTriple = [number, number, number,];

/** Arguments accepted by the variadic constructor (Ruby `initialize(*args)`). */
export type ColorArg = string | number;

/**
 * Named colours (`Color::NamedColors`). Same order as Ruby; the keys are
 * strings because there is no idiomatic Symbol-keyed table in TS
 * (Category A).
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

/** Immutable RGB colour with named lookup and HSV conversion. */
export class Color {
  /** Equivalent of Ruby's `Color::NamedColors`, exposed as a static. */
  static readonly NamedColors: Record<string, ColorTriple> = NamedColors;

  private readonly r: number;
  private readonly g: number;
  private readonly b: number;

  /**
   * Ruby `initialize(*args)`: 1 argument = name; 3 = RGB; 4 = HSV (the 4th
   * argument is ignored); any other arity raises `ArgumentError`.
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

  /**
   * RGB triple `[r, g, b]` (values preserved, including fractional ones).
   *
   * @returns The red, green and blue channels.
   */
  to_rgb(): ColorTriple {
    return [this.r, this.g, this.b,];
  }

  /**
   * HSV triple `[h, s, v]` with `h` in degrees and `s`/`v` in 0-255.
   *
   * @returns The hue, saturation and value channels.
   */
  to_hsv(): ColorTriple {
    return this.rgbToHsv(this.r, this.g, this.b,);
  }

  /**
   * HTML/SVG format `#rrggbb` (lowercase, truncating like `%02x`).
   *
   * @returns The colour as a CSS hex string.
   */
  to_s(): string {
    return `#${hex(this.r,)}${hex(this.g,)}${hex(this.b,)}`;
  }

  /**
   * Ruby `hsvToRgb` — `hi` by sextant and the table `[v, t, p] … [v, p, q]`.
   *
   * @param h Hue, in degrees.
   * @param s Saturation, in 0-255.
   * @param v Value, in 0-255.
   * @returns The equivalent RGB triple.
   */
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

  /**
   * Ruby `rgbToHsv` — truncation through `.to_i` (not rounding).
   *
   * @param r Red channel, in 0-255.
   * @param g Green channel, in 0-255.
   * @param b Blue channel, in 0-255.
   * @returns The equivalent HSV triple.
   */
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

/** Ruby `format("%02x", value)`: truncates toward zero and pads with `0`. */
function hex(value: number,): string {
  return Math.trunc(value,).toString(16,).padStart(2, "0",);
}
