/**
 * Testes de `XMLElementLike` + `SimpleXMLElement` (Fase 12.1).
 *
 * Cobria a serialização HTML fiel ao `XMLElement.rb`: escapes de atributo
 * (`&`, `"`) e de texto (`&`, `<`, `>`), elementos void auto-fechados,
 * aninhamento, fragmentos e os helpers `createComment`/`createBlob`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/XMLElement.rb:112-150
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import {
  createBlob,
  createComment,
  createText,
  SimpleXMLElement,
} from "../../src/richtext/xml-like.ts";

describe("SimpleXMLElement", () => {
  it("elemento vazio não-void abre e fecha a tag", () => {
    assertEquals(new SimpleXMLElement("div",).toHTML(), "<div></div>",);
  });

  it("append de texto (critério de aceite do plano)", () => {
    const div = new SimpleXMLElement("div", { class: "foo", },);
    div.append("Hello",);
    assertEquals(div.toHTML(), '<div class="foo">Hello</div>',);
  });

  it("append de filho aninha o markup", () => {
    const outer = new SimpleXMLElement("div",);
    const inner = new SimpleXMLElement("span",);
    inner.append("oi",);
    outer.append(inner,);
    assertEquals(outer.toHTML(), "<div><span>oi</span></div>",);
  });

  it("escapa & < > no conteúdo de texto", () => {
    const p = new SimpleXMLElement("p",);
    p.append("a & b < c > d",);
    assertEquals(p.toHTML(), "<p>a &amp; b &lt; c &gt; d</p>",);
  });

  it('escapa & e " em atributos', () => {
    const el = new SimpleXMLElement("a", {
      title: 'x & "y"',
      href: "http://e.com/?a=1&b=2",
    },);
    const html = el.toHTML();
    assertEquals(
      html,
      '<a href="http://e.com/?a=1&amp;b=2" title="x &amp; &quot;y&quot;"></a>',
    );
  });

  it("ordena atributos alfabeticamente (como o Ruby)", () => {
    const el = new SimpleXMLElement("td", { z: "1", a: "2", },);
    assertEquals(el.toHTML(), '<td a="2" z="1"></td>',);
  });

  it("elemento void auto-fecha quando sem filhos", () => {
    assertEquals(new SimpleXMLElement("hr",).toHTML(), "<hr />",);
    assertEquals(
      new SimpleXMLElement("br", { class: "x", },).toHTML(),
      '<br class="x" />',
    );
  });

  it("não-void com filhos preserva texto e nós", () => {
    const ul = new SimpleXMLElement("ul",);
    const li = new SimpleXMLElement("li",);
    li.append("item",);
    ul.append(li,);
    assertEquals(ul.toHTML(), "<ul><li>item</li></ul>",);
  });

  it("fragmento (tag null) concatena filhos sem wrapper", () => {
    const frag = new SimpleXMLElement(null,);
    frag.append("um ",);
    const b = new SimpleXMLElement("b",);
    b.append("dois",);
    frag.append(b,);
    assertEquals(frag.toHTML(), "um <b>dois</b>",);
  });

  it("fragmento com atributos lança (inválido)", () => {
    assertThrows(() => new SimpleXMLElement(null, { class: "x", },));
  });

  it("append ignora null/undefined", () => {
    const div = new SimpleXMLElement("div",);
    div.append(null as unknown as string,);
    div.append("ok",);
    assertEquals(div.toHTML(), "<div>ok</div>",);
  });
});

describe("helpers de texto/comentário/blob", () => {
  it("createText devolve o conteúdo cru (escapado ao renderizar)", () => {
    assertEquals(createText("a<b",), "a<b",);
    const p = new SimpleXMLElement("p",);
    p.append(createText("a<b",),);
    assertEquals(p.toHTML(), "<p>a&lt;b</p>",);
  });

  it("createComment produz comentário HTML", () => {
    assertEquals(createComment("nota",).toHTML(), "<!-- nota -->",);
  });

  it("createComment neutraliza sequências -- (como o Ruby)", () => {
    assertEquals(
      createComment("a--b",).toHTML(),
      "<!-- a-\\-b -->",
    );
  });

  it("createBlob injeta HTML cru sem escape", () => {
    const blob = createBlob("<custom>x & y</custom>",);
    const div = new SimpleXMLElement("div",);
    div.append(blob,);
    assertEquals(div.toHTML(), "<div><custom>x & y</custom></div>",);
  });
});
