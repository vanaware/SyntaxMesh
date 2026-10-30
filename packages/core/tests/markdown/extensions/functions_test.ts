/**
 * Testes da extensão de funções `[[name:args]]` (Fase 13.6).
 *
 * @see docs/syntaxmesh/fases/fase-13-markdown.md (13.6)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  functionToExtraction,
  parseFunctionArgs,
  postprocessFunctions,
  preprocessFunctions,
} from "../../../src/markdown/extensions/functions.ts";
import { parseMdast, } from "../../../src/markdown/parse-mdast.ts";
import type { MdastExtension, } from "../../../src/markdown/types.ts";
import {
  DEFAULT_BLOCK_FUNCTIONS,
  DEFAULT_KNOWN_FUNCTIONS,
} from "../../../src/markdown/types.ts";

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

describe("extensão functions (13.6)", () => {
  describe("preprocessFunctions (13.6.3, 13.6.7)", () => {
    it("extrai query e deixa placeholder", () => {
      const { text, extractions, } = preprocessFunctions(
        "Total: [[query:attribute=effort]] horas",
      );
      assertEquals(text, "Total: §FUNC_0§ horas",);
      assertEquals(extractions.length, 1,);
      assertEquals(extractions[0]!.name, "query",);
    });

    it("extrai múltiplas funções com numeração sequencial", () => {
      const { text, extractions, } = preprocessFunctions(
        "[[query:attribute=cost]] e [[report:id=r1]]",
      );
      assertEquals(extractions.length, 2,);
      assertEquals(text, "§FUNC_0§ e §FUNC_1§",);
    });

    it("startIndex produz placeholders únicos entre passadas", () => {
      const { extractions, } = preprocessFunctions("[[query:x]]", 5,);
      assertEquals(extractions[0]!.placeholder, "§FUNC_5§",);
    });

    it("sem funções retorna texto inalterado", () => {
      const { text, extractions, } = preprocessFunctions("hello world",);
      assertEquals(text, "hello world",);
      assertEquals(extractions.length, 0,);
    });

    it("preserva source original", () => {
      const { extractions, } = preprocessFunctions(
        "[[query:attribute=effort]]",
      );
      assertEquals(
        extractions[0]!.source,
        "[[query:attribute=effort]]",
      );
    });
  });

  describe("parseFunctionArgs (13.6.4, 13.6.5, 13.6.6)", () => {
    it("key=value simples", () => {
      assertEquals(parseFunctionArgs("report", "id=r1",), { id: "r1", },);
    });

    it('key="valor com espaço"', () => {
      assertEquals(
        parseFunctionArgs("query", 'attribute="effort total"',),
        { attribute: "effort total", },
      );
    });

    it("múltiplos pares key=value", () => {
      const result = parseFunctionArgs(
        "report",
        'headline="My Report" id=report1',
      );
      assertEquals(result["headline"], "My Report",);
      assertEquals(result["id"], "report1",);
    });

    it("posicional isolado em query vira attribute", () => {
      assertEquals(parseFunctionArgs("query", "effort",), {
        attribute: "effort",
      },);
    });

    it("posicional em outras funções vira _1", () => {
      assertEquals(parseFunctionArgs("report", "myid",), { _1: "myid", },);
    });

    it("mistura key=value e posicional", () => {
      const result = parseFunctionArgs("query", "attribute=cost start=2024",);
      assertEquals(result["attribute"], "cost",);
      assertEquals(result["start"], "2024",);
    });
  });

  describe("functionToExtraction", () => {
    it("gera Extraction com category inlinefunc", () => {
      const { extractions, } = preprocessFunctions(
        "[[query:attribute=effort]]",
      );
      const e = functionToExtraction(extractions[0]!,);
      assertEquals(e.category, "inlinefunc",);
      assert(Array.isArray(e.payload,),);
      assertEquals(
        (e.payload as [string, Record<string, string>,])[0],
        "query",
      );
    });
  });

  describe("postprocessFunctions (13.6.8)", () => {
    it("substitui placeholder por nó richtextExtension", () => {
      const { text, extractions, } = preprocessFunctions(
        "[[query:attribute=effort]]",
      );
      const ast = postprocessFunctions(parseMdast(text,), extractions,);
      const nodes = extensions(ast,);
      assertEquals(nodes.length, 1,);
      assertEquals(nodes[0]!.category, "inlinefunc",);
      assertEquals(
        (nodes[0]!.payload as [string, Record<string, string>,])[0],
        "query",
      );
    });

    it("[[report:...]] sozinho vira blockfunc (13.6.8)", () => {
      const { text, extractions, } = preprocessFunctions("[[report:id=r1]]",);
      const ast = postprocessFunctions(parseMdast(text,), extractions, {
        isBlockFunction: (name,) => DEFAULT_BLOCK_FUNCTIONS.includes(name,),
      },);
      const nodes = extensions(ast,);
      assertEquals(nodes.length, 1,);
      assertEquals(nodes[0]!.category, "blockfunc",);
    });

    it("[[navigator:...]] sozinho vira blockfunc", () => {
      const { text, extractions, } = preprocessFunctions(
        "[[navigator:id=n1]]",
      );
      const ast = postprocessFunctions(parseMdast(text,), extractions, {
        isBlockFunction: (name,) => DEFAULT_BLOCK_FUNCTIONS.includes(name,),
      },);
      const nodes = extensions(ast,);
      assertEquals(nodes[0]!.category, "blockfunc",);
    });

    it("[[query:...]] sozinho permanece inlinefunc", () => {
      const { text, extractions, } = preprocessFunctions(
        "[[query:attribute=effort]]",
      );
      const ast = postprocessFunctions(parseMdast(text,), extractions, {
        isBlockFunction: (name,) => DEFAULT_BLOCK_FUNCTIONS.includes(name,),
      },);
      const nodes = extensions(ast,);
      assertEquals(nodes[0]!.category, "inlinefunc",);
    });
  });

  describe("função desconhecida (13.6.10)", () => {
    it("volta como texto cru quando isKnownFunction rejeita", () => {
      const { text, extractions, } = preprocessFunctions(
        "[[unknown:foo=bar]]",
      );
      const ast = postprocessFunctions(parseMdast(text,), extractions, {
        isKnownFunction: (name,) => DEFAULT_KNOWN_FUNCTIONS.includes(name,),
      },);
      assertEquals(extensions(ast,).length, 0,);
      // O texto original deve estar preservado como nó text
      const para =
        ((ast as { children: unknown[] }).children[0] as unknown) as {
          children: Array<{ type: string; value?: string }>;
        };
      assertEquals(para.children[0]!.type, "text",);
      assert(para.children[0]!.value!.includes("[[unknown:foo=bar]]",),);
    });

    it("sem isKnownFunction aceita tudo", () => {
      const { text, extractions, } = preprocessFunctions(
        "[[whatever:foo=bar]]",
      );
      const ast = postprocessFunctions(parseMdast(text,), extractions,);
      assertEquals(extensions(ast,).length, 1,);
    });
  });

  describe("agregado (13.6.9)", () => {
    it("3 funções → 3 extrações", () => {
      const { extractions, } = preprocessFunctions(
        "[[query:attribute=effort]] [[report:id=r1]] [[navigator:id=n1]]",
      );
      assertEquals(extractions.length, 3,);
    });
  });
});
