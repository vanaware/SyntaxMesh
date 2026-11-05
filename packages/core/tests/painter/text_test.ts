/**
 * 17.9.2 — `Text`.
 *
 * Saídas copiadas do oráculo Ruby (`.tmp/shapes_ruby_check.rb`, 2026-11-04).
 *
 * @see packages/core/src/painter/text.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";

import { TjArgumentError, } from "../../src/model/errors.ts";
import { Text, TextAttrs, } from "../../src/painter/text.ts";

describe("Text (17.9.2.2–17.9.2.3)", () => {
  it("conteúdo sai entre as tags, com x/y", () => {
    assertEquals(
      new Text("hi", { x: 1, y: 2, },).to_svg().to_s(),
      '<text x="1" y="2">hi</text>',
    );
  });

  it("aceita font_family e font_size (TextAttrs)", () => {
    assertEquals(
      new Text("hi", {
        x: 1,
        y: 2,
        font_family: "Arial",
        font_size: 10,
      },)
        .to_svg()
        .to_s(),
      '<text font-family="Arial" font-size="10pt" x="1" y="2">hi</text>',
    );
  });

  it("string vazia ainda cria o nó (serializa entre as tags)", () => {
    assertEquals(
      new Text("", { x: 1, y: 2, },).to_svg().to_s(),
      '<text x="1" y="2"></text>',
    );
  });

  it("rejeita atributo fora da lista", () => {
    assertThrows(
      () => new Text("hi", { x: 1, y: 2, z: 3, },),
      TjArgumentError,
      "Unsupported attribute z",
    );
  });

  it("TextAttrs = FillAndStroke + font_family + font_size", () => {
    assertEquals(
      TextAttrs.slice(-2,),
      ["font_family", "font_size",],
    );
    assert(TextAttrs.includes("fill",),);
    assert(TextAttrs.includes("stroke_width",),);
  });
});
