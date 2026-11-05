/**
 * 17.11.2 — `FontData` (as quatro variantes LiberationSans).
 *
 * Alturas e amostras conferidas no oráculo Ruby
 * (`.tmp/fontmetrics_probe.rb`, 2026-11-04). Os dados são transcrição byte-a-
 * byte de `FontData.rb`; estes testes travam os valores de fronteira.
 *
 * @see packages/core/src/painter/font-data.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";

import {
  Font_LiberationSans_bold,
  Font_LiberationSans_bold_italic,
  Font_LiberationSans_italic,
  Font_LiberationSans_normal,
} from "../../src/painter/font-data.ts";

describe("FontData (17.11.2.2–17.11.2.5)", () => {
  it("normal: ptSize 24, height 26.088, 'A' 15.984, '|' 6.216", () => {
    assertEquals(Font_LiberationSans_normal.ptSize, 24,);
    assertEquals(Font_LiberationSans_normal.height, 26.088,);
    assertEquals(Font_LiberationSans_normal.glyphWidth("A",), 15.984,);
    assertEquals(Font_LiberationSans_normal.glyphWidth("|",), 6.216,);
    assertEquals(Font_LiberationSans_normal.kerningDelta["AW"], -0.891,);
  });

  it("italic: height 26.016 (a única altura diferente)", () => {
    assertEquals(Font_LiberationSans_italic.height, 26.016,);
    assertEquals(Font_LiberationSans_italic.type, "italic",);
    assertEquals(Font_LiberationSans_italic.kerningDelta["Wy"], undefined,);
    assertEquals(Font_LiberationSans_italic.kerningDelta["Yv"], -0.891,);
  });

  it("bold: 'A' passa a 17.328 e kerning 'W-' é -0.48", () => {
    assertEquals(Font_LiberationSans_bold.height, 26.088,);
    assertEquals(Font_LiberationSans_bold.glyphWidth("A",), 17.328,);
    assertEquals(Font_LiberationSans_bold.glyphWidth("m",), 21.336,);
    assertEquals(Font_LiberationSans_bold.kerningDelta["W-"], -0.48,);
  });

  it("bold_italic: mesmo charWidth do bold, mas outro conjunto de kernings", () => {
    assertEquals(Font_LiberationSans_bold_italic.type, "bold_italic",);
    assertEquals(Font_LiberationSans_bold_italic.glyphWidth("A",), 17.328,);
    assertEquals(Font_LiberationSans_bold_italic.kerningDelta["ff"], -0.434,);
    // bold não tem 'ff'; bold_italic tem.
    assertEquals(Font_LiberationSans_bold.kerningDelta["ff"], undefined,);
  });
});
