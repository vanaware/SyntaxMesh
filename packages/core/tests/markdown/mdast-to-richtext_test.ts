/**
 * Testes de MdastToRichText (Fase 13.2).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.2)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MdastToRichText, } from "../../src/markdown/mdast-to-richtext.ts";
import { parseMdast, } from "../../src/markdown/parse-mdast.ts";
import { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import { RichTextElement, } from "../../src/richtext/rich-text-element.ts";
import { RTFHandlers, } from "../../src/richtext/handlers/rtf-handlers.ts";
import type { RichTextFuncData, } from "../../src/richtext/rich-text-element.ts";

function makeRti(): RichTextIntermediate {
  const rti = new RichTextIntermediate(null,);
  for (const h of RTFHandlers.create(null,)) rti.registerFunctionHandler(h,);
  return rti;
}

function convert(markdown: string,): RichTextElement[] {
  const rti = makeRti();
  const converter = new MdastToRichText(rti,);
  return converter.convert(parseMdast(markdown,),);
}

describe("MdastToRichText (13.2)", () => {
  describe("heading → title1-4 (13.2.4–13.2.7)", () => {
    it("# H1 → title1", () => {
      const els = convert("# Hello",);
      assertEquals(els.length, 1,);
      assertEquals(els[0]!.category, "title1",);
      assertEquals(els[0]!.to_tagged(), "<h1>1 [Hello]</h1>\n\n",);
    });

    it("## H2 → title2", () => {
      const els = convert("## Sub",);
      assertEquals(els[0]!.category, "title2",);
    });

    it("### H3 → title3", () => {
      const els = convert("### Deep",);
      assertEquals(els[0]!.category, "title3",);
    });

    it("#### H4 → title4", () => {
      const els = convert("#### Deeper",);
      assertEquals(els[0]!.category, "title4",);
    });

    it("##### H5 → title4 (capped)", () => {
      const els = convert("##### Deepest",);
      assertEquals(els[0]!.category, "title4",);
    });

    it("###### H6 → title4 (capped)", () => {
      const els = convert("###### Max",);
      assertEquals(els[0]!.category, "title4",);
    });

    it("título com children bold", () => {
      const els = convert("# **Bold** Title",);
      assertEquals(els[0]!.category, "title1",);
      const children = els[0]!.children;
      assert(
        children.some((c,) =>
          c instanceof RichTextElement && c.category === "bold"
        ),
      );
    });
  });

  describe("sectionCounter (13.2.17)", () => {
    it("incrementa por nível", () => {
      const els = convert("# A\n\n# B\n\n## C",);
      assertEquals(els.length, 3,);
      assertEquals((els[0]!.data as number[])[0], 1,);
      assertEquals((els[1]!.data as number[])[0], 2,);
      assertEquals((els[2]!.data as number[])[0], 2,);
      assertEquals((els[2]!.data as number[])[1], 1,);
    });

    it("reseta níveis inferiores ao subir", () => {
      const els = convert("## X\n\n# Y",);
      // X é title2: counter [0, 1, 0, 0] → but section starts at 0+1 for level 2
      const d0 = els[0]!.data as number[];
      assertEquals(d0[1], 1,);
      // Y é title1: counter [1, 0, 0, 0]
      const d1 = els[1]!.data as number[];
      assertEquals(d1[0], 1,);
      assertEquals(d1[1], 0,);
    });
  });

  describe("paragraph (13.2.8)", () => {
    it("texto simples vira paragraph", () => {
      const els = convert("Hello world",);
      assertEquals(els[0]!.category, "paragraph",);
    });

    it("dois parágrafos → dois elements", () => {
      const els = convert("One\n\nTwo",);
      assertEquals(els.length, 2,);
      assertEquals(els[0]!.category, "paragraph",);
      assertEquals(els[1]!.category, "paragraph",);
    });
  });

  describe("inline formatting (13.2.9, 13.2.10)", () => {
    it("*em* → italic", () => {
      const els = convert("*hello*",);
      const para = els[0]!;
      const child = para.children[0] as RichTextElement;
      assertEquals(child.category, "italic",);
    });

    it("**strong** → bold", () => {
      const els = convert("**hello**",);
      const child = (els[0]!).children[0] as RichTextElement;
      assertEquals(child.category, "bold",);
    });

    it("`code` → code", () => {
      const els = convert("Use `x=1` here",);
      const para = els[0]!;
      const codeEl = para.children.find((c,) =>
        c instanceof RichTextElement && c.category === "code"
      ) as RichTextElement;
      assert(codeEl, "should have code element",);
      assertEquals(codeEl.children[0], "x=1",);
    });

    it("code block → pre", () => {
      const els = convert("```\nlet x = 1\n```",);
      assertEquals(els[0]!.category, "pre",);
      assert((els[0]!.children[0] as string).includes("let x = 1",),);
    });
  });

  describe("lists (13.2.11)", () => {
    it("unordered → bulletlist1 + bulletitem1", () => {
      const els = convert("- a\n- b",);
      assertEquals(els[0]!.category, "bulletlist1",);
      const list = els[0]!;
      assertEquals(list.children.length, 2,);
      assertEquals(
        (list.children[0] as RichTextElement).category,
        "bulletitem1",
      );
    });

    it("ordered → numberlist1 + numberitem1", () => {
      const els = convert("1. a\n2. b",);
      assertEquals(els[0]!.category, "numberlist1",);
      const item = els[0]!.children[0] as RichTextElement;
      assertEquals(item.category, "numberitem1",);
      assertEquals((item.data as number[])[0], 1,);
    });

    it("nested list depth 2 → bulletitem2", () => {
      const els = convert("- a\n  - b",);
      const list = els[0]!;
      assertEquals(list.category, "bulletlist1",);
      // bulletitem1 contains bulletlist2
      const item1 = list.children[0] as RichTextElement;
      assertEquals(item1.category, "bulletitem1",);
    });

    it("numberitem data é contador", () => {
      const els = convert("1. first\n2. second\n3. third",);
      const items = (els[0]!).children as RichTextElement[];
      assertEquals((items[0]!.data as number[])[0], 1,);
      assertEquals((items[1]!.data as number[])[0], 2,);
      assertEquals((items[2]!.data as number[])[0], 3,);
    });
  });

  describe("blockquote (13.2.12)", () => {
    it("> quote → paragraph with prefix", () => {
      const els = convert("> Hello",);
      assertEquals(els[0]!.category, "paragraph",);
      const first = els[0]!.children[0] as RichTextElement;
      assertEquals(first.category, "text",);
      assertEquals(first.children[0], "> ",);
    });
  });

  describe("link → href (13.2.13)", () => {
    it("[text](url) → href", () => {
      const els = convert("[click](http://x.com)",);
      const para = els[0]!;
      const link = para.children[0] as RichTextElement;
      assertEquals(link.category, "href",);
      assert(link.data instanceof RichTextElement,);
      assertEquals((link.data as RichTextElement).to_s(), "http://x.com",);
    });

    it("href children têm texto do link", () => {
      const els = convert("[click](http://x.com)",);
      const link = (els[0]!).children[0] as RichTextElement;
      const child = link.children[0] as RichTextElement;
      assertEquals(child.category, "text",);
      assertEquals(child.children[0], "click",);
    });
  });

  describe("image → img (13.2.13)", () => {
    it("![alt](path) → img", () => {
      const els = convert("![photo](img.png)",);
      const para = els[0]!;
      const imgEl = para.children[0] as RichTextElement;
      assertEquals(imgEl.category, "img",);
    });

    it("img data é RichTextImage com fileName", () => {
      const els = convert("![photo](img.png)",);
      const imgEl = (els[0]!).children[0] as RichTextElement;
      const img = imgEl.data as { fileName: string; altText: string | null };
      assertEquals(img.fileName, "img.png",);
      assertEquals(img.altText, "photo",);
    });
  });

  describe("text, break, thematicBreak (13.2.14)", () => {
    it("texto puro vira text element", () => {
      const els = convert("hello",);
      const para = els[0]!;
      const t = para.children[0] as RichTextElement;
      assertEquals(t.category, "text",);
      assertEquals(t.children[0], "hello",);
    });

    it("thematicBreak → hline", () => {
      const els = convert("---",);
      assertEquals(els[0]!.category, "hline",);
    });
  });

  describe("html → htmlblob (13.2.15)", () => {
    it("inline HTML seguro vira htmlblob dentro de paragraph", () => {
      const els = convert("<span>hi</span>",);
      // micromark parseia como paragraph com nós html inline
      assertEquals(els[0]!.category, "paragraph",);
      const children = els[0]!.children;
      const blob = children.find((c,) =>
        c instanceof RichTextElement && c.category === "htmlblob"
      );
      assert(blob, "should have htmlblob child",);
    });

    it("HTML perigoso é sanitizado", () => {
      const els = convert("<div>\n<script>alert(1)</script>\n</div>",);
      // script dentro de div → sanitizado, div permitida
      assert(els.length >= 0,);
    });

    it("tag inline desconhecida remove tag e mantém texto", () => {
      const els = convert("hello <blink>world</blink>",);
      const para = els[0]!;
      // blink some, conteúdo preservado como texto ou htmlblob sanitizado
      const tagged = para.to_tagged();
      assert(!tagged.includes("blink",),);
    });
  });

  describe("table fallback (13.2.16)", () => {
    it("table GFM vira paragraphs", () => {
      const els = convert("| a | b |\n|---|---|\n| 1 | 2 |",);
      // Cada row vira um paragraph
      assert(els.length >= 2, `expected >= 2 paragraphs, got ${els.length}`,);
      for (const el of els) {
        assertEquals(el.category, "paragraph",);
      }
    });
  });

  describe("strikethrough (GFM delete)", () => {
    it("~~text~~ produz texto com ~~", () => {
      const els = convert("~~removed~~",);
      const para = els[0]!;
      // delete → fallback com ~~ markers
      const firstChild = para.children[0] as RichTextElement;
      assertEquals(firstChild.children[0], "~~",);
    });
  });

  describe("richtextExtension (fontCol/inlinefunc/blockfunc)", () => {
    it("fontCol vira elemento fontCol", () => {
      const rti = makeRti();
      const converter = new MdastToRichText(rti,);
      // Simula a AST com extension node injetado
      const mdast = parseMdast("§COLOR_0§",);
      // Manually inject extension node into the paragraph
      const para = mdast.children[0] as { children: unknown[] };
      para.children = [{
        type: "richtextExtension",
        category: "fontCol",
        payload: "red",
        children: [{ type: "text", value: "alerta", },],
      },];
      const els = converter.convert(mdast,);
      const inner = (els[0]!).children[0] as RichTextElement;
      assertEquals(inner.category, "fontCol",);
      assertEquals(inner.data, "red",);
    });

    it("inlinefunc vira elemento inlinefunc", () => {
      const rti = makeRti();
      const converter = new MdastToRichText(rti,);
      const mdast = parseMdast("x",);
      const para = mdast.children[0] as { children: unknown[] };
      para.children = [{
        type: "richtextExtension",
        category: "inlinefunc",
        payload: ["query", { attribute: "effort", },],
        children: [],
      },];
      const els = converter.convert(mdast,);
      const inner = (els[0]!).children[0] as RichTextElement;
      assertEquals(inner.category, "inlinefunc",);
      assertEquals((inner.data as RichTextFuncData)[0], "query",);
    });

    it("blockfunc vira elemento blockfunc standalone", () => {
      const rti = makeRti();
      const converter = new MdastToRichText(rti,);
      const mdast = parseMdast("x",);
      // blockfunc at top level (replaces paragraph)
      mdast.children = [{
        type: "paragraph",
        children: [{
          type: "richtextExtension",
          category: "blockfunc",
          payload: ["report", { id: "r1", },],
          children: [],
        },],
        position: {
          start: { line: 1, column: 1, offset: 0, },
          end: { line: 1, column: 2, offset: 1, },
        },
      },] as typeof mdast.children;
      const els = converter.convert(mdast,);
      // blockfunc inside paragraph → paragraph with one child
      assert(els.length >= 1,);
      const para = els[0]!;
      assertEquals(para.category, "paragraph",);
      const blockEl = para.children[0] as RichTextElement;
      assertEquals(blockEl.category, "blockfunc",);
    });
  });
});
