/**
 * 15.14.7 — Smoke test pós-Fase 15 (Gantt HTML+CSS).
 *
 * Ponta o Gantt (Fase 15) com o pipeline de relatórios (Fase 14) usando
 * `.tjp` reais com coluna `chart`: parse → schedule → `Report#generate`
 * → HTML em memória (ADR 027).
 *
 * Verifica três coisas:
 *  1. **Fase 14 intacta** — a tabela continua sendo gerada (cabeçalho, colunas
 *     e linhas de texto antes/depois do chart).
 *  2. **Fase 15 presente** — a célula `chart` emite o viewport `div.tabback`
 *     com as barras (`taskbar`), exatamente o contrato `SpecialCell` que
 *     substituiu os 2 stubs `Ancorado: Fase 16` (ADR 032).
 *  3. **HTML puro (ADR 028)** — nenhuma saída contém `<svg`/`<canvas`.
 *
 * Usa as variantes **pt-BR** dos MWEs: prova que a língua não contamina o core
 * (ADR 004) e que o namespace de colunas traduzido chega ao chart.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.14.7)
 * @see docs/syntaxmesh/decisoes/028-gantt-html-css.md
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { parseProject, } from "../parser/parse-helper.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
// Efeito colateral: registra as fábricas de conteúdo de relatório.
import "../../src/reports/mod.ts";
import type { Project, } from "../../src/model/project.ts";

/** MWEs com coluna `chart` usados no smoke (os mesmos do golden 15.13). */
const CHART_MWES = ["mwe001", "mwe003", "mwe008",] as const;

/** Quantos charts cada MWE declara (conferido em `gantt.golden.json`). */
const EXPECTED_CHARTS: Record<string, number> = {
  mwe001: 1,
  mwe003: 1,
  mwe008: 3,
};

/** Lê o `.tjp` traduzido, parseia, agenda e devolve o projeto. */
function loadProject(mwe: string,): Project {
  const text = Deno.readTextFileSync(
    new URL(`../fixtures/i18n/${mwe}.pt-BR.tjp`, import.meta.url,),
  );
  const out = parseProject(text,);
  assertEquals(
    out.threw,
    null,
    `${mwe}: parse lançou ${out.threw?.message ?? ""}`,
  );
  assertEquals(
    out.messageIds,
    [],
    `${mwe}: msgs=${
      out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)
    }`,
  );
  const project = out.result as Project;
  project.schedule();
  return project;
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
  assertEquals(typeof output, "string", `${id}: HTML deve ser string`,);
  return output as string;
}

describe("Smoke test after Fase 15 (Gantt)", () => {
  it("mwe001 pt-BR: o chart é gerado dentro da tabela (Fase 14 intacta)", () => {
    const project = loadProject("mwe001",);
    // O `.tjp` pt-BR não declara id no `relatoriotarefa`, então o id é o
    // automático `report1` (o nome é "Plan").
    const html = generateHtml(project, "report1",);
    assertEquals(
      (project.report("report1",) as Report).name,
      "Plan",
      "id automático mudou de lugar",
    );

    // Fase 14: a tabela e as colunas de texto continuam lá.
    assert(html.includes("<table",), "sem <table>",);
    assert(html.includes(">WBS<",), "cabeçalho da coluna bsi ausente",);
    assert(html.includes("Design Phase",), "linha de tarefa ausente",);

    // Fase 15: a célula `chart` virou o viewport com as barras.
    assert(html.includes(`class="tabback"`,), "sem o div.tabback do chart",);
    assert(html.includes(`taskbar"`,), "sem div.taskbar (barras)",);
    assert(html.includes(`class="tj_gantt_frame"`,), "sem a moldura da barra",);

    // ADR 028: Gantt é HTML+CSS puro.
    assert(!html.includes("<svg",), "ADR 028: chart não usa SVG",);
    assert(!html.includes("<canvas",), "ADR 028: chart não usa Canvas",);
  });

  it("mwe003 e mwe008 pt-BR: todos os charts dos MWEs fecham sem stub", () => {
    for (const mwe of CHART_MWES.slice(1,)) {
      const project = loadProject(mwe,);
      // mwe008 declara 3 relatórios com `chart`; gerar todos é o que prova
      // que nenhum caminho caiu no `NotYetImplementedError` da Fase 16.
      const reports = (project.reports.toArray() as Report[]).filter((r,) =>
        r.get("formats",) !== null
      );
      assert(reports.length > 0, `${mwe}: nenhum relatório`,);
      let charts = 0;
      for (const report of reports) {
        const html = generateHtml(project, report.id,);
        if (html.includes(`class="tabback"`,)) charts++;
        assert(html.includes("<table",), `${mwe}/${report.id}: sem <table>`,);
        assert(!html.includes("<svg",), `${mwe}: chart não usa SVG`,);
      }
      assertEquals(charts, EXPECTED_CHARTS[mwe], `${mwe}: nº de charts`,);
    }
  });
});
