/**
 * Testes de TextReport (Fase 14.17).
 *
 * Cobre o cálculo de larguras conforme a presença das seções (center/l/r),
 * a montagem HTML (`to_html`) e a recusa de CSV (`to_csv` → null com aviso
 * `text_report_no_csv`).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.17)
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { RichText, } from "../../src/richtext/rich-text.ts";
import { type XMLElementLike, } from "../../src/richtext/xml-like.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TextReport, } from "../../src/reports/text-report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { contentFactories, } from "../../src/model/report-content.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";

/** Subclasse que expõe as larguras/paddings calculados. */
class TestTextReport extends TextReport {
  widths(): [number, number, number,] {
    // deno-lint-ignore no-explicit-any
    const t = this as any;
    return [t.lWidth, t.cWidth, t.rWidth,];
  }
  paddings(): [number, number, number,] {
    // deno-lint-ignore no-explicit-any
    const t = this as any;
    return [t.lPadding, t.cPadding, t.rPadding,];
  }
}

describe("TextReport (14.17)", () => {
  let project: Project;
  let report: Report;
  let tr: TestTextReport;

  /** Bloco RichText mínimo aceito por `rt_to_html`. */
  const rt = (text: string,) =>
    new RichText(text,).generateIntermediateFormat();

  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
    project = createTestProject(1,);
    report = new Report(project, "tx", "tx.html", null,);
    report.typeSpec = ReportType.TextReport;
    project.reportContexts.push(new ReportContext(project, report,),);
    tr = new TestTextReport(report,);
  },);

  describe("larguras (14.17.4–14.17.8)", () => {
    it("inicia com zero em todas as dimensões", () => {
      assertEquals(tr.widths(), [0, 0, 0,],);
      assertEquals(tr.paddings(), [0, 0, 0,],);
    });

    it("só center: cWidth 100", () => {
      report.set("center", rt("Centro",),);
      tr.generateIntermediateFormat();
      assertEquals(tr.widths(), [0, 100, 0,],);
      assertEquals(tr.paddings(), [0, 0, 0,],);
    });

    it("left + center: 25/75 com padding esquerdo 2", () => {
      report.set("left", rt("Esquerda",),);
      report.set("center", rt("Centro",),);
      tr.generateIntermediateFormat();
      assertEquals(tr.widths(), [25, 75, 0,],);
      assertEquals(tr.paddings(), [2, 0, 0,],);
    });

    it("left + center + right: 20/60/20 com paddings l/c 2", () => {
      report.set("left", rt("Esquerda",),);
      report.set("center", rt("Centro",),);
      report.set("right", rt("Direita",),);
      tr.generateIntermediateFormat();
      assertEquals(tr.widths(), [20, 60, 20,],);
      assertEquals(tr.paddings(), [2, 2, 0,],);
    });

    it("center + right: 75/25 com padding central 2", () => {
      report.set("center", rt("Centro",),);
      report.set("right", rt("Direita",),);
      tr.generateIntermediateFormat();
      assertEquals(tr.widths(), [0, 75, 25,],);
      assertEquals(tr.paddings(), [0, 2, 0,],);
    });

    it("left + right sem center: 50/50 com padding esquerdo 2", () => {
      report.set("left", rt("Esquerda",),);
      report.set("right", rt("Direita",),);
      tr.generateIntermediateFormat();
      assertEquals(tr.widths(), [50, 0, 50,],);
      assertEquals(tr.paddings(), [2, 0, 0,],);
    });

    it("só left sem center: lWidth 100", () => {
      report.set("left", rt("Esquerda",),);
      tr.generateIntermediateFormat();
      assertEquals(tr.widths(), [100, 0, 0,],);
    });

    it("só right sem center: rWidth 100", () => {
      report.set("right", rt("Direita",),);
      tr.generateIntermediateFormat();
      assertEquals(tr.widths(), [0, 0, 100,],);
    });

    it("sem seções: tudo permanece zero", () => {
      tr.generateIntermediateFormat();
      assertEquals(tr.widths(), [0, 0, 0,],);
    });
  });

  describe("to_html (14.17.9)", () => {
    it("vazio produz array vazio", () => {
      tr.generateIntermediateFormat();
      assertEquals(tr.to_html(), [],);
    });

    it("monta tabela tj_text_page com células tj_column_*", () => {
      report.set("left", rt("Esquerda",),);
      report.set("center", rt("Centro",),);
      tr.generateIntermediateFormat();
      const html = tr.to_html();
      assertEquals(html.length, 1,);
      const table = html[0] as XMLElementLike;
      assertEquals(table.attrs.class, "tj_text_page",);
      const inner = table.toHTML();
      assert(inner.includes("tj_text_row",),);
      assert(inner.includes("tj_column_left",),);
      assert(inner.includes("tj_column_center",),);
      assert(!inner.includes("tj_column_right",),);
      assert(inner.includes("width:25%;",),);
      assert(inner.includes("padding-right:2%;",),);
    });

    it("inclui header e footer ao redor da tabela", () => {
      report.set("header", rt("Cabeçalho",),);
      report.set("center", rt("Centro",),);
      report.set("footer", rt("Rodapé",),);
      tr.generateIntermediateFormat();
      const html = tr.to_html();
      assertEquals(html.length, 3,);
      assert(
        (html[0] as XMLElementLike).toHTML().includes(
          "Cabeçalho".slice(0, 3,),
        ),
      );
      assertEquals((html[1] as XMLElementLike).attrs.class, "tj_text_page",);
    });
  });

  describe("to_csv (14.17.10)", () => {
    it("retorna null", () => {
      assertEquals(tr.to_csv(), null,);
    });

    it("emite o aviso text_report_no_csv", () => {
      tr.to_csv();
      const handler = MessageHandlerInstance.instance;
      const warning = handler.messages.find((m,) =>
        m.id === "text_report_no_csv"
      );
      assert(warning, "aviso text_report_no_csv emitido",);
      assertEquals(warning!.type, "warning",);
    });

    it("textreport está registrado na fábrica de conteúdo", () => {
      assert(contentFactories.get("textreport",), "fábrica registrada",);
    });
  });
});
