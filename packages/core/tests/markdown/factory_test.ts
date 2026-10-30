/**
 * Testes do MarkdownFactory (Fase 13.3).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.3)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MarkdownFactory, } from "../../src/markdown/factory.ts";
import { parseMdast, } from "../../src/markdown/parse-mdast.ts";
import { RichTextElement, } from "../../src/richtext/rich-text-element.ts";

describe("MarkdownFactory (13.3)", () => {
  const factory = new MarkdownFactory(null,);

  describe("create (13.3.3)", () => {
    it("texto simples → RTI com árvore paragraph", () => {
      const rti = factory.create("Hello world",);
      assert(rti.tree, "should have tree",);
      assertEquals(rti.tree!.category, "richtext",);
      assertEquals(rti.tree!.children.length, 1,);
      const para = rti.tree!.children[0] as RichTextElement;
      assertEquals(para.category, "paragraph",);
    });

    it("título → title1 com contador", () => {
      const rti = factory.create("# Introduction",);
      const title = rti.tree!.children[0] as RichTextElement;
      assertEquals(title.category, "title1",);
      assert(Array.isArray(title.data,), "data should be section counter",);
    });

    it("texto com extensão color → fontCol", () => {
      const rti = factory.create("<fcol:red>caution</fcol>",);
      const para = rti.tree!.children[0] as RichTextElement;
      const fontCol = para.children.find((c,) =>
        c instanceof RichTextElement && c.category === "fontCol"
      ) as RichTextElement;
      assert(fontCol, "should have fontCol",);
      assertEquals(fontCol.data, "red",);
    });

    it("texto com função → inlinefunc", () => {
      const rti = factory.create("[[query:attribute=effort]]",);
      const para = rti.tree!.children[0] as RichTextElement;
      const func = para.children.find((c,) =>
        c instanceof RichTextElement && c.category === "inlinefunc"
      ) as RichTextElement;
      assert(func, "should have inlinefunc",);
    });
  });

  describe("RTFHandlers registered (13.3.4)", () => {
    it("RTI tem handler de query", () => {
      const rti = factory.create("x",);
      assert(rti.functionHandler("query",), "query handler should exist",);
    });

    it("RTI tem handlers de report e navigator", () => {
      const rti = factory.create("x",);
      assert(rti.functionHandler("report",),);
      assert(rti.functionHandler("navigator",),);
    });
  });

  describe("createFromMdast (13.3.5)", () => {
    it("aceita mdast pré-parseada", () => {
      const mdast = parseMdast("## Hello",);
      const rti = factory.createFromMdast(mdast,);
      const title = rti.tree!.children[0] as RichTextElement;
      assertEquals(title.category, "title2",);
    });

    it("RTI resultante funciona com to_s", () => {
      const mdast = parseMdast("plain text",);
      const rti = factory.createFromMdast(mdast,);
      const str = rti.to_s();
      assert(str.includes("plain text",),);
    });
  });

  describe("to_s / to_tagged consistency", () => {
    it("to_s com texto simples", () => {
      const rti = factory.create("Hello world",);
      assertEquals(rti.to_s(), "Hello world",);
    });

    it("to_tagged mostra estrutura", () => {
      const rti = factory.create("# Title\n\nPara",);
      const tagged = rti.to_tagged();
      assert(tagged.includes("<h1>",),);
      assert(tagged.includes("<p>",),);
    });
  });

  describe("constructor (13.3.2)", () => {
    it("aceita project null", () => {
      const f = new MarkdownFactory(null,);
      const rti = f.create("test",);
      assert(rti.tree,);
    });

    it("aceita project null + sfi null", () => {
      const f = new MarkdownFactory(null, null,);
      const rti = f.create("test",);
      assert(rti.tree,);
    });
  });
});
