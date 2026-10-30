/**
 * Testes da extensão de cor `<fcol:…>` (Fase 13.4).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.4)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  colorToExtraction,
  isValidColor,
  NAMED_COLORS,
  postprocessColor,
  preprocessColor,
} from "../../../src/markdown/extensions/color.ts";
import { parseMdast, } from "../../../src/markdown/parse-mdast.ts";
import type { MdastExtension, } from "../../../src/markdown/types.ts";

/** Todos os nós `richtextExtension` da árvore. */
function extensions(node: unknown,): MdastExtension[] {
  const out: MdastExtension[] = [];
  const walk = (n: Record<string, unknown>,) => {
    if (n["type"] === "richtextExtension") {
      out.push(n as unknown as MdastExtension,);
    }
    for (const c of (n["children"] as Record<string, unknown>[]) ?? []) {
      walk(c,);
    }
  };
  walk(node as Record<string, unknown>,);
  return out;
}

describe("extensão color (13.4)", () => {
  it("extrai cor nomeada e deixa placeholder", () => {
    const { text, extractions, } = preprocessColor(
      "antes <fcol:red>alerta</fcol> depois",
    );
    assertEquals(text, "antes §COLOR_0§ depois",);
    assertEquals(extractions.length, 1,);
    assertEquals(extractions[0]!.color, "red",);
    assertEquals(extractions[0]!.content, "alerta",);
  });

  it("extrai cor hex #RRGGBB e #RGB", () => {
    const { extractions, } = preprocessColor(
      "<fcol:#FF8800>a</fcol> <fcol:#abc>b</fcol>",
    );
    assertEquals(extractions.map((e,) => e.color), ["#FF8800", "#abc",],);
  });

  it("cor inválida permanece texto simples", () => {
    const { text, extractions, } = preprocessColor(
      "<fcol:chartreuse>x</fcol>",
    );
    assertEquals(extractions.length, 0,);
    assertEquals(text, "<fcol:chartreuse>x</fcol>",);
  });

  it("múltiplas cores numeram placeholders sequentialmente", () => {
    const { text, extractions, } = preprocessColor(
      "<fcol:red>a</fcol> <fcol:blue>b</fcol> <fcol:green>c</fcol>",
    );
    assertEquals(extractions.length, 3,);
    assertEquals(text, "§COLOR_0§ §COLOR_1§ §COLOR_2§",);
  });

  it("startIndex produz placeholders únicos entre passadas", () => {
    const { extractions, } = preprocessColor("<fcol:red>a</fcol>", 5,);
    assertEquals(extractions[0]!.placeholder, "§COLOR_5§",);
  });

  it("conteúdo multi-linha é capturado", () => {
    const { extractions, } = preprocessColor(
      "<fcol:red>linha1\nlinha2</fcol>",
    );
    assertEquals(extractions[0]!.content, "linha1\nlinha2",);
  });

  describe("isValidColor (13.4.4)", () => {
    it("aceita as 16 cores nomeadas do RichText", () => {
      assertEquals(NAMED_COLORS.length, 16,);
      for (const color of NAMED_COLORS) {
        assert(isValidColor(color,), `${color} deveria ser válida`,);
      }
    });

    it("aceita #RGB e #RRGGBB", () => {
      assert(isValidColor("#abc",),);
      assert(isValidColor("#a1b2c3",),);
    });

    it("rejeita hex malformado", () => {
      assertEquals(isValidColor("#ab",), false,);
      assertEquals(isValidColor("#ggg",), false,);
      assertEquals(isValidColor("abc",), false,);
    });

    it("rejeita nomes fora da lista", () => {
      assertEquals(isValidColor("chartreuse",), false,);
      assertEquals(isValidColor("darkred",), false,);
    });

    it("é case-insensitive para nomes", () => {
      assert(isValidColor("RED",),);
    });
  });

  it("colorToExtraction gera payload de fontCol", () => {
    const { extractions, } = preprocessColor("<fcol:teal>x</fcol>",);
    const e = colorToExtraction(extractions[0]!,);
    assertEquals(e.category, "fontCol",);
    assertEquals(e.payload, "teal",);
    assertEquals(e.content, "x",);
    assertEquals(e.source, "<fcol:teal>x</fcol>",);
  });

  describe("postprocessColor (13.4.5)", () => {
    it("substitui placeholder por nó richtextExtension", () => {
      const { text, extractions, } = preprocessColor(
        "<fcol:red>alerta</fcol>",
      );
      const ast = postprocessColor(parseMdast(text,), extractions,);
      const nodes = extensions(ast,);
      assertEquals(nodes.length, 1,);
      assertEquals(nodes[0]!.category, "fontCol",);
      assertEquals(nodes[0]!.payload, "red",);
    });

    it("mantém o texto ao redor do placeholder", () => {
      const { text, extractions, } = preprocessColor(
        "antes <fcol:red>Y</fcol> depois",
      );
      const ast = postprocessColor(parseMdast(text,), extractions,);
      const para =
        ((ast as { children: unknown[] }).children[0] as unknown) as {
          children: Array<Record<string, unknown>>;
        };
      assertEquals(para.children.map((c,) => c["type"]), [
        "text",
        "richtextExtension",
        "text",
      ],);
      assertEquals(para.children[0]!["value"], "antes ",);
    });

    it("parseia markup inline dentro do conteúdo", () => {
      const { text, extractions, } = preprocessColor(
        "<fcol:red>**forte**</fcol>",
      );
      const ast = postprocessColor(parseMdast(text,), extractions,);
      const node = extensions(ast,)[0]!;
      assertEquals(node.children.length, 1,);
      assertEquals(node.children[0]!.type, "strong",);
    });

    it("sem extrações a árvore fica inalterada", () => {
      const ast = postprocessColor(parseMdast("texto simples",), [],);
      assertEquals(extensions(ast,).length, 0,);
    });

    it("três cores no mesmo texto viram três nós (13.4.6)", () => {
      const { text, extractions, } = preprocessColor(
        "<fcol:red>a</fcol>, <fcol:green>b</fcol> e <fcol:blue>c</fcol>",
      );
      const ast = postprocessColor(parseMdast(text,), extractions,);
      assertEquals(extensions(ast,).length, 3,);
      assertEquals(
        extensions(ast,).map((e,) => e.payload),
        ["red", "green", "blue",],
      );
    });
  });
});
