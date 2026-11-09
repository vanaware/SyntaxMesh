/**
 * Testes do `UserManual` (22.1b.5) — o manual HTML do `syntaxmesh man --format
 * html`.
 *
 * O teste cobre a **estrutura** do mapa de arquivos (índice, sumário,
 * capítulos, apêndice, navegação e CSS) e as regras editoriais do manual:
 * prosa em inglês, extensão `.smx` como única forma citada e nenhuma menção
 * ao projeto de origem da gramática. Essas regras são verificáveis porque
 * todo o texto dos capítulos e da referência sai do `doc-core`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco G
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  MANUAL_CHAPTER_NAMES,
  MANUAL_CHAPTERS,
  MANUAL_STYLESHEET,
  MANUAL_STYLESHEET_NAME,
  UserManual,
} from "../../src/docgen/mod.ts";

/** Manual gerado uma única vez (caro: monta o parser e todas as páginas). */
let cached: Record<string, string> | null = null;
function manual(): Record<string, string> {
  cached ??= new UserManual().generate();
  return cached;
}

describe("UserManual — estrutura do manual (22.1b.5.6)", () => {
  it("gera índice, sumário, navegação e CSS", () => {
    const pages = manual();
    for (
      const name of [
        "index.html",
        "toc.html",
        "navbar.html",
        "alphabet.html",
        MANUAL_STYLESHEET_NAME,
      ]
    ) {
      assert(name in pages, `faltou ${name}`,);
    }
  });

  // A folha embutida e o asset da raiz são o **mesmo** arquivo: o doc-core não
  // lê disco, então a cópia de `assets/css/tjmanual.css` vive em
  // `manual-css.ts` e as duas precisam andar juntas.
  it("MANUAL_STYLESHEET é byte a byte igual ao asset da raiz", async () => {
    const asset = await Deno.readTextFile(
      new URL("../../../../assets/css/tjmanual.css", import.meta.url,),
    );
    assertEquals(MANUAL_STYLESHEET, asset,);
  });

  it("gera uma página por capítulo e uma por keyword documentada", () => {
    const pages = manual();
    for (const chapter of MANUAL_CHAPTERS) {
      assert(`${chapter.name}.html` in pages, `faltou ${chapter.name}.html`,);
    }
    assert("task.html" in pages,);
    assert("resource.html" in pages,);
    assert("shift.html" in pages,);
  });

  it("os nomes dos capítulos são os do índice canônico", () => {
    const pages = manual();
    const chapters = MANUAL_CHAPTER_NAMES.filter((name,) =>
      `${name}.html` in pages
    );
    assertEquals(chapters.length, MANUAL_CHAPTER_NAMES.length,);
  });

  it("o sumário linka os capítulos e numera o apêndice com `A.`", () => {
    const toc = manual()["toc.html"]!;
    for (const name of MANUAL_CHAPTER_NAMES) {
      assertStringIncludes(toc, `${name}.html`,);
    }
    assertStringIncludes(toc, "Syntax Reference",);
    assertStringIncludes(toc, "A.1",);
  });

  it("as páginas usam caminho relativo para o CSS", () => {
    const pages = manual();
    assertStringIncludes(pages["task.html"]!, MANUAL_STYLESHEET_NAME,);
    assert(!pages["task.html"]!.includes('href="/css/',),);
  });
});

describe("UserManual — regras editoriais da documentação", () => {
  /** Todos os arquivos do manual concatenados (uma passada por teste). */
  function allText(): string {
    return Object.values(manual(),).join("\n",);
  }

  it("não menciona o projeto de origem da gramática", () => {
    assert(!/taskjuggler/i.test(allText(),),);
  });

  it("cita apenas a extensão `.smx`, nunca as legadas", () => {
    const text = allText();
    assert(!/\.tjp\b/i.test(text,), "o manual citou '.tjp'",);
    assert(!/\.tji\b/i.test(text,), "o manual citou '.tji'",);
    assert(text.includes(".smx",),);
  });

  it("o rodapé traz o copyright e o contato do AppConfig", () => {
    const intro = manual()["Intro.html"]!;
    assertStringIncludes(intro, "Copyright (c) 2026 SyntaxMesh Contributors",);
    assertStringIncludes(intro, "mailto:",);
  });

  it("o capítulo de abertura descreve o projeto em inglês", () => {
    const pages = manual();
    const [first,] = MANUAL_CHAPTER_NAMES;
    assertStringIncludes(pages[`${first}.html`]!, "project management",);
  });
});
