/**
 * Testes de ReportContext (Fase 14.2).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.2)
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { type Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";

describe("ReportContext (14.2)", () => {
  let project: Project;
  let report: Report;

  beforeEach(() => {
    project = createTestProject(2,);
    report = new Report(project, "r1", "r1.html", null,);
  },);

  it("contexto raiz tem dynamicReportId '0'", () => {
    const ctx = new ReportContext(project, report,);
    assertEquals(ctx.dynamicReportId, "0",);
    assertEquals(ctx.childReportCounter, 0,);
    assertEquals(ctx.attributeBackup, null,);
  });

  it("query referencia o projeto", () => {
    const ctx = new ReportContext(project, report,);
    assertEquals(ctx.query.project, project,);
  });

  it("query herda configurações do report", () => {
    report.set("loadUnit", "day",);
    report.set("journalMode", "status_up",);
    const ctx = new ReportContext(project, report,);
    assertEquals(ctx.query.loadUnit, "day",);
    assertEquals(ctx.query.journalMode, "status_up",);
  });

  it("tasks/resources populados do projeto na raiz", () => {
    const ctx = new ReportContext(project, report,);
    assert(ctx.tasks instanceof Object,);
    assert(ctx.resources instanceof Object,);
    // Cópia independente das listas do projeto.
    assertEquals(ctx.tasks.length(), project.tasks.toArray().length,);
  });

  it("contexto aninhado encadeia dynamicReportId", () => {
    const root = new ReportContext(project, report,);
    project.reportContexts.push(root,);
    const child = new ReportContext(project, report,);
    // Primeiro filho da raiz: "0.0".
    assertEquals(child.dynamicReportId, "0.0",);
    assertEquals(root.childReportCounter, 1,);
    const child2 = new ReportContext(project, report,);
    assertEquals(child2.dynamicReportId, "0.1",);
    project.reportContexts.pop();
  });

  it("contexto aninhado herda tasks/resources do pai", () => {
    const root = new ReportContext(project, report,);
    project.reportContexts.push(root,);
    const child = new ReportContext(project, report,);
    assertEquals(child.tasks.length(), root.tasks.length(),);
    // Mas são listas distintas (mutação do filho não afeta o pai).
    assert(child.tasks !== root.tasks,);
    project.reportContexts.pop();
  });

  it("encadeamento profundo 0 → 0.0 → 0.0.0", () => {
    const root = new ReportContext(project, report,);
    project.reportContexts.push(root,);
    const mid = new ReportContext(project, report,);
    project.reportContexts.push(mid,);
    const leaf = new ReportContext(project, report,);
    assertEquals(leaf.dynamicReportId, "0.0.0",);
    project.reportContexts.pop();
    project.reportContexts.pop();
  });
});
