/**
 * Testes de `RichTextImage` (Fase 12.2).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/Element.rb:22-31
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { RichTextImage, } from "../../src/richtext/rich-text-image.ts";

describe("RichTextImage", () => {
  it("constructor guarda fileName e inicia altText/verticalAlign null", () => {
    const img = new RichTextImage("doc.png",);
    assertEquals(img.fileName, "doc.png",);
    assertEquals(img.altText, null,);
    assertEquals(img.verticalAlign, null,);
  });

  it("altText e verticalAlign são mutáveis", () => {
    const img = new RichTextImage("a/b.jpg",);
    img.altText = "legenda";
    img.verticalAlign = "middle";
    assertEquals(img.altText, "legenda",);
    assertEquals(img.verticalAlign, "middle",);
  });
});
