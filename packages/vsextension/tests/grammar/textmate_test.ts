/**
 * Unit tests of the pure TextMate grammar generator (22.3.1). BDD +
 * `@std/assert`, no `vscode` runtime — the grammar is plain data projected
 * from `SyntaxCore`, so it is fully testable in Deno.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertFalse, } from "@std/assert";
import { SyntaxCore, } from "@vanaware/syntaxmesh/doc-core";
import { generateGrammar, } from "../../src/grammar/textmate.ts";

describe("generateGrammar", () => {
  it("exposes the SyntaxMesh root scope", () => {
    const grammar = generateGrammar();
    assertEquals(grammar.name, "SyntaxMesh",);
    assertEquals(grammar.scopeName, "source.syntaxmesh",);
  });

  it("maps the three keyword categories to their scopes", () => {
    const grammar = generateGrammar();
    const keywords = grammar.repository.keywords!.patterns;
    assertEquals(keywords.length, 3,);
    assertEquals(keywords[0]!.name, "keyword.control.syntaxmesh",);
    assertEquals(keywords[1]!.name, "storage.type.syntaxmesh",);
    assertEquals(keywords[2]!.name, "keyword.other.syntaxmesh",);

    // The control trio is present and word-boundary anchored.
    const control = new RegExp(keywords[0]!.match!,);
    assert(control.test("project",),);
    assert(control.test("macro",),);
    assert(control.test("supplement",),);
    assertFalse(control.test("projectx",),);

    // The builtin pattern matches a real property name from the data.
    const builtin = new RegExp(keywords[1]!.match!,);
    const categories = new SyntaxCore().categories();
    assert(builtin.test(categories.builtin[0]!,),);
  });

  it("projects every literal family with its scope and valid regexes", () => {
    const grammar = generateGrammar();
    const names = (key: string,): (string | undefined)[] =>
      grammar.repository[key]!.patterns.map((p,) => p.name);

    assertEquals(names("constants",), [
      "constant.other.date.syntaxmesh",
      "constant.other.time.syntaxmesh",
      "constant.numeric.duration.syntaxmesh",
    ],);
    assertEquals(names("strings",), [
      "string.quoted.single.syntaxmesh",
      "string.quoted.double.syntaxmesh",
      "string.unquoted.scissors.syntaxmesh",
    ],);
    assertEquals(names("comments",), [
      "comment.line.number-sign.syntaxmesh",
      "comment.line.double-slash.syntaxmesh",
      "comment.block.syntaxmesh",
    ],);
    assertEquals(names("numbers",), [
      "constant.numeric.float.syntaxmesh",
      "constant.numeric.integer.syntaxmesh",
    ],);
    assertEquals(names("punctuation",), [
      "punctuation.section.block.begin.syntaxmesh",
      "punctuation.section.block.end.syntaxmesh",
      "punctuation.section.brackets.begin.syntaxmesh",
      "punctuation.section.brackets.end.syntaxmesh",
    ],);
    assertEquals(
      grammar.repository.include!.patterns[0]!.name,
      "keyword.control.include.syntaxmesh",
    );

    // Numbers match real literals (integer suffixes and float forms).
    const numbers = grammar.repository.numbers!.patterns;
    assert(new RegExp(numbers[1]!.match!,).test("100",),);
    assert(new RegExp(numbers[1]!.match!,).test("100ULL",),);
    assert(new RegExp(numbers[0]!.match!,).test("1.5",),);

    // Every emitted regex compiles (catches malformed projections).
    for (const entry of Object.values(grammar.repository,)) {
      for (const pattern of entry.patterns) {
        if (pattern.match !== undefined) new RegExp(pattern.match,);
        if (pattern.begin !== undefined) new RegExp(pattern.begin,);
        if (pattern.end !== undefined) new RegExp(pattern.end,);
      }
    }
  });

  it("orders the repository and the top-level includes", () => {
    const grammar = generateGrammar();
    assertEquals(Object.keys(grammar.repository,), [
      "comments",
      "strings",
      "include",
      "keywords",
      "constants",
      "numbers",
      "punctuation",
    ],);
    assertEquals(grammar.patterns, [
      { include: "#comments", },
      { include: "#strings", },
      { include: "#include", },
      { include: "#keywords", },
      { include: "#constants", },
      { include: "#numbers", },
      { include: "#punctuation", },
    ],);
  });

  it("is deterministic across calls", () => {
    assertEquals(generateGrammar(), generateGrammar(),);
    assertEquals(
      JSON.stringify(generateGrammar(),),
      JSON.stringify(generateGrammar(),),
    );
  });
});
