/**
 * Unit tests of the pure VS Code snippets (22.3.4). BDD + `@std/assert`,
 * no `vscode` runtime — the snippets are plain data.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { SNIPPETS, } from "../../src/grammar/snippets.ts";

/** The six v1 snippet keys required by the task. */
const KEYS = ["project", "task", "resource", "account", "report", "material",];

describe("SNIPPETS", () => {
  it("exposes the six v1 snippets", () => {
    assertEquals(Object.keys(SNIPPETS,).sort(), [...KEYS,].sort(),);
  });

  it("gives every snippet a prefix matching its key", () => {
    for (const key of KEYS) {
      assertEquals(SNIPPETS[key]!.prefix, key,);
    }
  });

  it("uses tab stops and a final cursor position in every body", () => {
    for (const key of KEYS) {
      const body = SNIPPETS[key]!.body.join("\n",);
      // At least one numbered placeholder and the final `$0` cursor.
      assert(/\$\{\d+[:|]/.test(body,), `${key} has a placeholder`,);
      assert(body.includes("$0",), `${key} has a final tab stop`,);
    }
  });

  it("describes every snippet in non-empty English (ASCII)", () => {
    for (const key of KEYS) {
      const description = SNIPPETS[key]!.description;
      assert(description.length > 0, `${key} has a description`,);
      // v1 is English-only: no accented/non-ASCII characters.
      assert(/^[\x20-\x7E]+$/.test(description,), `${key} is ASCII`,);
    }
  });
});
