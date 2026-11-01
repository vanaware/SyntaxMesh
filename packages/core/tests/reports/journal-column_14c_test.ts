/**
 * Testes da coluna `journal` em relatórios (Fase 14 Complemento 14C.1.7).
 *
 * Cobre o port de `Journal#to_rti` + `JournalEntry#to_rText` e o dispatch
 * `TableReport.genJournalCell`, que atende qualquer entidade: material e conta
 * (novos em 14C) e tarefa/recurso (que antes caíam em "Unknown attribute").
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.1.7)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Material, } from "../../src/model/material.ts";
import { Account, } from "../../src/model/account.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { MaterialListRE, } from "../../src/reports/material-list-re.ts";
import { AccountListRE, } from "../../src/reports/account-list-re.ts";
import type { ReportTableLine, } from "../../src/reports/report-table-line.ts";

const D = (s: string,) => TjTime.fromString(s,);

/** Relatório pronto para gerar o formato intermediário. */
function makeReport(
  project: Project,
  typeSpec: ReportType | "materialreport",
  columns: TableColumnDefinition[],
): Report {
  const report = new Report(project, "r", "r.html", null,);
  report.typeSpec = typeSpec as never;
  report.set("start", D("2026-01-01",),);
  report.set("end", D("2026-12-31",),);
  report.set("scenarios", [0,],);
  report.set("columns", columns,);
  project.reportContexts.push(new ReportContext(project, report,),);
  return report;
}

/** Texto plano de uma célula (RTI ou string). */
function textOf(line: ReportTableLine, index: number,): string {
  const cell = line.cells[index] as unknown as { text?: unknown } | null;
  const text = cell?.text;
  if (text === null || text === undefined) return "";
  if (typeof text === "string") return text;
  const rti = text as { to_s?: () => string };
  return typeof rti.to_s === "function" ? rti.to_s() : String(text,);
}

/** Linha da tabela cuja propriedade é `property`. */
function lineOf(
  lines: ReportTableLine[],
  property: unknown,
): ReportTableLine {
  const line = lines.find((l,) => l.property === property);
  assert(line, `linha de ${String(property,)} ausente`,);
  return line!;
}

describe("coluna journal (14C.1.7)", () => {
  let project: Project;
  let steel: Material;

  beforeEach(() => {
    project = createTestProject(1,);
    steel = new Material(project, "steel", "kg", 2.5,);
    steel.set("unit", "kg",);
    steel.set("cost", 2.5,);
    steel.set("totalquantity", 100,);
  },);

  it("renderiza as entradas de um material (headline, data, flags e detalhes)", () => {
    const entry = new JournalEntry(
      project.journal,
      D("2026-03-10",),
      "Entrega parcial",
      steel,
    );
    entry.summary = "Chegaram 50 kg.";
    entry.details = "Nota fiscal 1234.";
    entry.flags = ["entrega",];

    const report = makeReport(project, "materialreport", [
      new TableColumnDefinition("name", "Name",),
      new TableColumnDefinition("journal", "Journal",),
    ],);
    const re = new MaterialListRE(report,);
    re.generateIntermediateFormat();
    const line = re.getTable()!.getLines()[0]!;
    const journal = textOf(line, 1,);

    assert(journal.includes("Entrega parcial",), `sem headline: ${journal}`,);
    assert(journal.includes("2026-03-10",), `sem data: ${journal}`,);
    assert(journal.includes("Chegaram 50 kg.",), `sem resumo: ${journal}`,);
    assert(journal.includes("Nota fiscal 1234.",), `sem detalhes: ${journal}`,);
    assert(journal.includes("entrega",), `sem flags: ${journal}`,);
  });

  it("material sem entradas não gera '<Error>' na célula", () => {
    const report = makeReport(project, "materialreport", [
      new TableColumnDefinition("name", "Name",),
      new TableColumnDefinition("journal", "Journal",),
    ],);
    const re = new MaterialListRE(report,);
    re.generateIntermediateFormat();
    const journal = textOf(re.getTable()!.getLines()[0]!, 1,);
    assertEquals(journal, "",);
  });

  it("journal_sub de uma conta inclui as entradas das subcontas", () => {
    const root = new Account(project, "a1", "A1", null,);
    const child = new Account(project, "a2", "A2", root,);
    new JournalEntry(project.journal, D("2026-02-01",), "Conta raiz", root,);
    new JournalEntry(project.journal, D("2026-02-02",), "Subconta", child,);

    const report = makeReport(project, ReportType.AccountReport, [
      new TableColumnDefinition("name", "Name",),
      new TableColumnDefinition("journal_sub", "Journal",),
    ],);
    report.set("journalMode", "journal_sub",);

    const re = new AccountListRE(report,);
    re.generateIntermediateFormat();
    const lines = re.getTable()!.getLines();
    const rootLine = lineOf(lines, root,);
    const journal = textOf(rootLine, 1,);

    assert(journal.includes("Conta raiz",), `sem raiz: ${journal}`,);
    assert(journal.includes("Subconta",), `sem subconta: ${journal}`,);
  });
});
