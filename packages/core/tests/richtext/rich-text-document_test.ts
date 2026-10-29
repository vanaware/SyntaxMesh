/**
 * Testes de `RichTextDocument` (Fase 12.10).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Document.rb
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import type { RichTextSnip, } from "../../src/richtext/rich-text-snip.ts";
import type { RichTextFunctionHandler, } from "../../src/richtext/handlers/function-handler.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { TestRichTextDocument, } from "../fixtures/test-richtext-document.ts";

/** Accessor do `crossReference` privado (privado só em tempo de compilação). */
function crossReference(doc: TestRichTextDocument,): void {
  (doc as unknown as { crossReference(): void }).crossReference();
}

/** Accessor da página de índice privada. */
function tocPage(doc: TestRichTextDocument,): string {
  return (doc as unknown as { generateHTMLTableOfContents(): string })
    .generateHTMLTableOfContents();
}

/** Accessor do `linkTarget` interno do snip (via RTI privado). */
function snipLinkTarget(snip: RichTextSnip,): unknown {
  return (snip as unknown as { richText: { linkTarget: unknown } }).richText
    .linkTarget;
}

function fakeHandler(name: string,): RichTextFunctionHandler {
  return {
    function: name,
    blockFunction: false,
    dup() {
      return this;
    },
  } as unknown as RichTextFunctionHandler;
}

describe("RichTextDocument (12.10)", () => {
  let doc: TestRichTextDocument;

  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
    doc = new TestRichTextDocument();
  },);

  describe("registerFunctionHandler (12.10.3)", () => {
    it("anexa o handler, na ordem, sem duplicar (Ruby <<)", () => {
      const h1 = fakeHandler("a",);
      const h2 = fakeHandler("b",);
      doc.registerFunctionHandler(h1,);
      doc.registerFunctionHandler(h2,);
      assertEquals(doc.functionHandlers.length, 2,);
      assertEquals(
        doc.functionHandlers[0] === h1,
        true,
        "sem dup no documento",
      );
      assertEquals(doc.functionHandlers[1] === h2, true,);
    });

    it("handlers do documento chegam aos snips", () => {
      doc.registerFunctionHandler(fakeHandler("a",),);
      const snip = doc.addSnip("s.txt", "x\n\n",);
      assertEquals(snip !== undefined, true,);
      // O RTI do snip recebeu o handler (registro via dup no RTI).
      const rt = (snip as unknown as {
        richText: { functionHandlers: Map<string, unknown> };
      }).richText;
      assertEquals(rt.functionHandlers.has("a",), true,);
    });
  });

  describe("addSnip (12.10.4)", () => {
    it("cria o snip, armazena e retorna", () => {
      const snip = doc.addSnip("dir/intro.txt", "ola\n\n",);
      assertEquals(snip.name, "intro.txt",);
      assertEquals(doc.snippets.length, 1,);
      assertEquals(doc.snippets[0] === snip, true,);
    });

    it("propaga o linkTarget corrente do documento", () => {
      doc.linkTarget = "_top";
      const snip = doc.addSnip("s.txt", "x\n\n",);
      assertEquals(snipLinkTarget(snip,), "_top",);
    });

    it("compartilha o sectionCounter entre snips (numeração contínua)", () => {
      doc.addSnip("a.txt", "== Um ==\n\n",);
      assertEquals(doc.sectionCounter, [1, 0, 0,],);
      doc.addSnip("b.txt", "== Dois ==\n\n",);
      assertEquals(doc.sectionCounter, [2, 0, 0,],);
    });

    it("gera HTML encadeia prev/next dos snips (dirty)", () => {
      const a = doc.addSnip("a.txt", "x\n\n",);
      const b = doc.addSnip("b.txt", "y\n\n",);
      assertEquals(a.prevSnip, null, "addSnip não encadeia diretamente",);
      const out = doc.generateHTML();
      assertEquals(b.prevSnip === a, true,);
      assertEquals(a.nextSnip === b, true,);
      assertEquals(Object.keys(out,), [
        "toc.html",
        "a.txt.html",
        "b.txt.html",
      ],);
    });
  });

  describe("tableOfContents (12.10.5)", () => {
    it("agrega entradas e âncoras 'arquivo#tag' dos snips", () => {
      doc.addSnip("a.txt", "== Alpha ==\n\n",);
      doc.addSnip("b.txt", "== Beta ==\n\n",);
      doc.tableOfContents();
      const entries = [...(doc.toc ?? []),];
      assertEquals(entries.length, 2,);
      assertEquals(entries[0]!.file, "a.txt",);
      assertEquals(entries[1]!.title, "Beta",);
      assertEquals(doc.anchors, [
        "a.txt",
        "b.txt",
        "a.txt#Alpha",
        "b.txt#Beta",
      ],);
    });

    it("coleta referências internas só quando não vazias", () => {
      doc.addSnip("a.txt", "veja [[b.txt]] aqui\n\n",);
      doc.addSnip("b.txt", "sem refs\n\n",);
      doc.tableOfContents();
      assertEquals(doc.references, { "a.txt": ["b.txt",], },);
    });

    it("reexecução reset âncoras e referências", () => {
      doc.addSnip("a.txt", "== A ==\n\n",);
      doc.tableOfContents();
      assertEquals(doc.anchors.length, 2,);
      doc.tableOfContents();
      assertEquals(doc.anchors.length, 2, "sem acumular duplicatas",);
    });
  });

  describe("checkInternalReferences (12.10.6)", () => {
    it("referência conhecida (nome de snip) não gera aviso", () => {
      doc.addSnip("a.txt", "veja [[b.txt]] aqui\n\n",);
      doc.addSnip("b.txt", "x\n\n",);
      doc.tableOfContents();
      doc.checkInternalReferences();
      assertEquals(
        MessageHandlerInstance.instance.messages.some((m,) =>
          m.id === "rt_doc_unknown_reference"
        ),
        false,
      );
    });

    it("referência desconhecida gera aviso com snip e alvo", () => {
      doc.addSnip("a.txt", "veja [[zeta]] aqui\n\n",);
      doc.tableOfContents();
      doc.checkInternalReferences();
      const msg = MessageHandlerInstance.instance.messages.find((m,) =>
        m.id === "rt_doc_unknown_reference"
      );
      assert(msg !== undefined,);
      assert(msg!.message.includes("a.txt",), msg!.message,);
      assert(msg!.message.includes("zeta",), msg!.message,);
    });

    it("âncora 'arquivo#tag' de título é aceita", () => {
      doc.addSnip("a.txt", "veja [[b.txt#Beta]] aqui\n\n",);
      doc.addSnip("b.txt", "== Beta ==\n\n",);
      doc.tableOfContents();
      doc.checkInternalReferences();
      assertEquals(
        MessageHandlerInstance.instance.messages.some((m,) =>
          m.id === "rt_doc_unknown_reference"
        ),
        false,
      );
    });
  });

  describe("generateHTML (12.10.7)", () => {
    it("inclui toc.html com cover, TOC e footer", () => {
      doc.addSnip("a.txt", "== Alpha ==\n\n",);
      doc.tableOfContents();
      const out = doc.generateHTML();
      const toc = out["toc.html"] ?? "";
      assert(toc.startsWith("<!DOCTYPE html>",), toc,);
      assert(toc.includes("<title>Index</title>",), toc,);
      assert(toc.includes("COVER_MARKER",), toc,);
      assert(toc.includes("FOOTER_MARKER",), toc,);
      assert(toc.includes("Alpha",), "TOC agregada deve aparecer no índice",);
    });

    it("um arquivo por snip + toc.html, com prefixo de diretório", () => {
      doc.addSnip("a.txt", "x\n\n",);
      doc.addSnip("b.txt", "y\n\n",);
      const out = doc.generateHTML("out/",);
      assertEquals(
        Object.keys(out,),
        ["out/toc.html", "out/a.txt.html", "out/b.txt.html",],
      );
    });

    it("sem snips: apenas toc.html (índice vazio)", () => {
      const out = doc.generateHTML();
      assertEquals(Object.keys(out,), ["toc.html",],);
      assert((out["toc.html"] ?? "").includes("COVER_MARKER",),);
    });
  });

  describe("crossReference (12.10.8)", () => {
    it("encadeia e limpa dirty; segunda chamada é no-op", () => {
      const a = doc.addSnip("a.txt", "x\n\n",);
      crossReference(doc,);
      assertEquals(a.prevSnip, null,);
      const b = doc.addSnip("b.txt", "y\n\n",);
      crossReference(doc,);
      assertEquals(b.prevSnip === a, true,);
      assertEquals(a.nextSnip === b, true,);
      // Sem novos snips, a cadeia não muda (no-op).
      crossReference(doc,);
      assertEquals(b.prevSnip === a, true,);
    });

    it("snip único não ganha prev/next", () => {
      const a = doc.addSnip("a.txt", "x\n\n",);
      crossReference(doc,);
      assertEquals(a.prevSnip, null,);
      assertEquals(a.nextSnip, null,);
    });
  });

  describe("generateHTMLTableOfContents (12.10.9)", () => {
    it("monta head 'Index' + cover + toc + br/hr/br + footer", () => {
      doc.addSnip("a.txt", "== Alpha ==\n\n",);
      doc.tableOfContents();
      const html = tocPage(doc,);
      assert(html.includes("<title>Index</title>",), html,);
      assert(html.includes("COVER_MARKER",), html,);
      assert(html.includes("<br />",), html,);
      assert(html.includes("<hr />",), html,);
      assert(html.includes("FOOTER_MARKER",), html,);
      assert(html.includes('href="a.txt.html#Alpha"',), html,);
    });

    it("funciona sem tableOfContents (toc nula não quebra)", () => {
      const html = tocPage(doc,);
      assert(html.includes("<title>Index</title>",), html,);
      assert(html.includes("COVER_MARKER",), html,);
    });
  });
});
