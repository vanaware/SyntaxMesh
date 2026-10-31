/**
 * 14.24.7/14.24.10 — Smoke test pós-Fase 14.
 *
 * Exercita o fluxo ponta-a-ponta de relatórios sem escrita a disco (ADR 027):
 *
 *  1. Parser (`mwe005`) → `schedule` → `Report.generate()` → string HTML com
 *     a tabela do `taskreport` (integração modelo ↔ relatório).
 *  2. `Project.generateReports` (agregador da Fase 9) com 1 `textreport`
 *     construído programaticamente — 14.24.10.
 *  3. Fase 13 (Markdown) permanece funcional — regressão exigida pelo plano.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.24.7, 14.24.10)
 * @see ADR 027 (reports browser-only retornam strings)
 */

import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { ProjectFileParser, } from "../../src/parser/mod.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { RichText, } from "../../src/richtext/rich-text.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import * as markdown from "../../src/markdown/mod.ts";
// Efeito colateral: registra as fábricas de conteúdo de relatório.
import "../../src/reports/mod.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report as ReportTypeModel, } from "../../src/model/report.ts";

const REPO_ROOT = new URL("../../../../", import.meta.url,);

/** Parse + schedule de um `.tjp` do repo, como nos golden tests. */
function loadProject(rel: string,): Project {
  TjTime.setTimeZone("Europe/Berlin",);
  const mh = MessageHandlerInstance.instance;
  mh.messages.length = 0;
  mh.errors = 0;
  const parser = new ProjectFileParser();
  parser.open(new URL(rel, REPO_ROOT,).pathname, true, false,);
  const project = parser.parse("project",) as Project;
  project.schedule();
  return project;
}

describe("Smoke test after Phase 14 (reports end-to-end)", () => {
  it("mwe005 → report html → generate() retorna string com a tabela", () => {
    const project = loadProject("docs/Learning/mwe005/tutorial.tjp",);
    const report = (project.reports.toArray() as ReportTypeModel[]).find(
      (r,) => (r.get("formats",) as string[] | null)?.includes("html",),
    );
    assert(report, "mwe005 tem um relatório html",);
    // `generate()` roda sobre o contexto ativo — quem empurra é o agregador
    // (`Project.generateReports`); no smoke, manualmente como em tj3.
    project.reportContexts.push(
      new ReportContext(project, report,),
    );
    try {
      report.generate();
    } finally {
      project.reportContexts.pop();
    }
    const output = report.output;
    // ADR 027: browser — o resultado é SEMPRE uma string em memória.
    assertEquals(typeof output, "string",);
    assert((output as string).length > 0, "relatório vazio",);
    assert((output as string).includes("<table",), "saída sem tabela",);
  });

  it("Fase 13 (Markdown) permanece funcional — regressão (14.24.7)", () => {
    const factory = new markdown.MarkdownFactory(null,);
    const rti = factory.create("# Título\n\n**negrito**",);
    assert(rti.to_html !== undefined || rti.tree !== null,);
    assert(rti.to_s().includes("negrito",), rti.to_s(),);
    assert(
      markdown.richTextToMarkdown("== Título ==",).includes("# Título",),
    );
  });
});

describe("14.24.10 Project.generateReports end-to-end (1 report)", () => {
  it("gera um textreport html via agregador e popula report.output", () => {
    const project = createTestProject(1,);
    project.schedule();
    const report = new Report(project, "tx", "tx.html", null,);
    report.typeSpec = ReportType.TextReport;
    report.set("formats", ["html",],);
    const rt = (text: string,) =>
      new RichText(text,).generateIntermediateFormat();
    report.set("center", rt("Relatório de fumaça",),);

    // Agregador da Fase 9.8: indexa, empurra contexto, gera, popa.
    project.generateReports(1,);

    assertEquals(typeof report.output, "string",);
    const out = report.output as string;
    assert(
      out.includes("Relatório de fumaça",),
      `saída: ${out.slice(0, 120,)}`,
    );
    // Browser (ADR 027): nada escrito em disco — só a pilha de contextos.
    assertEquals(project.reportContexts.length, 0,);
  });
});
