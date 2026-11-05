/**
 * 17.11.3 — `FontMetrics`.
 *
 * Todos os números vêm direto do oráculo Ruby
 * (`.tmp/fontmetrics_probe.rb`, 2026-11-04): `fm.height('Arial', 12) == 17`,
 * `fm.width('Arial', 12, 'Hello') == 36`, etc.
 *
 * @see packages/core/src/painter/font-metrics.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";

import { TjArgumentError, } from "../../src/model/errors.ts";
import { FontMetrics, } from "../../src/painter/font-metrics.ts";

const fm = new FontMetrics();

describe("FontMetrics — registro de fontes (17.11.3.3)", () => {
  it("Arial e LiberationSans são o mesmo objeto (alias)", () => {
    assertEquals(
      fm.width("Arial", 12, "Hello",),
      fm.width("LiberationSans", 12, "Hello",),
    );
  });

  it("accepta as 4 variantes nos dois nomes", () => {
    for (
      const name of [
        "Arial-Italic",
        "LiberationSans-Italic",
        "Arial-Bold",
        "LiberationSans-Bold",
        "Arial-BoldItalic",
        "LiberationSans-BoldItalic",
      ]
    ) {
      assertEquals(fm.height(name, 24,), 34,);
    }
  });

  it("italic difere de normal em height (26.016 vs 26.088)", () => {
    assertEquals(fm.height("Arial-Italic", 24,), 34,);
    assertEquals(fm.height("Arial", 24,), 34,);
    // Em 12 pt, a diferença de ~0.07pt não sobrevive ao truncamento.
    assertEquals(fm.height("Arial-Italic", 12,), 17,);
  });
});

describe("FontMetrics — height (17.11.3.4, 17.11.3.7)", () => {
  it("Arial 12 → 17 (oráculo)", () => {
    assertEquals(fm.height("Arial", 12,), 17,);
  });

  it("Arial 24 → 34", () => {
    assertEquals(fm.height("Arial", 24,), 34,);
  });

  it("Arial 11 → 15 (truncamento)", () => {
    assertEquals(fm.height("Arial", 11,), 15,);
  });
});

describe("FontMetrics — width (17.11.3.5, 17.11.3.8–9)", () => {
  it("string simples: 'Hello' 12pt → 36 (oráculo)", () => {
    assertEquals(fm.width("Arial", 12, "Hello",), 36,);
  });

  it("escala linear com o tamanho: 'Hello' 24pt → 72", () => {
    assertEquals(fm.width("Arial", 24, "Hello",), 72,);
  });

  it("string vazia → 0", () => {
    assertEquals(fm.width("Arial", 12, "",), 0,);
  });

  it("um glifo: 'A' → 10", () => {
    assertEquals(fm.width("Arial", 12, "A",), 10,);
  });

  it("espaço → 4", () => {
    assertEquals(fm.width("Arial", 12, " ",), 4,);
  });

  it("kerning aplicado: 'AW' → 25 (soma 37.725 após delta -0.891)", () => {
    assertEquals(fm.width("Arial", 12, "AW",), 25,);
  });

  it("negrito: 'Hello' 12pt → 39 (oráculo)", () => {
    assertEquals(fm.width("Arial-Bold", 12, "Hello",), 39,);
  });
});

describe("FontMetrics — checkFontName (17.11.3.6)", () => {
  it("height de fonte desconhecida levanta 'Unknown font'", () => {
    assertThrows(
      () => fm.height("Times", 12,),
      TjArgumentError,
      "Unknown font 'Times'!",
    );
  });

  it("width de fonte desconhecida levanta 'Unknown font'", () => {
    assertThrows(
      () => fm.width("Times", 12, "x",),
      TjArgumentError,
      "Unknown font 'Times'!",
    );
  });
});
