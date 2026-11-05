/**
 * Testes de conteúdo markdown nos relatórios (Fase 14 Complemento 14C.5.6 a
 * 14C.5.9).
 *
 *  - 14C.5.6: imagens inline no `details` de `journalentry` são coletadas pela
 *    galeria do RDO (14C.3.6/3.7) nos **dois** dialetos — `![alt](path)`
 *    (markdown) e `[[Image:path|alt]]` (MediaWiki). A galeria é agnóstica de
 *    formato (`picturesFromDetails`), daí o cruzamento dos dois lados.
 *  - 14C.5.7: `note` de propriedade nasce richtext (é lido antes de qualquer
 *    relatório) e é reinterpretado pelo `format` do relatório que o exibe;
 *    `celltext` (string crua no TaskJuggler) passa pelo markdown no mesmo caso.
 *  - 14C.5.8: header/footer markdown de `textreport` produzem o mesmo texto
 *    plano (`to_s`) que a sintaxe MediaWiki equivalente.
 *  - 14C.5.9: HTML cru em atributo markdown do relatório sai sanitizado
 *    (`html-sanitizer` da 13.5, aplicado por nó em `mdast-to-richtext`): a
 *    tag bloqueada e os atributos de evento desaparecem, e o texto entre as
 *    tags permanece como texto inerte (a sanitização é por nó mdast).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.5)
 */
import { beforeAll, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";
import { parseProject, } from "../parser/parse-helper.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
// Efeito colateral: registra as fábricas de conteúdo (TaskListRE, ...).
import "../../src/reports/mod.ts";
import { RdoReport, } from "../../src/reports/rdo-report.ts";
import { TextReport, } from "../../src/reports/text-report.ts";
import type { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import type { XMLElementLike, } from "../../src/xml/xml-element-like.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";

/** Serializa o retorno de `RichTextIntermediate#to_html`. */
const html = (rti: RichTextIntermediate,): string => {
  const out = rti.to_html() as XMLElementLike | XMLElementLike[] | null;
  if (out === null) return "";
  const list = Array.isArray(out,) ? out : [out,];
  return list.map((el,) => el.toHTML()).join("",);
};

/** Gera o relatório como HTML completo e devolve a string de saída. */
const generateHtml = (project: Project, report: Report,): string => {
  project.reportContexts.push(new ReportContext(project, report,),);
  try {
    report.generate(["html",],);
  } finally {
    project.reportContexts.pop();
  }
  return String(report.output,);
};

describe("conteúdo markdown nos relatórios (14C.5.6–5.9)", () => {
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

  describe("14C.5.6 — imagens inline em details (RDO)", () => {
    /** TJP inline: uma entrada markdown e uma richtext, ambas com imagem. */
    const SOURCE = `project img "Imagens" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
}

task t1 "Tarefa" {
  start 2026-02-01
  effort 5d
  journalentry 2026-02-10 "Entrada markdown" {
    details "Vê: ![A](img/a.png)"
  }
  journalentry 2026-02-11 "Entrada richtext" {
    details "Vê: [[Image:img/b.png|B]]"
    format richtext
  }
}

rdoreport rdo "RDO" {
  period 2026-02-01 - 2026-03-31
  formats html
}
`;

    it("coleta a imagem de details markdown e de details MediaWiki", () => {
      const outcome = parseProject(SOURCE,);
      assert(outcome.threw === null, String(outcome.threw,),);
      const rdoProject = outcome.result as Project;
      const report = rdoProject.report("rdo",) as Report;
      rdoProject.reportContexts.push(new ReportContext(rdoProject, report,),);
      const re = new RdoReport(report,);
      try {
        re.generateIntermediateFormat();
        const entries = re.getGroups().flatMap((group,) => group.entries);
        const md = entries.find((entry,) =>
          entry.headline === "Entrada markdown"
        )!;
        const rt = entries.find((entry,) =>
          entry.headline === "Entrada richtext"
        )!;
        // Markdown: `![A](img/a.png)` vira imagem da entrada e da galeria.
        assertEquals(md.pictures.map((p,) => p.path), ["img/a.png",],);
        // MediaWiki: `[[Image:img/b.png|B]]` chega ao mesmo coletor — a
        // galeria (`picturesFromDetails`) é agnóstica de formato (14C.3.7).
        assertEquals(rt.pictures.map((p,) => p.path), ["img/b.png",],);
        // E o HTML do RDO traz as duas imagens.
        const htmlOut = re.to_html().map((el,) => el.toHTML()).join("",);
        assertEquals(htmlOut.split("<img",).length - 1, 2,);
      } finally {
        rdoProject.reportContexts.pop();
      }
    });
  });

  describe("14C.5.7 — note e celltext no dialeto do relatório", () => {
    it("note nasce richtext e vira markdown quando o relatório pede", () => {
      const md = generateHtml(project, byId("mdnote",),);
      assert(
        md.includes("<b>Importante</b>",),
        `esperava o negrito markdown da nota em ${md.slice(0, 400,)}`,
      );

      const rt = generateHtml(project, byId("rtnote",),);
      assert(
        rt.includes("**Importante**",),
        "sem format markdown a nota mantém o literal richtext",
      );
      assert(!rt.includes("<b>Importante</b>",), rt.slice(0, 400,),);
    });

    it("celltext passa pelo markdown só no relatório markdown", () => {
      const md = generateHtml(project, byId("mdnote",),);
      assert(md.includes("<b>Célula</b>",), "esperava o rótulo em negrito",);

      const rt = generateHtml(project, byId("rtnote",),);
      assert(rt.includes("**Célula**",), "celltext do Ruby é texto literal",);
      assert(!rt.includes("<b>Célula</b>",), rt.slice(0, 400,),);
    });
  });

  describe("14C.5.8 — TextReport em texto plano", () => {
    it("header markdown e MediaWiki geram o mesmo to_s", () => {
      const md = byId("mdtext",).get("header",) as RichTextIntermediate;
      const rt = byId("rttext",).get("header",) as RichTextIntermediate;
      assertEquals(md.to_s(), rt.to_s(),);
      assertEquals(md.to_s(), "Título\n\nTexto forte",);

      // No footer a diferença é o que sobra do markup: markdown remove as
      // ênfases (`*fim*` → `fim`), o MediaWiki preserva `//fim//` no to_s.
      const mdFooter = byId("mdtext",).get("footer",) as RichTextIntermediate;
      assertEquals(mdFooter.to_s(), "fim",);
      const rtFooter = byId("rttext",).get("footer",) as RichTextIntermediate;
      assertEquals(rtFooter.to_s(), "//fim//",);

      // O `textreport` real usa os mesmos blocos (sem moldura de tabela).
      const report = byId("mdtext",);
      project.reportContexts.push(new ReportContext(project, report,),);
      const re = new TextReport(report,);
      try {
        re.generateIntermediateFormat();
        const out = re.to_html().map((el,) => el.toHTML()).join("",);
        assert(out.includes("Título",), out,);
        assert(out.includes("fim",), out,);
      } finally {
        project.reportContexts.pop();
      }
    });
  });

  describe("14C.5.9 — sanitização", () => {
    it("caption markdown perde <script>/onerror e mantém o texto", () => {
      const caption = byId("mdxss",).get("caption",) as RichTextIntermediate;
      const capHtml = html(caption,);
      // A tag bloqueada some e o atributo de evento é descartado…
      assert(!capHtml.includes("<script",), capHtml,);
      assert(!capHtml.includes("onerror",), capHtml,);
      // …mas o texto em volta sobrevive (o corpo do `<script>` fica como texto
      // inerte: a sanitização é por nó mdast, não por documento).
      assert(capHtml.includes("Antes",), capHtml,);
      assert(capHtml.includes("depois",), capHtml,);

      // No documento o mesmo vale; o `<script>` que sobra é o do template.
      const out = generateHtml(project, byId("mdxss",),);
      assert(!out.includes("<script>alert",), out.slice(0, 400,),);
      assert(!out.includes("onerror",), "atributo de evento descartado",);
    });
  });
});
