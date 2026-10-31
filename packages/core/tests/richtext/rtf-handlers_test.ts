/**
 * Testes dos handlers `RTFHandlers` (Fases 12.15–12.17; RTFReport e
 * RTFReportLink completos em 14.24.6 — ADR 027: embed de relatório via
 * ReportContext, sem escrita a disco).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFHandlers.rb
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { RTFReport, } from "../../src/richtext/handlers/rtf-report.ts";
import { RTFReportLink, } from "../../src/richtext/handlers/rtf-report-link.ts";
import { RTFNavigator, } from "../../src/richtext/handlers/rtf-navigator.ts";
import { RTFQuery, } from "../../src/richtext/handlers/rtf-query.ts";
import { RTFHandlers, } from "../../src/richtext/handlers/rtf-handlers.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { RichText, } from "../../src/richtext/rich-text.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
// Efeito colateral: registra as fábricas de conteúdo (TextReport, …) que
// `RTFReport#to_html` invoca via `generateIntermediateFormat`.
import "../../src/reports/mod.ts";

describe("handlers RTF + RTFHandlers (12.15-12.17, 14.24.6)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  describe("RTFReport (completo em 14.24.6)", () => {
    it("function = report, blockFunction = true", () => {
      const h = new RTFReport(null,);
      assertEquals(h.function, "report",);
      assertEquals(h.blockFunction, true,);
      assertEquals(h.to_s({},), "",);
      assertEquals(h.to_tagged({},), null,);
    });

    it("id ausente registra rtp_report_id (14.24.6.1)", () => {
      const h = new RTFReport(null,);
      assertEquals(h.to_html({},), null,);
      assert(
        MessageHandlerInstance.instance.messages.some((m,) =>
          m.id === "rtp_report_id"
        ),
      );
    });

    it("id desconhecido registra rtp_report_unknown_id (14.24.6.1)", () => {
      const h = new RTFReport(null,);
      assertEquals(h.to_html({ id: "x", },), null,);
      assert(
        MessageHandlerInstance.instance.messages.some((m,) =>
          m.id === "rtp_report_unknown_id"
        ),
      );
    });

    it("gera o HTML do relatório e restaura o contexto (14.24.6.2)", () => {
      const project = createTestProject(1,);
      const report = new Report(project, "report1", "Report 1", null,);
      report.typeSpec = ReportType.TextReport;
      const rt = (text: string,) =>
        new RichText(text,).generateIntermediateFormat();
      report.set("center", rt("Olá relatório",),);

      const h = new RTFReport(project,);
      const el = h.to_html({ id: "report1", },);
      assert(el, "deveria produzir um nó HTML",);
      assert(el.toHTML().includes("Olá relatório",), "HTML do conteúdo",);
      // O contexto empurrado por to_html é removido no fim (RTFReport.rb:72).
      assertEquals(project.reportContexts.length, 0,);
    });

    it("aninhamento recursivo registra rtp_report_recursion (14.24.6.3)", () => {
      const project = createTestProject(1,);
      const report = new Report(project, "report1", "Report 1", null,);
      report.typeSpec = ReportType.TextReport;
      // Contexto já ativo para o mesmo relatório → recursão.
      project.reportContexts.push(new ReportContext(project, report,),);

      const h = new RTFReport(project,);
      assertEquals(h.to_html({ id: "report1", },), null,);
      const msg = MessageHandlerInstance.instance.messages.find((m,) =>
        m.id === "rtp_report_recursion"
      );
      assert(msg, "erro de recursão registrado",);
      assert(
        (msg.message ?? "").includes("Recursive nesting",),
        "mensagem espelha Ruby",
      );
      // O contexto pré-existente permanece (só o nosso é popado).
      assertEquals(project.reportContexts.length, 1,);
    });
  });

  describe("RTFReportLink (completo em 14.24.6)", () => {
    it("function = reportlink, não-bloco", () => {
      const h = new RTFReportLink(null,);
      assertEquals(h.function, "reportlink",);
      assertEquals(h.blockFunction, false,);
    });

    it('relatório estático → <a href="Nome.html"> (14.24.6.4)', () => {
      const project = createTestProject(1,);
      new Report(project, "other", "Other", null,);
      const h = new RTFReportLink(project,);
      const el = h.to_html({ id: "other", },);
      assert(el, "deveria produzir um nó HTML",);
      assertEquals(el.toHTML(), '<a href="Other.html">Other</a>',);
      assertEquals(h.to_s({ id: "other", },), "Other",);
    });

    it("relatório interativo → URL taskjuggler?project=…;report=… (14.24.6.4)", () => {
      const project = createTestProject(1,);
      const top = new Report(project, "top", "Top", null,);
      top.set("interactive", true,);
      new Report(project, "other", "Other", null,);
      // interactive? olha o contexto de topo (Report.rb:206-210).
      project.reportContexts.push(new ReportContext(project, top,),);
      const h = new RTFReportLink(project,);
      const el = h.to_html({ id: "other", },)!;
      project.reportContexts.pop();
      const pid = String(project.get("projectid",) ?? "",);
      assert(
        el.toHTML().includes(`taskjuggler?project=${pid};report=other`,),
        `href inesperado: ${el.toHTML()}`,
      );
    });

    it("id ausente/desconhecido registra os erros do Ruby (14.24.6.4)", () => {
      const project = createTestProject(1,);
      const h = new RTFReportLink(project,);
      assertEquals(h.to_html({},), null,);
      assertEquals(h.to_html({ id: "naoexiste", },), null,);
      assertEquals(h.to_s({},), "",);
      const ids = MessageHandlerInstance.instance.messages.map((m,) => m.id);
      assert(ids.includes("rtp_report_id",), "faltou rtp_report_id",);
      assert(
        ids.includes("rtp_report_unknown_id",),
        "faltou rtp_report_unknown_id",
      );
    });
  });

  describe("RTFNavigator (completo em 14.21)", () => {
    it("function = navigator, blockFunction = true", () => {
      const h = new RTFNavigator(null,);
      assertEquals(h.function, "navigator",);
      assertEquals(h.blockFunction, true,);
      assertEquals(h.to_s({},), "",);
    });

    it("to_html registra rtf_nav_unknown_id para project null (14.21.3.2)", () => {
      const h = new RTFNavigator(null,);
      // Sem project, o mapa `navigators` está vazio → id desconhecido.
      const out = h.to_html({ id: "x", },);
      assertEquals(out, null,);
      assert(
        MessageHandlerInstance.instance.messages.some((m,) =>
          m.id === "rtf_nav_unknown_id"
        ),
      );
    });

    it("id ausente registra rtf_nav_id_missing (14.21.3.1)", () => {
      const h = new RTFNavigator(null,);
      const out = h.to_html({},);
      assertEquals(out, null,);
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
