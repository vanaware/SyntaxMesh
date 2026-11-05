/**
 * 17.11.1 — `FontMetricsData`.
 *
 * Valores conferidos no oráculo Ruby (`.tmp/fontmetrics_probe.rb`, 2026-11-04).
 *
 * @see packages/core/src/painter/font-metrics-data.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";

import {
  FontMetricsData,
  MAX_GLYPH_INDEX,
  MIN_GLYPH_INDEX,
} from "../../src/painter/font-metrics-data.ts";
import { Font_LiberationSans_normal, } from "../../src/painter/font-data.ts";

function sample(): FontMetricsData {
  return new FontMetricsData(
    "Foo",
    "normal",
    24,
    10.5,
    { "A": 7, " ": 3, },
    { "AB": -1, },
  );
}

describe("FontMetricsData — glyphWidth (17.11.1.3)", () => {
  it("devolve a largura do glifo conhecido", () => {
    assertEquals(sample().glyphWidth("A",), 7,);
  });

  it("devolve null para glifo ausente", () => {
    assertEquals(sample().glyphWidth("Z",), null,);
  });

  it("no set real, glyphWidth('A') == 15.984 (oráculo)", () => {
    assertEquals(Font_LiberationSans_normal.glyphWidth("A",), 15.984,);
  });
});

describe("FontMetricsData — averageWidth (17.11.1.4)", () => {
  it("modo de dados → 0 (Ruby nunca recomputa @averageWidth)", () => {
    assertEquals(sample().averageWidth(), 0,);
  });

  it("mesmo para as fontes reais do FontData", () => {
    assertEquals(Font_LiberationSans_normal.averageWidth(), 0,);
  });
});

describe("FontMetricsData — campos e índices", () => {
  it("guarda fontName/type/ptSize/height", () => {
    const d = sample();
    assertEquals(d.fontName, "Foo",);
    assertEquals(d.type, "normal",);
    assertEquals(d.ptSize, 24,);
    assertEquals(d.height, 10.5,);
  });

  it("MIN/MAX_GLYPH_INDEX são 32/126", () => {
    assertEquals(MIN_GLYPH_INDEX, 32,);
    assertEquals(MAX_GLYPH_INDEX, 126,);
  });

  it("fonte normal tem 95 glifos e 96 kernings (oráculo)", () => {
    assertEquals(
      Object.keys(Font_LiberationSans_normal.charWidth,).length,
      95,
    );
    assertEquals(
      Object.keys(Font_LiberationSans_normal.kerningDelta,).length,
      96,
    );
  });
});

describe("FontMetricsData — toRuby (17.11.1.5)", () => {
  it("emite o cabeçalho de geração em sintaxe Ruby", () => {
    const s = sample().toRuby();
    assert(
      s.includes(
        "Font_Foo_normal = Painter::FontMetricsData.new('Foo', :normal, " +
          "24, 10.500,",
      ),
      s,
    );
    assert(s.includes("@charWidth = {",), s,);
    assert(s.includes("'A' => 7.000,",), s,);
    assert(s.includes("@kerningDelta = {",), s,);
    assert(s.includes("'AB' => -1.000,",), s,);
  });

  it("substitui hífens do nome por underscores na constante", () => {
    const d = new FontMetricsData(
      "Liberation-Sans",
      "bold",
      24,
      26.088,
      { "A": 1, },
      {},
    );
    assert(d.toRuby().includes("Font_Liberation_Sans_bold = ",), d.toRuby(),);
  });
});
