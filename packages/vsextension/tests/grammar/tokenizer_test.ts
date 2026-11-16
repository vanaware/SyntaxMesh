/**
 * Verification of the headless TextMate tokenizer harness (F21², 26.30.1).
 * BDD + `@std/assert`. Proves the `vscode-oniguruma` WASM loads in Deno, the
 * generated grammar registers, and known EN constructs receive their expected
 * `*.syntaxmesh` scopes — including state carried across lines (block comment).
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, } from "@std/assert";
import {
  hasScope,
  SCOPE_NAME,
  type ScopedToken,
  tokenize,
  tokenizeFlat,
} from "./tokenizer.ts";

/** Asserts a token with exactly `text` exists and carries `suffix`. */
function expectScope(
  tokens: ScopedToken[],
  text: string,
  suffix: string,
): void {
  const token = tokens.find((t,) => t.text === text);
  assert(token !== undefined, `token ${JSON.stringify(text,)} not found`,);
  assert(
    hasScope(token, suffix,),
    `${text} expected ${suffix}, got ${token.scopes.join(",",)}`,
  );
}

describe("headless TextMate tokenizer (26.30.1)", () => {
  it("loads the WASM engine and registers the generated grammar", async () => {
    const lines = await tokenize(
      'project prj "Demo" "1.0" 2024-06-01 - 2024-06-30 {}\n',
    );
    assert(lines.length >= 1,);
    // Every token carries the root scope (the grammar is active).
    for (const line of lines) {
      for (const token of line) {
        assert(token.scopes.includes(SCOPE_NAME,),);
      }
    }
  });

  it("assigns keyword scopes by category (control/storage/other)", async () => {
    const tokens = await tokenizeFlat(
      'project prj "Demo"\nresource dev "Foad"\ntask main "Main" {\n' +
        "  effort 2d\n  allocate dev\n}\n",
    );
    expectScope(tokens, "project", "keyword.control.syntaxmesh",);
    expectScope(tokens, "resource", "storage.type.syntaxmesh",);
    expectScope(tokens, "task", "storage.type.syntaxmesh",);
    expectScope(tokens, "effort", "keyword.other.syntaxmesh",);
    expectScope(tokens, "allocate", "keyword.other.syntaxmesh",);
  });

  it("assigns literal scopes (string/date/duration)", async () => {
    const tokens = await tokenizeFlat(
      'project prj "Demo" "1.0" 2024-06-01 - 2024-06-30 {}\n' +
        'task t "T" {\n  effort 2d\n}\n',
    );
    assert(
      tokens.some((t,) =>
        t.text.includes("Demo",) &&
        hasScope(t, "string.quoted.double.syntaxmesh",)
      ),
      "double-quoted string scoped",
    );
    expectScope(tokens, "2024-06-01", "constant.other.date.syntaxmesh",);
    expectScope(tokens, "2d", "constant.numeric.duration.syntaxmesh",);
  });

  it("assigns numeric scopes (integer + float)", async () => {
    const tokens = await tokenizeFlat("100 1.5\n",);
    expectScope(tokens, "100", "constant.numeric.integer.syntaxmesh",);
    expectScope(tokens, "1.5", "constant.numeric.float.syntaxmesh",);
  });

  it("assigns comment scopes and carries state across lines", async () => {
    const tokens = await tokenizeFlat(
      '# a line comment\n/* a block\n   spanning lines */\ntask t "T"\n',
    );
    assert(
      tokens.some((t,) =>
        t.text.startsWith("# a line comment",) &&
        hasScope(t, "comment.line.number-sign.syntaxmesh",)
      ),
      "line comment scoped",
    );
    assert(
      tokens.some((t,) => hasScope(t, "comment.block.syntaxmesh",)),
      "block comment scoped",
    );
    // After the block closes the state returns to root: `task` is a keyword.
    expectScope(tokens, "task", "storage.type.syntaxmesh",);
  });
});
