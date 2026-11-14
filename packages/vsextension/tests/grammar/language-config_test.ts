/**
 * Unit tests of the pure language configuration generator (22.3.3). BDD +
 * `@std/assert`, no `vscode` runtime.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertFalse, } from "@std/assert";
import { SyntaxCore, } from "@vanaware/syntaxmesh/doc-core";
import { generateLanguageConfiguration, } from "../../src/grammar/language-config.ts";

describe("generateLanguageConfiguration", () => {
  it("declares the brace/bracket pairs and auto-closing", () => {
    const config = generateLanguageConfiguration();
    assertEquals(config.brackets, [
      { open: "{", close: "}", },
      { open: "[", close: "]", },
    ],);
    // Quotes auto-close only outside strings/comments.
    const quote = config.autoClosingPairs.find((p,) => p.open === '"')!;
    assertEquals(quote.notIn, ["string", "comment",],);
    assertEquals(config.surroundingPairs.length, 4,);
  });

  it("declares the comment delimiters", () => {
    const config = generateLanguageConfiguration();
    assertEquals(config.comments.lineComment, "#",);
    assertEquals(config.comments.blockComment, ["/*", "*/",],);
  });

  it("folds option-block headers from the cinwords", () => {
    const config = generateLanguageConfiguration();
    const cinwords = new SyntaxCore().indentSettings().cinwords;
    const start = new RegExp(config.folding.start!,);
    const end = new RegExp(config.folding.end!,);
    // A real option-block header ending in `{` opens a fold; a lone `}` closes.
    assert(start.test(`  ${cinwords[0]!} foo {`,),);
    assert(end.test("  }",),);
    assertFalse(start.test("  // not a block",),);
  });

  it("indents after an opening brace and dedents at a closing brace", () => {
    const config = generateLanguageConfiguration();
    const increase = new RegExp(
      config.indentationRules.increaseIndentPattern!,
    );
    const decrease = new RegExp(
      config.indentationRules.decreaseIndentPattern!,
    );
    assert(increase.test("task foo {",),);
    assert(decrease.test("  }",),);
    assert(new RegExp(config.wordPattern,).test("task",),);
  });
});
