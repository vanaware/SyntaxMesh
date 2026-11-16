/**
 * EN manual/help coverage regression (F21², 26.32.1). BDD + `@std/assert`.
 *
 * Reuses the doc-core delivered in F22 (22.1b) — verification, not rebuild.
 * Proves the editor's help/manual surface covers the EN keyword universe:
 * - every documented EN keyword resolves to `getKeywordHelp` Markdown (title
 *   `### keyword`, no ANSI) and to a `getManualPage`;
 * - `UserManual.generate` emits a page per documented keyword (golden over the
 *   whole keyword set, not just samples) plus the structural pages;
 * - `getManualToc` lists every documented keyword in appendix A;
 * - the keywords actually used by the EN corpus (MWEs) all resolve to help.
 *
 * The highlight grammar (`SyntaxCore.categories`) recognizes a few extra
 * attribute-value words (e.g. `align`, `width`) that are not separately
 * documented; coverage is asserted over the documented reference universe,
 * which is the keyword set `getKeywordHelp` shares with the editor.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.32)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (getKeywordHelp)
 */
import { assert, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { syntaxReference, UserManual, } from "../../src/docgen/mod.ts";
import {
  getKeywordHelp,
  getManualPage,
  getManualToc,
} from "../../src/lsp/mod.ts";

/** Repo root (this test lives in `packages/core/tests/lsp/`). */
const ROOT = new URL("../../../../", import.meta.url,);
const CORPUS = new URL("tests/fixtures/corpus.json", ROOT,);

/** Minimal shape of the corpus manifest consumed here. */
interface CorpusManifest {
  groups: { id: string; fixtures: { path: string }[] }[];
}

/**
 * Documented EN keyword universe (`ignoreOld=true`, the same index
 * `getKeywordHelp` uses). Built once; the doc-core memoizes the reference.
 */
const documented = syntaxReference(null, true,).all();

describe("EN manual/help coverage (26.32.1)", () => {
  it("every documented EN keyword resolves to help Markdown + manual page", () => {
    assert(documented.length >= 160, `EN reference has ${documented.length}`,);
    for (const keyword of documented) {
      const help = getKeywordHelp(keyword,);
      assert(help !== null, `${keyword} resolves to help`,);
      assert(help.startsWith(`### ${keyword}`,), `${keyword} title`,);
      assert(help.endsWith("\n",), `${keyword} markdown ends with newline`,);
      assert(!help.includes("\x1b[",), `${keyword} markdown has no ANSI`,);
      assert(getManualPage(keyword,) !== null, `${keyword} has a manual page`,);
    }
  });

  it("UserManual.generate emits a page per documented keyword", () => {
    const pages = new UserManual().generate();
    for (
      const name of ["index.html", "toc.html", "navbar.html", "alphabet.html",]
    ) {
      assert(name in pages, `structural page ${name}`,);
    }
    for (const keyword of documented) {
      assert(`${keyword}.html` in pages, `${keyword}.html present`,);
    }
  });

  it("getManualToc lists every documented keyword in appendix A", () => {
    const ids = new Set(getManualToc().map((entry,) => entry.id),);
    for (const keyword of documented) {
      assert(ids.has(keyword,), `${keyword} listed in the TOC`,);
    }
  });

  it("every EN corpus (MWE) keyword resolves to help", async () => {
    const manifest = JSON.parse(
      await Deno.readTextFile(CORPUS,),
    ) as CorpusManifest;
    const mwe = manifest.groups.find((g,) => g.id === "mwe");
    assert(mwe !== undefined, "corpus has the MWE group",);
    const documentedSet = new Set(documented,);
    const words = new Set<string>();
    for (const fixture of mwe.fixtures) {
      const text = await Deno.readTextFile(new URL(fixture.path, ROOT,),);
      for (const match of text.matchAll(/[a-zA-Z_][a-zA-Z0-9_]*/g,)) {
        words.add(match[0],);
      }
    }
    const corpusKeywords = [...words,].filter((w,) => documentedSet.has(w,));
    assert(
      corpusKeywords.length >= 30,
      `corpus exercises ${corpusKeywords.length} documented keywords`,
    );
    for (
      const core of [
        "project",
        "task",
        "resource",
        "effort",
        "allocate",
        "depends",
      ]
    ) {
      assert(corpusKeywords.includes(core,), `${core} used in the corpus`,);
    }
    for (const keyword of corpusKeywords) {
      const help = getKeywordHelp(keyword,);
      assert(help !== null, `${keyword} resolves to help`,);
      assertStringIncludes(help, `### ${keyword}`,);
    }
  });
});
