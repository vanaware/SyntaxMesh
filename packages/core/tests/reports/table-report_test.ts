/**
 * Testes de TableReport (Fase 14.12).
 *
 * Cobre os métodos estáticos (metadados de coluna), a montagem de saída
 * (`to_html`/`to_csv`) e os helpers protegidos/privados fiéis a
 * `TableReport.rb`. A subclasse `TestTableReport` expõe os protegidos; os
 * privados são alcançados via cast (padrão dos testes desta fase).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.12)
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Task, } from "../../src/model/task.ts";
import { Account, } from "../../src/model/account.ts";
import { AttributeType, } from "../../src/attributes/attribute-type.ts";
import { Query, } from "../../src/query/query.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { type XMLElementLike, } from "../../src/richtext/xml-like.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { ReportTable, } from "../../src/reports/report-table.ts";
import { ReportTableColumn, } from "../../src/reports/report-table-column.ts";
import { ReportTableLine, } from "../../src/reports/report-table-line.ts";
import { ReportTableCell, } from "../../src/reports/report-table-cell.ts";
import { ColumnTable, } from "../../src/reports/column-table.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { TableReport, } from "../../src/reports/table-report.ts";
import type { TableReportColumn, } from "../../src/reports/table-report-column.ts";
import { GanttChart, } from "../../src/gantt/gantt-chart.ts";

/** Subclasse concreta que expõe os membros protegidos de TableReport. */
class TestTableReport extends TableReport {
  columnInfo(def: TableColumnDefinition,): TableReportColumn | undefined {
    return this.columns.get(def,);
  }
  setTable(t: ReportTable,): void {
    this.table = t;
  }
  override getTable(): ReportTable | null {
    return this.table;
  }
  adj(
    def: TableColumnDefinition,
    tasks: Task[] = [],
    sc: number[] = [],
  ): void {
    this.adjustColumnPeriod(def, tasks, sc,);
  }
  header(def: TableColumnDefinition,): void {
    this.generateHeaderCell(def,);
  }
}

/** Acesso a um método privado de TableReport (cast controlado). */
// deno-lint-ignore no-explicit-any
function priv(tr: TableReport,): any {
  // deno-lint-ignore no-explicit-any
  return tr as any;
}

/** Célula avulsa (sem linha) para testes de helpers. */
function cell(text: string | null = null,): ReportTableCell {
  return new ReportTableCell(null, null, text,);
}

describe("TableReport (14.12)", () => {
  let project: Project;
  let report: Report;
  let tr: TestTableReport;

  beforeEach(() => {
    project = createTestProject(2,);
    report = new Report(project, "r1", "r1.html", null,);
    project.reportContexts.push(new ReportContext(project, report,),);
    tr = new TestTableReport(report,);
  },);

  describe("estrutura", () => {
    it("constructor define conteúdo, legenda e tabela nula", () => {
      assert(report.content, "report.content deve ser definido",);
      assertEquals(tr.getTable(), null,);
      assert(tr.legend, "legend deve ser criado",);
    });
  });

  describe("metadados estáticos", () => {
    it("propertiesById guarda colunas embutidas", () => {
      assert(TableReport.propertiesById.size >= 40,);
      assertEquals(TableReport.propertiesById.get("effort",)?.[0], "Effort",);
    });

    it("defaultColumnTitle: conhecida, especial e desconhecida", () => {
      assertEquals(TableReport.defaultColumnTitle("effort",), "Effort",);
      assertEquals(TableReport.defaultColumnTitle("chart",), "",);
      assertEquals(TableReport.defaultColumnTitle("daily",), "",);
      assertEquals(TableReport.defaultColumnTitle("desconhecida",), null,);
    });

    it("indent respeita id e depois tipo", () => {
      assertEquals(TableReport.indent("name", undefined,), true,);
      assertEquals(TableReport.indent("no", undefined,), false,);
      // Id desconhecido cai no propertiesByType (String → false).
      assertEquals(TableReport.indent("xyz", AttributeType.String,), false,);
    });

    it("alignment respeita id, tipo e centro padrão", () => {
      assertEquals(TableReport.alignment("name", undefined,), "left",);
      assertEquals(TableReport.alignment("no", undefined,), "right",);
      assertEquals(
        TableReport.alignment("xyz", AttributeType.Integer,),
        "right",
      );
      assertEquals(TableReport.alignment("xyz", undefined,), "center",);
    });

    it("calculated e scenarioSpecific", () => {
      assertEquals(TableReport.calculated("effort",), true,);
      assertEquals(TableReport.calculated("algum_atributo",), false,);
      assertEquals(TableReport.scenarioSpecific("effort",), true,);
      assertEquals(TableReport.scenarioSpecific("name",), false,);
    });
  });

  describe("to_html / to_csv", () => {
    it("to_html monta comentário, moldura e legenda", () => {
      tr.setTable(new ReportTable(),);
      const html = tr.to_html();
      assertEquals(html.length, 2,);
      assert(
        (html[0] as XMLElementLike).toHTML().includes("Dynamic Report ID",),
      );
      assertEquals((html[1] as XMLElementLike).attrs.class, "tj_table_frame",);
    });

    it("to_csv retorna [[]] sem tabela", () => {
      assertEquals(tr.to_csv(), [[],],);
    });

    it("to_csv delega à tabela quando presente", () => {
      const table = new ReportTable();
      tr.setTable(table,);
      new ReportTableColumn(table, null, "H",);
      const line = new ReportTableLine(table, null, null,);
      new ReportTableCell(line, null, "valor",);
      const csv = tr.to_csv();
      assertEquals(csv.length, 2,);
      assertEquals(csv[1]?.[0], "valor",);
    });
  });

  describe("adjustColumnPeriod", () => {
    it("guarda datas brutas quando o usuário fixa o período da coluna", () => {
      const def = new TableColumnDefinition("effort", "Effort",);
      def.start = TjTime.fromString("2026-02-01",);
      def.end = TjTime.fromString("2026-02-10",);
      tr.adj(def, [], [],);
      const info = tr.columnInfo(def,)!;
      assertEquals(info.start?.toSeconds(), def.start!.toSeconds(),);
      assertEquals(info.end?.toSeconds(), def.end!.toSeconds(),);
    });

    it("guarda datas brutas quando não há tarefas", () => {
      report.set("start", TjTime.fromString("2026-03-01",),);
      report.set("end", TjTime.fromString("2026-03-20",),);
      const def = new TableColumnDefinition("effort", "Effort",);
      tr.adj(def, [], [],);
      const info = tr.columnInfo(def,)!;
      assertEquals(
        info.start?.toSeconds(),
        (report.get("start",) as TjTime).toSeconds(),
      );
      assertEquals(
        info.end?.toSeconds(),
        (report.get("end",) as TjTime).toSeconds(),
      );
    });

    it("expande o período para coluna de calendário com tarefas", () => {
      const task = new Task(project, "t1", "T1", null,);
      const def = new TableColumnDefinition("daily", undefined,);
      report.force("start", project.get("start",),);
      report.force("end", project.get("end",),);
      report.force("scenarios", [0,],);
      const projStart = project.get("start",) as TjTime;
      const projEnd = project.get("end",) as TjTime;
      tr.adj(def, [task,], [0,],);
      const info = tr.columnInfo(def,)!;
      // Margem de 2 dias em cada ponta (span do projeto >> mínimo diário).
      assertEquals(info.start!.diff(projStart,), -172800,);
      assertEquals(info.end!.diff(projEnd,), 172800,);
    });

    it("respeita doNotAdjustStart em coluna de calendário estreita", () => {
      // Início fixado pelo usuário (coluna) mantém-se; fim é ajustado.
      report.force("end", project.get("end",),);
      const fixedStart = TjTime.fromString("2026-10-01",);
      const def = new TableColumnDefinition("daily", undefined,);
      def.start = fixedStart; // usuário fixou o início → não ajusta
      const task = new Task(project, "t2", "T2", null,);
      report.force("scenarios", [0,],);
      const projEnd = project.get("end",) as TjTime;
      tr.adj(def, [task,], [0,],);
      const info = tr.columnInfo(def,)!;
      assertEquals(info.start!.toSeconds(), fixedStart.toSeconds(),);
      // Fim (livre) é empurrado para frente pela margem.
      assert(info.end!.compareTo(projEnd,) > 0, "end deve crescer",);
    });

    it("lança para escala de gráfico desconhecida", () => {
      const def = new TableColumnDefinition("chart", undefined,);
      def.scale = "sexade";
      const task = new Task(project, "t3", "T3", null,);
      report.force("start", project.get("start",),);
      report.force("end", project.get("end",),);
      assertThrows(
        () => tr.adj(def, [task,], [0,],),
        Error,
        "Unknown scale",
      );
    });
  });

  describe("generateHeaderCell", () => {
    beforeEach(() => {
      tr.setTable(new ReportTable(),);
    },);

    it("coluna padrão: cell1 com 2 linhas, cell2 oculta", () => {
      const def = new TableColumnDefinition("name", "Name",);
      def.start = TjTime.fromString("2026-10-01",);
      def.end = TjTime.fromString("2026-10-10",);
      tr.adj(def, [], [],);
      tr.header(def,);
      const col = def.column as ReportTableColumn;
      assertEquals(col.cell1.rows, 2,);
      assertEquals(col.cell2.hidden, true,);
      assertEquals(col.cell1.text, "Name",);
    });

    it("coluna chart cria um GanttChart no cabeçalho (Fase 15.12)", () => {
      report.force("now", TjTime.fromString("2026-10-05",),);
      const def = new TableColumnDefinition("chart", undefined,);
      def.start = TjTime.fromString("2026-10-01",);
      def.end = TjTime.fromString("2026-10-10",);
      tr.adj(def, [], [],);
      tr.header(def,);
      const col = def.column as ReportTableColumn;
      assert(col.cell1.special instanceof GanttChart,);
      assertEquals(col.cell2.hidden, true,);
      assertEquals(tr.getTable()!.equiLines, true,);
    });

    it("coluna daily embute uma ColumnTable com scrollbar", () => {
      report.set("start", TjTime.fromString("2026-10-05",),);
      report.set("end", TjTime.fromString("2026-10-06",),);
      const def = new TableColumnDefinition("daily", undefined,);
      tr.adj(def, [], [],);
      tr.header(def,);
      const col = def.column as ReportTableColumn;
      const embedded = col.cell1.special as unknown as ColumnTable;
      assert(embedded instanceof ColumnTable, "deve embutir ColumnTable",);
      assertEquals(col.scrollbar, true,);
      // 1 dia de intervalo → 1 coluna interna com day-of-month em cell2.
      const inner = (embedded as unknown as ReportTable).getColumns();
      assertEquals(inner.length, 1,);
      assertEquals(inner[0]!.cell1.columns, 1,);
      assertEquals(inner[0]!.cell2.text, "05",);
    });
  });

  describe("setScenarioSettings", () => {
    it("cenário único não altera a célula", () => {
      report.force("scenarios", [0,],);
      const c = cell("x",);
      assertEquals(priv(tr,).setScenarioSettings(c, 0, false,), true,);
      assertEquals(c.hidden, false,);
    });

    it("primeiro cenário: fonte maior e rowspan", () => {
      report.force("scenarios", [0, 1,],);
      const c = cell("x",);
      assertEquals(priv(tr,).setScenarioSettings(c, 0, false,), true,);
      assertEquals(c.fontSize, 15,);
      assertEquals(c.rows, 2,);
    });

    it("cenários demais: oculta e retorna false", () => {
      report.force("scenarios", [0, 1,],);
      const c = cell("x",);
      assertEquals(priv(tr,).setScenarioSettings(c, 1, false,), false,);
      assertEquals(c.hidden, true,);
    });

    it("atributo específico de cenário não é oculto", () => {
      report.force("scenarios", [0, 1,],);
      const c = cell("x",);
      assertEquals(priv(tr,).setScenarioSettings(c, 1, true,), true,);
      assertEquals(c.hidden, false,);
    });
  });

  describe("newCell", () => {
    it("cria célula ligada à linha", () => {
      const table = new ReportTable();
      const line = new ReportTableLine(
        table,
        new Task(project, "t", "T", null,),
        null,
      );
      const c = priv(tr,).newCell(new Query({ project, },), line,);
      assert(c instanceof ReportTableCell,);
      assertEquals(c.line, line,);
    });

    it("negrito para contêiner em linha bold", () => {
      const table = new ReportTable();
      const root = new Task(project, "root", "Root", null,);
      new Task(project, "root.child", "Child", root,); // torna root contêiner
      const line = new ReportTableLine(table, root, null,);
      line.bold = true;
      const c = priv(tr,).newCell(new Query({ project, },), line,);
      assertEquals(c.bold, true,);
    });

    it("sem negrito para folha", () => {
      const table = new ReportTable();
      const leaf = new Task(project, "leaf", "Leaf", null,);
      const line = new ReportTableLine(table, leaf, null,);
      line.bold = true;
      const c = priv(tr,).newCell(new Query({ project, },), line,);
      assertEquals(c.bold, false,);
    });
  });

  describe("setIndent", () => {
    it("soma o nível em modo árvore e marca bold", () => {
      const table = new ReportTable();
      const root = new Task(project, "root", "Root", null,);
      const child = new Task(project, "root.child", "Child", root,);
      const line = new ReportTableLine(table, child, null,);
      priv(tr,).setIndent(line, root, true,);
      assertEquals(line.indentation, 1,); // level - root.level = 1
      assertEquals(line.bold, true,);
    });

    it("sem tree mode mantém indentação 0", () => {
      const table = new ReportTable();
      const leaf = new Task(project, "leaf", "Leaf", null,);
      const line = new ReportTableLine(table, leaf, null,);
      priv(tr,).setIndent(line, null, false,);
      assertEquals(line.indentation, 0,);
      assertEquals(line.bold, false,);
    });

    it("scopeLine desloca a indentação mínima", () => {
      const table = new ReportTable();
      const scopeTask = new Task(project, "s", "S", null,);
      const scopeLine = new ReportTableLine(table, scopeTask, null,);
      scopeLine.indentation = 2;
      const task = new Task(project, "t", "T", null,);
      const line = new ReportTableLine(table, task, scopeLine,);
      priv(tr,).setIndent(line, null, false,);
      assertEquals(line.indentation, 3,); // scopeLine.indentation + 1
    });
  });

  describe("checkCellText", () => {
    it("preserva texto válido", () => {
      const c = cell("abc",);
      priv(tr,).checkCellText(c,);
      assertEquals(c.text, "abc",);
      assertEquals(c.fontColor, null,);
    });

    it("marca erro em vermelho para texto vazio", () => {
      const c = cell("",);
      priv(tr,).checkCellText(c,);
      assertEquals(c.text, "<Error>",);
      assertEquals(c.fontColor, "#FF0000",);
    });
  });

  describe("tryCellMerging", () => {
    // Fiel a `TableReport.rb`: mescla quando `line.last(1)` (a primeira-célula-
    // do-fim) é a própria célula vazia. Como as células de calendário são
    // sempre anexadas no fim, a célula recém-criada é a última → não mescla.
    it("não mescla célula vazia recém-anexada (last(1) ≠ cell)", () => {
      const table = new ReportTable();
      const line = new ReportTableLine(table, null, null,);
      const c1 = new ReportTableCell(line, null, "X",);
      const c2 = new ReportTableCell(line, null, "",);
      priv(tr,).tryCellMerging(c2, line, c1,);
      assertEquals(c2.hidden, false,);
      assertEquals(c1.columns, 1,);
    });

    it("oculta e amplia quando last(1) é a própria célula vazia", () => {
      const table = new ReportTable();
      const line = new ReportTableLine(table, null, null,);
      const c1 = new ReportTableCell(line, null, "",); // primeira-do-fim
      new ReportTableCell(line, null, "X",); // c2
      new ReportTableCell(line, null, "Y",); // c3 (última)
      // last(1) === cells[len-2] === c2 ("X", visível) ≠ c1 → não mescla.
      priv(tr,).tryCellMerging(c1, line, c1,);
      assertEquals(c1.hidden, false,);
      // Agora uma linha onde a primeira-do-fim é a célula vazia passada.
      const line2 = new ReportTableLine(table, null, null,);
      const d1 = new ReportTableCell(line2, null, "X",);
      const d2 = new ReportTableCell(line2, null, "",); // primeira-do-fim = d1? não
      const d3 = new ReportTableCell(line2, null, "Z",); // última
      // last(1) === cells[len-2] === d2 ("") = célula passada → mescla.
      priv(tr,).tryCellMerging(d2, line2, d1,);
      assertEquals(d2.hidden, true,);
      assertEquals(d2.columns, 2,);
      assertEquals(d3.columns, 1,);
      assertEquals(d1.columns, 1,);
    });

    it("não mescla quando firstCell é nulo", () => {
      const table = new ReportTable();
      const line = new ReportTableLine(table, null, null,);
      const c1 = new ReportTableCell(line, null, "",);
      priv(tr,).tryCellMerging(c1, line, null,);
      assertEquals(c1.hidden, false,);
    });
  });

  describe("setAccountCellBgColor", () => {
    const q = (over: Record<string, unknown>,): Query =>
      Object.assign(new Query({ project, },), over,);

    it("prefixo cost para conta de custo", () => {
      const cost = new Account(project, "cost", "Cost", null,);
      const child = new Account(project, "cost.child", "Child", cost,);
      const table = new ReportTable();
      const line = new ReportTableLine(table, child, null,);
      line.subLineNo = 1;
      const c = cell("x",);
      priv(tr,).setAccountCellBgColor(
        q({ property: child, costAccount: cost, revenueAccount: null, },),
        line,
        c,
      );
      assertEquals(c.category, "costaccountcell1",);
    });

    it("prefixo revenue para conta de receita", () => {
      const rev = new Account(project, "rev", "Rev", null,);
      const table = new ReportTable();
      const line = new ReportTableLine(table, rev, null,);
      line.subLineNo = 2;
      const c = cell("x",);
      priv(tr,).setAccountCellBgColor(
        q({ property: rev, costAccount: null, revenueAccount: rev, },),
        line,
        c,
      );
      assertEquals(c.category, "revenueaccountcell2",);
    });

    it("sem prefixo quando nada casa", () => {
      const acc = new Account(project, "a", "A", null,);
      const table = new ReportTable();
      const line = new ReportTableLine(table, acc, null,);
      line.subLineNo = 1;
      const c = cell("x",);
      priv(tr,).setAccountCellBgColor(
        q({ property: acc, costAccount: null, revenueAccount: null, },),
        line,
        c,
      );
      assertEquals(c.category, "accountcell1",);
    });
  });

  describe("setStandardCellAttributes", () => {
    it("indentação, alinhamento e categoria de tarefa", () => {
      const table = new ReportTable();
      const task = new Task(project, "t", "T", null,);
      const line = new ReportTableLine(table, task, null,);
      line.indentation = 3;
      line.subLineNo = 1;
      const c = cell("x",);
      const def = new TableColumnDefinition("name", "Name",);
      priv(tr,).setStandardCellAttributes(
        new Query({ project, },),
        c,
        def,
        AttributeType.String,
        line,
      );
      assertEquals(c.indent, 3,);
      assertEquals(c.alignment, "left",);
      assertEquals(c.category, "taskcell1",);
    });

    it("largura da coluna é propagada", () => {
      const table = new ReportTable();
      const task = new Task(project, "t", "T", null,);
      const line = new ReportTableLine(table, task, null,);
      line.subLineNo = 2;
      const c = cell("x",);
      const def = new TableColumnDefinition("no", "No.",);
      def.width = 40;
      priv(tr,).setStandardCellAttributes(
        new Query({ project, },),
        c,
        def,
        undefined,
        line,
      );
      assertEquals(c.width, 40,);
      assertEquals(c.category, "taskcell2",);
    });
  });
});
