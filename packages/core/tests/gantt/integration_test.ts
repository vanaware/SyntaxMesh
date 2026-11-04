/**
 * Testes de integração Gantt ↔ TableReport (Fase 15.12).
 *
 * Exercita o pipeline real de uma coluna `chart`:
 * `TaskListRE`/`ResourceListRE` → `generateHeaderCell` (cria o `GanttChart`) →
 * `generateTableCell` (cria as `GanttLine`s) → `ReportTable.to_html` (coluna
 * renderizada pelo `GanttChart.to_html`).
 *
 * Fonte: `docs/taskjuggler/lib/taskjuggler/reports/TableReport.rb:335-357` e
 * `:645-659`.
 *
 * @see docs/syntaxmesh/fases/fase-15-gantt-tarefas.md (15.12)
 */
import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import type { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { ReportTable, } from "../../src/reports/report-table.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { TaskListRE, } from "../../src/reports/task-list-re.ts";
import { ResourceListRE, } from "../../src/reports/resource-list-re.ts";
import type { ReportTableColumn, } from "../../src/reports/report-table-column.ts";
import { ReportTableCell, } from "../../src/reports/report-table-cell.ts";
import { GanttChart, } from "../../src/gantt/gantt-chart.ts";
import type { GanttLine, } from "../../src/gantt/gantt-line.ts";

const D = (s: string,): TjTime => TjTime.fromString(s,);

/** Subclasse que expõe a tabela intermediária. */
class TestTaskListRE extends TaskListRE {
  override getTable(): ReportTable | null {
    return this.table;
  }
}

/** Idem para `ResourceListRE`. */
class TestResourceListRE extends ResourceListRE {
  override getTable(): ReportTable | null {
    return this.table;
  }
}

/** Coluna `chart` com a escala pedida. */
function chartColumn(
  scale = "day",
  width: number | null = null,
): TableColumnDefinition {
  const def = new TableColumnDefinition("chart", undefined,);
  def.scale = scale;
  def.width = width;
  return def;
}

/** Expressão lógica constante (evita a máquina de `Query`). */
function constExpr(value: boolean,): LogicalExpression {
  return {
    eval: () => value,
    operation: {},
    sourceFileInfo: null,
    query: null,
    to_s: () => "const",
  } as unknown as LogicalExpression;
}

/** Chart que o cabeçalho criou para a coluna `def`. */
function chartOf(def: TableColumnDefinition,): GanttChart {
  return (def.column as ReportTableColumn).cell1.special as GanttChart;
}

/** Linhas registradas no chart (campo privado no port). */
function linesOf(chart: GanttChart,): GanttLine[] {
  return (chart as unknown as { lines: GanttLine[] }).lines;
}

/** HTML serializado da tabela intermediária. */
function htmlOf(table: ReportTable,): string {
  return table.to_html().toHTML();
}

const restores: Array<() => void> = [];

/** Espião de método na instância; restaurado no `afterEach`. */
// deno-lint-ignore no-explicit-any
function spy(obj: any, method: string,): Array<unknown[]> {
  const calls: Array<unknown[]> = [];
  const original = obj[method];
  obj[method] = (...args: unknown[]) => {
    calls.push(args,);
    return original.apply(obj, args,);
  };
  restores.push(() => {
    obj[method] = original;
  },);
  return calls;
}

describe("Integração Gantt ↔ TableReport (15.12)", () => {
  let project: Project;
  let report: Report;

  /** Projeto de 28 dias em janeiro de 2027 (período do chart). */
  function setupProject(): void {
    project = createTestProject();
    project.set("start", D("2027-01-01",),);
    project.set("end", D("2027-01-29",),);
    project.set("now", D("2027-01-04",),);
  }

  /** Relatório de tarefas/recursos com as colunas pedidas. */
  function setupReport(
    type: ReportType,
    columns: TableColumnDefinition[],
  ): void {
    report = new Report(project, "rep", "rep.html", null,);
    report.typeSpec = type;
    report.set("start", D("2027-01-01",),);
    report.set("end", D("2027-01-29",),);
    report.set("now", D("2027-01-04",),);
    report.set("weekStartsMonday", true,);
    report.set("scenarios", [0,],);
    report.set("columns", columns,);
    project.reportContexts.push(new ReportContext(project, report,),);
  }

  /** Tarefa folha com início/fim explícitos. */
  function task(
    id: string,
    start: string,
    end: string,
    parent: Task | null = null,
  ): Task {
    const t = new Task(project, id, id, parent,);
    t.setForScenario("start", D(start,), 0,);
    t.setForScenario("end", D(end,), 0,);
    return t;
  }

  beforeEach(() => {
    restores.length = 0;
    TjTime.setTimeZone("UTC",);
    setupProject();
  },);

  afterEach(() => {
    while (restores.length) restores.pop()!();
  },);

  describe("generateHeaderCell (15.12.1)", () => {
    function header(cols: TableColumnDefinition[],): TestTaskListRE {
      setupReport(ReportType.TaskReport, cols,);
      const re = new TestTaskListRE(report,);
      re.generateIntermediateFormat();
      return re;
    }

    it("cria o GanttChart na célula especial do cabeçalho", () => {
      const def = chartColumn();
      const re = header([new TableColumnDefinition("name", "Name",), def,],);
      const col = def.column as ReportTableColumn;
      assert(col.cell1.special instanceof GanttChart,);
      assertEquals(col.cell2.hidden, true,);
      assertEquals(re.getTable()!.equiLines, true,);
    });

    it("altura do header = headerLineHeight * 2 + 1 (39)", () => {
      const def = chartColumn();
      header([def,],);
      assertEquals(chartOf(def,).header!.height, 39,);
    });

    it("viewWidth default 450 e sem scrollbar em período curto", () => {
      setupReport(ReportType.TaskReport, [chartColumn(),],);
      // Encolhe o período: 5 dias × 20px = 100px < 450 → sem scrollbar.
      report.force("start", D("2027-01-04",),);
      report.force("end", D("2027-01-09",),);
      new TestTaskListRE(report,).generateIntermediateFormat();
      const chart = chartOf(
        (report.get("columns",) as TableColumnDefinition[])[0]!,
      );
      assertEquals(chart.viewWidth, 450,);
      assertEquals(chart.width, 100,);
      assertEquals(chart.hasScrollbar(), false,);
    });

    it("width da coluna menor que o chart liga a scrollbar", () => {
      const def = chartColumn("day", 60,);
      header([def,],);
      const chart = chartOf(def,);
      assertEquals(chart.viewWidth, 60,);
      assertEquals(chart.hasScrollbar(), true,);
      assertEquals((def.column as ReportTableColumn).scrollbar, true,);
    });

    it("escala da coluna decide o passo (week → 4 × 20px)", () => {
      const def = chartColumn("week",);
      header([def,],);
      assertEquals(chartOf(def,).scale!.name, "week",);
      assertEquals(chartOf(def,).width, 80,);
    });
  });

  describe("generateTableCell (15.12.2)", () => {
    it("cria uma célula oculta por linha", () => {
      const def = chartColumn();
      setupReport(ReportType.TaskReport, [def,],);
      task("t1", "2027-01-04", "2027-01-08",);
      const re = new TestTaskListRE(report,);
      re.generateIntermediateFormat();
      const line = re.getTable()!.getLines()[0]!;
      const cell = line.cells[0] as ReportTableCell;
      assertEquals(cell.hidden, true,);
      assertEquals(cell.text, "",);
    });

    it("registra uma GanttLine por linha e devolve true", () => {
      const def = chartColumn();
      setupReport(ReportType.TaskReport, [def,],);
      task("t1", "2027-01-04", "2027-01-08",);
      task("t2", "2027-01-11", "2027-01-15",);
      const re = new TestTaskListRE(report,);
      const calls = spy(re, "generateTableCell",);
      re.generateIntermediateFormat();
      assertEquals(calls.length, 2,);
      assertEquals(calls.map((c,) => c.length > 0 && c[1] === def), [
        true,
        true,
      ],);
      assertEquals(linesOf(chartOf(def,),).length, 2,);
    });

    it("y = (subLineNo - 1) * (height + 1) + header + 1", () => {
      const def = chartColumn();
      setupReport(ReportType.TaskReport, [def,],);
      task("t1", "2027-01-04", "2027-01-08",);
      task("t2", "2027-01-11", "2027-01-15",);
      const re = new TestTaskListRE(report,);
      re.generateIntermediateFormat();
      const [first, second,] = linesOf(chartOf(def,),);
      assert(first && second,);
      // Primeira linha: y = 0 + 39 + 1 = 40; segunda: 22 + 40 = 62.
      assertEquals(first.y, 40,);
      assertEquals(second.y, 62,);
    });

    it("a chart marca a linha primária da tarefa (addTask)", () => {
      const def = chartColumn();
      setupReport(ReportType.TaskReport, [def,],);
      const t1 = task("t1", "2027-01-04", "2027-01-08",);
      const re = new TestTaskListRE(report,);
      re.generateIntermediateFormat();
      const tasks = (chartOf(def,) as unknown as {
        tasks: Map<unknown, GanttLine[]>;
      }).tasks;
      assertEquals(tasks.get(t1,)?.length, 1,);
    });
  });

  describe("renderização (15.12.6–15.12.9)", () => {
    function taskTableHtml(
      cols: TableColumnDefinition[],
      build: () => void,
    ): string {
      setupReport(ReportType.TaskReport, cols,);
      build();
      const re = new TestTaskListRE(report,);
      re.generateIntermediateFormat();
      return htmlOf(re.getTable()!,);
    }

    it("tarefa com barra: taskbar dentro de taskbarframe", () => {
      const html = taskTableHtml([chartColumn(),], () => {
        task("t1", "2027-01-04", "2027-01-08",);
      },);
      assert(html.includes("taskbarframe",),);
      assert(html.includes('class="taskbar"',),);
    });

    it("cadeia de dependências gera seta (tj_arrow_head)", () => {
      const html = taskTableHtml([chartColumn(),], () => {
        const t1 = task("t1", "2027-01-04", "2027-01-08",);
        const t2 = task("t2", "2027-01-11", "2027-01-15",);
        t1.scenarioData(0,).startsuccs = () => [[t2, false,],];
      },);
      assert(html.includes("tj_arrow_head",),);
      assert(html.includes("depline",),);
    });

    it("milestone vira losango (tj_diamond_top)", () => {
      const html = taskTableHtml([chartColumn(),], () => {
        const t1 = task("t1", "2027-01-04", "2027-01-04",);
        t1.setForScenario("milestone", true, 0,);
      },);
      assert(html.includes("tj_diamond_top",),);
      assertEquals(html.includes("taskbarframe",), false,);
    });

    it("container não-rollup: containerbar + jags", () => {
      const html = taskTableHtml([chartColumn(),], () => {
        const t1 = task("t1", "2027-01-04", "2027-01-15",);
        task("t1.1", "2027-01-04", "2027-01-08", t1,);
      },);
      assert(html.includes("containerbar",),);
      assert(html.includes("tj_gantt_jag",),);
    });

    it("container marcado como rollupTask não desenha containerbar", () => {
      setupReport(ReportType.TaskReport, [chartColumn(),],);
      report.force("rollupTask", constExpr(true,),);
      const t1 = task("t1", "2027-01-04", "2027-01-15",);
      task("t1.1", "2027-01-04", "2027-01-08", t1,);
      const re = new TestTaskListRE(report,);
      re.generateIntermediateFormat();
      const html = htmlOf(re.getTable()!,);
      assertEquals(html.includes("containerbar",), false,);
    });
  });

  describe("recursos (15.12.10–15.12.12)", () => {
    /** Relatório de recursos com período curto (6 datas → 5 stacks). */
    function resourceTableHtml(
      cols: TableColumnDefinition[],
      build: () => void,
    ): string {
      setupReport(ReportType.ResourceReport, cols,);
      report.force("start", D("2027-01-04",),);
      report.force("end", D("2027-01-09",),);
      build();
      const re = new TestResourceListRE(report,);
      re.generateIntermediateFormat();
      return htmlOf(re.getTable()!,);
    }

    it("resourcereport com chart desenha load stacks", () => {
      const html = resourceTableHtml([chartColumn(),], () => {
        new Resource(project, "r1", "R1", null,);
      },);
      // Sem alocação todas as pilhas ficam vazias: só a moldura aparece.
      assert(html.includes("loadstackframe",), html.slice(0, 1200,),);
    });

    it("um stack por par de datas do cabeçalho", () => {
      const def = chartColumn();
      resourceTableHtml([def,], () => {
        new Resource(project, "r1", "R1", null,);
      },);
      const lines = linesOf(chartOf(def,),);
      assertEquals(lines.length, 1,);
      const content = (lines[0] as unknown as { content: unknown[] }).content;
      // 6 `cellStartDates` (2027-01-04 … 2027-01-09) → 5 intervalos.
      assertEquals(content.length, 5,);
    });
  });
});
