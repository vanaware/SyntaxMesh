/**
 * 17.7.3 — `valuesToSVG`.
 *
 * Saídas conferidas no oráculo Ruby (`SVGSupport#valuesToSVG`) em 2026-11-04:
 * `{ font_size: 10 }` → `{ "font-size": "10pt" }` e a ordem das chaves é a de
 * inserção (sem ordenação, ao contrário dos atributos de `XMLElement`).
 *
 * @see packages/core/src/painter/svg-support.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";

import { Color, } from "../../src/painter/color.ts";
import { type SVGValues, valuesToSVG, } from "../../src/painter/svg-support.ts";

describe("valuesToSVG — conversão de chaves (17.7.3.2/3.4)", () => {
  it("troca underscores por travessões", () => {
    assertEquals(valuesToSVG({ stroke_width: 2, },), { "stroke-width": "2", },);
  });

  it("troca em todos os underscores (regex global)", () => {
    assertEquals(
      valuesToSVG({ my_long_attr: 1, },),
      { "my-long-attr": "1", },
    );
  });

  it("não altera chaves sem underscore", () => {
    assertEquals(valuesToSVG({ anchor: "middle", },), { anchor: "middle", },);
  });

  it("hash vazio devolve hash vazio", () => {
    assertEquals(valuesToSVG({},), {},);
  });

  it("preserva a ordem de inserção das chaves", () => {
    const out = valuesToSVG({ stroke_width: 2, fill: "red", } as SVGValues,);
    assertEquals(Object.keys(out,), ["stroke-width", "fill",],);
  });
});

describe("valuesToSVG — unidade pt em font_size (17.7.3.3)", () => {
  it("font_size ganha 'pt'", () => {
    assertEquals(valuesToSVG({ font_size: 10, },), { "font-size": "10pt", },);
  });

  it("nenhuma outra chave ganha unidade", () => {
    assertEquals(
      valuesToSVG({ font_family: "Arial", font_weight: 400, },),
      { "font-family": "Arial", "font-weight": "400", },
    );
  });

  it("font_size fracionário também recebe 'pt'", () => {
    assertEquals(valuesToSVG({ font_size: 8.5, },), { "font-size": "8.5pt", },);
  });
});

describe("valuesToSVG — valores (Ruby `v.to_s`)", () => {
  it("números inteiros e fracionários viram string", () => {
    assertEquals(valuesToSVG({ x1: 0, y1: 2.5, },), { x1: "0", y1: "2.5", },);
  });

  it("strings passam intactas (inclusive cores #rrggbb)", () => {
    assertEquals(valuesToSVG({ fill: "#ff0000", },), { fill: "#ff0000", },);
  });

  it("objetos com to_s() (Color) são serializados por to_s", () => {
    assertEquals(
      valuesToSVG({
        fill: new Color("red",),
        stroke: new Color(0, 10, 200,),
      },),
      { fill: "#ff0000", stroke: "#000ac8", },
    );
  });
});
