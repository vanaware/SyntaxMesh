/**
 * Unit tests of the pure `language` directive rewrite (22.7.4). BDD +
 * `@std/assert`, no `vscode` runtime — plain text in, plain text out.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { rewriteLanguageDirective, } from "../../src/commands/input-language.ts";

describe("input-language (22.7.4)", () => {
  it("replaces an existing directive value, keeping indentation", () => {
    assertEquals(
      rewriteLanguageDirective('language "en"\nproject p {\n}\n', "pt-BR",),
      'language "pt-BR"\nproject p {\n}\n',
    );
    assertEquals(
      rewriteLanguageDirective('  language "en"\n', "es",),
      '  language "es"\n',
    );
  });

  it("inserts a directive at the top when none exists", () => {
    const text = 'project p "P" "1.0" 2026-01-01 - 2026-12-31 {\n}\n';
    assertEquals(
      rewriteLanguageDirective(text, "es",),
      `language "es"\n${text}`,
    );
  });

  it("preserves the rest of the file and trailing line content", () => {
    const text = [
      'language "en" # prolog',
      'project p "P" "1.0" 2026-01-01 - 2026-12-31 {',
      "}",
      'task t "T" {',
      "}",
      "",
    ].join("\n",);
    assertEquals(
      rewriteLanguageDirective(text, "pt-BR",),
      text.replace('language "en"', 'language "pt-BR"',),
    );
  });

  it("is idempotent for the same locale", () => {
    const text = 'language "en"\nproject p {\n}\n';
    const once = rewriteLanguageDirective(text, "es",);
    assertEquals(rewriteLanguageDirective(once, "es",), once,);
    assertEquals(rewriteLanguageDirective(text, "en",), text,);
  });
});
