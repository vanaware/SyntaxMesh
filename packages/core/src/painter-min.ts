/**
 * PainterMin (Fase 14.22.1) — pincel SVG mínimo para `ChartPlotter`.
 *
 * Porta do subconjunto de `Painter/*.rb` que o `ChartPlotter` consome:
 * `group`, `line`, `rect`, `text`, `circle`, `polyline`, `color` e `to_svg()`.
 * O `Painter` completo (com `FontMetrics` reais, elipses, cores nomeadas
 * exaustivas e `instance_eval`) é **Fase 17**; aqui usamos uma implementação
 * local, suficiente para gerar o gráfico SVG dos relatórios de trace.
 *
 * Saída como `XMLElementLike` (Fase 12.1) — o `to_svg()` produz a árvore
 * `<svg>…</svg>` que o relatório injeta no HTML. Atributos seguem a convenção
 * SVG do Ruby (`SVGSupport#valuesToSVG`): underscores viram travessões e
 * `font_size` ganha unidade `pt`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter.rb
 * @see docs/taskjuggler/lib/taskjuggler/Painter/Primitives.rb
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.22.1)
 */

import { SimpleXMLElement, type XMLElementLike, } from "./richtext/xml-like.ts";

/** Par de coordenadas `[x, y]` para `polyline`. */
export type PaintPoint = [number, number,];

/** Atributos de estilo/geometria (chave em snake_case, como no Ruby). */
export type PaintAttrs = Record<string, string | number>;

/** Atributos aceitos por `group` (Ruby `Group#@attributes`). */
const GROUP_ATTRS: ReadonlySet<string> = new Set([
  "fill",
  "font_family",
  "font_size",
  "stroke",
  "stroke_width",
],);

/** Cores nomeadas mínimas usadas pelo `ChartPlotter`. */
const NAMED_COLORS: Record<string, [number, number, number,]> = {
  black: [0, 0, 0,],
  white: [255, 255, 255,],
  red: [255, 0, 0,],
  green: [0, 128, 0,],
  blue: [0, 0, 255,],
  gray: [128, 128, 128,],
  grey: [128, 128, 128,],
};

/** Converte nome/RGB para `#rrggbb` (Ruby `Color#to_s`). */
function toHex(r: number, g: number, b: number,): string {
  const h = (v: number,): string =>
    Math.max(0, Math.min(255, Math.trunc(v,),),)
      .toString(16,)
      .padStart(2, "0",);
  return `#${h(r,)}${h(g,)}${h(b,)}`;
}

/** Conversão HSV → RGB fiel a `Painter::Color#hsvToRgb` (valores 0-255/0-360). */
function hsvToRgb(h: number, s: number, v: number,): [number, number, number,] {
  const hi = Math.floor(h / 60.0,) % 6;
  const f = h / 60.0 - Math.floor(h / 60.0,);
  const p = Math.trunc(v * (1.0 - s / 255.0),);
  const q = Math.trunc(v * (1.0 - (f * s / 255.0)),);
  const t = Math.trunc(v * (1.0 - ((1.0 - f) * s / 255.0)),);
  const table: [number, number, number,][] = [
    [v, t, p,],
    [q, v, p,],
    [p, v, t,],
    [p, q, v,],
    [t, p, v,],
    [v, p, q,],
  ];
  return table[hi]!;
}

/** Lista de pontos no formato SVG (`"x,y "` concatenado, como Ruby `Points#to_s`). */
function pointsToString(points: PaintPoint[],): string {
  let str = "";
  for (const [x, y,] of points) str += `${x},${y} `;
  return str;
}

/**
 * Renomeia/serializa atributos para SVG: `font_size` → `font-size="Npt"`,
 * demais underscores → travessões.
 */
function toSvgAttrs(attrs: PaintAttrs,): Record<string, string> {
  const out: Record<string, string> = {};
  for (const key of Object.keys(attrs,)) {
    const svgKey = key.replace(/_/g, "-",);
    const raw = attrs[key]!;
    out[svgKey] = key === "font_size" ? `${raw}pt` : String(raw,);
  }
  return out;
}

/**
 * Alvo de desenho (raiz ou grupo): acumula elementos-filhos e expõe as
 * primitivas. `PainterMin` e os grupos retornados por `group` compartilham esta
 * API, de modo que o callback de `group` desenha dentro do grupo.
 */
export class PainterScope {
  protected readonly container: SimpleXMLElement;

  constructor(container: SimpleXMLElement,) {
    this.container = container;
  }

  /** Elementos filhos já desenhados (inspeção/testes). */
  get elements(): readonly XMLElementLike[] {
    return this.container.children as XMLElementLike[];
  }

  /** Círculo de centro `(cx, cy)` e raio `r`. */
  circle(
    cx: number,
    cy: number,
    r: number,
    attrs: PaintAttrs = {},
  ): XMLElementLike {
    const el = new SimpleXMLElement(
      "circle",
      toSvgAttrs({
        ...attrs,
        cx,
        cy,
        r,
      },),
    );
    this.container.append(el,);
    return el;
  }

  /** Linha de `(x1, y1)` a `(x2, y2)`. */
  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    attrs: PaintAttrs = {},
  ): XMLElementLike {
    const el = new SimpleXMLElement(
      "line",
      toSvgAttrs({
        ...attrs,
        x1,
        y1,
        x2,
        y2,
      },),
    );
    this.container.append(el,);
    return el;
  }

  /** Polilinha fechando sobre os pontos fornecidos. */
  polyline(points: PaintPoint[], attrs: PaintAttrs = {},): XMLElementLike {
    const el = new SimpleXMLElement(
      "polyline",
      toSvgAttrs({
        ...attrs,
        points: pointsToString(points,),
      },),
    );
    this.container.append(el,);
    return el;
  }

  /** Retângulo em `(x, y)` com `width` × `height`. */
  rect(
    x: number,
    y: number,
    width: number,
    height: number,
    attrs: PaintAttrs = {},
  ): XMLElementLike {
    const el = new SimpleXMLElement(
      "rect",
      toSvgAttrs({
        ...attrs,
        x,
        y,
        width,
        height,
      },),
    );
    this.container.append(el,);
    return el;
  }

  /** Texto `str` na posição `(x, y)`. */
  text(
    x: number,
    y: number,
    str: string,
    attrs: PaintAttrs = {},
  ): XMLElementLike {
    const el = new SimpleXMLElement("text", toSvgAttrs({ ...attrs, x, y, },),);
    el.append(str,);
    this.container.append(el,);
    return el;
  }

  /**
   * Agrupa elementos com atributos comuns. Valida as chaves contra o conjunto
   * suportado (Ruby `Group#initialize`). Se `fn` for fornecido, recebe um alvo
   * que desenha dentro do grupo.
   */
  group(
    attrs: PaintAttrs = {},
    fn?: (scope: PainterScope,) => void,
  ): XMLElementLike {
    for (const key of Object.keys(attrs,)) {
      if (!GROUP_ATTRS.has(key,)) {
        throw new Error(
          "Unsupported attribute " + key + ". Use one of " +
            [...GROUP_ATTRS,].join(", ",) + ".",
        );
      }
    }
    const g = new SimpleXMLElement("g", toSvgAttrs(attrs,),);
    this.container.append(g,);
    if (fn) fn(new PainterScope(g,),);
    return g;
  }

  /**
   * Cor como `#rrggbb`. Formas: `color("black")`, `color(r, g, b)`. Cores HSV
   * usam {@link colorFromHsv}.
   */
  color(nameOrR: string | number, g?: number, b?: number,): string {
    if (typeof nameOrR === "string" && g === undefined && b === undefined) {
      const rgb = NAMED_COLORS[nameOrR];
      if (!rgb) {
        throw new Error(`Unknown color name: ${nameOrR}`,);
      }
      return toHex(rgb[0], rgb[1], rgb[2],);
    }
    return toHex(nameOrR as number, g!, b!,);
  }
}

/** Conversão HSV explícita (equivalente a `Painter::Color.new(h, s, v, :hsv)`). */
export function colorFromHsv(h: number, s: number, v: number,): string {
  const [r, g, b,] = hsvToRgb(h, s, v,);
  return toHex(r, g, b,);
}

/**
 * Pincel SVG com dimensões de canvas. `to_svg()` serializa a raiz `<svg>` com
 * `width`/`height` em pixels, envolvendo todos os elementos desenhados.
 */
export class PainterMin extends PainterScope {
  readonly width: number;
  readonly height: number;

  constructor(width: number, height: number,) {
    super(new SimpleXMLElement(null,),);
    this.width = width;
    this.height = height;
  }

  /** Raiz `<svg width="Npx" height="Mpx">` com todos os elementos. */
  to_svg(): XMLElementLike {
    const svg = new SimpleXMLElement("svg", {
      width: `${this.width}px`,
      height: `${this.height}px`,
    },);
    for (const child of this.elements) svg.append(child,);
    return svg;
  }
}
