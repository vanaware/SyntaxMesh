/**
 * Unitários do canonicalizador de HTML (24.7.7).
 *
 * O golden da CLI compara o HTML do relatório por árvore canônica: se o
 * canonicalizador mentir (deixar passar diferença real ou apagar diferença
 * legítima), o golden passa a não valer nada. Por isso ele tem testes próprios,
 * desligados do `tj3`.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.7.7)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import {
  canonicalDom,
  firstDifference,
  stabilizeHtml,
} from "./canonical-dom.ts";

/** Documento mínimo com `<body>` — o envelope sai da comparação. */
function doc(body: string,): string {
  return `<!DOCTYPE html>\n<html>\n <head>\n  <title>x</title>\n </head>\n` +
    ` <link href="css/tjreport.css" rel="stylesheet"></link>\n` +
    ` <body>${body}</body>\n</html>\n`;
}

describe("canonical_dom — stabilizeHtml", () => {
  it("troca id de tooltip por ID<n> e o carimbo por <TS>", () => {
    const html = `<div id="ID29120" onclick="TagToTip('ID29120')">` +
      `Project: P Version: 1.0 - Created on 2026-11-08 12:01:34 with SyntaxMesh` +
      `</div>`;
    assertEquals(
      stabilizeHtml(html,),
      `<div id="ID<n>" onclick="TagToTip('ID<n>')">` +
        `Project: P Version: 1.0 - <TS></div>`,
    );
  });

  it("é idempotente: o golden já vem estabilizado do Ruby", () => {
    const once = stabilizeHtml(
      `<div id="ID7">a - Created on 2026-11-08 12:01:34</div>`,
    );
    assertEquals(stabilizeHtml(once,), once,);
    assertEquals(once.includes("ID<n>",), true,);
    assertEquals(once.includes("<TS>",), true,);
  });
});

describe("canonical_dom — canonicalDom", () => {
  it("descarta envelope, comentário e script; mantém a árvore do body", () => {
    assertEquals(
      canonicalDom(doc(
        `<!-- Dynamic Report ID: 0 --><script src="s.js"></script>` +
          `<div class="tj_page">ok</div>`,
      ),),
      [`<div class="tj_page">`, "ok", "</div>",],
    );
  });

  it("ordena atributos e colapsa o espaço dos nós de texto", () => {
    assertEquals(
      canonicalDom(doc(
        `<td style="a; " class="c">\n   Design\n</td>`,
      ),),
      [`<td class="c" style="a; ">`, "Design", "</td>",],
    );
  });

  it("preserva diferença de conteúdo (o golden tem de falhar quando muda)", () => {
    assertEquals(
      canonicalDom(doc(`<td>Design</td>`,),),
      ["<td>", "Design", "</td>",],
    );
    assertEquals(
      canonicalDom(doc(`<td>Build</td>`,),),
      ["<td>", "Build", "</td>",],
    );
  });

  it("não confunde atributo com tag: valor com '>' entre aspas", () => {
    assertEquals(
      canonicalDom(doc(`<td onclick="Tip('ID3', TITLE, 'A>B')">x</td>`,),),
      [`<td onclick="Tip('ID<n>', TITLE, 'A>B')">`, "x", "</td>",],
    );
  });

  it("recusa documento sem <body>", () => {
    assertThrows(
      () => canonicalDom("<html><head></head></html>",),
      TypeError,
      "documento sem <body>",
    );
  });
});

describe("canonical_dom — firstDifference", () => {
  it("aponta a linha e os dois lados", () => {
    assertEquals(firstDifference(["a", "b",], ["a", "b",],), "identical",);
    assertEquals(
      firstDifference(["a", "b",], ["a", "c",],),
      "line 2:\n  tj3:  b\n  port: c",
    );
    assertEquals(
      firstDifference(["a", "b",], ["a",],),
      "line 2:\n  tj3:  b\n  port: <missing>",
    );
  });
});
