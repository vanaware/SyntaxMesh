/**
 * Testes da extensão de mini-queries `<-name->` (Fase 13.7).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.7)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  miniQueryToExtraction,
  postprocessMiniQueries,
  preprocessMiniQueries,
} from "../../../src/markdown/extensions/mini-query.ts";
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

describe("extensão mini-query (13.7)", () => {
  describe("preprocessMiniQueries (13.7.2, 13.7.3)", () => {
    it("extrai <-effort-> e deixa placeholder", () => {
      const { text, extractions, } = preprocessMiniQueries(
        "Custo: <-effort-> horas totais",
      );
      assertEquals(text, "Custo: §MINIQ_0§ horas totais",);
      assertEquals(extractions.length, 1,);
      assertEquals(extractions[0]!.attribute, "effort",);
    });

    it("extrai múltiplas mini-queries", () => {
      const { text, extractions, } = preprocessMiniQueries(
        "<-cost-> e <-revenue->",
      );
      assertEquals(extractions.length, 2,);
      assertEquals(text, "§MINIQ_0§ e §MINIQ_1§",);
    });

    it("startIndex produz placeholders únicos", () => {
      const { extractions, } = preprocessMiniQueries("<-effort->", 3,);
      assertEquals(extractions[0]!.placeholder, "§MINIQ_3§",);
    });

    it("sem mini-queries texto inalterado", () => {
      const { text, extractions, } = preprocessMiniQueries("hello",);
      assertEquals(text, "hello",);
      assertEquals(extractions.length, 0,);
    });

    it("preserva source", () => {
      const { extractions, } = preprocessMiniQueries("<-cost->",);
      assertEquals(extractions[0]!.source, "<-cost->",);
    });

    it("aceita atributos com underscore e números", () => {
      const { extractions, } = preprocessMiniQueries("<-my_attr2->",);
      assertEquals(extractions[0]!.attribute, "my_attr2",);
    });
  });

  describe("miniQueryToExtraction (13.7.4)", () => {
    it("gera payload ['query', { attribute }]", () => {
      const { extractions, } = preprocessMiniQueries("<-effort->",);
      const e = miniQueryToExtraction(extractions[0]!,);
      assertEquals(e.category, "inlinefunc",);
      assert(Array.isArray(e.payload,),);
      const [name, args,] = e.payload as [string, Record<string, string>,];
      assertEquals(name, "query",);
      assertEquals(args["attribute"], "effort",);
    });
  });

  describe("postprocessMiniQueries (13.7.4)", () => {
    it("substitui placeholder por nó richtextExtension", () => {
      const { text, extractions, } = preprocessMiniQueries("<-effort->",);
      const ast = postprocessMiniQueries(parseMdast(text,), extractions,);
      const nodes = extensions(ast,);
      assertEquals(nodes.length, 1,);
      assertEquals(nodes[0]!.category, "inlinefunc",);
      const [name, args,] = nodes[0]!.payload as [
        string,
        Record<string, string>,
      ];
      assertEquals(name, "query",);
      assertEquals(args["attribute"], "effort",);
    });

    it("múltiplas queries viram múltiplos nós", () => {
      const { text, extractions, } = preprocessMiniQueries(
        "<-cost-> e <-revenue->",
      );
      const ast = postprocessMiniQueries(parseMdast(text,), extractions,);
      assertEquals(extensions(ast,).length, 2,);
    });

    it("sem extrações AST inalterada", () => {
      const ast = postprocessMiniQueries(parseMdast("oi",), [],);
      assertEquals(extensions(ast,).length, 0,);
    });
  });

  describe("agregado (13.7.5)", () => {
    it("múltiplas mini-queries com texto ao redor", () => {
      const { text, extractions, } = preprocessMiniQueries(
        "De <-start-> até <-end-> com <-effort-> horas",
      );
      assertEquals(extractions.length, 3,);
      assertEquals(
        extractions.map((e,) => e.attribute),
        ["start", "end", "effort",],
      );
      const ast = postprocessMiniQueries(parseMdast(text,), extractions,);
      assertEquals(extensions(ast,).length, 3,);
    });
  });
});
