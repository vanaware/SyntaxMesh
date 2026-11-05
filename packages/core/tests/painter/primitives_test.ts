/**
 * 17.9.3 — `Primitives` (host: `Group`).
 *
 * Saídas copiadas do oráculo Ruby (`.tmp/primitives_probe.rb`, 2026-11-04).
 * `Group` agora estende `Primitives`, então é o hospedeiro natural para
 * exercitar as formas antes de existir o `Painter` (17.10).
 *
 * @see packages/core/src/painter/primitives.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";

import {
  Circle,
  Ellipse,
  Line,
  PolyLine,
  Rect,
} from "../../src/painter/basic-shapes.ts";
import { Color, } from "../../src/painter/color.ts";
import { Group, } from "../../src/painter/group.ts";
import { Points, } from "../../src/painter/points.ts";
import { type SVGValues, } from "../../src/painter/svg-support.ts";
import { Text, } from "../../src/painter/text.ts";

describe("Primitives — color e points (17.9.3.2–17.9.3.3)", () => {
  it("color(...) devolve um Color", () => {
    const c = new Group({},).color("red",);
    assert(c instanceof Color,);
    assertEquals(c.to_s(), "#ff0000",);
  });

  it("color(r, g, b) aceita a forma RGB", () => {
    assertEquals(new Group({},).color(1, 2, 3,).to_rgb(), [1, 2, 3,],);
  });

  it("points(arr) devolve um Points", () => {
    const p = new Group({},).points([[1, 2,],],);
    assert(p instanceof Points,);
    assertEquals(p.to_s(), "1,2 ",);
  });
});

describe("Primitives — group (17.9.3.4)", () => {
  it("group sem bloco vazio: <g><g></g></g>", () => {
    const g = new Group({},);
    g.group();
    assertEquals(g.to_svg().to_s(), "<g><g></g></g>",);
  });

  it("group aninhado propaga atributos e filhos", () => {
    const outer = new Group({ fill: "red", }, (g,) => {
      g.group({ stroke: "blue", }, (inner,) => {
        inner.circle(1, 2, 3,);
      },);
    },);
    assertEquals(
      outer.to_svg().to_s(),
      '<g fill="red"><g stroke="blue">' +
        '<circle cx="1" cy="2" r="3"></circle></g></g>',
    );
  });

  it("group devolve o Group recém-criado e o registra", () => {
    const parent = new Group({},);
    const child = parent.group({ fill: "green", },);
    assert(child instanceof Group,);
    assertEquals(child.to_svg().to_s(), '<g fill="green"></g>',);
    assertEquals(parent.to_svg().to_s(), '<g><g fill="green"></g></g>',);
  });
});

describe("Primitives — formas (17.9.3.5–17.9.3.10)", () => {
  it("circle: <g><circle …></circle></g>", () => {
    const g = new Group({},);
    g.circle(1, 2, 3, { fill: "red", },);
    assertEquals(
      g.to_svg().to_s(),
      '<g><circle cx="1" cy="2" fill="red" r="3"></circle></g>',
    );
  });

  it("ellipse: só centro e raios", () => {
    const g = new Group({},);
    g.ellipse(1, 2, 3, 4,);
    assertEquals(
      g.to_svg().to_s(),
      '<g><ellipse cx="1" cy="2" rx="3" ry="4"></ellipse></g>',
    );
  });

  it("line: coordenadas + stroke_width", () => {
    const g = new Group({},);
    g.line(0, 0, 10, 10, { stroke_width: 2, },);
    assertEquals(
      g.to_svg().to_s(),
      '<g><line stroke-width="2" x1="0" x2="10" y1="0" y2="10"></line></g>',
    );
  });

  it("polyline aceita array (converte em Points)", () => {
    const g = new Group({},);
    g.polyline([[1, 2,], [3, 4,],],);
    assertEquals(
      g.to_svg().to_s(),
      '<g><polyline points="1,2 3,4 "></polyline></g>',
    );
  });

  it("polyline aceita um Points pronto", () => {
    const g = new Group({},);
    g.polyline(new Points([[1, 2,], [3, 4,],],),);
    assertEquals(
      g.to_svg().to_s(),
      '<g><polyline points="1,2 3,4 "></polyline></g>',
    );
  });

  it("rect: x, y, width, height", () => {
    const g = new Group({},);
    g.rect(1, 2, 3, 4,);
    assertEquals(
      g.to_svg().to_s(),
      '<g><rect height="4" width="3" x="1" y="2"></rect></g>',
    );
  });

  it("text: conteúdo e posição", () => {
    const g = new Group({},);
    g.text(1, 2, "hi",);
    assertEquals(g.to_svg().to_s(), '<g><text x="1" y="2">hi</text></g>',);
  });

  it("dois filhos ganham quebra e indentação de 1 espaço", () => {
    const g = new Group({},);
    g.rect(1, 2, 3, 4,);
    g.text(5, 6, "x",);
    assertEquals(
      g.to_svg().to_s(),
      '<g>\n <rect height="4" width="3" x="1" y="2"></rect>\n' +
        ' <text x="5" y="6">x</text>\n</g>',
    );
  });
});

describe("Primitives — tipos e efeitos colaterais", () => {
  it("cada forma devolve sua classe", () => {
    const g = new Group({},);
    assert(g.line(1, 2, 3, 4,) instanceof Line,);
    assert(g.group() instanceof Group,);
    assert(g.rect(1, 1, 1, 1,) instanceof Rect,);
    assert(g.polyline([],) instanceof PolyLine,);
    assert(g.text(1, 1, "a",) instanceof Text,);
    assert(g.circle(1, 1, 1,) instanceof Circle,);
    assert(g.ellipse(1, 1, 1, 1,) instanceof Ellipse,);
  });

  it("muta o hash attrs do chamador (Category C do Ruby)", () => {
    const attrs: SVGValues = { stroke: "red", };
    new Group({},).line(1, 2, 3, 4, attrs,);
    assertEquals(attrs, { stroke: "red", x1: 1, y1: 2, x2: 3, y2: 4, },);
  });
});
