import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { TokenDoc, } from "../../src/lexer/token-doc.ts";
import { Pattern, } from "../../src/parser/pattern.ts";

describe("TokenDoc", () => {
  it("constructor aceita name null", () => {
    const doc = new TokenDoc(null, "um texto",);
    assertEquals(doc.name, null,);
    assertEquals(doc.text, "um texto",);
  });

  it("constructor com name válido e string armazena text", () => {
    const doc = new TokenDoc("taskID", "<taskID>",);
    assertEquals(doc.name, "taskID",);
    assertEquals(doc.text, "<taskID>",);
    assertEquals(doc.pattern, null,);
    assertEquals(doc.typeSpec, null,);
  });

  it("constructor com Pattern armazena pattern e text null", () => {
    const pattern = new Pattern(["!optionalID",],);
    const doc = new TokenDoc("id", pattern,);
    assertEquals(doc.text, null,);
    assertEquals(doc.pattern, pattern,);
  });

  it("text e pattern são mutuamente exclusivos", () => {
    const pattern = new Pattern(["$STRING",],);
    const doc = new TokenDoc(null, pattern,);
    assertEquals(doc.text, null,);
    assertEquals(doc.pattern, pattern,);
  });
});
