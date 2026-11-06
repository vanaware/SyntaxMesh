/**
 * 14C.19 (ADR 039) — consumo do atributo `markdown` de `extend` nos relatórios.
 *
 * Consome o fixture `tests/fixtures/ext/10c-extend-markdown.tjp` (C5.8):
 *  - 14C.19.1: a linha `[AttributeType.Markdown, [false, "left"]]` em
 *    `TableReport.propertiesByType` dá à coluna alinhamento de texto rico
 *    (sem ela caía no fallback "center") e o HTML da célula traz `<b>` —
 *    o `strong` do markdown vira `bold` (não `<strong>`) no RichText.
 *  - 14C.19.2: o texto plano (`to_s`) da célula é markup-free.
 *  - 14C.19.3: em `format markdown` o atributo markdown NÃO é reconvertido
 *    (o guard `richText instanceof RichText` devolve o RTI armazenado),
 *    enquanto o `richtext` ao lado é recriado pelo pipeline markdown — troca
 *    de dialeto, não de ênfase (14C.5.7).
 *  - 14C.19.4: HTML cru no valor markdown chega sanitizado ao relatório
 *    (sem `<script>`, sem `onerror`; o texto permanece inerte).
 */
import { beforeAll, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TaskListRE, } from "../../src/reports/task-list-re.ts";
import { TableReport, } from "../../src/reports/table-report.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
// Efeito colateral: registra as fábricas de conteúdo (TaskListRE, ...).
import "../../src/reports/mod.ts";
import type { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import type { XMLElementLike, } from "../../src/xml/xml-element-like.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import type { ReportTable, } from "../../src/reports/report-table.ts";
import type { ReportTableCell, } from "../../src/reports/report-table-cell.ts";
import type { ReportTableLine, } from "../../src/reports/report-table-line.ts";

/** Serializa o retorno de `RichTextIntermediate#to_html`. */
const html = (rti: RichTextIntermediate,): string => {
  const out = rti.to_html() as XMLElementLike | XMLElementLike[] | null;
  if (out === null) return "";
  const list = Array.isArray(out,) ? out : [out,];
  return list.map((el,) => el.toHTML()).join("",);
};

/** Gera o taskreport e devolve a tabela intermediária. */
const genTable = (project: Project, report: Report,): ReportTable => {
  project.reportContexts.push(new ReportContext(project, report,),);
  const re = new TaskListRE(report,);
  try {
    re.generateIntermediateFormat();
    const table = re.getTable();
    assert(table, `relatório ${report.id} não produziu tabela`,);
    return table;
  } finally {
    project.reportContexts.pop();
  }
};

/** Célula da linha cuja coluna tem o id de definição `colId`. */
function cellOf(
  table: ReportTable,
  line: ReportTableLine,
  colId: string,
): ReportTableCell {
  const idx = table.getColumns().findIndex((c,) => c.definition?.id === colId);
  assert(idx >= 0, `coluna "${colId}" ausente`,);
  const cell = line.cells[idx];
  assert(cell, `célula "${colId}" ausente na linha`,);
  // Nas grades de taskreport a célula é sempre `ReportTableCell` (o
  // `PlaceHolderCell` da union aparece em tabelas embutidas).
  return cell as unknown as ReportTableCell;
}

describe("consumo de extend markdown nos relatórios (14C.19)", () => {
  let project: Project;
  const byId = (id: string,): Report => project.report(id,) as Report;
  const lineOf = (table: ReportTable, fullId: string,) =>
    table.getLines().find((l,) =>
      (l.property as { fullId?: string })?.fullId === fullId
    )!;

  beforeAll(() => {
    MessageHandlerInstance.instance.reset();
    TjTime.setTimeZone("UTC",);
    const path = new URL(
      "../fixtures/ext/10c-extend-markdown.tjp",
      import.meta.url,
    ).pathname;
    const parser = new ProjectFileParser();
    parser.open(path, true, false,);
    project = parser.parse("project",) as Project;
    assert(project, "fixture deve parsear sem erro",);
    project.schedule();
  },);

  describe("14C.19.1 — linha Markdown em propertiesByType", () => {
    it("alinhamento da coluna markdown é left (não o fallback center)", () => {
      assertEquals(
        TableReport.alignment("Claim", AttributeType.Markdown,),
        "left",
      );
      assertEquals(
        TableReport.alignment("Claim", AttributeType.RichText,),
        "left",
        "markdown se alinha a richtext",
      );
      assertEquals(
        TableReport.indent("Claim", AttributeType.Markdown,),
        false,
      );
    });

    it("célula markdown é rica: alinhada e com <b> no to_html", () => {
      const table = genTable(project, byId("mdcols",),);
      const cell = cellOf(table, lineOf(table, "fase.t1",), "Claim",);
      assertEquals(cell.alignment, "left",);
      const text = cell.text as RichTextIntermediate;
      const out = html(text,);
      assert(out.includes("<b>Efetivo:</b>",), `esperava <b>: ${out}`,);
      assert(out.includes("15 pedreiros",), out,);
    });
  });

  describe("14C.19.2 — texto plano da célula é markup-free", () => {
    it("to_s da célula markdown não carrega asteriscos", () => {
      const table = genTable(project, byId("mdcols",),);
      const cell = cellOf(table, lineOf(table, "fase.t1",), "Claim",);
      const plain = (cell.text as RichTextIntermediate).to_s();
      assertEquals(plain, "Efetivo: 15 pedreiros",);
    });

    it("atributo sem markup (t2) tem o mesmo texto em to_s e to_html", () => {
      const table = genTable(project, byId("mdcols",),);
      const t2 = lineOf(table, "fase.t2",);
      const cell = cellOf(table, t2, "Claim",);
      const rti = cell.text as RichTextIntermediate;
      assertEquals(rti.to_s(), "Sem markup, só texto",);
      assertEquals(html(rti,).includes("Sem markup, só texto",), true,);
    });
  });

  describe("14C.19.3 — format markdown não reconverte atributo markdown", () => {
    it("Claim é idêntico em mdfmt e rtfmt; Intro é recriado no dialeto", () => {
      // Claim é markdown na origem: o guard `richText instanceof RichText` de
      // rtiForReport (14C.5.7) não o reinterpreta — as duas saídas coincidem
      // e a célula de mdfmt é o próprio RTI armazenado.
      const mdTable = genTable(project, byId("mdfmt",),);
      const rtTable = genTable(project, byId("rtfmt",),);
      const mdClaim = cellOf(mdTable, lineOf(mdTable, "fase.t1",), "Claim",);
      const rtClaim = cellOf(rtTable, lineOf(rtTable, "fase.t1",), "Claim",);
      const storedClaim = project.task("fase.t1",)!.getAttribute("Claim",)!
        .get() as RichTextIntermediate;
      assert(mdClaim.text === storedClaim, "markdown não deve ser recriado",);
      assertEquals(
        html(mdClaim.text as RichTextIntermediate,),
        html(rtClaim.text as RichTextIntermediate,),
      );

      // Intro é richtext: `format markdown` recria o RTI pelo pipeline
      // markdown a partir do texto de origem — a célula de mdfmt é um objeto
      // novo (não o armazenado). A troca é de dialeto, não de ênfase: o
      // markup MediaWiki `'''…'''` não é sintaxe markdown e permanece literal.
      const mdIntro = cellOf(mdTable, lineOf(mdTable, "fase.t1",), "Intro",);
      const rtIntro = cellOf(rtTable, lineOf(rtTable, "fase.t1",), "Intro",);
      const storedIntro = project.task("fase.t1",)!.getAttribute("Intro",)!
        .get() as RichTextIntermediate;
      assert(
        mdIntro.text !== storedIntro,
        "richtext deveria ser recriado no dialeto markdown",
      );
      assertEquals(
        (rtIntro.text as RichTextIntermediate).to_s(),
        (storedIntro as RichTextIntermediate).to_s(),
        "no default richtext o RTI armazenado volta intacto",
      );
      // O texto de origem (inputText) é o mesmo nos dois dialetos — é dele
      // que o export TJP se recupera (C5.7). No RTI markdown o back-pointer
      // é o shim `{ factory, inputText }` do MarkdownFactory, não um RichText.
      assertEquals(
        ((mdIntro.text as RichTextIntermediate).richText as {
          inputText: string;
        }).inputText,
        "'''abertura'''",
        "inputText sobrevive à troca de dialeto",
      );
      assertEquals(
        (storedIntro as RichTextIntermediate).richText as unknown,
        (rtIntro.text as RichTextIntermediate).richText as unknown,
        "no richtext o back-pointer é o próprio RichText armazenado",
      );
    });
  });

  describe("14C.19.4 — sanitização na saída do relatório", () => {
    it("HTML cru no valor markdown sai inerte na grade", () => {
      const table = genTable(project, byId("mdcols",),);
      const t2 = lineOf(table, "fase.t2",);
      const cell = cellOf(table, t2, "Note2",);
      const out = html(cell.text as RichTextIntermediate,);
      assert(!out.includes("<script",), out,);
      assert(!out.includes("onerror",), out,);
      // O texto em volta sobrevive como texto inerte.
      assert(out.includes("alert(",), out,);
      assert(out.includes("Texto com",), out,);
    });

    it("documento gerado não carrega o payload da fixture", () => {
      project.reportContexts.push(
        new ReportContext(project, byId("mdcols",),),
      );
      try {
        byId("mdcols",).generate(["html",],);
        const doc = String(byId("mdcols",).output,);
        assert(!doc.includes("<script>alert",), doc.slice(0, 400,),);
        assert(!doc.includes("onerror=",), "atributo de evento descartado",);
      } finally {
        project.reportContexts.pop();
      }
    });
  });
});
