/**
 * 17.8.6–17.8.9 — `Group`.
 *
 * Saídas copiadas do oráculo Ruby (`.tmp/element_ruby_check.rb`):
 * `G.new({fill: 'red'}).to_svg.to_s == '<g fill="red"></g>'` e, com um filho,
 * `'<g fill="red"><foo a="1"></foo></g>'`.
 *
 * @see packages/core/src/painter/group.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";

import { TjArgumentError, } from "../../src/model/errors.ts";
import { Color, } from "../../src/painter/color.ts";
import { type Drawable, Element, } from "../../src/painter/element.ts";
import { Group, } from "../../src/painter/group.ts";
import { type SVGValues, } from "../../src/painter/svg-support.ts";

/** Subclasse só para injetar filhos sem as primitivas (que chegam em 17.9). */
class GroupWithChildren extends Group {
  add(element: Drawable,): void {
    this.elements.push(element,);
  }
}

function foo(value: number,): Element {
  return new Element("foo", ["a",], { a: value, },);
}

describe("Group — construtor (17.8.7)", () => {
  it("aceita os cinco atributos herdáveis", () => {
    const g = new Group({
      fill: "red",
      font_family: "Arial",
      font_size: 9,
      stroke: "blue",
      stroke_width: 1,
    },);
    assertEquals(
      g.to_svg().to_s(),
      '<g fill="red" font-family="Arial" font-size="9pt" ' +
        'stroke="blue" stroke-width="1"></g>',
    );
  });

  it("aceita hash vazio", () => {
    assertEquals(new Group({},).to_svg().to_s(), "<g></g>",);
  });

  it("rejeita chave desconhecida com a lista de sugestões", () => {
    assertThrows(
      () => new Group({ bogus: 1, },),
      TjArgumentError,
      "Unsupported attribute bogus. Use one of fill, font_family, " +
        "font_size, stroke, stroke_width.",
    );
  });

  it("rejeita atributo de Element (ex.: stroke_opacity) — lista própria", () => {
    assertThrows(() => new Group({ stroke_opacity: 1, },), TjArgumentError,);
  });

  it("aliasa o objeto de valores, como o Ruby (@values = values)", () => {
    const values: SVGValues = { fill: "red", };
    const g = new Group(values,);
    values.stroke = "blue";
    assertEquals(g.to_svg().to_s(), '<g fill="red" stroke="blue"></g>',);
  });
});

describe("Group — bloco (17.8.8)", () => {
  it("bloco recebe o grupo e roda no construtor", () => {
    let seen: Group | null = null;
    const g = new Group({}, (group,) => {
      seen = group;
    },);
    assert(seen === g, "o bloco deve receber o próprio grupo",);
  });

  it("bloco ausente deixa `elements` vazio", () => {
    assertEquals(new Group({ fill: "red", },).to_svg().children.length, 0,);
  });

  it("elementos acrescentados pelo bloco entram na serialização", () => {
    const g = new GroupWithChildren({ fill: "red", }, (group,) => {
      (group as GroupWithChildren).add(foo(1,),);
    },);
    assertEquals(g.to_svg().to_s(), '<g fill="red"><foo a="1"></foo></g>',);
  });
});

describe("Group — to_svg (17.8.9)", () => {
  it("é sempre um <g> com selfClosing false", () => {
    const el = new Group({},).to_svg();
    assertEquals(el.name, "g",);
    assertEquals(el.selfClosing, false,);
  });

  it("dois filhos ganham quebra de linha e indentação de 1 espaço", () => {
    const g = new GroupWithChildren({},);
    g.add(foo(1,),);
    g.add(foo(2,),);
    assertEquals(
      g.to_svg().to_s(),
      '<g>\n <foo a="1"></foo>\n <foo a="2"></foo>\n</g>',
    );
  });

  it("valores vão para a sintaxe SVG (Color inclusive)", () => {
    const g = new Group({ fill: new Color("red",), font_size: 12, },);
    assertEquals(g.to_svg().to_s(), '<g fill="#ff0000" font-size="12pt"></g>',);
  });

  it("grupos aninhados serializam a árvore completa", () => {
    const inner = new GroupWithChildren({ stroke: "blue", },);
    inner.add(foo(7,),);
    const outer = new GroupWithChildren({ fill: "red", },);
    outer.add(inner,);
    assertEquals(
      outer.to_svg().to_s(),
      '<g fill="red"><g stroke="blue"><foo a="7"></foo></g></g>',
    );
  });
});
