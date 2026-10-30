/**
 * Testes do pipeline de extração (Fase 13.8).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.8)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { ExtractionPipeline, } from "../../../src/markdown/extensions/pipeline.ts";
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

describe("ExtractionPipeline (13.8)", () => {
  describe("preprocess (13.8.4)", () => {
    it("extrai color, functions e mini-queries em ordem", () => {
      const pipeline = new ExtractionPipeline();
      const result = pipeline.preprocess(
        "<fcol:red>[[query:attribute=effort]] <-cost-></fcol>",
      );
      // Placeholder de color no texto:
      assert(result.includes("§COLOR_0§",),);
      // Extrações internas: FUNC e MINIQ dentro da cor:
      const all = pipeline.all();
      assert(all.length >= 3, `expected >= 3, got ${all.length}`,);
    });

    it("color sozinho produz placeholder COLOR", () => {
      const pipeline = new ExtractionPipeline();
      const text = pipeline.preprocess("<fcol:blue>hello</fcol>",);
      assertEquals(text, "§COLOR_0§",);
      const ext = pipeline.lookup("§COLOR_0§",);
      assert(ext, "deveria ter extração registrada",);
      assertEquals(ext.category, "fontCol",);
    });

    it("function sozinha produz placeholder FUNC", () => {
      const pipeline = new ExtractionPipeline();
      const text = pipeline.preprocess("[[query:attribute=effort]]",);
      assertEquals(text, "§FUNC_0§",);
      const ext = pipeline.lookup("§FUNC_0§",);
      assert(ext,);
      assertEquals(ext.category, "inlinefunc",);
    });

    it("mini-query sozinha produz placeholder MINIQ", () => {
      const pipeline = new ExtractionPipeline();
      const text = pipeline.preprocess("<-effort->",);
      assertEquals(text, "§MINIQ_0§",);
      const ext = pipeline.lookup("§MINIQ_0§",);
      assert(ext,);
      assertEquals(ext.payload[0], "query",);
    });
  });

  describe("postprocessMdast (13.8.5)", () => {
    it("restitui nós richtextExtension na AST", () => {
      const pipeline = new ExtractionPipeline();
      const text = pipeline.preprocess("<fcol:red>ola</fcol>",);
      const ast = pipeline.postprocessMdast(parseMdast(text,),);
      const nodes = extensions(ast,);
      assertEquals(nodes.length, 1,);
      assertEquals(nodes[0]!.category, "fontCol",);
      assertEquals(nodes[0]!.payload, "red",);
    });

    it("função vira nó inlinefunc", () => {
      const pipeline = new ExtractionPipeline();
      const text = pipeline.preprocess("[[query:attribute=effort]]",);
      const ast = pipeline.postprocessMdast(parseMdast(text,),);
      const nodes = extensions(ast,);
      assertEquals(nodes.length, 1,);
      assertEquals(nodes[0]!.category, "inlinefunc",);
    });

    it("report sozinho vira blockfunc", () => {
      const pipeline = new ExtractionPipeline();
      const text = pipeline.preprocess("[[report:id=r1]]",);
      const ast = pipeline.postprocessMdast(parseMdast(text,),);
      const nodes = extensions(ast,);
      assertEquals(nodes[0]!.category, "blockfunc",);
    });

    it("texto sem extensões passa inalterado", () => {
      const pipeline = new ExtractionPipeline();
      const text = pipeline.preprocess("hello world",);
      const ast = pipeline.postprocessMdast(parseMdast(text,),);
      assertEquals(extensions(ast,).length, 0,);
    });
  });

  describe("placeholders únicos (13.8.6)", () => {
    it("color + functions + mini-queries no mesmo texto", () => {
      const pipeline = new ExtractionPipeline();
      const text = pipeline.preprocess(
        "<fcol:red>a</fcol> [[query:x]] <-effort-> <fcol:blue>b</fcol> [[report:id=r]]",
      );
      // Deve ter placeholders COLOR_0, COLOR_1, FUNC_0, FUNC_1, MINIQ_0
      assert(text.includes("§COLOR_0§",),);
      assert(text.includes("§COLOR_1§",),);
      assert(text.includes("§FUNC_0§",),);
      assert(text.includes("§MINIQ_0§",),);
      // Contadores por tipo são independentes
      const all = pipeline.all();
      const colors = all.filter((e,) => e.category === "fontCol");
      assertEquals(colors.length, 2,);
    });

    it("pipeline reset zera estado", () => {
      const pipeline = new ExtractionPipeline();
      pipeline.preprocess("<fcol:red>x</fcol>",);
      pipeline.reset();
      const text = pipeline.preprocess("<fcol:red>y</fcol>",);
      assertEquals(text, "§COLOR_0§",);
      assertEquals(pipeline.all().length, 1,);
    });
  });

  describe("conteúdo de cor processado recursivamente", () => {
    it("mini-query dentro de <fcol> é extraída", () => {
      const pipeline = new ExtractionPipeline();
      const text = pipeline.preprocess("<fcol:red><-effort-></fcol>",);
      const ast = pipeline.postprocessMdast(parseMdast(text,),);
      const nodes = extensions(ast,);
      // fontCol + inlinefunc nested = 2 extension nodes
      assertEquals(nodes.length, 2,);
      const fontCol = nodes.find((n,) => n.category === "fontCol");
      assert(fontCol, "deveria ter fontCol",);
      assert(fontCol!.children.length > 0,);
    });
  });
});
