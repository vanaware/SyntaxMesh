/**
 * Testes de richTextToMarkdown (Fase 13.10).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.10)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { richTextToMarkdown, } from "../../src/markdown/convert-rich-to-md.ts";

describe("richTextToMarkdown (13.10)", () => {
  it("título → markdown heading (13.10.5)", () => {
    const result = richTextToMarkdown("== Title ==",);
    assert(result.includes("# Title",),);
  });

  it("bold → **bold** (13.10.5)", () => {
    const result = richTextToMarkdown("'''bold'''",);
    assert(result.includes("**bold**",),);
  });

  it("italic → *italic*", () => {
    const result = richTextToMarkdown("''italic''",);
    assert(result.includes("*italic*",),);
  });

  it("texto simples passa (13.10.2)", () => {
    const result = richTextToMarkdown("hello",);
    assertEquals(result.trim(), "hello",);
  });

  it("listas (13.10.6)", () => {
    const result = richTextToMarkdown("* item1\n* item2",);
    assert(result.includes("- item1",),);
    assert(result.includes("- item2",),);
  });

  it("links (13.10.7)", () => {
    const result = richTextToMarkdown("[http://x.com click]",);
    assert(result.includes("[click](http://x.com)",),);
  });

  it("preserva funções (13.10.4)", () => {
    const result = richTextToMarkdown("[[query:attribute=effort]]",);
    assert(result.includes("[[query:",),);
  });

  it("preserva cores (13.10.4)", () => {
    const result = richTextToMarkdown("<fcol:red>caution</fcol>",);
    assert(result.includes("<fcol:red>",),);
  });

  it("header opcional (13.10.3)", () => {
    const withHeader = richTextToMarkdown("hello", true,);
    assert(withHeader.includes("<!-- converted from RichText -->",),);
  });

  it("sem header por padrão", () => {
    const noHeader = richTextToMarkdown("hello",);
    assert(!noHeader.includes("<!-- converted",),);
  });

  it("string vazia → saída mínima", () => {
    const result = richTextToMarkdown("",);
    assert(
      result.length <= 1,
      `expected empty/minimal, got ${JSON.stringify(result,)}`,
    );
  });
});
