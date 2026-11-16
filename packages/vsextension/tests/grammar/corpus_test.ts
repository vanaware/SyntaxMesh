/**
 * Grammar scope coverage over the EN corpus (F21², 26.30.2). BDD +
 * `@std/assert`, headless TextMate tokenization (no VS Code).
 *
 * Proves three things over real fixtures (MWEs `docs/Learning/mwe001–009` +
 * the `syntax-correct` EN subset of `tests/fixtures/corpus.json`):
 * 1. every grammar regex compiles and runs against real lines (tokenizing the
 *    whole corpus never throws; the root scope stays active on every token);
 * 2. every scope the grammar declares is actually exercised by the corpus
 *    (keywords/literals/comments/strings/punctuation, incl. nested escapes);
 * 3. the EN-only v1 limitation: non-EN keywords fall through to the root
 *    scope (asserted as a documented limitation, not a failure).
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { generateGrammar, } from "../../src/grammar/textmate.ts";
import type { TextMatePattern, } from "../../src/grammar/types.ts";
import { SCOPE_NAME, tokenizeFlat, } from "./tokenizer.ts";

/** Repo root, resolved relative to this test file (tests/grammar/ → root). */
const ROOT = new URL("../../../../", import.meta.url,);
const CORPUS = new URL("tests/fixtures/corpus.json", ROOT,);

/** Minimal shape of the corpus manifest consumed here. */
interface CorpusManifest {
  groups: { id: string; fixtures: { id: string; path: string }[] }[];
}

/** The EN groups targeted by the grammar v1 (EN-only). */
const EN_GROUPS = ["mwe", "syntax-correct",];

/** Result of scanning the EN corpus once (memoized across the assertions). */
interface CorpusScan {
  fixtureCount: number;
  tokenCount: number;
  scopes: Set<string>;
  allRooted: boolean;
}

let scanPromise: Promise<CorpusScan> | null = null;

/** Reads + tokenizes every EN fixture, collecting the scopes exercised. */
async function doScan(): Promise<CorpusScan> {
  const manifest = JSON.parse(
    await Deno.readTextFile(CORPUS,),
  ) as CorpusManifest;
  const paths: URL[] = [];
  for (const id of EN_GROUPS) {
    const group = manifest.groups.find((g,) => g.id === id);
    assert(group !== undefined, `corpus group ${id} exists`,);
    for (const fixture of group.fixtures) {
      paths.push(new URL(fixture.path, ROOT,),);
    }
  }
  const scopes = new Set<string>();
  let tokenCount = 0;
  let allRooted = true;
  for (const path of paths) {
    const tokens = await tokenizeFlat(await Deno.readTextFile(path,),);
    assert(tokens.length > 0, `${path.pathname} tokenizes`,);
    for (const token of tokens) {
      tokenCount++;
      if (!token.scopes.includes(SCOPE_NAME,)) allRooted = false;
      for (const scope of token.scopes) {
        if (scope !== SCOPE_NAME) scopes.add(scope,);
      }
    }
  }
  return { fixtureCount: paths.length, tokenCount, scopes, allRooted, };
}

/** Resolves the shared corpus scan (tokenizes the corpus a single time). */
function scan(): Promise<CorpusScan> {
  scanPromise ??= doScan();
  return scanPromise;
}

/** Every scope name the generated grammar declares (incl. nested rules). */
function declaredScopes(): Set<string> {
  const out = new Set<string>();
  const walk = (patterns: TextMatePattern[],): void => {
    for (const pattern of patterns) {
      if (pattern.name !== undefined) out.add(pattern.name,);
      if (pattern.patterns !== undefined) walk(pattern.patterns,);
      for (
        const captures of [
          pattern.captures,
          pattern.beginCaptures,
          pattern.endCaptures,
        ]
      ) {
        for (const capture of Object.values(captures ?? {},)) {
          out.add(capture.name,);
        }
      }
    }
  };
  for (const entry of Object.values(generateGrammar().repository,)) {
    walk(entry.patterns,);
  }
  return out;
}

describe("grammar scope coverage over the EN corpus (26.30.2)", () => {
  it("tokenizes every MWE + syntax-correct fixture; no regex breaks", async () => {
    const result = await scan();
    // 9 MWEs + 75 syntax-correct EN fixtures.
    assertEquals(result.fixtureCount, 84,);
    assert(result.allRooted, "root scope active on every token of every line",);
    assert(
      result.tokenCount > 1000,
      "corpus yields a substantial token stream",
    );
  });

  it("exercises every scope the grammar declares", async () => {
    const result = await scan();
    const declared = declaredScopes();
    assert(declared.size >= 20, "grammar declares the full v1 scope surface",);
    for (const scope of declared) {
      assert(result.scopes.has(scope,), `corpus exercises ${scope}`,);
    }
  });

  it("EN-only v1: non-EN keywords fall through to the root scope", async () => {
    // PT keywords (projeto/tarefa/recurso) are absent from the EN grammar.
    const tokens = await tokenizeFlat(
      'projeto prj "Demo"\ntarefa main "Main"\nrecurso dev "Foad"\n',
    );
    for (const word of ["projeto", "tarefa", "recurso",]) {
      const token = tokens.find((t,) => t.text.includes(word,));
      assert(token !== undefined, `${word} present in the stream`,);
      // Unmatched text merges into a root-only token: no keyword highlight.
      assertEquals(token.scopes, [SCOPE_NAME,], `${word} falls through`,);
    }
    // Contrast: the EN equivalents are highlighted by category.
    const en = await tokenizeFlat(
      'project prj "Demo"\ntask main "Main"\nresource dev "Foad"\n',
    );
    const scopeOf = (text: string,): string[] =>
      en.find((t,) => t.text === text)?.scopes ?? [];
    assert(scopeOf("project",).includes("keyword.control.syntaxmesh",),);
    assert(scopeOf("task",).includes("storage.type.syntaxmesh",),);
    assert(scopeOf("resource",).includes("storage.type.syntaxmesh",),);
  });
});
