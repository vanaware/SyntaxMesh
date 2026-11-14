/**
 * Unit tests of the pure `.tji` include grammar generator (22.3.2). BDD +
 * `@std/assert`, no `vscode` runtime.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { generateTjiGrammar, } from "../../src/grammar/tji.ts";

describe("generateTjiGrammar", () => {
  it("exposes the include root scope", () => {
    const grammar = generateTjiGrammar();
    assertEquals(grammar.name, "SyntaxMesh Include",);
    assertEquals(grammar.scopeName, "source.syntaxmesh.tji",);
  });

  it("surfaces the include directive", () => {
    const grammar = generateTjiGrammar();
    const include = grammar.repository.include!.patterns;
    assertEquals(include.length, 1,);
    assertEquals(include[0]!.name, "keyword.control.include.syntaxmesh",);
    assert(new RegExp(include[0]!.match!,).test("include file.tji",),);
    assert(
      grammar.patterns.some((p,) => p.include === "#include"),
    );
  });

  it("imports the main grammar", () => {
    const grammar = generateTjiGrammar();
    assert(
      grammar.patterns.some((p,) => p.include === "source.syntaxmesh"),
    );
    // The main grammar reference is last (the directive is matched first).
    assertEquals(
      grammar.patterns[grammar.patterns.length - 1]!.include,
      "source.syntaxmesh",
    );
  });
});
