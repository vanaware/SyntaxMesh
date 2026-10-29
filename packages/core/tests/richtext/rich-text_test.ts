/**
 * Testes de `RichText`, `RichTextFactory` e integração com o parser
 * (Fase 12.18).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText.rb
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { RichText, } from "../../src/richtext/rich-text.ts";
import { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import { RTFHandlers, } from "../../src/richtext/handlers/rtf-handlers.ts";
import {
  type RichTextFactory,
  RichTextFactoryImpl,
} from "../../src/richtext/factory.ts";
import { ProjectFileParser, } from "../../src/parser/project-file-parser.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { RichTextFunctionArgs, } from "../../src/richtext/handlers/function-handler.ts";
import { RichTextFunctionHandler, } from "../../src/richtext/handlers/function-handler.ts";
import type { XMLElementLike, } from "../../src/richtext/xml-like.ts";

/** Handler inline trivial para verificar cópia + despacho. */
class InlineEcho extends RichTextFunctionHandler {
  override to_s(args: RichTextFunctionArgs,): string {
    return `echo:${args["x"] ?? "?"}`;
  }
  override to_html(_args: RichTextFunctionArgs,): XMLElementLike | null {
    return null;
  }
  override to_tagged(_args: RichTextFunctionArgs,): string | null {
    return null;
  }
}

describe("RichText / RichTextFactory / integração (12.18)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  describe("RichText.generateIntermediateFormat", () => {
    it("texto puro produz rti com to_s igual ao texto", () => {
      const rt = new RichText("hello world",);
      const rti = rt.generateIntermediateFormat();
      assert(rti !== null,);
      assertEquals(rti.to_s(), "hello world",);
    });

    it("markup negrito produz categoria bold na árvore", () => {
      const rt = new RichText("isto é '''negrito''' aqui",);
      const rti = rt.generateIntermediateFormat();
      assert(rti !== null,);
      const cats: string[] = [];
      const walk = (el: { category: string; children: unknown[] },) => {
        cats.push(el.category,);
        for (const c of el.children) {
          if (c && typeof c === "object" && "category" in c) {
            walk(c as { category: string; children: unknown[] },);
          }
        }
      };
      walk(rti.tree as unknown as { category: string; children: unknown[] },);
      assert(cats.includes("bold",), cats.join(",",),);
    });

    it("texto vazio produz rti com árvore vazia", () => {
      const rt = new RichText("",);
      const rti = rt.generateIntermediateFormat();
      assert(rti !== null, "vazio deve produzir rti, não null",);
      assertEquals(rti.tree!.empty(), true,);
    });

    it("copia os function handlers para o rti (via dup)", () => {
      const echo = new InlineEcho("echo", null,);
      echo.blockFunction = false;
      const rt = new RichText("x", [echo,],);
      const rti = rt.generateIntermediateFormat();
      const registered = rti!.functionHandlers.get("echo",);
      assert(registered !== undefined, "handler deve ser registrado",);
      assertEquals(registered !== echo, true, "deve ser uma cópia (dup)",);
      assertEquals(registered!.function, "echo",);
    });

    it("functionHandler(name, block) busca por função e modo", () => {
      const inline = new InlineEcho("fn", null,);
      inline.blockFunction = false;
      const rt = new RichText("x", [inline,],);
      assertEquals(rt.functionHandler("fn", false,)?.function, "fn",);
      assertEquals(rt.functionHandler("fn", true,), null,);
      assertEquals(rt.functionHandler("outro", false,), null,);
    });

    it("reutiliza o parser singleton sem vazar estado entre chamadas", () => {
      const a = new RichText("primeiro paragrafo",)
        .generateIntermediateFormat();
      const b = new RichText("segundo paragrafo",).generateIntermediateFormat();
      assertEquals(a!.to_s(), "primeiro paragrafo",);
      assertEquals(b!.to_s(), "segundo paragrafo",);
    });
  });

  describe("RichTextFactoryImpl", () => {
    it("create devolve rti com os handlers padrão registrados", () => {
      const factory = new RichTextFactoryImpl(null, null,);
      const rti = factory.create("documento simples",);
      assert(rti instanceof RichTextIntermediate,);
      assertEquals(rti.to_s(), "documento simples",);
      for (const name of ["query", "report", "reportlink", "navigator",]) {
        assert(rti.functionHandlers.has(name,), `faltou handler ${name}`,);
      }
    });

    it("create aceita tokenSet opcional", () => {
      const factory = new RichTextFactoryImpl(null,);
      const rti = factory.create("texto", null,);
      assertEquals(rti.to_s(), "texto",);
    });
  });

  describe("ProjectFileParser integration", () => {
    it("newRichText produz rti real (não stub) com sectionNumbers=false", () => {
      const parser = new ProjectFileParser();
      const rti = parser.newRichText("nota de teste", null,);
      assert(rti instanceof RichTextIntermediate,);
      assertEquals(rti.to_s(), "nota de teste",);
      assertEquals(rti.sectionNumbers, false,);
    });

    it("newRichText usa a fábrica injetada via setRichTextFactory", () => {
      let called = 0;
      const fake: RichTextFactory = {
        create(text: string,): RichTextIntermediate {
          called++;
          const rt = new RichText(text, RTFHandlers.create(null,),);
          return rt.generateIntermediateFormat()!;
        },
      };
      const parser = new ProjectFileParser();
      parser.setRichTextFactory(fake,);
      const rti = parser.newRichText("via fabrica", null,);
      assertEquals(called, 1,);
      assertEquals(rti.to_s(), "via fabrica",);
    });

    it("newRichText faz baseline do SFI e o restaura depois", () => {
      const mh = MessageHandlerInstance.instance;
      const parser = new ProjectFileParser();
      parser.newRichText("x", null,);
      assertEquals(mh.baselineSFI, null, "baseline deve ser resetado",);
    });
  });
});
