/**
 * `Fragment` + contrato `XMLElementLike` (Fase 17.12).
 *
 * Este arquivo substitui o antigo `tests/richtext/xml-like_test.ts`, que
 * pinava o `SimpleXMLElement` da Fase 12. Os comportamentos que só existiam
 * no mínimo mudam de forma (fiel a `XMLElement.rb`, verificada no oráculo):
 *   - Tags void (`hr`, `br`) **não** se auto-fecham sozinhas: é preciso o
 *     3º argumento `selfClosing` (Ruby `XMLElement.new('hr', {}, true)`).
 *   - Atributos escapam `"` como `\"` (`compat.keepRubyBugs`, default) em vez
 *     de `&quot;`.
 *   - Fragmento é a classe `Fragment` — `new XMLElement(null).to_s()` levanta
 *     `TypeError` no Ruby, e replicamos.
 *
 * @see docs/taskjuggler/lib/taskjuggler/XMLElement.rb:112-154
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";

import {
  Fragment,
  XMLBlob,
  XMLComment,
  XMLElement,
  XMLText,
} from "../../src/xml/xml-element.ts";

describe("XMLElement — contrato XMLElementLike (ex-SimpleXMLElement)", () => {
  it("elemento vazio não-void abre e fecha a tag", () => {
    assertEquals(new XMLElement("div",).toHTML(), "<div></div>",);
  });

  it("append de texto (critério de aceite do plano)", () => {
    const div = new XMLElement("div", { class: "foo", },);
    div.append("Hello",);
    assertEquals(div.toHTML(), '<div class="foo">Hello</div>',);
  });

  it("append de filho aninha o markup", () => {
    const outer = new XMLElement("div",);
    const inner = new XMLElement("span",);
    inner.append("oi",);
    outer.append(inner,);
    assertEquals(outer.toHTML(), "<div><span>oi</span></div>",);
  });

  it("escapa & < > no conteúdo de texto (XMLText)", () => {
    const p = new XMLElement("p",);
    p.append("a & b < c > d",);
    assertEquals(p.toHTML(), "<p>a &amp; b &lt; c &gt; d</p>",);
  });

  it("ordena atributos alfabeticamente (como o Ruby)", () => {
    const el = new XMLElement("td", { z: "1", a: "2", },);
    assertEquals(el.toHTML(), '<td a="2" z="1"></td>',);
  });

  it('escapa & em atributo e " na forma do Ruby (Category B)', () => {
    const el = new XMLElement("a", { href: "http://e.com/?a=1&b=2", },);
    assertEquals(
      el.toHTML(),
      '<a href="http://e.com/?a=1&amp;b=2"></a>',
    );
  });

  it("void auto-fecha apenas com selfClosing (Ruby `XMLElement.new('hr', {}, true)`)", () => {
    assertEquals(new XMLElement("hr", {}, true,).toHTML(), "<hr/>",);
    assertEquals(
      new XMLElement("br", { class: "x", }, true,).toHTML(),
      '<br class="x"/>',
    );
    // Sem a flag, o Ruby também fecha a tag normalmente.
    assertEquals(new XMLElement("hr",).toHTML(), "<hr></hr>",);
  });

  it("não-void com filhos preserva texto e nós", () => {
    const ul = new XMLElement("ul",);
    const li = new XMLElement("li",);
    li.append("item",);
    ul.append(li,);
    assertEquals(ul.toHTML(), "<ul><li>item</li></ul>",);
  });

  it("append ignora null/undefined", () => {
    const div = new XMLElement("div",);
    div.append(undefined,);
    div.append("ok",);
    assertEquals(div.toHTML(), "<div>ok</div>",);
  });

  it("elemento com tag nula não serializa (TypeError do Ruby)", () => {
    assertThrows(() => new XMLElement(null,).toHTML(), TypeError,);
  });

  it("fragmento (tag null) com atributos lança (inválido)", () => {
    assertThrows(() => new XMLElement(null, { class: "x", },));
  });
});

describe("Fragment — agrupador sem tag (acréscimo 17.12)", () => {
  it("concatena filhos sem wrapper", () => {
    const frag = new Fragment();
    frag.append("um ",);
    const b = new XMLElement("b",);
    b.append("dois",);
    frag.append(b,);
    assertEquals(frag.toHTML(), "um <b>dois</b>",);
  });

  it("aceita lista no construtor e serializa do mesmo modo", () => {
    const frag = new Fragment(["x", new XMLText("<y>",),],);
    assertEquals(frag.toHTML(), "x&lt;y&gt;",);
    assertEquals(frag.tag, null,);
  });
});

describe("XMLComment / XMLBlob (substitutos de createComment/createBlob)", () => {
  it("comentário serializa como o Ruby: `<!-- … -->` + \\n", () => {
    assertEquals(new XMLComment("nota",).toHTML(), "<!-- nota -->\n",);
  });

  it("comentário neutraliza sequências -- (canonicalize_comment)", () => {
    assertEquals(new XMLComment("a--b",).toHTML(), "<!-- a-\\-b -->\n",);
  });

  it("blob injeta HTML cru sem escape", () => {
    const blob = new XMLBlob("<custom>x & y</custom>",);
    const div = new XMLElement("div",);
    div.append(blob,);
    assertEquals(div.toHTML(), "<div><custom>x & y</custom></div>",);
  });
});
