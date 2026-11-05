/**
 * 17.9.1 — formas básicas do Painter (`Painter/BasicShapes.rb`).
 *
 * Cada classe é um `Element` com tag fixa e a lista de atributos aceitos
 * exatamente como no Ruby. Nenhum comportamento extra: a graça está na
 * validação de `Element` e na serialização SVG.
 *
 * Conjuntos de atributos (Ruby `Primitives`): `StrokeAttrs`, `FillAttrs`,
 * `FillAndStrokeAttrs` e `TextAttrs` vivem aqui (e em `text.ts`) em vez de
 * `primitives.ts` para manter o grafo de módulos acíclico — `Primitives`
 * precisa importar estas classes, e `Element`/formas não podem importar
 * `Primitives`. Conteúdo e ordem são os do Ruby.
 *
 * Saídas conferidas no oráculo (2026-11-04, `.tmp/shapes_ruby_check.rb`):
 * - `Circle.new({fill: 'red'}).to_svg.to_s` == `<circle fill="red"></circle>`.
 * - Atributos sempre saem **ordenados** (`<circle cx cy fill fill-opacity r
 *   stroke stroke-opacity stroke-width>`), regra herdada do 17.1.
 * - `Circle.new` sem argumento levanta `ArgumentError` no Ruby (aridade); em
 *   TS o parâmetro é obrigatório, então o compilador já barra.
 * - `PolyLine` aceita um objeto `Points` **ou** (pelas primitivas) um array
 *   de pares, que é convertido em `Points`. Passar um array cru diretamente
 *   ao `PolyLine` produziria `points="[1, 2]"` no Ruby (`Array#to_s`); o port
 *   não tem esse caminho porque o tipo não aceita array solto.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Painter/BasicShapes.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.9.1)
 */

import { Element, } from "./element.ts";
import { type SVGValues, } from "./svg-support.ts";

/** Atributos de traço (Ruby `Primitives::StrokeAttrs`). */
export const StrokeAttrs: readonly string[] = [
  "stroke",
  "stroke_opacity",
  "stroke_width",
];

/** Atributos de preenchimento (Ruby `Primitives::FillAttrs`). */
export const FillAttrs: readonly string[] = ["fill", "fill_opacity",];

/** Traço + preenchimento (Ruby `Primitives::FillAndStrokeAttrs`). */
export const FillAndStrokeAttrs: readonly string[] = [
  ...StrokeAttrs,
  ...FillAttrs,
];

/** Círculo: centro `cx`, `cy` e raio `r`. */
export class Circle extends Element {
  constructor(attrs: SVGValues,) {
    super("circle", [...["cx", "cy", "r",], ...FillAndStrokeAttrs,], attrs,);
  }
}

/** Elipse: centro `cx`, `cy` e raios `rx`, `ry`. */
export class Ellipse extends Element {
  constructor(attrs: SVGValues,) {
    super(
      "ellipse",
      [...["cx", "cy", "rx", "ry",], ...FillAndStrokeAttrs,],
      attrs,
    );
  }
}

/** Linha reta de `(x1, y1)` a `(x2, y2)` — só traço, sem fill. */
export class Line extends Element {
  constructor(attrs: SVGValues,) {
    super("line", [...["x1", "y1", "x2", "y2",], ...StrokeAttrs,], attrs,);
  }
}

/** Retângulo em `x`, `y` com `width`/`height` (e cantos `rx`/`ry`). */
export class Rect extends Element {
  constructor(attrs: SVGValues,) {
    super(
      "rect",
      [
        ...["x", "y", "width", "height", "rx", "ry",],
        ...FillAndStrokeAttrs,
      ],
      attrs,
    );
  }
}

/** Polilinha descrita por um objeto `Points`. */
export class PolyLine extends Element {
  constructor(attrs: SVGValues,) {
    super("polyline", [...["points",], ...FillAndStrokeAttrs,], attrs,);
  }
}
