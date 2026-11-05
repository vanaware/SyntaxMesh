/**
 * 17.7.1 — `Color`.
 *
 * Todas as strings e triples foram conferidos contra o oráculo Ruby
 * (`docs/taskjuggler/lib/taskjuggler/Painter/Color.rb`) em 2026-11-04.
 *
 * @see packages/core/src/painter/color.ts
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertMatch, assertThrows, } from "@std/assert";

import { TjArgumentError, } from "../../src/model/errors.ts";
import { Color, NamedColors, } from "../../src/painter/color.ts";

describe("Color — NamedColors (17.7.1.2)", () => {
  it("tem pelo menos 140 cores nomeadas (o Ruby tem 147)", () => {
    const count = Object.keys(NamedColors,).length;
    assert(count >= 140, `NamedColors tem ${count}`,);
    assertEquals(count, 147,);
  });

  it("expose o mapa também como estático da classe", () => {
    assertEquals(Color.NamedColors, NamedColors,);
  });

  it("inclui as cores usadas pelo ChartPlotter e pelos reports", () => {
    for (
      const name of ["black", "white", "red", "green", "blue", "gray", "grey",]
    ) {
      assertEquals(NamedColors[name]?.length, 3, name,);
    }
    assertEquals(NamedColors["black"], [0, 0, 0,],);
    assertEquals(NamedColors["grey"], [128, 128, 128,],);
  });
});

describe("Color — construtor variádico (17.7.1.3)", () => {
  it("1 argumento: nome conhecido vira o triple da tabela", () => {
    assertEquals(new Color("tomato",).to_rgb(), [255, 99, 71,],);
  });

  it("3 argumentos: RGB direto", () => {
    assertEquals(new Color(10, 20, 30,).to_rgb(), [10, 20, 30,],);
  });

  it("4 argumentos: HSV (o 4º é ignorado, como no Ruby)", () => {
    assertEquals(new Color(0, 255, 255, "hsv",).to_rgb(), [255, 0, 0,],);
    assertEquals(new Color(0, 255, 255, 9999,).to_rgb(), [255, 0, 0,],);
  });

  it("aridade inválida: ArgumentError sem mensagem no Ruby", () => {
    const Bare = Color as unknown as (new (...a: unknown[]) => Color);
    for (const args of [[], [1, 2,], [1, 2, 3, 4, 5,],]) {
      assertThrows(() => new Bare(...args,), TjArgumentError, "ArgumentError",);
    }
  });

  it("nome desconhecido levanta RuntimeError com o nome na mensagem", () => {
    const err = assertThrows(() => new Color("notacolor",), Error,);
    assertEquals(err.message, "Unknown color name notacolor",);
  });

  it("nomes são case-sensitive (como no Ruby)", () => {
    assertThrows(() => new Color("Red",), Error, "Unknown color name Red",);
  });
});

describe("Color — validação de faixas (17.7.1.3)", () => {
  it("RGB aceita 0 e 255 e rejeita 256 com a lista joinada", () => {
    assertEquals(new Color(0, 0, 255,).to_rgb(), [0, 0, 255,],);
    const err = assertThrows(
      () => new Color(0, 0, 256,),
      TjArgumentError,
    ) as TjArgumentError;
    assertEquals(
      err.message,
      "RGB values (0, 0, 256) must be between 0 and 255.",
    );
  });

  it("RGB rejeita negativos", () => {
    assertThrows(
      () => new Color(-1, 0, 0,),
      TjArgumentError,
      "RGB values (-1, 0, 0) must be between 0 and 255.",
    );
  });

  it("RGB aceita 255.5 (a faixa é `< 256`), mas `to_s` trunca", () => {
    assertEquals(new Color(0, 0, 255.5,).to_rgb(), [0, 0, 255.5,],);
    assertEquals(new Color(0, 0, 255.5,).to_s(), "#0000ff",);
  });

  it("hue fora de 0-360: mensagem sem valor interpolado", () => {
    assertThrows(
      () => new Color(360, 255, 255, "hsv",),
      TjArgumentError,
      "Hue value must be between 0 and 360",
    );
    assertThrows(
      () => new Color(-1, 255, 255, "hsv",),
      TjArgumentError,
      "Hue value must be between 0 and 360",
    );
  });

  it("saturação 256: mensagem com o valor", () => {
    assertThrows(
      () => new Color(0, 256, 255, "hsv",),
      TjArgumentError,
      "Saturation value (256) must be between 0 and 255",
    );
  });

  it("valor (brightness) fora de 0-255: 'Color value'", () => {
    assertThrows(
      () => new Color(0, 255, -1, "hsv",),
      TjArgumentError,
      "Color value (-1) must be between 0 and 255",
    );
    assertThrows(
      () => new Color(0, 255, 256, "hsv",),
      TjArgumentError,
      "Color value (256) must be between 0 and 255",
    );
  });
});

describe("Color — to_rgb (17.7.1.4)", () => {
  it("devolve uma cópia nova a cada chamada", () => {
    const c = new Color("red",);
    const a = c.to_rgb();
    const b = c.to_rgb();
    assertEquals(a, b,);
    assert(a !== b,);
  });

  it("preserva o triple das cores nomeadas", () => {
    assertEquals(new Color("steelblue",).to_rgb(), [70, 130, 180,],);
    assertEquals(new Color("yellowgreen",).to_rgb(), [154, 205, 50,],);
  });

  it("mantém o v fracionário vindo de HSV (Categoria C do Ruby)", () => {
    assertEquals(new Color(40, 200, 240.5, "hsv",).to_rgb(), [
      240.5,
      177,
      51,
    ],);
  });
});

describe("Color — to_hsv (17.7.1.5)", () => {
  it("cores puras mapeiam para os sextantes de 60 graus", () => {
    assertEquals(new Color("red",).to_hsv(), [0, 255, 255,],);
    assertEquals(new Color(0, 255, 0,).to_hsv(), [120, 255, 255,],);
    assertEquals(new Color(0, 0, 255,).to_hsv(), [240, 255, 255,],);
    assertEquals(new Color(255, 255, 0,).to_hsv(), [60, 255, 255,],);
    assertEquals(new Color(0, 255, 255,).to_hsv(), [180, 255, 255,],);
    assertEquals(new Color(255, 0, 255,).to_hsv(), [300, 255, 255,],);
  });

  it("tons de cinza têm saturação 0 e hue 0", () => {
    assertEquals(new Color(128, 128, 128,).to_hsv(), [0, 0, 128,],);
    assertEquals(new Color("black",).to_hsv(), [0, 0, 0,],);
  });

  it("trunca (não arredonda) os resultados fracionários", () => {
    // Ruby: (255-71)/184*... → h = 9.xx → to_i = 9
    assertEquals(new Color("tomato",).to_hsv(), [9, 184, 255,],);
    assertEquals(new Color("khaki",).to_hsv(), [54, 106, 240,],);
  });
});

describe("Color — to_s (17.7.1.6)", () => {
  it("formato #rrggbb em minúsculas", () => {
    assertEquals(new Color("red",).to_s(), "#ff0000",);
    assertEquals(new Color(255, 128, 0,).to_s(), "#ff8000",);
  });

  it("completa com zeros à esquerda", () => {
    assertEquals(new Color("black",).to_s(), "#000000",);
    assertEquals(new Color(0, 1, 15,).to_s(), "#00010f",);
  });

  it("match com o padrão hexadecimal de 6 dígitos", () => {
    assertMatch(new Color("mediumseagreen",).to_s(), /^#[0-9a-f]{6}$/,);
  });

  it("é o que o SVG/HTML espera nas cores do ChartPlotter", () => {
    // Ruby: Color.new(60, 255, 230, :hsv).to_s == '#e6e600' (ci = 0)
    assertEquals(new Color(60, 255, 230, "hsv",).to_s(), "#e6e600",);
  });
});

describe("Color — hsvToRgb (17.7.1.7)", () => {
  it("cada sextante produz a cor primária/secundária esperada", () => {
    assertEquals(new Color(0, 255, 255, "hsv",).to_rgb(), [255, 0, 0,],);
    assertEquals(new Color(60, 255, 255, "hsv",).to_rgb(), [255, 255, 0,],);
    assertEquals(new Color(120, 255, 255, "hsv",).to_rgb(), [0, 255, 0,],);
    assertEquals(new Color(180, 255, 255, "hsv",).to_rgb(), [0, 255, 255,],);
    assertEquals(new Color(240, 255, 255, "hsv",).to_rgb(), [0, 0, 255,],);
    assertEquals(new Color(300, 255, 255, "hsv",).to_rgb(), [255, 0, 255,],);
  });

  it("hue 359 cai no último sextante (perto de vermelho)", () => {
    assertEquals(new Color(359, 255, 255, "hsv",).to_rgb(), [255, 0, 4,],);
  });

  it("hue intermediário com f != 0 (case do plano: 40, 200, 240)", () => {
    assertEquals(new Color(40, 200, 240, "hsv",).to_rgb(), [240, 177, 51,],);
  });

  it("saturação 0 devolve tons de cinza", () => {
    assertEquals(new Color(200, 0, 128, "hsv",).to_rgb(), [128, 128, 128,],);
  });

  it("valor 0 devolve preto em qualquer sextante", () => {
    assertEquals(new Color(200, 255, 0, "hsv",).to_rgb(), [0, 0, 0,],);
  });

  it("sequência do ChartPlotter (hue rotativo, s=255-ci/8, v=230)", () => {
    const rgb = (ci: number,): number[] =>
      new Color(
        (60 * (ci % 6) + Math.floor(60 / (1 + Math.floor(ci / 6,)),)) % 360,
        255 - Math.floor(ci / 8,),
        230,
        "hsv",
      ).to_rgb();
    assertEquals(rgb(0,), [230, 230, 0,],);
    assertEquals(rgb(1,), [0, 230, 0,],);
    assertEquals(rgb(5,), [230, 0, 0,],);
    assertEquals(rgb(6,), [230, 115, 0,],);
    assertEquals(rgb(8,), [0, 230, 115,],);
    assertEquals(rgb(9,), [0, 115, 230,],);
  });
});

describe("Color — rgbToHsv (17.7.1.8)", () => {
  it("hue 0 quando o vermelho é o máximo", () => {
    assertEquals(new Color(128, 0, 0,).to_hsv(), [0, 255, 128,],);
  });

  it("hue 207 quando o azul é o máximo (steelblue)", () => {
    assertEquals(new Color("steelblue",).to_hsv(), [207, 155, 180,],);
  });

  it("hue positivo mesmo quando (g-b) é negativo", () => {
    // Ruby: (0, 0, 200) → h = (4 + 0/200) * 60 = 240; s = 200/200*255 = 255
    assertEquals(new Color(0, 0, 200,).to_hsv(), [240, 255, 200,],);
    // Ruby: (0, 10, 200) → h = (4 - 10/200) * 60 = 237 (to_i trunca)
    assertEquals(new Color(0, 10, 200,).to_hsv(), [237, 255, 200,],);
  });

  it("round-trip sem drift em cores de sextante", () => {
    for (const name of ["red", "white", "gray", "khaki", "steelblue",]) {
      const c = new Color(name,);
      const [h, s, v,] = c.to_hsv();
      assertEquals(new Color(h, s, v, "hsv",).to_rgb(), c.to_rgb(), name,);
    }
  });

  it("round-trip com drift em cores de saturação alta (truncamento)", () => {
    const c = new Color("tomato",);
    const [h, s, v,] = c.to_hsv();
    assertEquals(new Color(h, s, v, "hsv",).to_rgb(), [255, 98, 71,],);
  });
});

describe("Color — exemplos do plano (17.7.1.9/10)", () => {
  it("new Color('red').to_s() === '#ff0000'", () => {
    assertEquals(new Color("red",).to_s(), "#ff0000",);
  });

  it("new Color(255, 128, 0).to_s() === '#ff8000'", () => {
    assertEquals(new Color(255, 128, 0,).to_s(), "#ff8000",);
  });
});
