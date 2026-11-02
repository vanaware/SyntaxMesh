/**
 * Testes de `format markdown` nos relatórios (Fase 14 Complemento 14C.5.1 e
 * 14C.5.2).
 *
 * O dialeto dos atributos RichText de um `report` é **richtext** por default
 * (compatibilidade `.tjp`); `format markdown` é opt-in e troca o pipeline de
 * construção do `RichTextIntermediate` para o {@link MarkdownFactory} (Fase 13).
 * Como as duas fábricas produzem o MESMO `RichTextIntermediate`, os geradores
 * de relatório (`rt_to_html` → `TableReport`/`TextReport`) não mudam de API:
 * a verificação da 14C.5.2 é justamente essa transparência.
 *
 * A ordem dos atributos não importa em TJP: `format` declarado depois de
 * `header`/`footer` reconstrói os RTI já lidos (`applyReportFormat`).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.5)
 */
import { beforeAll, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
// Efeito colateral: registra as fábricas de conteúdo (TaskListRE, ...).
import "../../src/reports/mod.ts";
import { MarkdownFactory, } from "../../src/markdown/factory.ts";
import { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import type { XMLElementLike, } from "../../src/richtext/xml-like.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";

/** Serializa o retorno de `RichTextIntermediate#to_html`. */
const html = (rti: RichTextIntermediate,): string => {
  const out = rti.to_html() as XMLElementLike | XMLElementLike[];
  const list = Array.isArray(out,) ? out : [out,];
  return list.map((el,) => el.toHTML()).join("",);
};

/** Fábrica que produziu o RTI (`richtext` vs `markdown`). */
const producedByMarkdown = (rti: RichTextIntermediate,): boolean =>
  rti.richText instanceof MarkdownFactory;

describe("format markdown nos relatórios (14C.5)", () => {
  let project: Project;
  const byId = (id: string,): Report => project.report(id,) as Report;

  beforeAll(() => {
    MessageHandlerInstance.instance.reset();
    TjTime.setTimeZone("UTC",);
    const path = new URL(
      "../fixtures/ext/14c-markdown-report.tjp",
      import.meta.url,
    ).pathname;
    const parser = new ProjectFileParser();
    parser.open(path, true, false,);
    project = parser.parse("project",) as Project;
    assert(project, "fixture deve parsear sem erro",);
    project.schedule();
  },);

  describe("14C.5.1 — parser", () => {
    it("format markdown antes do texto: header nasce pelo MarkdownFactory", () => {
      const report = byId("mdfirst",);
      assertEquals(report.get("format",), "markdown",);
      const header = report.get("header",) as RichTextIntermediate;
      assert(
        producedByMarkdown(header,),
        "header deve vir do MarkdownFactory",
      );
      // Markdown: `#` vira título nível 1 (sem numeração de seção).
      const out = html(header,);
      assert(out.includes("<h1",), `esperava <h1> em ${out}`,);
      assert(out.includes("<b>forte</b>",), `esperava <b> em ${out}`,);
      assert(out.includes("<i>",), `esperava <i> em ${out}`,);
    });

    it("format markdown DEPOIS do texto: ordem dos atributos não importa", () => {
      const report = byId("mdlate",);
      assertEquals(report.get("format",), "markdown",);
      const header = report.get("header",) as RichTextIntermediate;
      assert(
        producedByMarkdown(header,),
        "header lido antes do format deve ser reconstruído",
      );
      assert(html(header,).includes("<h1",), "esperava <h1> após o rebuild",);
      const footer = report.get("footer",) as RichTextIntermediate;
      assert(
        html(footer,).includes("<b>Rodapé tardio</b>",),
        `esperava negrito em ${html(footer,)}`,
      );
    });

    it("sem format: default richtext preserva '''forte''' (regressão)", () => {
      const report = byId("mddefault",);
      assertEquals(report.get("format",), "richtext",);
      const header = report.get("header",) as RichTextIntermediate;
      assert(!producedByMarkdown(header,), "default deve ser richtext",);
      const out = html(header,);
      assert(out.includes("<b>Forte</b>",), `esperava <b> em ${out}`,);
      assert(!out.includes("<h1",), "markdown não deve ser aplicado",);
    });

    it("format é herdado do relatório-pai", () => {
      const child = byId("mdparent.mdchild",);
      assertEquals(child.get("format",), "markdown",);
      const header = child.get("header",) as RichTextIntermediate;
      assert(producedByMarkdown(header,), "filho herda o dialeto do pai",);
      assert(html(header,).includes("<h2",), "esperava <h2>",);
    });

    it("fábrica markdown injetada é usada por newRichText(markdown)", () => {
      let called = 0;
      const parser = new ProjectFileParser();
      const fake = {
        create(): RichTextIntermediate {
          called++;
          return new RichTextIntermediate(null,);
        },
      };
      parser.setMarkdownFactory(fake,);
      parser.newRichText("x", null, null, "markdown",);
      assertEquals(called, 1,);
      // O dialeto richtext continua usando a fábrica richtext (não a markdown).
      parser.newRichText("y", null,);
      assertEquals(called, 1,);
    });
  });

  describe("14C.5.2 — geradores de relatório", () => {
    /** Gera o HTML do relatório e devolve a saída serializada. */
    const generateHtml = (report: Report,): string => {
      project.reportContexts.push(new ReportContext(project, report,),);
      try {
        report.generate(["html",],);
      } finally {
        project.reportContexts.pop();
      }
      return String(report.output,);
    };

    it("header markdown chega ao HTML do TableReport sem mudança de API", () => {
      const out = generateHtml(byId("mdfirst",),);
      assert(
        out.includes("<h1",),
        `esperava <h1> no html: ${out.slice(0, 200,)}`,
      );
      assert(out.includes("<b>forte</b>",), "esperava <b> no html",);
    });

    it("relatório richtext continua sem conversão markdown no HTML", () => {
      const out = generateHtml(byId("mddefault",),);
      assert(out.includes("<b>Forte</b>",), "esperava <b> richtext",);
      assert(!out.includes("<h1",), "não deve haver <h1> markdown",);
    });
  });
});
