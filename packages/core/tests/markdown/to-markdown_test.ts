/**
 * Testes de `to_markdown` em RichTextElement / RTI (Fase 13.9).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.9)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { RichTextElement, } from "../../src/richtext/rich-text-element.ts";
import { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import { RichTextImage, } from "../../src/richtext/rich-text-image.ts";
import { RTFHandlers, } from "../../src/richtext/handlers/rtf-handlers.ts";
import type { RichTextFuncData, } from "../../src/richtext/rich-text-element.ts";

function makeRti(): RichTextIntermediate {
  const rti = new RichTextIntermediate(null,);
  for (const h of RTFHandlers.create(null,)) rti.registerFunctionHandler(h,);
  return rti;
}

function el(
  category: string,
  children?: string | RichTextElement | Array<RichTextElement | string>,
  data?: unknown,
): RichTextElement {
  const rti = makeRti();
  const e = new RichTextElement(rti, category as never, children,);
  if (data !== undefined) e.data = data;
  return e;
}

describe("to_markdown (13.9)", () => {
  describe("titles (13.9.4)", () => {
    it("title1 → # text", () => {
      const e = el("title1", [el("text", "Intro",),], [1, 0, 0, 0,],);
      assertEquals(e.to_markdown(), "# Intro\n\n",);
    });

    it("title2 → ## text", () => {
      const e = el("title2", [el("text", "Sub",),], [1, 1, 0, 0,],);
      assertEquals(e.to_markdown(), "## Sub\n\n",);
    });

    it("title3 → ### text", () => {
      const e = el("title3", "Deep",);
      assertEquals(e.to_markdown(), "### Deep\n\n",);
    });

    it("title4 → #### text", () => {
      const e = el("title4", "Deeper",);
      assertEquals(e.to_markdown(), "#### Deeper\n\n",);
    });
  });

  describe("paragraph (13.9.5)", () => {
    it("paragraph → text + \\n\\n", () => {
      const e = el("paragraph", [el("text", "Hello",),],);
      assertEquals(e.to_markdown(), "Hello\n\n",);
    });

    it("paragraph vazio → \\n\\n", () => {
      const e = el("paragraph", [],);
      assertEquals(e.to_markdown(), "\n\n",);
    });
  });

  describe("inline (13.9.6, 13.9.7)", () => {
    it("italic → *text*", () => {
      const e = el("italic", [el("text", "hi",),],);
      assertEquals(e.to_markdown(), "*hi*",);
    });

    it("bold → **text**", () => {
      const e = el("bold", [el("text", "hi",),],);
      assertEquals(e.to_markdown(), "**hi**",);
    });

    it("code → `text`", () => {
      const e = el("code", "x=1",);
      assertEquals(e.to_markdown(), "`x=1`",);
    });

    it("pre → ``` block ```", () => {
      const e = el("pre", "let a = 1",);
      assertEquals(e.to_markdown(), "```\nlet a = 1\n```\n\n",);
    });
  });

  describe("lists (13.9.8, 13.9.9)", () => {
    it("bulletitem1 → - text", () => {
      const e = el("bulletitem1", [el("text", "one",),],);
      assertEquals(e.to_markdown(), "- one\n",);
    });

    it("bulletitem2 → indented - text", () => {
      const e = el("bulletitem2", [el("text", "two",),],);
      assertEquals(e.to_markdown(), "  - two\n",);
    });

    it("numberitem1 → 1. text", () => {
      const e = el("numberitem1", [el("text", "first",),], [1,],);
      assertEquals(e.to_markdown(), "1. first\n",);
    });

    it("numberitem2 → indented number", () => {
      const e = el("numberitem2", [el("text", "sub",),], [1, 2,],);
      assertEquals(e.to_markdown(), "  2. sub\n",);
    });
  });

  describe("links, images, refs (13.9.10)", () => {
    it("href → [text](url)", () => {
      const rti = makeRti();
      const href = new RichTextElement(rti, "href", [
        new RichTextElement(rti, "text", "click",),
      ],);
      href.data = new RichTextElement(rti, "richtext", [
        new RichTextElement(rti, "text", "http://x.com",),
      ],);
      assertEquals(href.to_markdown(), "[click](http://x.com)",);
    });

    it("img → ![alt](file)", () => {
      const img = new RichTextImage("photo.png",);
      img.altText = "My photo";
      const e = el("img", undefined, img,);
      assertEquals(e.to_markdown(), "![My photo](photo.png)",);
    });

    it("ref → [[name]]", () => {
      const e = el("ref", undefined, "snippet1",);
      assertEquals(e.to_markdown(), "[[snippet1]]",);
    });
  });

  describe("hline (13.9.11)", () => {
    it("hline → ---", () => {
      const e = el("hline",);
      assertEquals(e.to_markdown(), "---\n\n",);
    });
  });

  describe("fontCol (13.9.12)", () => {
    it("fontCol → <fcol:color>text</fcol>", () => {
      const e = el("fontCol", [el("text", "red text",),], "red",);
      assertEquals(e.to_markdown(), "<fcol:red>red text</fcol>",);
    });
  });

  describe("functions (13.9.13)", () => {
    it("inlinefunc → [[name:args]]", () => {
      const data: RichTextFuncData = ["query", { attribute: "effort", },];
      const e = el("inlinefunc", undefined, data,);
      assertEquals(e.to_markdown(), "[[query:attribute=effort]]",);
    });

    it("blockfunc → [[name:args]] with newlines", () => {
      const data: RichTextFuncData = ["report", { id: "r1", },];
      const e = el("blockfunc", undefined, data,);
      assertEquals(e.to_markdown(), "[[report:id=r1]]\n\n",);
    });

    it("func args com espaço usa aspas", () => {
      const data: RichTextFuncData = ["query", { attribute: "effort total", },];
      const e = el("inlinefunc", undefined, data,);
      assertEquals(e.to_markdown(), '[[query:attribute="effort total"]]',);
    });
  });

  describe("text/htmlblob (13.9.14)", () => {
    it("text → raw string", () => {
      const e = el("text", "plain",);
      assertEquals(e.to_markdown(), "plain",);
    });

    it("htmlblob → raw HTML", () => {
      const e = el("htmlblob", "<span>x</span>",);
      assertEquals(e.to_markdown(), "<span>x</span>",);
    });
  });

  describe("RTI delegation (13.9.1, 13.9.2)", () => {
    it("RTI to_markdown com tree null → ''", () => {
      const rti = makeRti();
      assertEquals(rti.to_markdown(), "",);
    });

    it("RTI to_markdown delega para tree.to_markdown", () => {
      const rti = makeRti();
      rti.tree = new RichTextElement(rti, "richtext", [
        new RichTextElement(rti, "paragraph", [
          new RichTextElement(rti, "text", "Hello",),
        ],),
      ],);
      assertEquals(rti.to_markdown(), "Hello\n\n",);
    });
  });
});
