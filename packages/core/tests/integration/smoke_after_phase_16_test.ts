/**
 * 16.20.7 / 16.20.10 — Smoke test pós-Fase 16 (Apoio).
 *
 * Fecha a fase provando três pontos:
 *  1. **Journal** (ADR 029) — uma entrada criada pelo construtor é indexada
 *     na lista canônica e por propriedade, e `Journal#alertLevel` devolve o
 *     nível da entrada mais recente.
 *  2. **Fase 15 intacta** — o Gantt continua gerando HTML+CSS (sem SVG nem
 *     Canvas) dentro do pipeline de relatórios da Fase 14.
 *  3. **16.20.10** — `TaskScenario.query_journal` (via `PropertyTreeNode`)
 *     devolve `RichTextIntermediate` com as entradas do journal.
 *
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.20)
 * @see docs/syntaxmesh/decisoes/029-journal-alertlevel.md
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { parseProject, } from "../parser/parse-helper.ts";
import { Task, } from "../../src/model/task.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import { Query, } from "../../src/query/query.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
// Efeito colateral: registra as fábricas de conteúdo de relatório.
import "../../src/reports/mod.ts";
import type { Project, } from "../../src/model/project.ts";
import type { RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";

/** Query de journal padrão para as asserções do smoke. */
function journalQuery(project: Project, task: Task,): Query {
  return new Query({
    project,
    property: task,
    start: TjTime.fromString("2026-01-01",),
    end: TjTime.fromString("2026-12-31",),
    scenarioIdx: 0,
    journalMode: "journal",
    journalAttributes: ["alert", "property", "propertyid", "headline", "date",],
    timeFormat: "%Y-%m-%d",
  },);
}

/** Gera `html` do relatório `id` (empilha/desempilha o contexto). */
function generateHtml(project: Project, id: string,): string {
  const report = project.report(id,) as Report;
  assert(report !== null, `relatório ${id} ausente no fixture`,);
  project.reportContexts.push(new ReportContext(project, report,),);
  try {
    report.generate(["html",],);
  } finally {
    project.reportContexts.pop();
  }
  const output = report.output;
  assert(output !== null, `relatório ${id} não produziu HTML`,);
  return output as string;
}

describe("Smoke test after Fase 16 (Apoio)", () => {
  it("journal: entrada indexada, alertLevel e nível default red", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "Design", null,);

    const entry = new JournalEntry(
      project.journal,
      TjTime.fromString("2026-01-10",),
      "Risco identificado",
      task,
    );
    entry.alertLevel = 2;
    entry.summary = "Resumo do risco";

    // Lista canônica + índice por propriedade.
    assertEquals(project.journal.entryList.length(), 1,);
    assertEquals(project.journal.getEntries(task,)?.length(), 1,);

    // alertLevel usa as entradas correntes até a data.
    const query = journalQuery(project, task,);
    assertEquals(
      project.journal.alertLevel(
        TjTime.fromString("2026-01-20",),
        task,
        query,
      ),
      2,
    );

    // AlertLevelDefinitions default: green/yellow/red (ADR 029).
    const levels = project.get("alertLevels",) as Array<
      { id: string; name: string; color: string }
    >;
    assertEquals(levels[2]?.id, "red",);
    assertEquals(levels[2]?.name, "Red",);
  });

  it("TaskScenario.query_journal devolve RTI com a entrada (16.20.10)", () => {
    const project = createTestProject(1,);
    const task = new Task(project, "t1", "Design", null,);
    new JournalEntry(
      project.journal,
      TjTime.fromString("2026-01-10",),
      "Risco identificado",
      task,
    );

    const query = journalQuery(project, task,);
    task.query_journal(query,);

    assert(query.rti !== null, "query_journal não produziu RTI",);
    const rti = query.rti as RichTextIntermediate;
    assertEquals(rti.cssClass, "tj_journal",);
    assertEquals(rti.sectionNumbers, false,);
    const text = rti.to_s().replace(/\s+/g, " ",).trim();
    assert(text.includes("Risco identificado",), `texto do RTI: ${text}`,);
    assert(text.includes("Design",), `texto do RTI: ${text}`,);
  });

  it("Gantt (Fase 15) continua gerando HTML+CSS dentro dos relatórios", () => {
    const text = Deno.readTextFileSync(
      new URL(`../fixtures/i18n/mwe001.pt-BR.tjp`, import.meta.url,),
    );
    const out = parseProject(text,);
    assertEquals(out.threw, null,);
    assertEquals(out.messageIds, [],);
    const project = out.result as Project;
    project.schedule();

    const html = generateHtml(project, "report1",);
    // Fase 14: tabela e colunas de texto.
    assert(html.includes("<table",), "sem <table>",);
    assert(html.includes("Design Phase",), "linha de tarefa ausente",);
    // Fase 15: viewport do chart com barras.
    assert(html.includes(`class="tabback"`,), "sem o div.tabback do chart",);
    assert(html.includes(`taskbar"`,), "sem div.taskbar (barras)",);
    // ADR 028: Gantt é HTML+CSS puro.
    assert(!html.includes("<svg",), "ADR 028: chart não usa SVG",);
    assert(!html.includes("<canvas",), "ADR 028: chart não usa Canvas",);
  });
});
