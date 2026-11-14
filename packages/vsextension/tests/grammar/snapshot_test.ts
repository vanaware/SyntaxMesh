/**
 * Golden snapshot tests of the language generators (22.3.6). BDD +
 * `@std/assert`, no `vscode` runtime. Each generator's serialized output must
 * match its committed fixture byte-for-byte (English v1). Regenerate after an
 * intentional change with `deno task generate:snapshots`.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { generateGrammar, } from "../../src/grammar/textmate.ts";
import { generateTjiGrammar, } from "../../src/grammar/tji.ts";
import { generateLanguageConfiguration, } from "../../src/grammar/language-config.ts";
import { SNIPPETS, } from "../../src/grammar/snippets.ts";

/** Fixture directory, resolved relative to this test file. */
const FIXTURES = new URL("./fixtures/", import.meta.url,);

/** Serializes exactly like the generate scripts (2-space JSON + newline). */
function serialize(value: unknown,): string {
  return JSON.stringify(value, null, 2,) + "\n";
}

/** Reads a committed golden fixture. */
function golden(name: string,): Promise<string> {
  return Deno.readTextFile(new URL(name, FIXTURES,),);
}

describe("grammar golden snapshots (EN)", () => {
  it("main grammar matches textmate.golden.json", async () => {
    assertEquals(
      serialize(generateGrammar(),),
      await golden("textmate.golden.json",),
    );
  });

  it("include grammar matches tji.golden.json", async () => {
    assertEquals(
      serialize(generateTjiGrammar(),),
      await golden("tji.golden.json",),
    );
  });

  it("language configuration matches language-config.golden.json", async () => {
    assertEquals(
      serialize(generateLanguageConfiguration(),),
      await golden("language-config.golden.json",),
    );
  });

  it("snippets match snippets.golden.json", async () => {
    assertEquals(serialize(SNIPPETS,), await golden("snippets.golden.json",),);
  });
});
