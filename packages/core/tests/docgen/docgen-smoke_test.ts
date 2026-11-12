/**
 * Smoke da subfase 22.1b (I 7.9): monta `SyntaxReference` + `UserManual` e
 * exige os limiares de completude do doc-core.
 *
 * ⚠️ ADAPTAÇÃO: o enunciado original pedia ≥ 200 keywords e ≥ 250 páginas —
 * números derivados da gramática Ruby completa (266 keywords, oracle
 * `syntax-reference.rb`). A gramática portada é um **subset reescrito**
 * (170 keywords hoje — mesma adaptação registrada em D 2.15), então os
 * limiares acompanham o subset: ≥ 150 keywords documentadas e ≥ 180 páginas
 * no mapa HTML, com folga sobre o estado atual (170/184) para absorver
 * pequenas variações sem falso-verde. A integridade estrutural (uma página
 * por keyword, capítulos, especiais, nenhuma página vazia) é exigida em
 * qualquer cenário.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco I 7.9
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { SyntaxReference, } from "../../src/docgen/syntax-reference.ts";
import { UserManual, } from "../../src/docgen/user-manual.ts";
import { MANUAL_CHAPTER_NAMES, } from "../../src/docgen/manual/chapters.ts";
import { MANUAL_STYLESHEET_NAME, } from "../../src/docgen/manual/manual-css.ts";

/** Páginas especiais do mapa (fora capítulos e keywords). */
const SPECIAL_PAGES = [
  "index.html",
  "toc.html",
  "navbar.html",
  "alphabet.html",
];

describe("docgen smoke (I 7.9)", () => {
  it("SyntaxReference: ≥ 150 keywords documentadas, sem duplicatas", () => {
    const reference = new SyntaxReference(null, false,);
    const keywords = reference.all();
    assert(keywords.length >= 150, `só ${keywords.length} keywords`,);
    // Sem duplicatas e toda keyword tem documentação com conteúdo.
    assertEquals(new Set(keywords,).size, keywords.length,);
    for (const keyword of keywords) {
      const documentation = reference.keywords.get(keyword,);
      assert(documentation !== undefined, keyword,);
      assert(documentation!.toText(false,).length > 0, keyword,);
    }
    // O filtro ignoreOld remove pelo menos uma keyword (subset atual: 6).
    const trimmed = new SyntaxReference(null, true,).all();
    assert(trimmed.length < keywords.length,);
    assert(trimmed.every((k,) => keywords.includes(k,)),);
  });

  it("UserManual: ≥ 180 páginas no mapa HTML, uma por keyword, sem vazias", () => {
    const manual = new UserManual();
    const pages = manual.generate();
    const names = Object.keys(pages,);
    assert(names.length >= 180, `só ${names.length} páginas`,);
    // Uma página HTML por keyword da referência + capítulos + especiais.
    const keywords = manual.reference.all();
    for (const keyword of keywords) {
      assert(`${keyword}.html` in pages, keyword,);
    }
    for (const chapter of MANUAL_CHAPTER_NAMES) {
      assert(`${chapter}.html` in pages, chapter,);
    }
    for (const special of SPECIAL_PAGES) assert(special in pages, special,);
    assert(MANUAL_STYLESHEET_NAME in pages,);
    assertEquals(
      names.length,
      keywords.length + MANUAL_CHAPTER_NAMES.length + SPECIAL_PAGES.length + 1,
    );
    // Nenhuma página vazia; as de keyword são HTML de verdade.
    for (const name of names) assert(pages[name]!.trim().length > 0, name,);
    assert(pages["task.html"]!.includes("<html",),);
    assert(pages["index.html"]!.includes("frameset",),);
    // A TOC projetada (G 5.13) cobre o mesmo universo de keywords.
    const toc = manual.getManualToc();
    for (const keyword of keywords) {
      assert(toc.some((e,) => e.id === keyword), keyword,);
    }
  });
});
