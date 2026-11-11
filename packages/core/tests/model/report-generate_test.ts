/**
 * Testes de `Report` — geração e dispatch (Fase 14.11).
 *
 * Complementa `report_test.ts` (que cobre construção/atributos). Aqui cobrimos
 * `generate`, `generateIntermediateFormat`, `to_html`, `interactive?` e os
 * conversores de formato privados (via `generate`).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.11)
 */

import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import {
  contentFactories,
  registerContentFactory,
  type ReportContent,
} from "../../src/model/report-content.ts";
import { XMLElement, } from "../../src/xml/xml-element.ts";

/** Conteúdo falso: marca quantas vezes `generateIntermediateFormat` rodou. */
function fakeContent(
  overrides: Partial<ReportContent> = {},
): ReportContent & { genCalled: number } {
  return {
    genCalled: 0,
    generateIntermediateFormat(this: ReportContent & { genCalled: number },) {
      this.genCalled++;
    },
    ...overrides,
  } as ReportContent & { genCalled: number };
}

describe("Report geração (14.11)", () => {
  let project: Project;

  beforeEach(() => {
    project = createTestProject(2,);
    MessageHandlerInstance.instance.reset();
  },);

  // As fábricas vivem num Map global — limpa para não vazar entre testes.
  afterEach(() => {
    contentFactories.clear();
  },);

  function newReport(name = "report1",): Report {
    const r = new Report(project, name, name, null,);
    r.set("timezone", "UTC",);
    return r;
  }

  describe("generateIntermediateFormat", () => {
    it("dispacha por typeSpec para a fábrica registrada", () => {
      const content = fakeContent();
      registerContentFactory("taskreport", () => content,);
      const r = newReport();
      r.typeSpec = "taskreport" as never;
      r.generateIntermediateFormat();
      assertEquals(r.content, content,);
      assertEquals(content.genCalled, 1,);
    });

    it("sem cenário habilitado emite warning all_scenarios_disabled", () => {
      registerContentFactory("taskreport", () => fakeContent(),);
      const r = newReport();
      r.typeSpec = "taskreport" as never;
      r.set("scenarios", [],);
      r.generateIntermediateFormat();
      const mh = MessageHandlerInstance.instance;
      assert(mh.messages.some((m,) => m.id === "all_scenarios_disabled"),);
    });

    it("typeSpec desconhecido lança 'Unknown report type'", () => {
      const r = newReport();
      r.typeSpec = "bogus" as never;
      assertThrows(() => r.generateIntermediateFormat(), Error, "Unknown",);
    });

    it("typeSpec nulo lança 'Unknown report type'", () => {
      const r = newReport();
      r.typeSpec = null;
      assertThrows(() => r.generateIntermediateFormat(), Error, "Unknown",);
    });

    it("type conhecido sem fábrica → Error (inconsistência interna)", () => {
      // Após `afterEach` limpar `contentFactories`, um type ainda presente em
      // `KNOWN_TYPE_SPECS` sem fábrica registrada é uma inconsistência
      // interna (o registro deveria ter acontecido no import do conteúdo), não
      // uma âncora de fase. Era `NotYetImplementedError("18", ...)` antes da
      // auditoria da Fase 21 1ª onda (2026-11-10) — os conteúdos de
      // timesheet/statussheet agora têm fábrica, então essa branch virou
      // sentinela. Ver `completude-matrix.md` §B/A5.
      const r = newReport();
      r.typeSpec = "accountreport" as never;
      assertThrows(
        () => r.generateIntermediateFormat(),
        Error,
        "no registered content factory",
      );
    });
  });

  describe("generate", () => {
    it("retorna 0 e restaura o fuso", () => {
      registerContentFactory("taskreport", () =>
        fakeContent({
          to_html: () => new XMLElement("div",),
        },),);
      const r = newReport();
      r.typeSpec = "taskreport" as never;
      r.set("formats", ["html",],);
      assertEquals(r.generate(), 0,);
    });

    it("html grava output e outputFileName com sufixo .html", () => {
      registerContentFactory("taskreport", () =>
        fakeContent({
          to_html: () => new XMLElement("div",),
        },),);
      const r = newReport("myreport",);
      r.typeSpec = "taskreport" as never;
      r.generate(["html",],);
      assert(r.outputFileName.endsWith("/myreport.html",), r.outputFileName,);
      assert(typeof r.output === "string",);
      assert((r.output as string).includes("<!DOCTYPE html>",),);
    });

    it("name '.' envia html para stdout ('.')", () => {
      registerContentFactory("taskreport", () =>
        fakeContent({
          to_html: () => new XMLElement("div",),
        },),);
      const r = newReport(".",);
      r.typeSpec = "taskreport" as never;
      r.generate(["html",],);
      assertEquals(r.outputFileName, ".",);
    });

    it("csv produz Array-of-Arrays e sufixo .csv", () => {
      registerContentFactory("taskreport", () =>
        fakeContent({
          to_csv: () => [["a", "b",], ["1", "2",],],
        },),);
      const r = newReport("rep",);
      r.typeSpec = "taskreport" as never;
      r.generate(["csv",],);
      assert(r.outputFileName.endsWith("/rep.csv",), r.outputFileName,);
      assertEquals(r.output, [["a", "b",], ["1", "2",],],);
    });

    it("tjp usa .tjp quando definitions inclui project", () => {
      registerContentFactory("export", () =>
        fakeContent({
          to_tjp: () => "task x {}",
        },),);
      const r = newReport("out",);
      r.typeSpec = "export" as never;
      r.set("definitions", ["project", "tasks",],);
      r.generate(["tjp",],);
      assert(r.outputFileName.endsWith(".tjp",), r.outputFileName,);
      assertEquals(r.output, "task x {}",);
    });

    it("tjp usa .tji quando definitions não inclui project", () => {
      registerContentFactory("export", () =>
        fakeContent({
          to_tjp: () => "x",
        },),);
      const r = newReport("out",);
      r.typeSpec = "export" as never;
      r.set("definitions", ["tasks",],);
      r.generate(["tjp",],);
      assert(r.outputFileName.endsWith(".tji",), r.outputFileName,);
    });

    it("mspxml gera sufixo .xml", () => {
      registerContentFactory("export", () =>
        fakeContent({
          to_mspxml: () => "<Project/>",
        },),);
      const r = newReport("mp",);
      r.typeSpec = "export" as never;
      r.generate(["mspxml",],);
      assert(r.outputFileName.endsWith(".xml",),);
      assertEquals(r.output, "<Project/>",);
    });

    it("niku/ical/ctags adicionam quebra de linha (puts)", () => {
      registerContentFactory("niku", () =>
        fakeContent({
          to_niku: () => "NIKU",
        },),);
      const rn = newReport("n",);
      rn.typeSpec = "niku" as never;
      rn.generate(["niku",],);
      assertEquals(rn.output, "NIKU\n",);

      registerContentFactory("ical", () =>
        fakeContent({
          to_iCal: () => "VCALENDAR",
        },),);
      const ri = newReport("i",);
      ri.typeSpec = "iCal" as never;
      ri.generate(["iCal",],);
      assertEquals(ri.output, "VCALENDAR\n",);

      registerContentFactory("tagfile", () =>
        fakeContent({
          to_ctags: () => "TAGS",
        },),);
      const rt = newReport("tags",);
      rt.typeSpec = "tagfile" as never;
      rt.generate(["ctags",],);
      assertEquals(rt.output, "TAGS\n",);
    });

    it("formato desconhecido lança", () => {
      registerContentFactory("taskreport", () => fakeContent(),);
      const r = newReport();
      r.typeSpec = "taskreport" as never;
      assertThrows(
        () => r.generate(["pdf",],),
        Error,
        "Unknown report output",
      );
    });

    it("name vazio com formats emite error empty_report_file_name", () => {
      registerContentFactory("taskreport", () =>
        fakeContent({
          to_csv: () => [["x",],],
        },),);
      const r = new Report(project, "r1", "", null,);
      r.set("timezone", "UTC",);
      r.typeSpec = "taskreport" as never;
      r.generate(["csv",],);
      const mh = MessageHandlerInstance.instance;
      assert(mh.messages.some((m,) => m.id === "empty_report_file_name"),);
    });

    it("formato não suportado pelo conteúdo emite warning", () => {
      registerContentFactory("taskreport", () => fakeContent(),);
      const r = newReport("r",);
      r.typeSpec = "taskreport" as never;
      r.generate(["html",],);
      const mh = MessageHandlerInstance.instance;
      assert(mh.messages.some((m,) => m.id === "html_not_supported"),);
    });
  });

  describe("to_html / interactive?", () => {
    it("to_html delega ao conteúdo", () => {
      const el = new XMLElement("div",);
      registerContentFactory("taskreport", () =>
        fakeContent({
          to_html: () => el,
        },),);
      const r = newReport();
      r.typeSpec = "taskreport" as never;
      r.generateIntermediateFormat();
      assertEquals(r.to_html(), el,);
    });

    it("to_html retorna null sem conteúdo", () => {
      const r = newReport();
      assertEquals(r.to_html(), null,);
    });

    it("interactive? lê do contexto de relatório corrente", () => {
      const r = newReport();
      r.set("interactive", true,);
      project.reportContexts.push(new ReportContext(project, r,),);
      assertEquals(r["interactive?"](), true,);
      r.force("interactive", false,);
      assertEquals(r["interactive?"](), false,);
    });
  });
});
