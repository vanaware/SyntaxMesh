/**
 * 17.3 — `HTMLElements`.
 *
 * Expectativas conferidas contra o Ruby real (`HTMLElements.rb` +
 * `XMLElement.rb` executados): `DIV.new({'class' => 'foo'}).to_s` →
 * `"<div class=\"foo\"></div>"`; `BR.new.to_s` → `"<br/>"`; o bloco passado a
 * `DIV.new { BR.new }` **chega** ao `XMLElement` (o `super` do Ruby encaminha
 * o bloco implicitamente) e produz `"<div><br/></div>"`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/HTMLElements.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.3)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";

import {
  A,
  BR,
  closureTags,
  createHTMLElementClass,
  DIV,
  HTML,
  HTMLElements,
  htmlTags,
  META,
  P,
  TITLE,
} from "../../src/html/html-elements.ts";
import { XMLElement, } from "../../src/xml/xml-element.ts";

describe("HTMLElements — listas do Ruby (17.3.2–3)", () => {
  it("lista exatamente as 25 tags de `htmlTags`", () => {
    assertEquals(
      [...htmlTags,].sort(),
      [
        "a",
        "b",
        "body",
        "br",
        "code",
        "col",
        "colgroup",
        "div",
        "em",
        "footer",
        "frame",
        "frameset",
        "h1",
        "h2",
        "h3",
        "head",
        "hr",
        "html",
        "meta",
        "p",
        "pre",
        "span",
        "table",
        "td",
        "title",
        "tr",
      ].sort(),
    );
    assert(htmlTags.length >= 25,);
  });

  it("lista exatamente as 9 tags de `closureTags`", () => {
    assertEquals(
      [...closureTags,].sort(),
      [
        "area",
        "base",
        "basefont",
        "br",
        "hr",
        "img",
        "input",
        "link",
        "meta",
      ].sort(),
    );
  });
});

describe("createHTMLElementClass (17.3.4)", () => {
  it("fixa a tag e marca self-closing conforme closureTags", () => {
    const br = new BR();
    assertEquals(br.name, "br",);
    assertEquals(br.selfClosing, true,);
    const div = new DIV();
    assertEquals(div.name, "div",);
    assertEquals(div.selfClosing, false,);
  });

  it("as subclasses são XMLElement (contrato da Fase 12 preservado)", () => {
    assert(new P() instanceof XMLElement,);
    assert(new DIV() instanceof XMLElement,);
  });

  it("dá à classe o nome em MAIÚSCULAS que o Ruby lhe daria", () => {
    assertEquals(DIV.name, "DIV",);
    assertEquals(A.name, "A",);
    assertEquals(createHTMLElementClass("h1",).name, "H1",);
  });

  it("tag de closure fora de htmlTags também nasce auto-fechada", () => {
    // O Ruby não gera IMG, mas `closureTags` manda: a fábrica é genérica.
    const IMG = createHTMLElementClass("img",);
    assertEquals(new IMG().selfClosing, true,);
  });
});

describe("classes exportadas (17.3.5–6)", () => {
  it("new DIV({ class: 'foo' }) serializa o atributo", () => {
    assertEquals(
      new DIV({ class: "foo", },).to_s(),
      '<div class="foo"></div>',
    );
  });

  it("tags de closure sem filhos saem `/>` e as outras `<x></x>`", () => {
    assertEquals(new BR().to_s(), "<br/>",);
    assertEquals(
      new META({ charset: "utf-8", },).to_s(),
      '<meta charset="utf-8"/>',
    );
    assertEquals(new P().to_s(), "<p></p>",);
  });

  it("encaminha o bloco do construtor (1 filho)", () => {
    const div = new DIV({}, () => new BR(),);
    assertEquals(div.to_s(), "<div><br/></div>",);
    assertEquals(div.children.length, 1,);
  });

  it("encaminha o bloco que devolve lista (indentação de 1 espaço)", () => {
    const div = new DIV({}, () => [new P(), new P(),],);
    assertEquals(div.to_s(), "<div>\n <p></p>\n <p></p>\n</div>",);
  });

  it("converte string do bloco em XMLText", () => {
    assertEquals(
      new TITLE({}, () => "Título",).to_s(),
      "<title>Título</title>",
    );
  });

  it("ordena os atributos como o Ruby (`keys.sort`)", () => {
    assertEquals(
      new HTML({ "xml:lang": "en", lang: "en", },).to_s(),
      '<html lang="en" xml:lang="en"></html>',
    );
  });

  it("o registro `HTMLElements` aponta para as mesmas classes", () => {
    assertEquals(HTMLElements["DIV"], DIV,);
    assertEquals(HTMLElements["META"], META,);
    assertEquals(Object.keys(HTMLElements,).length, htmlTags.length,);
  });
});
