/**
 * Testes da base `RichTextFunctionHandler` (Fase 12.11).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/FunctionHandler.rb
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { RichTextFunctionHandler, } from "../../src/richtext/handlers/function-handler.ts";
import type {
  RichTextFunctionArgs,
} from "../../src/richtext/handlers/function-handler.ts";
import type { XMLElementLike, } from "../../src/richtext/xml-like.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { SourceFileInfo, } from "../../src/source-file-info.ts";

/** Subclasse concreta mínima só para exercitar a base. */
class ProbeHandler extends RichTextFunctionHandler {
  to_s(args: RichTextFunctionArgs,): string {
    return args.x ?? "";
  }
  to_html(_args: RichTextFunctionArgs,): XMLElementLike | null {
    return null;
  }
  to_tagged(_args: RichTextFunctionArgs,): string | null {
    return null;
  }
  /** Expõe os helpers protegidos para o teste. */
  fireError(id: string, msg: string,): void {
    this.error(id, msg,);
  }
  fireWarning(id: string, msg: string,): void {
    this.warning(id, msg,);
  }
}

describe("RichTextFunctionHandler (base)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("constructor guarda function, sfi e blockFunction=false", () => {
    const sfi = new SourceFileInfo("f.tjp", 3, 1,);
    const h = new ProbeHandler("query", sfi,);
    assertEquals(h.function, "query",);
    assertEquals(h.blockFunction, false,);
    assertEquals(h.sourceFileInfo, sfi,);
  });

  it("sourceFileInfo default null", () => {
    const h = new ProbeHandler("example",);
    assertEquals(h.sourceFileInfo, null,);
  });

  it("blockFunction é mutável (subclasses ajustam)", () => {
    const h = new ProbeHandler("report",);
    h.blockFunction = true;
    assertEquals(h.blockFunction, true,);
  });

  it("error() roteia ao MessageHandlerInstance com a sourceFileInfo", () => {
    const sfi = new SourceFileInfo("r.tjp", 7, 2,);
    const h = new ProbeHandler("query", sfi,);
    h.fireError("query_error", "boom",);
    assertEquals(MessageHandlerInstance.instance.errors, 1,);
    const msg = MessageHandlerInstance.instance.messages[0]!;
    assertEquals(msg.id, "query_error",);
    assertEquals(msg.sourceFileInfo, sfi,);
  });

  it("warning() registra mensagem de aviso sem contar erro", () => {
    const h = new ProbeHandler("query",);
    h.fireWarning("bad_arg", "ops",);
    assertEquals(MessageHandlerInstance.instance.errors, 0,);
    const msg = MessageHandlerInstance.instance.messages[0]!;
    assertEquals(msg.type, "warning",);
    assertEquals(msg.id, "bad_arg",);
  });
});
