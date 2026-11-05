/**
 * 17.8.1–17.8.5 — `Element`.
 *
 * As strings de saída foram copiadas do oráculo Ruby
 * (`.tmp/element_ruby_check.rb`, 2026-11-04).
 *
 * @see packages/core/src/painter/element.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";

import { TjArgumentError, } from "../../src/model/errors.ts";
import { Element, } from "../../src/painter/element.ts";
import { XMLElement, } from "../../src/xml/xml-element.ts";

/** Subclasse só para expor o `@text` protegido (Ruby usa `instance_variable_set`). */
class TextElement extends Element {
  setText(value: string,): void {
    this.text = value;
  }
}

describe("Element — construtor e validação (17.8.3)", () => {
  it("guarda o tipo e aceita as chaves listadas", () => {
    const el = new Element("foo", ["a", "b",], { a: 1, b: 2, },);
    assertEquals(el.to_svg().to_s(), '<foo a="1" b="2"></foo>',);
  });

  it("rejeita chave não listada com 'Unsupported attribute X'", () => {
    assertThrows(
      () => new Element("foo", ["a", "b",], { a: 1, c: 2, },),
      TjArgumentError,
      "Unsupported attribute c",
    );
  });

  it("values vazio não levanta", () => {
    assertEquals(
      new Element("foo", ["a",], {},).to_svg().to_s(),
      "<foo></foo>",
    );
  });

  it("não aliasa o objeto recebido (copia chave a chave)", () => {
    const values = { a: 1, };
    const el = new Element("foo", ["a",], values,);
    (values as Record<string, number>)["b"] = 2;
    assertEquals(el.to_svg().to_s(), '<foo a="1"></foo>',);
  });
});

describe("Element — to_svg (17.8.4)", () => {
  it("produz XMLElement com a tag do tipo", () => {
    const el = new Element("rect", ["x",], { x: 5, },).to_svg();
    assert(el instanceof XMLElement,);
    assertEquals(el.name, "rect",);
  });

  it("converte os valores para sintaxe SVG (underline→dash, pt)", () => {
    assertEquals(
      new Element("foo", ["font_size", "stroke_width",], {
        font_size: 10,
        stroke_width: 2,
      },)
        .to_svg()
        .to_s(),
      '<foo font-size="10pt" stroke-width="2"></foo>',
    );
  });

  it("ordena os atributos na serialização (regra do XMLElement)", () => {
    assertEquals(
      new Element("foo", ["b", "a",], { b: 1, a: 2, },).to_svg().to_s(),
      '<foo a="2" b="1"></foo>',
    );
  });

  it("valores Color são serializados por to_s", () => {
    const color = { to_s: (): string => "#ff0000", };
    assertEquals(
      new Element("foo", ["fill",], { fill: color, },).to_svg().to_s(),
      '<foo fill="#ff0000"></foo>',
    );
  });
});

describe("Element — texto (17.8.5)", () => {
  it("sem texto não há filho", () => {
    assertEquals(new Element("foo", [], {},).to_svg().children.length, 0,);
  });

  it("texto vazio ainda entra (Ruby `if @text` é truthy) e some na saída", () => {
    const el = new TextElement("foo", [], {},);
    el.setText("",);
    assertEquals(el.to_svg().children.length, 1,);
    assertEquals(el.to_svg().to_s(), "<foo></foo>",);
  });

  it("texto não vazio sai entre as tags", () => {
    const el = new TextElement("foo", [], {},);
    el.setText("hello",);
    assertEquals(el.to_svg().to_s(), "<foo>hello</foo>",);
  });
});
