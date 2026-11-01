/**
 * Testes do `textreport` em projetos com materiais (Fase 14 Complemento
 * 14C.1.12).
 *
 * Veredito: `TextReport` (também no Ruby 3.8.4 — `TextReport < ReportBase`)
 * não tem sistema de colunas, portanto **não** herda `materials`/
 * `materialcost` de `taskreport`. Dados de material chegam a um textreport
 * apenas via blocos RichText (`header`/`left`/`center`/`right`/`footer`); a
 * listagem tabular de materiais é responsabilidade do `materialreport`
 * (14C.1.1–14C.1.10). `columns` é aceito pelo parser (padrão compartilhado de
 * `report`) mas nunca é lido por `TextReport`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.12)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { RichText, } from "../../src/richtext/rich-text.ts";
import type { XMLElementLike, } from "../../src/richtext/xml-like.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TextReport, } from "../../src/reports/text-report.ts";
import { TableReport, } from "../../src/reports/table-report.ts";
import { Material, } from "../../src/model/material.ts";
import { contentFactories, } from "../../src/model/report-content.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";

describe("textreport com materiais (14C.1.12)", () => {
  let project: Project;
  let report: Report;

  /** Bloco RichText mínimo aceito por `rt_to_html`. */
  const rt = (text: string,) =>
    new RichText(text,).generateIntermediateFormat();

  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
    project = createTestProject(1,);
    const steel = new Material(project, "steel", "kg", 2.5,);
    steel.set("unit", "kg",);
    steel.set("cost", 2.5,);
    steel.set("totalquantity", 100,);

    report = new Report(project, "tx", "tx.html", null,);
    report.typeSpec = ReportType.TextReport;
    project.reportContexts.push(new ReportContext(project, report,),);
  },);

  it("a fábrica produz TextReport (sem colunas), não um TableReport", () => {
    const factory = contentFactories.get("textreport",);
    assert(factory, "textreport registrado na fábrica de conteúdo",);
    const content = factory!(report,);
    assert(content instanceof TextReport,);
    // Veredito: sem herança de colunas de taskreport (`materials`,
    // `materialcost`, `accounts` etc. não existem neste tipo de relatório).
    assert(!(content instanceof TableReport),);
  });

  it("material aparece no textreport apenas via RichText", () => {
    report.set("center", rt("Custo de steel: 250",),);
    const tr = new TextReport(report,);
    tr.generateIntermediateFormat();

    const html = tr.to_html();
    assertEquals(html.length, 1,);
    const inner = (html[0] as XMLElementLike).toHTML();
    assert(inner.includes("steel",), "texto do material no bloco RichText",);
    // Sem grade de colunas: só a célula do bloco central.
    assert(!inner.includes("tj_table",), "textreport não monta grade",);
    assertEquals(tr.to_csv(), null,);
  });
});
