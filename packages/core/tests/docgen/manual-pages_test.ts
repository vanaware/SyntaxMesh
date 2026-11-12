/**
 * Testes das projeções LSP-only do manual (G 5.13/5.14): `getManualToc`
 * (ordem dos capítulos + apêndice A, ids estáveis) e `getManualPage`
 * (capítulo via RichText `to_s`, keyword via `toMarkdown`, inexistente →
 * `null`, sem HTML cru fora das cercas de código).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco G (5.13/5.14)
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  getManualPage,
  getManualToc,
  resetManualPageCache,
} from "../../src/docgen/manual-pages.ts";
import { MANUAL_CHAPTER_NAMES, } from "../../src/docgen/manual/chapters.ts";
import { UserManual, } from "../../src/docgen/user-manual.ts";

/** Remove as cercas ```…``` — placeholders `<id>` de sintaxe não são HTML. */
function outsideFences(text: string,): string {
  return text.replace(/```[\s\S]*?```/g, "",);
}

/** Nenhum tag HTML fora das cercas de código. */
function assertNoHtml(text: string,): void {
  assertEquals(/<[a-zA-Z][^>]*>/.test(outsideFences(text,),), false,);
}

describe("getManualToc (22.1b.5.13)", () => {
  it("ordem: capítulos na ordem do manual, depois o apêndice A", () => {
    const toc = getManualToc();
    assert(toc.length > 200,); // capítulos + uma entrada por keyword
    // Cada capítulo aparece como primeira entrada level 0 do seu snip, na
    // ordem canônica; o apêndice "Syntax Reference" vem por último.
    const level0 = toc.filter((e,) => e.level === 0);
    const chapterEntries = level0.slice(0, MANUAL_CHAPTER_NAMES.length,);
    assertEquals(
      chapterEntries.map((e,) => e.id.split("#",)[0]),
      [...MANUAL_CHAPTER_NAMES,],
    );
    const appendix = level0[MANUAL_CHAPTER_NAMES.length];
    assertEquals(appendix!.title, "Syntax Reference",);
    // Entradas de keyword têm level 1 e id = nome da keyword.
    const task = toc.find((e,) => e.id === "task");
    assert(task !== undefined,);
    assertEquals(task!.level, 1,);
    // Seções internas de capítulo: level ≥ 1 com âncora `file#tag`.
    assert(toc.some((e,) => e.id.startsWith("Intro#",) && e.level >= 1),);
  });

  it("ids estáveis entre chamadas e entre instâncias", () => {
    const first = getManualToc();
    const second = getManualToc();
    assertEquals(second, first,);
    // Uma instância nova projeta a mesma TOC (ids não dependem do cache).
    resetManualPageCache();
    const fresh = new UserManual().getManualToc();
    assertEquals(fresh, first,);
    // Cada id é não-vazio e aponta para página resolvível ou keyword.
    for (const entry of first) assert(entry.id.length > 0,);
  });
});

describe("getManualPage (22.1b.5.14)", () => {
  it("id válido de capítulo: texto plano do RichText, sem HTML", () => {
    const page = getManualPage("Intro",);
    assert(page !== null,);
    assertStringIncludes(page!, "Introduction",);
    assertStringIncludes(page!, "SyntaxMesh",);
    assertNoHtml(page!,);
    // A âncora `#tag` é tolerada e serve o capítulo inteiro.
    assertEquals(getManualPage("Intro#Introduction",), page,);
  });

  it("id de keyword: projeção Markdown do toMarkdown", () => {
    const page = getManualPage("task",);
    assert(page !== null,);
    assert(page!.startsWith("### task\n",),);
    assertStringIncludes(page!, "**Purpose:** ",);
    assertStringIncludes(page!, "```tjp",);
    assertNoHtml(page!,);
  });

  it("id inexistente devolve null (sem lançar)", () => {
    assertEquals(getManualPage("no-such-page",), null,);
    assertEquals(getManualPage("",), null,);
    assertEquals(getManualPage("#anchor-only",), null,);
  });

  it("nenhuma página do mapa devolve HTML cru", () => {
    // Amostra representativa: primeiro capítulo, capítulo do meio e keywords
    // com placeholders de sintaxe (`<id>`, `<name>`) dentro da cerca tjp.
    const ids = ["Intro", "Getting_Started", "task", "project", "effort",];
    for (const id of ids) {
      const page = getManualPage(id,);
      assert(page !== null, `página ${id} ausente`,);
      assertNoHtml(page!,);
    }
  });
});
