/**
 * Testes do sanitizador de HTML (Fase 13.5).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.5)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  ALLOWED_ATTRS,
  ALLOWED_TAGS,
  BLOCKED_TAGS,
  isAllowedTag,
  isBlockedTag,
  sanitizeHtml,
} from "../../../src/markdown/extensions/html-sanitizer.ts";

describe("HTML sanitizer (13.5)", () => {
  describe("allow-list / block-list (13.5.2, 13.5.3)", () => {
    it("tem 16 tags na allow-list", () => {
      assertEquals(ALLOWED_TAGS.length, 16,);
    });

    it("tem 7 tags na block-list", () => {
      assertEquals(BLOCKED_TAGS.length, 7,);
    });

    it("reconhece tags permitidas", () => {
      for (const tag of ALLOWED_TAGS) {
        assert(isAllowedTag(tag,), `${tag} deveria ser permitida`,);
      }
    });

    it("reconhece tags bloqueadas", () => {
      for (const tag of BLOCKED_TAGS) {
        assert(isBlockedTag(tag,), `${tag} deveria ser bloqueada`,);
      }
    });

    it("tag desconhecida não está em nenhuma lista", () => {
      assertEquals(isAllowedTag("blink",), false,);
      assertEquals(isBlockedTag("blink",), false,);
    });
  });

  describe("sanitizeHtml: tags bloqueadas (13.5.4)", () => {
    it("remove <script> e seu conteúdo", () => {
      assertEquals(sanitizeHtml("<script>alert(1)</script>",), "",);
    });

    it("remove <style> e seu conteúdo", () => {
      assertEquals(sanitizeHtml("<style>body{color:red}</style>",), "",);
    });

    it("remove <iframe> e seu conteúdo", () => {
      assertEquals(sanitizeHtml("<iframe src='evil'>x</iframe>",), "",);
    });

    it("remove <object> e <embed>", () => {
      assertEquals(sanitizeHtml("<object>flash</object>",), "",);
      assertEquals(sanitizeHtml("<embed src='x'>",), "",);
    });

    it("preserva texto ao redor de tag bloqueada", () => {
      assertEquals(
        sanitizeHtml("antes<script>bad</script>depois",),
        "antesdepois",
      );
    });
  });

  describe("sanitizeHtml: tags permitidas (13.5.4)", () => {
    it("preserva <span> com atributos seguros", () => {
      assertEquals(
        sanitizeHtml('<span class="foo">text</span>',),
        '<span class="foo">text</span>',
      );
    });

    it("preserva <b>, <i>, <em>, <strong>", () => {
      assertEquals(sanitizeHtml("<b>bold</b>",), "<b>bold</b>",);
      assertEquals(sanitizeHtml("<em>italic</em>",), "<em>italic</em>",);
      assertEquals(
        sanitizeHtml("<strong>strong</strong>",),
        "<strong>strong</strong>",
      );
    });

    it("preserva <code>, <pre>, <br>, <hr>", () => {
      assertEquals(sanitizeHtml("<code>x=1</code>",), "<code>x=1</code>",);
      assertEquals(sanitizeHtml("<pre>block</pre>",), "<pre>block</pre>",);
      assertEquals(sanitizeHtml("a<br/>b",), "a<br />b",);
    });

    it("preserva <a> com href seguro", () => {
      assertEquals(
        sanitizeHtml('<a href="https://example.com">link</a>',),
        '<a href="https://example.com">link</a>',
      );
    });

    it("preserva <a> com href relativo", () => {
      assertEquals(
        sanitizeHtml('<a href="page.html">link</a>',),
        '<a href="page.html">link</a>',
      );
    });

    it("preserva listas <ul>/<ol>/<li>", () => {
      const input = "<ul><li>one</li><li>two</li></ul>";
      assertEquals(sanitizeHtml(input,), input,);
    });

    it("preserva <blockquote>", () => {
      assertEquals(
        sanitizeHtml("<blockquote>quote</blockquote>",),
        "<blockquote>quote</blockquote>",
      );
    });
  });

  describe("sanitizeHtml: tags desconhecidas (13.5.4)", () => {
    it("remove tag desconhecida e mantém conteúdo", () => {
      assertEquals(sanitizeHtml("<blink>oi</blink>",), "oi",);
    });

    it("remove <marquee> e mantém conteúdo", () => {
      assertEquals(sanitizeHtml("<marquee>scroll</marquee>",), "scroll",);
    });
  });

  describe("sanitizeHtml: atributos (13.5.5, 13.5.6)", () => {
    it("mantém atributos permitidos: class, id, href, title, target, style", () => {
      assertEquals(ALLOWED_ATTRS.length, 6,);
      const result = sanitizeHtml(
        '<span id="s1" class="c1" title="t" target="_blank">x</span>',
      );
      assert(result.includes('id="s1"',),);
      assert(result.includes('class="c1"',),);
      assert(result.includes('title="t"',),);
      assert(result.includes('target="_blank"',),);
    });

    it("remove onclick", () => {
      const result = sanitizeHtml('<a href="x" onclick="steal()">z</a>',);
      assert(!result.includes("onclick",),);
      assert(result.includes('href="x"',),);
    });

    it("remove onerror", () => {
      const result = sanitizeHtml('<span onerror="bad()">text</span>',);
      assert(!result.includes("onerror",),);
    });

    it("remove onload", () => {
      const result = sanitizeHtml("<div onload='hack()'>hi</div>",);
      assert(!result.includes("onload",),);
    });

    it("remove javascript: em href", () => {
      const result = sanitizeHtml('<a href="javascript:alert(1)">x</a>',);
      assert(!result.includes("javascript:",),);
    });

    it("remove vbscript: em href", () => {
      const result = sanitizeHtml('<a href="vbscript:msgbox">x</a>',);
      assert(!result.includes("vbscript:",),);
    });

    it("remove data: em href", () => {
      const result = sanitizeHtml('<a href="data:text/plain,hello">x</a>',);
      assert(!result.includes("data:",),);
    });

    it("remove style com expression()", () => {
      const result = sanitizeHtml('<div style="expression(alert(1))">x</div>',);
      assert(!result.includes("expression",),);
    });

    it("remove style com url()", () => {
      const result = sanitizeHtml('<div style="url(javascript:bad)">x</div>',);
      assert(!result.includes("url(",),);
    });
  });

  describe("OWASP vectors (13.5.7)", () => {
    it("<img onerror=xss>", () => {
      const result = sanitizeHtml('<img src="x" onerror="alert(1)">',);
      assert(!result.includes("onerror",),);
    });

    it("<svg onload>", () => {
      const result = sanitizeHtml("<svg onload=alert(1)>",);
      assert(!result.includes("onload",),);
    });

    it("<a href=javascript:>", () => {
      const result = sanitizeHtml('<a href="JaVaScRiPt:alert(1)">x</a>',);
      assert(!result.toLowerCase().includes("javascript:",),);
    });

    it("<!-- comments -->", () => {
      const result = sanitizeHtml("a<!--comment-->b",);
      assert(!result.includes("<!--",),);
      assert(result.includes("a",),);
      assert(result.includes("b",),);
    });
  });

  describe("agregado (13.5.8)", () => {
    it('<a href="x" onclick="y">z</a> → <a href="x">z</a>', () => {
      assertEquals(
        sanitizeHtml('<a href="x" onclick="y">z</a>',),
        '<a href="x">z</a>',
      );
    });

    it("texto puro passa intacto", () => {
      assertEquals(sanitizeHtml("hello world",), "hello world",);
    });

    it("string vazia", () => {
      assertEquals(sanitizeHtml("",), "",);
    });
  });
});
