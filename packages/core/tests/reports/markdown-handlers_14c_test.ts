/**
 * Testes dos handlers de função do RichText dentro do Markdown nos relatórios
 * (Fase 14 Complemento 14C.5.3, 14C.5.4 e 14C.5.5).
 *
 * O Markdown não tem `[[…]]` como referência interna (isso é RichText); ele usa
 * `[[nome:args]]` como a sintaxe going-forward das funções da Fase 12
 * (`extensions/functions.ts`) e `<-attr->` como açúcar de `[[query:…]]` (13.7).
 * O pipeline converte os dois em nós `inlinefunc`/`blockfunc` com o payload
 * `[nome, args]` — o MESMO contrato que os handlers (`richtext/handlers/*`) já
 * consomem, então aqui só se verifica o wiring de ponta a ponta com um
 * `ReportContext` ativo, sem tocar nos handlers.
 *
 * Divergências pré-existentes registradas no quadro de evidências da 14C.5:
 *  - RichText `[[…]]` é referência interna (link), então `[[query:…]]` só
 *    existe em Markdown; a contraparte RichText é `<-query …->`.
 *  - RichText `<-attr->` procura um handler com o nome do atributo e lança
 *    (`No handler for name registered`); o açúcar `<-attr->` é exclusivo do
 *    Markdown.
 *  - `name`/`projectid`/`version` do projeto são campos de `Project`, não
 *    atributos, então `[[query:attribute=name]]` renderiza vazio; os testes
 *    usam `start`/`end`, que são atributos de verdade.
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
import { RichTextElement, } from "../../src/richtext/rich-text-element.ts";
import type { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import type { XMLElementLike, } from "../../src/xml/xml-element-like.ts";
import { URLParameter, } from "../../src/utils/url-parameter.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";

/** Serializa o retorno de `RichTextIntermediate#to_html`. */
const html = (rti: RichTextIntermediate,): string => {
  const out = rti.to_html() as XMLElementLike | XMLElementLike[] | null;
  if (out === null) return "";
  const list = Array.isArray(out,) ? out : [out,];
  return list.map((el,) => el.toHTML()).join("",);
};

/** Percorre a árvore e coleta os payloads `[nome, args]` das funções. */
const collectFuncs = (
  el: RichTextElement | null,
  acc: Array<[string, Record<string, string> | null,]> = [],
): Array<[string, Record<string, string> | null,]> => {
  if (el === null) return acc;
  if (el.category === "inlinefunc" || el.category === "blockfunc") {
    acc.push(el.data as [string, Record<string, string> | null,],);
  }
  for (const child of el.children) {
    if (typeof child !== "string") collectFuncs(child, acc,);
  }
  return acc;
};

describe("handlers de função em markdown nos relatórios (14C.5)", () => {
  let project: Project;
  const mh = MessageHandlerInstance.instance;
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

  /**
   * Renderiza o RTI como durante a geração do relatório: empilha o
   * `ReportContext` do dono, registra a query (o que
   * `ReportBase.generateIntermediateFormat` faz para os RICH_TEXT_BLOCKS) e
   * desempilha no `finally`.
   */
  const renderInReport = (
    owner: Report,
    rti: RichTextIntermediate,
  ): string => {
    project.reportContexts.push(new ReportContext(project, owner,),);
    try {
      rti.setQuery(project.reportContexts.at(-1,)!.query,);
      return html(rti,);
    } finally {
      project.reportContexts.pop();
    }
  };

  /** Extrai o texto dos `<span>` de resultado de query na saída serializada. */
  const spanTexts = (out: string,): string[] =>
    [...out.matchAll(/<span>([^<]*)<\/span>/g,),].map((m,) => m[1]!);

  describe("14C.5.3 — wiring dos quatro handlers", () => {
    it("[[query:]] resolve o atributo no contexto do relatório", () => {
      const report = byId("mdfuncs",);
      const header = report.get("header",) as RichTextIntermediate;
      const out = renderInReport(report, header,);
      assert(
        out.includes("<span>2026-03-02</span>",),
        `esperava a data de início do projeto em ${out.slice(0, 300,)}`,
      );
      assertEquals(project.reportContexts.length, 0,);
    });

    it("[[report:]] embute o relatório citado e restaura o contexto", () => {
      const report = byId("mdfuncs",);
      const header = report.get("header",) as RichTextIntermediate;
      const out = renderInReport(report, header,);
      // `mddefault` usa `'''Fortes'''` (richtext) mesmo embutido em markdown.
      assert(out.includes("<b>Forte</b>",), `esperava o embed em ${out}`,);
      // Filho do relatório composto recebe o id dinâmico "0.0".
      assert(
        out.includes("Dynamic Report ID: 0.0",),
        "o contexto do relatório embutido deve ser o filho 0.0",
      );
      // `RTFReport` empilha e desempilha (finally) — nenhum contexto vaza.
      assertEquals(project.reportContexts.length, 0,);
    });

    it("[[reportlink:]] gera o link estático para o relatório", () => {
      const report = byId("mdfuncs",);
      const header = report.get("header",) as RichTextIntermediate;
      const out = renderInReport(report, header,);
      assert(
        out.includes('<a href="md-default.html">md-default</a>',),
        `esperava o link estático em ${out.slice(0, 400,)}`,
      );
    });

    it("[[navigator:]] gera a barra de navegação do relatório", () => {
      const report = byId("mdfuncs",);
      const header = report.get("header",) as RichTextIntermediate;
      const out = renderInReport(report, header,);
      assert(out.includes("navbar_container",), `esperava o navbar em ${out}`,);
      assert(
        out.includes('<span class="navbar_current">md-funcs</span>',),
        "o relatório corrente deve estar marcado no navbar",
      );
    });

    it("açúcar `<-attr->` do markdown vira [[query:]] (13.7)", () => {
      const report = byId("mdfuncs",);
      const footer = report.get("footer",) as RichTextIntermediate;
      const out = renderInReport(report, footer,);
      assert(
        out.startsWith("<div><p>Fim: ",),
        `esperava o parágrafo em ${out}`,
      );
      assertEquals(spanTexts(out,), ["2026-03-31",],);
    });
  });

  describe("14C.5.4 — query em markdown e em richtext dentro de reports", () => {
    it("as duas sintaxes renderizam o mesmo valor", () => {
      const md = byId("mdfuncs",);
      const mdOut = renderInReport(
        md,
        md.get("header",) as RichTextIntermediate,
      );

      const rt = byId("rtquery",);
      const rtOut = renderInReport(
        rt,
        rt.get("header",) as RichTextIntermediate,
      );

      assertEquals(spanTexts(mdOut,), ["2026-03-02",],);
      assertEquals(spanTexts(rtOut,), ["2026-03-02",],);
      // Única diferença: markdown envolve o resultado no parágrafo do bloco.
      assert(mdOut.includes("<p><span>",), `esperava <p> em ${mdOut}`,);
      assertEquals(rtOut, "<div><span>2026-03-02</span></div>",);
    });
  });

  describe("14C.5.5 — RTFReport/RTFReportLink sob markdown", () => {
    /** Gera o href do `reportlink` como no modo interativo (`interactive`). */
    const interactiveHref = (id: string,): string => {
      const report = byId(id,);
      report.force("interactive", true,);
      try {
        const out = renderInReport(
          report,
          report.get("header",) as RichTextIntermediate,
        );
        const match = out.match(/<a href="([^"]*)">/,);
        assert(match, `esperava um <a href> em ${out}`,);
        return match[1]!;
      } finally {
        report.force("interactive", false,);
      }
    };

    it("reportlink interativo: mesma URL comprimida em markdown e richtext", () => {
      const mdHref = interactiveHref("mdlink",);
      const rtHref = interactiveHref("rtlink",);
      assertEquals(mdHref, rtHref,);
      // `project=` fica vazio: `projectid` é campo de `Project`, não atributo.
      // O `report=` usa o `fullId` (id curto), não o nome do arquivo.
      assert(
        mdHref.startsWith("taskjuggler?project=;report=mddefault;attributes=",),
        `esperava a URL interativa em ${mdHref}`,
      );
      assertEquals(
        mdHref,
        "taskjuggler?project=;report=mddefault;attributes=" +
          URLParameter.encode("x=1",),
      );
    });

    it("pipeline markdown preserva o payload [nome, args] do handler", () => {
      // Mesmo texto, agora pela fábrica markdown: `[[report:…]]` sozinho no
      // parágrafo vira `blockfunc` com o payload cru para o handler.
      const rti = new MarkdownFactory(project, null,).create(
        "[[report:id=mddefault]]",
      );
      assertEquals(collectFuncs(rti.tree,), [
        ["report", { id: "mddefault", },],
      ],);

      // Recursão: um relatório embutindo a si mesmo é barrado pelo handler
      // (`rtp_report_recursion`) e não vaza contexto nem entra em loop.
      mh.reset();
      const report = byId("mdfuncs",);
      const recursive = new MarkdownFactory(project, null,).create(
        "[[report:id=mdfuncs]]",
      );
      project.reportContexts.push(new ReportContext(project, report,),);
      try {
        recursive.setQuery(project.reportContexts.at(-1,)!.query,);
        const out = html(recursive,);
        // O parágrafo do bloco permanece, mas o relatório não é embutido.
        assertEquals(out, "<div><p></p></div>",);
        assertEquals(project.reportContexts.length, 1,);
      } finally {
        project.reportContexts.pop();
      }
      assertEquals(
        mh.messages.map((m,) => m.id),
        ["rtp_report_recursion",],
      );
    });
  });
});
