/**
 * Testes do `tracereport` com materiais (Fase 14 Complemento 14C.1.14).
 *
 * O TraceReport monta uma linha por execução com colunas de contas, recursos e
 * tarefas. A extensão SyntaxMesh acrescenta uma lista de materiais, de modo que
 * colunas `<-atributo->` resolvidas por `Query.process` (14C.1.20) funcionam
 * quando a coluna aponta para um material. Sem materiais o cabeçalho não muda.
 *
 * Os filtros `hidematerial`/`rollupmaterial` ainda não existem — entram em
 * 14C.6 (Fase 14 Complemento).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.14)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { Material, } from "../../src/model/material.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { TraceReport, } from "../../src/reports/trace-report.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";

describe("tracereport com materiais (14C.1.14)", () => {
  let project: Project;
  let report: Report;

  beforeEach(() => {
    project = createTestProject(1,);
    report = new Report(project, "trace1", "trace1", null,);
    report.typeSpec = ReportType.TraceReport;
    report.set("start", TjTime.fromString("2026-01-01",),);
    report.set("end", TjTime.fromString("2026-12-31",),);
    report.set("scenarios", [0,],);
    report.set("sortTasks", [],);
    report.set("sortResources", [],);
    report.set("sortAccounts", [],);
    project.reportContexts.push(new ReportContext(project, report,),);
  },);

  it("colunas <-atributo-> resolvem para materiais", () => {
    const steel = new Material(project, "steel", "kg", 2.5,);
    steel.set("unit", "kg",);
    steel.set("cost", 2.5,);
    steel.set("totalquantity", 100,);

    report.set("columns", [
      new TableColumnDefinition("name", "<-name->",),
      new TableColumnDefinition("cost", "<-cost->",),
      new TableColumnDefinition("totalquantity", "<-totalquantity->",),
    ],);

    const tr = new TraceReport(report,);
    tr.generateIntermediateFormat();
    const table = tr.getTable()!;
    const header = table[0] as string[];

    // Date + 3 colunas × 1 cenário × 1 material (sem contas/recursos/tarefas).
    assertEquals(header, ["Date", "steel", "2.5", "100",],);
    const row = table[1]!;
    assertEquals(row[1], "steel",);
    // Células de valor usam `Query.result()`: o valor cru do atributo.
    assertEquals(row[2], 2.5,);
    assertEquals(row[3], 100,);
    // CSV preserva a ordem das colunas do material.
    assertEquals(tr.to_csv()[1]!.slice(1,), ["steel", 2.5, 100,],);
  });

  it("sem materiais o cabeçalho continua apenas com Date (regressão)", () => {
    const tr = new TraceReport(report,);
    tr.generateIntermediateFormat();
    assertEquals(tr.getTable()![0], ["Date",],);
    assert(project.materials.toArray().length === 0,);
  });
});
