/**
 * Fase 24 (24.2.14–24.2.17) — contrato `ReportsJson` da seção `results.reports`.
 *
 * `Report#generate()` guarda o conteúdo de **cada** formato em `outputs`
 * (`stdout`/arquivo continuam sendo política da CLI); `renderReports` monta a
 * seção com a ordem de declaração, a flag `stdout` da DSL, `formats[]` com
 * conteúdo já renderizado, `errors[]` por relatório (sem matar os demais) e o
 * `ok` global. Nenhum acesso a disco/terminal acontece aqui.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.2/§3.3
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";
import { TaskJuggler, } from "../../src/taskjuggler.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
// Efeito colateral: registra as fábricas de conteúdo dos relatórios.
import "../../src/reports/mod.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { renderReports, } from "../../src/reports/reports-json.ts";

/** Projeto com dois `taskreport` (o primeiro com `stdout`). */
const PROJECT_TEXT = [
  'project prj "Test" "1.0" 2026-01-01 - 2026-12-31',
  "",
  'task t1 "Alpha" { effort 2d }',
  'task t2 "Beta" { effort 1d }',
  "",
  'taskreport first "Tarefas" stdout {',
  "  formats csv, html",
  "}",
  "",
  'taskreport second "Recursos" {',
  "  formats csv",
  "}",
  "",
].join("\n",);

/** Parseia o fixture e devolve o `Project` (sem mensagens). */
function parseFixture(text: string = PROJECT_TEXT,): Project {
  MessageHandlerInstance.instance.reset();
  const parser = new ProjectFileParser();
  parser.open(text, true, true, "fixture.tjp",);
  const project = parser.parse("project",) as Project;
  assertEquals(MessageHandlerInstance.instance.errors, 0,);
  return project;
}

/** Relatório pelo nome exibido. */
function reportOf(project: Project, name: string,): Report {
  const r = project.reportByName(name,);
  assert(r !== null, `relatório ${name} não encontrado`,);
  return r!;
}

/** Gera o relatório dentro de um `ReportContext` (como o `Project` faz). */
function generate(project: Project, report: Report,): void {
  project.reportContexts.push(new ReportContext(project, report,),);
  try {
    report.generate();
  } finally {
    project.reportContexts.pop();
  }
}

describe("Report#outputs (24.2.14)", () => {
  let project: Project;

  beforeEach(() => {
    project = parseFixture();
  },);

  it("guarda o conteúdo de cada formato pedido", () => {
    const report = reportOf(project, "Tarefas",);
    generate(project, report,);
    const csv = report.outputs.get("csv",);
    const html = report.outputs.get("html",);
    assert(csv !== undefined, "csv ausente em outputs",);
    assert(html !== undefined, "html ausente em outputs",);
    assertEquals(typeof csv, "string",);
    assertEquals(typeof html, "string",);
    assert(csv!.includes(";",), `csv sem separador: ${csv}`,);
    assert(html!.includes("<html",), `html inesperado: ${html}`,);
  });

  it("CSV sai normalizado como texto (CSVFile ';')", () => {
    const report = reportOf(project, "Recursos",);
    generate(project, report,);
    const csv = report.outputs.get("csv",);
    assert(csv !== undefined,);
    assert(csv!.split("\n",).length > 1, `csv curto: ${csv}`,);
    assert(!csv!.includes("[object Object]",),);
  });

  it("mantém `output`/`outputFileName` legados", () => {
    const report = reportOf(project, "Recursos",);
    generate(project, report,);
    // Caminho lógico continua prefixado pelo `outputDir` do projeto (default
    // "/"); o `outputs` da Fase 24 não mexe nesse contrato.
    assert(
      report.outputFileName.endsWith("Recursos.csv",),
      report.outputFileName,
    );
    assert(Array.isArray(report.output,), "output legado continua cru (CSV)",);
  });
});

describe("renderReports (24.2.16)", () => {
  let project: Project;

  beforeEach(() => {
    project = parseFixture();
  },);

  it("preserva ordem, flag e formatos declarados", () => {
    const json = renderReports(project,);

    assertEquals(json.ok, true,);
    assertEquals(json.reports.map((r,) => r.name), ["Tarefas", "Recursos",],);
    const [first, second,] = json.reports;
    assertEquals(first!.stdout, true,);
    assertEquals(second!.stdout, false,);
    assertEquals(first!.formats.map((f,) => f.format), ["csv", "html",],);
    assertEquals(second!.formats.map((f,) => f.format), ["csv",],);
    for (const entry of json.reports) {
      for (const format of entry.formats) {
        assertEquals(typeof format.content, "string",);
        assert(format.content.length > 0, `${entry.name}/${format.format}`,);
      }
    }
    assertEquals(first!.errors, [],);
  });

  it("outputDir só aparece quando passado", () => {
    const without = renderReports(project,);
    assert(!("outputDir" in without),);

    const withDir = renderReports(project, { outputDir: "out", },);
    assertEquals(withDir.outputDir, "out",);
  });

  it("selection por id filtra mantendo o contrato", () => {
    const json = renderReports(project, { report: "second", },);
    assertEquals(json.reports.map((r,) => r.name), ["Recursos",],);
    assertEquals(json.ok, true,);
  });

  it("selection por regex filtra mantendo a ordem", () => {
    const json = renderReports(project, {
      report: "^fir",
      reportsIsRegex: true,
    },);
    assertEquals(json.reports.map((r,) => r.name), ["Tarefas",],);
  });

  it("erro em um relatório não mata os demais", () => {
    // Formato desconhecido injetado direto (o parser só aceita ids válidos).
    reportOf(project, "Tarefas",).set("formats", ["bogus",],);

    const json = renderReports(project,);
    const first = json.reports[0]!;
    assert(first.errors.length > 0, "erro do relatório não capturado",);
    assert(
      first.errors.some((e,) => e.includes("bogus",)),
      first.errors.join(" | ",),
    );
    assertEquals(first.formats, [],);

    // O segundo relatório continua sendo gerado.
    const second = json.reports[1]!;
    assertEquals(second.formats.length, 1,);
    assert(second.formats[0]!.content.length > 0,);
    assertEquals(json.ok, false,);
  });
});

describe("TaskJuggler.renderReports (24.2.17)", () => {
  it("expõe a seção a partir da fachada", () => {
    MessageHandlerInstance.instance.reset();
    const tj = new TaskJuggler();
    assertEquals(tj.parseContent(PROJECT_TEXT, "fixture.tjp",), true,);

    const json = tj.renderReports();
    assertEquals(json.reports.length, 2,);
    assertEquals(json.reports[0]!.name, "Tarefas",);

    const filtered = tj.renderReports({ report: "first", },);
    assertEquals(filtered.reports.length, 1,);
  });
});
