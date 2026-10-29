/**
 * Testes de `RTFWithQuerySupport` (Fase 12.13).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFWithQuerySupport.rb
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { RTFWithQuerySupport, } from "../../src/richtext/handlers/rtf-with-query-support.ts";
import type { RichTextFunctionArgs, } from "../../src/richtext/handlers/function-handler.ts";
import type { XMLElementLike, } from "../../src/richtext/xml-like.ts";
import { Query, } from "../../src/query/query.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";

/** Subclasse concreta mínima para exercitar a base. */
class ProbeQueryHandler extends RTFWithQuerySupport {
  to_s(_args: RichTextFunctionArgs,): string {
    return "";
  }
  to_html(_args: RichTextFunctionArgs,): XMLElementLike | null {
    return null;
  }
  to_tagged(_args: RichTextFunctionArgs,): string | null {
    return null;
  }
  /** Expõe o `query` protegido para asserções. */
  currentQuery(): Query | null {
    return this.query;
  }
}

describe("RTFWithQuerySupport", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("constructor inicia query = null e preserva function/sfi", () => {
    const h = new ProbeQueryHandler("query",);
    assertEquals(h.function, "query",);
    assertEquals(h.blockFunction, false,);
    assertEquals(h.currentQuery(), null,);
  });

  it("setQuery duplica a query (não guarda a mesma instância)", () => {
    const h = new ProbeQueryHandler("query",);
    const q = new Query({ attributeId: "effort", },);
    h.setQuery(q,);
    const stored = h.currentQuery();
    assertEquals(stored !== q, true, "handler deve armazenar uma cópia",);
    assertEquals(stored!.attributeId, "effort",);
  });

  it("setQuery duplicada reflete o estado da origem", () => {
    const h = new ProbeQueryHandler("query",);
    const q = new Query({ propertyId: "!task", loadUnit: "hours", },);
    h.setQuery(q,);
    const stored = h.currentQuery()!;
    assertEquals(stored.propertyId, "!task",);
    assertEquals(stored.loadUnit, "hours",);
  });

  it("dup() do handler preserva a query registrada", () => {
    const h = new ProbeQueryHandler("query",);
    h.setQuery(new Query({ attributeId: "effort", },),);
    const copy = h.dup();
    assertEquals(copy.currentQuery()!.attributeId, "effort",);
    assertEquals(copy.function, "query",);
  });
});
