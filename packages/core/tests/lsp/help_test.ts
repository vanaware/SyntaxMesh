/**
 * Testes das pontes de help do lsp-core (I 7.5 / 7.6): `getKeywordHelp`
 * (projeção do doc-core via `toMarkdown`, cache memoizado, locale ignorado
 * no v1) e as pontes do manual `getManualToc`/`getManualPage` sobre
 * 22.1b.5.13/5.14.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco I 7.5/7.6
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  clearKeywordHelpCache,
  getKeywordHelp,
  getManualPage,
  getManualToc,
  keywordHelpCacheSize,
} from "../../src/lsp/help.ts";
import {
  getManualPage as docManualPage,
  getManualToc as docManualToc,
} from "../../src/docgen/manual-pages.ts";

describe("getKeywordHelp (I 7.5)", () => {
  it("keyword conhecida devolve a projeção Markdown do doc-core", () => {
    const help = getKeywordHelp("task",);
    assert(help !== null,);
    // Título e cerca de sintaxe do keywordToMarkdown (22.1b.3.21).
    assertStringIncludes(help!, "### task",);
    assertStringIncludes(help!, "```tjp",);
    // É a mesma projeção do doc-core, não uma reimplementação.
    assertEquals(help!.endsWith("\n",), true,);
  });

  it("keyword inexistente devolve null (sem lançar)", () => {
    assertEquals(getKeywordHelp("boguskeyword",), null,);
    // O null também fica memoizado — segunda chamada continua null.
    assertEquals(getKeywordHelp("boguskeyword",), null,);
  });

  it("cache: memoiza por keyword; clear esvazia e nova chamada re-renderiza", () => {
    clearKeywordHelpCache();
    assertEquals(keywordHelpCacheSize(), 0,);
    const first = getKeywordHelp("depends",);
    assert(first !== null,);
    assertEquals(keywordHelpCacheSize(), 1,);
    // Segunda chamada não cresce o cache (hit, não nova renderização).
    const second = getKeywordHelp("depends",);
    assertEquals(second, first,);
    assertEquals(keywordHelpCacheSize(), 1,);
    // Keyword diferente entra no cache; null de inexistente também.
    getKeywordHelp("task",);
    getKeywordHelp("boguskeyword",);
    assertEquals(keywordHelpCacheSize(), 3,);
    clearKeywordHelpCache();
    assertEquals(keywordHelpCacheSize(), 0,);
    assertEquals(getKeywordHelp("depends",), first,);
    assertEquals(keywordHelpCacheSize(), 1,);
  });

  it("locale ignorado no v1: pt-br/es devolvem o mesmo texto inglês", () => {
    const en = getKeywordHelp("resource", "en",);
    const pt = getKeywordHelp("resource", "pt-br",);
    const es = getKeywordHelp("resource", "es",);
    assertEquals(pt, en,);
    assertEquals(es, en,);
  });
});

describe("pontes do manual (I 7.6)", () => {
  it("getManualToc é a projeção do doc-core (capítulos + apêndice A)", () => {
    const toc = getManualToc();
    assert(toc.length > 200,);
    // Mesma entrega do doc-core, sem reimplementação (22.1b.5.13).
    assertEquals(toc, docManualToc(),);
    assert(toc.some((e,) => e.title === "Syntax Reference"),);
    assert(toc.some((e,) => e.id === "task" && e.level === 1),);
  });

  it("getManualPage serve capítulo (texto plano) e keyword (Markdown)", () => {
    const chapter = getManualPage("Intro",);
    assert(chapter !== null,);
    assertStringIncludes(chapter!, "Introduction",);
    assertEquals(chapter, docManualPage("Intro",),);
    const keyword = getManualPage("task",);
    assert(keyword !== null,);
    assert(keyword!.startsWith("### task\n",),);
    assertEquals(keyword, docManualPage("task",),);
  });

  it("id inexistente devolve null (sem lançar)", () => {
    assertEquals(getManualPage("no-such-page",), null,);
    assertEquals(getManualPage("",), null,);
  });
});
