/**
 * Testes de `RichTextSnip` (Fase 12.9).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Snip.rb
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { RichTextSnip, } from "../../src/richtext/rich-text-snip.ts";
import type { RichTextDocument, } from "../../src/richtext/rich-text-document.ts";
import type { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import { TableOfContents, } from "../../src/richtext/table-of-contents.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { TestRichTextDocument, } from "../fixtures/test-richtext-document.ts";

describe("RichTextSnip (12.9)", () => {
  let doc: TestRichTextDocument;

  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
    doc = new TestRichTextDocument();
  },);

  describe("constructor (12.9.3)", () => {
    it("remove diretórios do nome (Ruby rindex('/'))", () => {
      const snip = new RichTextSnip(
        doc,
        "docs/manual/intro.txt",
        [0, 0, 0,],
        "oi\n\n",
      );
      assertEquals(snip.name, "intro.txt",);
    });

    it("sem diretório mantém o nome", () => {
      const snip = new RichTextSnip(doc, "intro.txt", [0, 0, 0,], "oi\n\n",);
      assertEquals(snip.name, "intro.txt",);
      assertEquals(snip.prevSnip, null,);
      assertEquals(snip.nextSnip, null,);
    });

    it("monta RichTextIntermediate a partir do texto injetado", () => {
      const snip = new RichTextSnip(doc, "a.txt", [0, 0, 0,], "ola mundo\n\n",);
      const rt =
        (snip as unknown as { richText: RichTextIntermediate }).richText;
      assertEquals(rt.to_s(), "ola mundo",);
    });

    it("sectionCounter compartilhado avança entre snips (snip2 continua snip1)", () => {
      const counter = [0, 0, 0,];
      new RichTextSnip(doc, "a.txt", counter, "== Um ==\n\n",);
      assertEquals(counter, [1, 0, 0,], "parser deve avançar o contador",);
      const snip2 = new RichTextSnip(doc, "b.txt", counter, "== Dois ==\n\n",);
      const rt =
        (snip2 as unknown as { richText: RichTextIntermediate }).richText;
      assert(
        rt.to_html()!.toHTML().includes("2 Dois",),
        rt.to_html()!.toHTML(),
      );
    });

    it("lança erro quando a geração do formato intermediário falha", () => {
      // No Ruby o caminho de falha era `exit`; no navegador, Error.
      // Documento sabotado: acesso a functionHandlers estoura (o constructor
      // lê os handlers antes de gerar o RTI).
      assertThrows(
        () => {
          const bad = {
            get functionHandlers(): never {
              throw new Error("no handlers",);
            },
          } as unknown as RichTextDocument;
          new RichTextSnip(bad, "x.txt", [0, 0, 0,], "texto\n\n",);
        },
        Error,
        "no handlers",
      );
    });
  });

  describe("linkTarget (12.9.4)", () => {
    it("setLinkTarget delega ao RTI", () => {
      const snip = new RichTextSnip(doc, "a.txt", [0, 0, 0,], "x\n\n",);
      snip.setLinkTarget("_blank",);
      const rt =
        (snip as unknown as { richText: RichTextIntermediate }).richText;
      assertEquals(rt.linkTarget, "_blank",);
    });

    it("propaga para o HTML: href externo ganha target=", () => {
      const snip = new RichTextSnip(
        doc,
        "a.txt",
        [0, 0, 0,],
        "[http://exemplo.com Exemplo]\n\n",
      );
      snip.setLinkTarget("_blank",);
      const rt =
        (snip as unknown as { richText: RichTextIntermediate }).richText;
      const html = rt.to_html()!.toHTML();
      assert(html.includes('target="_blank"',), html,);
    });
  });

  describe("cssClass (12.9.5)", () => {
    it("setCssClass delega ao RTI", () => {
      const snip = new RichTextSnip(doc, "a.txt", [0, 0, 0,], "x\n\n",);
      snip.setCssClass("myclass",);
      const rt =
        (snip as unknown as { richText: RichTextIntermediate }).richText;
      assertEquals(rt.cssClass, "myclass",);
    });

    it("permite sobrescrever para null", () => {
      const snip = new RichTextSnip(doc, "a.txt", [0, 0, 0,], "x\n\n",);
      snip.setCssClass("myclass",);
      snip.setCssClass(null,);
      const rt =
        (snip as unknown as { richText: RichTextIntermediate }).richText;
      assertEquals(rt.cssClass, null,);
    });
  });

  describe("tableOfContents (12.9.6)", () => {
    it("coleta títulos com número, arquivo e tag", () => {
      const snip = new RichTextSnip(
        doc,
        "a.txt",
        [0, 0, 0,],
        "== Capítulo ==\n\n=== Seção ===\n\n",
      );
      const toc = new TableOfContents();
      snip.tableOfContents(toc, snip.name,);
      const entries = [...toc,];
      assertEquals(entries.length, 2,);
      assertEquals(entries[0]!.number, "1 ",);
      assertEquals(entries[0]!.title, "Capítulo",);
      assertEquals(entries[0]!.file, "a.txt",);
      assertEquals(entries[0]!.tag, "Captulo",);
      assertEquals(entries[1]!.number, "1.1 ",);
    });

    it("sem títulos deixa a toc vazia", () => {
      const snip = new RichTextSnip(
        doc,
        "a.txt",
        [0, 0, 0,],
        "apenas texto\n\n",
      );
      const toc = new TableOfContents();
      snip.tableOfContents(toc, snip.name,);
      assertEquals([...toc,].length, 0,);
    });
  });

  describe("internalReferences (12.9.7)", () => {
    it("retorna alvos de [[...]] internos, deduplicados", () => {
      const snip = new RichTextSnip(
        doc,
        "a.txt",
        [0, 0, 0,],
        "veja [[Alpha]] e [[Alpha]] e [[Beta]]\n\n",
      );
      assertEquals(snip.internalReferences(), ["Alpha", "Beta",],);
    });

    it("ignora referências externas (com ':')", () => {
      const snip = new RichTextSnip(
        doc,
        "a.txt",
        [0, 0, 0,],
        "veja [http://x.com link] e [[Gamma]]\n\n",
      );
      assertEquals(snip.internalReferences(), ["Gamma",],);
    });
  });

  describe("generateHTML (12.9.8)", () => {
    it("estrutura completa: doctype, head+title+stylesheet, body+markers, div 90%", () => {
      const snip = new RichTextSnip(doc, "a.txt", [0, 0, 0,], "conteudo\n\n",);
      const html = snip.generateHTML();
      assert(html.startsWith("<!DOCTYPE html>",), html,);
      assert(html.includes("<title>a.txt</title>",), html,);
      assert(html.includes("STYLESHEET_MARKER",), html,);
      assert(html.includes("HEADER_MARKER",), html,);
      assert(html.includes("FOOTER_MARKER",), html,);
      assert(html.includes("NAV_MARKER",), html,);
      assert(
        html.includes('style="width:90%; margin-left:5%; margin-right:5%"',),
        html,
      );
      assert(html.includes("conteudo",), html,);
    });

    it("sem encadeamento: navbar recebe prev/next nulos", () => {
      const snip = new RichTextSnip(doc, "a.txt", [0, 0, 0,], "x\n\n",);
      snip.generateHTML();
      assertEquals(doc.lastNav, {
        prevName: null,
        prevFile: null,
        nextName: null,
        nextFile: null,
      },);
    });

    it("com prev/next encadeados: navbar recebe nomes e arquivos .html", () => {
      const a = new RichTextSnip(doc, "a.txt", [0, 0, 0,], "x\n\n",);
      const b = new RichTextSnip(doc, "b.txt", [0, 0, 0,], "y\n\n",);
      a.nextSnip = b;
      b.prevSnip = a;
      b.generateHTML();
      assertEquals(doc.lastNav, {
        prevName: "a.txt",
        prevFile: "a.txt.html",
        nextName: null,
        nextFile: null,
      },);
    });
  });
});
