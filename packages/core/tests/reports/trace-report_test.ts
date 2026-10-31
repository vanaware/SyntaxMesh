/**
 * Testes de TraceReport (Fase 14.20.2).
 *
 * Cobre a construção do cabeçalho (Date + colunas expandidas via
 * SimpleQueryExpander), merge da tabela anterior com e sem `TableColumnSorter`,
 * adição/atualização da linha da data atual, ordenação por data preservando o
 * cabeçalho no topo e a serialização `to_csv()`. A variante Ruby lê o CSV
 * anterior do disco — aqui injetamos via `previousTableSource` (ADR 027).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.20.2)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Account, } from "../../src/model/account.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import {
  TraceReport,
  type TraceTable,
} from "../../src/reports/trace-report.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { contentFactories, } from "../../src/model/report-content.ts";

function column(id: string, title: string,): TableColumnDefinition {
  return new TableColumnDefinition(id, title,);
}

describe("TraceReport (14.20.2)", () => {
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

  function newTrace(prev?: TraceTable | null,): TraceReport {
    const tr = new TraceReport(report,);
    if (prev !== undefined && prev !== null) {
      tr.previousTableSource = () => prev;
    } else if (prev === null) {
      tr.previousTableSource = () => null;
    }
    return tr;
  }

  // --------------------------------------------------------------
  // 14.20.2.2 — headers = ['Date', ...]
  // --------------------------------------------------------------
  it("gera cabeçalho com 'Date' mesmo sem colunas configuradas (14.20.2.2)", () => {
    const tr = newTrace();
    tr.generateIntermediateFormat();
    const table = tr.getTable()!;
    assertEquals(table[0], ["Date",],);
    // apenas 1 linha (cabeçalho) + 1 linha da data atual
    assertEquals(table.length, 2,);
    assertEquals((table[1]![0] as TjTime).to_s("%Y-%m-%d",), "2026-01-01",);
  });

  it("expande títulos de colunas 1:1 com as três listas (14.20.2.2)", () => {
    new Account(project, "acc1", "Account One", null,);
    new Resource(project, "res1", "Resource One", null,);
    new Task(project, "tsk1", "Task One", null,);
    // Títulos literais (sem placeholders) para evitar depender do pipeline
    // de query do SimpleQueryExpander, que exige atributos consultáveis.
    report.set("columns", [
      column("name", "ColA",),
      column("name", "ColB",),
      column("name", "ColC",),
    ],);
    // 3 colunas × 1 cenário × (1 conta + 1 recurso + 1 tarefa) = 9 colunas.
    const tr = newTrace();
    tr.generateIntermediateFormat();
    const header = tr.getTable()![0] as string[];
    assertEquals(header[0], "Date", "primeira coluna é Date",);
    assertEquals(header.length, 1 + 9,);
    // Cada título aparece 3× (uma vez por lista de propriedades).
    const counts = new Map<string, number>();
    for (const h of header.slice(1,)) {
      counts.set(h, (counts.get(h,) ?? 0) + 1,);
    }
    assertEquals(counts.get("ColA",), 3,);
    assertEquals(counts.get("ColB",), 3,);
    assertEquals(counts.get("ColC",), 3,);
  });

  // --------------------------------------------------------------
  // 14.20.2.3/14.20.2.4 — tabela anterior + TableColumnSorter
  // --------------------------------------------------------------
  it("reaproveita tabela anterior quando headers são idênticos (14.20.2.3)", () => {
    // Tabela prévia só com 'Date' e uma linha antiga (2025-06-15).
    const old = TjTime.fromString("2025-06-15",).to_s("%Y-%m-%d",);
    const previous: TraceTable = [["Date",], [old, "42",],];
    const tr = newTrace(previous,);
    tr.generateIntermediateFormat();
    const table = tr.getTable()!;
    // Colunas antigas ('42' na posição 1) não estão em headers novos → o
    // sorter move para fim como descontinuada. Como 'Date' casa, fica.
    assertEquals(table[0], ["Date",],);
    // 3 linhas: header + 2025-06-15 antiga + 2026-01-01 atual.
    assertEquals(table.length, 3,);
    // A linha 2025 permanece com o valor '42' na coluna 0? Não — coluna 0 é
    // Date (TjTime). '42' estava em coluna 1 (descontinuada).
    const older = table.find(
      (l,) =>
        l[0] instanceof TjTime &&
        (l[0] as TjTime).to_s("%Y-%m-%d",) === "2025-06-15",
    )!;
    assert(older, "linha antiga preservada",);
    // Coluna descontinuada foi movida para o fim e mantém o '42'.
    assertEquals(older[older.length - 1], "42",);
  });

  it("usa TableColumnSorter quando headers mudam (14.20.2.4)", () => {
    report.set("columns", [column("name", "X",),],);
    const prev: TraceTable = [
      ["Date", "Antigo",],
      ["2025-06-15", "99",],
    ];
    const tr = newTrace(prev,);
    tr.generateIntermediateFormat();
    const table = tr.getTable()!;
    // 'Antigo' não está em novos headers → coluna descontinuada ao fim.
    // Header novo: ['Date', <expansões X>] + ['Antigo' descontinuada].
    assertEquals(table[0]![0], "Date",);
    // 3 linhas: header + 2025-06-15 + 2026-01-01.
    assertEquals(table.length, 3,);
    const older = table[1]!;
    assertEquals(older[older.length - 1], "99", "descontinuada mantém '99'",);
  });

  it("não duplica quando a data atual já existia na tabela anterior (14.20.2.5)", () => {
    const today = TjTime.fromString("2026-01-01",).to_s("%Y-%m-%d",);
    const prev: TraceTable = [["Date",], [today,],];
    const tr = newTrace(prev,);
    tr.generateIntermediateFormat();
    const table = tr.getTable()!;
    assertEquals(table.length, 2, "apenas header + linha única da data atual",);
    assertEquals((table[1]![0] as TjTime).to_s("%Y-%m-%d",), "2026-01-01",);
  });

  it("adiciona linha com a data atual quando não existia (14.20.2.5)", () => {
    const tr = newTrace();
    tr.generateIntermediateFormat();
    const table = tr.getTable()!;
    assertEquals(table.length, 2,);
    assert(table[1]![0] instanceof TjTime, "célula Date é TjTime",);
  });

  // --------------------------------------------------------------
  // 14.20.2.6 — ordenação
  // --------------------------------------------------------------
  it("ordena por data crescente mantendo o cabeçalho no topo (14.20.2.6)", () => {
    const prev: TraceTable = [
      ["Date",],
      ["2026-06-01",],
      ["2025-01-01",],
    ];
    const tr = newTrace(prev,);
    tr.generateIntermediateFormat();
    const table = tr.getTable()!;
    // Header sempre primeiro.
    assertEquals(table[0]![0], "Date",);
    const dates = table.slice(1,).map(
      (l,) => (l[0] as TjTime).to_s("%Y-%m-%d",),
    );
    assertEquals(dates, ["2025-01-01", "2026-01-01", "2026-06-01",],);
  });

  // --------------------------------------------------------------
  // 14.20.2.7 — to_html (ChartPlotter ainda não disponível)
  // --------------------------------------------------------------
  it("to_html retorna array vazio sem blocos RichText (14.20.2.7)", () => {
    const tr = newTrace();
    tr.generateIntermediateFormat();
    const html = tr.to_html();
    assertEquals(html, [], "sem header/footer configurados → array vazio",);
  });

  // --------------------------------------------------------------
  // 14.20.2.8 — to_csv
  // --------------------------------------------------------------
  it("to_csv converte TjTime → 'YYYY-MM-DD' (14.20.2.8)", () => {
    const tr = newTrace();
    tr.generateIntermediateFormat();
    const csv = tr.to_csv();
    assertEquals(csv[0], ["Date",],);
    assertEquals(csv[1]![0], "2026-01-01",);
  });

  it("to_csv converte null/undefined em string vazia (14.20.2.8)", () => {
    // Sem colunas → só a coluna Date, mas testamos o caminho de null via
    // uma tabela anterior que já traz células vazias.
    const prev: TraceTable = [["Date",], ["2025-06-15",],];
    const tr = newTrace(prev,);
    tr.generateIntermediateFormat();
    const csv = tr.to_csv();
    // Todas as células da linha antiga que eram vazias permanecem "" após
    // to_csv (o caminho null→"" em to_csv).
    for (const row of csv) {
      for (const cell of row) {
        assert(cell !== null && cell !== undefined, "sem null no CSV",);
      }
    }
  });

  // --------------------------------------------------------------
  // 14.20.2.9 — registro na fábrica
  // --------------------------------------------------------------
  it("'tracereport' está registrado na fábrica de conteúdo", () => {
    const factory = contentFactories.get("tracereport",);
    assert(factory, "fábrica tracereport presente",);
    const c = factory!(report,) as unknown as TraceReport;
    assert(c instanceof TraceReport,);
  });
});
