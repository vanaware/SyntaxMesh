/**
 * Testes dos stubs de handler e da fábrica `RTFHandlers` (Fases 12.15–12.17).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFHandlers.rb
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { RTFReport, } from "../../src/richtext/handlers/rtf-report.ts";
import { RTFReportLink, } from "../../src/richtext/handlers/rtf-report-link.ts";
import { RTFNavigator, } from "../../src/richtext/handlers/rtf-navigator.ts";
import { RTFQuery, } from "../../src/richtext/handlers/rtf-query.ts";
import { RTFHandlers, } from "../../src/richtext/handlers/rtf-handlers.ts";
import { NotYetImplementedError, } from "../../src/model/errors.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";

describe("handlers stub + RTFHandlers (12.15-12.17)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  describe("RTFReport (stub)", () => {
    it("function = report, blockFunction = true", () => {
      const h = new RTFReport(null,);
      assertEquals(h.function, "report",);
      assertEquals(h.blockFunction, true,);
      assertEquals(h.to_s({},), "",);
      assertEquals(h.to_tagged({},), null,);
    });

    it("to_html lança NotYetImplementedError (Fase 14)", () => {
      const h = new RTFReport(null,);
      assertThrows(() => h.to_html({ id: "x", },), NotYetImplementedError,);
    });
  });

  describe("RTFReportLink (stub)", () => {
    it("function = reportlink, não-bloco", () => {
      const h = new RTFReportLink(null,);
      assertEquals(h.function, "reportlink",);
      assertEquals(h.blockFunction, false,);
    });

    it("to_html lança NotYetImplementedError (Fase 14)", () => {
      const h = new RTFReportLink(null,);
      assertThrows(() => h.to_html({ id: "x", },), NotYetImplementedError,);
    });
  });

  describe("RTFNavigator (stub)", () => {
    it("function = navigator, blockFunction = true", () => {
      const h = new RTFNavigator(null,);
      assertEquals(h.function, "navigator",);
      assertEquals(h.blockFunction, true,);
      assertEquals(h.to_s({},), "",);
    });

    it("to_html lança NotYetImplementedError (Fase 14)", () => {
      const h = new RTFNavigator(null,);
      assertThrows(() => h.to_html({ id: "x", },), NotYetImplementedError,);
    });

    it("id ausente registra rtf_nav_id_missing antes de lançar", () => {
      const h = new RTFNavigator(null,);
      assertThrows(() => h.to_html({},), NotYetImplementedError,);
      assert(
        MessageHandlerInstance.instance.messages.some((m,) =>
          m.id === "rtf_nav_id_missing"
        ),
      );
    });
  });

  describe("RTFHandlers.create", () => {
    it("retorna 4 handlers nas funções corretas", () => {
      const project = createTestProject(1,);
      const handlers = RTFHandlers.create(project, null,);
      assertEquals(handlers.length, 4,);
      assertEquals(
        handlers.map((h,) => h.function),
        ["navigator", "query", "report", "reportlink",],
      );
    });

    it("bloco vs inline: navigator/report são bloco; query/reportlink não", () => {
      const handlers = RTFHandlers.create(null,);
      const byName = Object.fromEntries(
        handlers.map((h,) => [h.function, h.blockFunction,]),
      );
      assertEquals(byName["navigator"], true,);
      assertEquals(byName["report"], true,);
      assertEquals(byName["query"], false,);
      assertEquals(byName["reportlink"], false,);
    });

    it("RTFQuery e RTFReportLink aceitam setQuery", () => {
      const handlers = RTFHandlers.create(null,);
      const query = handlers.find((h,) => h.function === "query")!;
      const link = handlers.find((h,) => h.function === "reportlink")!;
      assertEquals(
        typeof (query as { setQuery?: unknown }).setQuery,
        "function",
      );
      assertEquals(
        typeof (link as { setQuery?: unknown }).setQuery,
        "function",
      );
      // navigator e report NÃO expõem setQuery
      const nav = handlers.find((h,) => h.function === "navigator")!;
      assertEquals(
        typeof (nav as { setQuery?: unknown }).setQuery,
        "undefined",
      );
    });

    it("RTFQuery é instância real (não stub)", () => {
      const handlers = RTFHandlers.create(createTestProject(1,), null,);
      const query = handlers.find((h,) => h.function === "query")!;
      assert(query instanceof RTFQuery,);
    });
  });
});
