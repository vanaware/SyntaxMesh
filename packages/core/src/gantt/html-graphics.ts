/**
 * HTMLGraphics (Fase 15.1) — primitivas gráficas como `<div>` absolutos.
 *
 * Port fiel de `docs/taskjuggler/lib/taskjuggler/reports/HTMLGraphics.rb`.
 * O Gantt do TaskJuggler não usa SVG nem Canvas: linhas, retângulos, jags,
 * losangos e pontas de seta são `div`s com `position: absolute` e `class` de
 * categoria CSS. Coordenadas são truncadas como `to_i` no Ruby
 * (cheat sheet §3: `Math.trunc`).
 *
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md (ADR 028)
 * @see docs/syntaxmesh/fases/fase-15-gantt.md (15.1)
 */
import {
  SimpleXMLElement,
  type XMLElementLike,
} from "../richtext/xml-like.ts";

/** Trunca para inteiro como `Integer#to_i` do Ruby. */
function toI(v: number,): number {
  return Math.trunc(v,);
}

/**
 * Renderiza uma linha horizontal ou vertical como `<div>` de 1px.
 *
 * Ruby `HTMLGraphics#lineToHTML`. Linhas diagonais não são suportadas (o
 * roteamento do Gantt é estritamente ortogonal) e lançam erro.
 */
export function lineToHTML(
  xs: number,
  ys: number,
  xe: number,
  ye: number,
  category: string,
): XMLElementLike {
  let x0 = toI(xs,);
  let y0 = toI(ys,);
  let x1 = toI(xe,);
  let y1 = toI(ye,);
  let style: string;
  if (y0 === y1) {
    // Linha horizontal.
    if (x1 < x0) [x0, x1,] = [x1, x0,];
    style = `left:${x0}px; top:${y0}px; ` +
      `width:${x1 - x0 + 1}px; height:1px;`;
  } else if (x0 === x1) {
    // Linha vertical.
    if (y1 < y0) [y0, y1,] = [y1, y0,];
    style = `left:${x0}px; top:${y0}px; ` +
      `width:1px; height:${y1 - y0 + 1}px;`;
  } else {
    throw new Error(
      `Can't draw diagonal line ${x0}/${y0} to ${x1}/${y1}!`,
    );
  }
  return new SimpleXMLElement("div", { class: category, style, },);
}

/** Renderiza um retângulo preenchido (Ruby `rectToHTML`). */
export function rectToHTML(
  x: number,
  y: number,
  w: number,
  h: number,
  category: string,
): XMLElementLike {
  const style = `left:${toI(x,)}px; top:${toI(y,)}px; ` +
    `width:${toI(w,)}px; height:${toI(h,)}px;`;
  return new SimpleXMLElement("div", { class: category, style, },);
}

/** Renderiza o "jag" (colchete) de uma barra de container. */
export function jagToHTML(x: number, y: number,): XMLElementLike {
  return new SimpleXMLElement("div", {
    class: "tj_gantt_jag",
    style: `left:${toI(x,) - 5}px; top:${toI(y,)}px;`,
  },);
}

/** Renderiza um losango (milestone) como dois `<div>` sobrepostos. */
export function diamondToHTML(x: number, y: number,): XMLElementLike[] {
  return [
    new SimpleXMLElement("div", {
      class: "tj_diamond_top",
      style: `left:${toI(x,) - 6}px; top:${toI(y,) - 7}px;`,
    },),
    new SimpleXMLElement("div", {
      class: "tj_diamond_bottom",
      style: `left:${toI(x,) - 6}px; top:${toI(y,)}px;`,
    },),
  ];
}

/** Renderiza a ponta de seta de uma dependência. */
export function arrowHeadToHTML(x: number, y: number,): XMLElementLike {
  return new SimpleXMLElement("div", {
    class: "tj_arrow_head",
    style: `left:${toI(x,) - 5}px; top:${toI(y,) - 5}px;`,
  },);
}
