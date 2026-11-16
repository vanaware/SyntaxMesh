/**
 * Tokenization golden + snippets-expansion regression (F21², 26.30.3). BDD +
 * `@std/assert`, headless TextMate tokenization (no VS Code).
 *
 * - Golden: the tokenization of a representative EN fixture (mwe001) must
 *   match `fixtures/tokenization.golden.json` byte-for-byte. Regenerate after
 *   an intentional change with `tests/grammar/generate-tokenization.ts`.
 * - Snippets: every body committed in `fixtures/snippets.golden.json` is
 *   expanded (tab stops → placeholders, choices → first option, `$0` → cursor)
 *   and tokenized; the recognized EN keywords must receive their scopes. This
 *   ties the shipped snippets to the grammar (a snippet that stops highlighting
 *   is a regression). `taskreport`/`headline` are not in the v1 highlight data,
 *   so only the recognized keywords are asserted.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import type { Snippet, } from "../../src/grammar/types.ts";
import { hasScope, tokenizeFlat, tokenizeSnapshot, } from "./tokenizer.ts";

/** Fixtures live beside this test; the MWE is resolved from the repo root. */
const FIXTURES = new URL("./fixtures/", import.meta.url,);
const MWE001 = new URL(
  "../../../../docs/Learning/mwe001/tutorial.tjp",
  import.meta.url,
);

/** Serializes exactly like the generator (2-space JSON + newline). */
function serialize(value: unknown,): string {
  return JSON.stringify(value, null, 2,) + "\n";
}

/**
 * Expands VS Code tab stops into plain text: `${N:default}` → default,
 * `${N|a,b|}` → first choice, bare `$N`/`$0` → empty (cursor).
 */
function expandSnippet(body: string[],): string {
  return body.join("\n",)
    .replace(
      /\$\{\d+\|([^|]*)\|\}/g,
      (_match, choices: string,) => choices.split(",",)[0] ?? "",
    )
    .replace(/\$\{\d+:([^}]*)\}/g, (_match, def: string,) => def,)
    .replace(/\$\d+/g, "",);
}

/** Recognized EN keywords each expanded snippet must highlight (word→scope). */
const EXPECTED: Record<string, [string, string,][]> = {
  project: [
    ["project", "keyword.control.syntaxmesh",],
    ["timeformat", "keyword.other.syntaxmesh",],
  ],
  task: [
    ["task", "storage.type.syntaxmesh",],
    ["effort", "keyword.other.syntaxmesh",],
    ["allocate", "keyword.other.syntaxmesh",],
  ],
  resource: [["resource", "storage.type.syntaxmesh",],],
  account: [["account", "storage.type.syntaxmesh",],],
  report: [["formats", "keyword.other.syntaxmesh",],],
  material: [["material", "keyword.other.syntaxmesh",],],
};

describe("tokenization golden + snippets regression (26.30.3)", () => {
  it("mwe001 tokenization matches tokenization.golden.json byte-for-byte", async () => {
    const text = await Deno.readTextFile(MWE001,);
    const snapshot = await tokenizeSnapshot(text,);
    assertEquals(
      serialize(snapshot,),
      await Deno.readTextFile(
        new URL("tokenization.golden.json", FIXTURES,),
      ),
    );
  });

  it("expands every golden snippet into highlightable EN", async () => {
    const snippets = JSON.parse(
      await Deno.readTextFile(new URL("snippets.golden.json", FIXTURES,),),
    ) as Record<string, Snippet>;
    assertEquals(Object.keys(snippets,).sort(), [
      "account",
      "material",
      "project",
      "report",
      "resource",
      "task",
    ],);
    for (const [key, snippet,] of Object.entries(snippets,)) {
      const tokens = await tokenizeFlat(expandSnippet(snippet.body,),);
      assert(tokens.length > 0, `${key} expands to a token stream`,);
      for (const [word, scope,] of EXPECTED[key]!) {
        const token = tokens.find((t,) => t.text === word);
        assert(token !== undefined, `${key}: ${word} present after expansion`,);
        assert(hasScope(token, scope,), `${key}: ${word} → ${scope}`,);
      }
    }
  });
});
