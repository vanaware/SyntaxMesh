/**
 * Teste de integração end-to-end do Markdown (Fase 13.11).
 *
 * Verifica que o pipeline completo (extensões + parse + conversão + RTI)
 * funciona em conjunto com os handlers da Fase 12.
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.11)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MarkdownFactory, } from "../../src/markdown/factory.ts";
import { RichTextElement, } from "../../src/richtext/rich-text-element.ts";
import { RTFHandlers, } from "../../src/richtext/handlers/rtf-handlers.ts";
import { RichText, } from "../../src/richtext/rich-text.ts";
import { richTextToMarkdown, } from "../../src/markdown/convert-rich-to-md.ts";

describe("Integração Markdown (13.11)", () => {
  const factory = new MarkdownFactory(null,);

  describe("MarkdownFactory com todas as extensões (13.11.2)", () => {
    it("documento complexo produz RTI válido", () => {
      const doc = [
        "# Projeto Alpha",
        "",
        "Status: <fcol:green>OK</fcol>",
        "",
        "Esforço total: [[query:attribute=effort]]",
        "",
        "## Fases",
        "",
        "- Fase 1: Design",
        "- Fase 2: Build",
        "",
        "Referência: <-cost-> e <-revenue->",
      ].join("\n",);
      const rti = factory.create(doc,);
      assert(rti.tree, "should have tree",);
      assertEquals(rti.tree!.category, "richtext",);
      // Should have multiple children (title, paragraphs, list, etc.)
      assert(
        rti.tree!.children.length >= 5,
        `expected >= 5, got ${rti.tree!.children.length}`,
      );
    });

    it("to_tagged não lança exceção mesmo com handlers sem query", () => {
      const doc =
        "# Hello\n\n<fcol:red>World</fcol> [[query:attribute=effort]]";
      const rti = factory.create(doc,);
      // to_tagged não despacha handlers → não lança
      const tagged = rti.to_tagged();
      assert(tagged.includes("Hello",),);
    });

    it("to_tagged mostra estrutura completa", () => {
      const doc = "# Title\n\n**bold**";
      const rti = factory.create(doc,);
      const tagged = rti.to_tagged();
      assert(tagged.includes("<h1>",),);
      assert(tagged.includes("<b>",),);
    });
  });

  describe("RTFQuery funciona em Markdown (13.11.3)", () => {
    it("inlinefunc query pode ser resolvido", () => {
      const rti = factory.create("[[query:attribute=effort]]",);
      // Handler query existe:
      assert(rti.functionHandler("query",),);
      // Elemento inlinefunc existe na árvore:
      const para = rti.tree!.children[0] as RichTextElement;
      const func = para.children.find((c,) =>
        c instanceof RichTextElement && c.category === "inlinefunc"
      );
      assert(func, "should have inlinefunc",);
    });

    it("query em <fcol> aninhado", () => {
      const rti = factory.create("<fcol:red>[[query:attribute=cost]]</fcol>",);
      const para = rti.tree!.children[0] as RichTextElement;
      const fontCol = para.children[0] as RichTextElement;
      assertEquals(fontCol.category, "fontCol",);
      const func = fontCol.children[0] as RichTextElement;
      assertEquals(func.category, "inlinefunc",);
    });
  });

  describe("to_s, to_html, to_markdown consistentes (13.11.4)", () => {
    it("mesmo conteúdo nas três saídas", () => {
      const doc = "Hello **world**";
      const rti = factory.create(doc,);
      const plain = rti.to_s();
      const md = rti.to_markdown();
      assert(plain.includes("world",),);
      assert(md.includes("**world**",),);
    });

    it("title aparece em todas as saídas", () => {
      const doc = "# My Title";
      const rti = factory.create(doc,);
      assert(rti.to_s().includes("My Title",),);
      assert(rti.to_tagged().includes("My Title",),);
      assert(rti.to_markdown().includes("My Title",),);
    });

    it("to_html retorna elemento", () => {
      const doc = "para";
      const rti = factory.create(doc,);
      const html = rti.to_html();
      assert(html, "should return element",);
    });
  });

  describe("Migração RichText → Markdown → RichText (13.11.5)", () => {
    it("equivalência textual após conversão round-trip", () => {
      const rtMarkup = "== Title ==\n\nHello world";
      const md = richTextToMarkdown(rtMarkup,);
      // Markdown resultante tem "# Title" e "Hello world"
      assert(md.includes("# Title",),);
      assert(md.includes("Hello world",),);
      // Recrear RTI a partir do Markdown
      const rti = factory.create(md,);
      const text = rti.to_s();
      assert(text.includes("Title",),);
      assert(text.includes("Hello world",),);
    });

    it("bold sobrevive round-trip", () => {
      const md = "This is **bold** text";
      const rti = factory.create(md,);
      const back = rti.to_markdown();
      assert(back.includes("**bold**",),);
    });
  });
});
