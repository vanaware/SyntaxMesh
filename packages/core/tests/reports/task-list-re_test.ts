/**
 * Testes de TaskListRE (Fase 14.14).
 *
 * Cobre o construtor (tabela intermediária + selfcontained/auxdir) e o
 * `generateIntermediateFormat` fiel a `TaskListRE.rb`: preparação da lista de
 * tarefas (filtro + duplicatas), lista de recursos sem filtro, cabeçalho por
 * coluna e geração das linhas da tabela.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.14)
 */

import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import type { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import type { PropertyList, } from "../../src/model/property-list.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { ReportTable, } from "../../src/reports/report-table.ts";
import { ReportTableColumn, } from "../../src/reports/report-table-column.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { TaskListRE, } from "../../src/reports/task-list-re.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { GanttChart, } from "../../src/gantt/gantt-chart.ts";
import {
  contentFactories,
  type ReportContentFactory,
} from "../../src/model/report-content.ts";
import { ReportTableCell, } from "../../src/reports/report-table-cell.ts";
import type { XMLElementLike, } from "../../src/richtext/xml-like.ts";

/** Subclasse que expõe a tabela e os protegidos usados nos testes. */
class TestTaskListRE extends TaskListRE {
  override getTable(): ReportTable | null {
    return this.table;
  }
  cols() {
    return this.columnList();
  }
}

/** Expressão lógica falsa/verdadeira sob medida (evita a máquina de Query). */
function fakeExpr(hide: (property: unknown,) => boolean,): LogicalExpression {
  return {
    eval: (query: { property: unknown },) => hide(query.property,),
    operation: {},
    sourceFileInfo: null,
    query: null,
    to_s: () => "fake",
  } as unknown as LogicalExpression;
}

/** Espião de método: substitui um método da instância e registra chamadas. */
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

const restores: Array<() => void> = [];

describe("TaskListRE (14.14)", () => {
  let project: Project;
  let report: Report;
  let re: TestTaskListRE;

  /** Cria o relatório com colunas/ordenação típicas de taskreport. */
  function setup(columns: TableColumnDefinition[],): void {
    project = createTestProject(2,);
    report = new Report(project, "tl", "tl.html", null,);
    report.typeSpec = ReportType.TaskReport;
    report.set("start", TjTime.fromString("2026-01-01",),);
    report.set("end", TjTime.fromString("2026-12-31",),);
    report.set("scenarios", [0,],);
    if (columns.length > 0) report.set("columns", columns,);
    project.reportContexts.push(new ReportContext(project, report,),);
    re = new TestTaskListRE(report,);
  }

  beforeEach(() => {
    restores.length = 0;
    setup([new TableColumnDefinition("name", "Name",),],);
  },);

  afterEach(() => {
    while (restores.length) restores.pop()!();
  },);

  describe("constructor (14.14.2)", () => {
    it("cria a tabela intermediária com selfcontained falso por padrão", () => {
      const table = re.getTable();
      assert(table instanceof ReportTable, "deve criar ReportTable",);
      assertEquals(table!.selfcontained, false,);
      assertEquals(table!.auxDir, "",);
    });

    it("propaga selfcontained e auxdir do relatório", () => {
      report.set("selfcontained", true,);
      report.set("auxdir", "aux/",);
      const child = new TestTaskListRE(report,);
      assertEquals(child.getTable()!.selfcontained, true,);
      assertEquals(child.getTable()!.auxDir, "aux/",);
    });

    it("registra-se como conteúdo do Report", () => {
      assertEquals(report.content, re,);
    });
  });

  describe("preparo da lista de tarefas (14.14.4)", () => {
    it("usa filterTaskList com resource null e as expressões do relatório", () => {
      const hide = fakeExpr(() => false);
      const rollup = fakeExpr(() => false);
      report.set("hideTask", hide,);
      report.set("rollupTask", rollup,);
      const calls = spy(re, "filterTaskList",);
      re.generateIntermediateFormat();
      assertEquals(calls.length, 1,);
      const [list, resource, aHide, aRollup,] = calls[0] as [
        unknown,
        unknown,
        unknown,
        unknown,
      ];
      assert(list, "recebe a PropertyList de tarefas",);
      assertEquals(resource, null,);
      assertEquals(aHide, hide,);
      assertEquals(aRollup, rollup,);
    });

    it("oculta tarefas casadas por hideTask", () => {
      const t1 = new Task(project, "t1", "T1", null,);
      const t2 = new Task(project, "t2", "T2", null,);
      report.set("hideTask", fakeExpr((p,) => p === t2),);
      re.generateIntermediateFormat();
      const lines = re.getTable()!.getLines();
      assertEquals(lines.length, 1,);
      assertEquals(lines[0]!.property, t1,);
    });

    it("remove filhos de nós enrollados pela rollupTask", () => {
      const parent = new Task(project, "p", "Parent", null,);
      new Task(project, "c", "Child", parent,);
      report.set("rollupTask", fakeExpr(() => true),);
      re.generateIntermediateFormat();
      const lines = re.getTable()!.getLines();
      assertEquals(lines.length, 1, "sobra apenas o pai",);
      assertEquals(lines[0]!.property, parent,);
    });

    it("checkForDuplicates lança para ids duplicados na lista", () => {
      const t1 = new Task(project, "t1", "T1", null,);
      const original = re.filterTaskList.bind(re,);
      // deno-lint-ignore no-explicit-any
      (re as any).filterTaskList = (l: PropertyList<Task>,) => {
        l.append([t1,],); // mesma tarefa duas vezes → id duplicado
        return original(l, null, null, null, null,);
      };
      restores.push(() => {
        // deno-lint-ignore no-explicit-any
        (re as any).filterTaskList = original;
      },);
      assertThrows(
        () => re.generateIntermediateFormat(),
        Error,
        "Duplicate property ID",
      );
    });

    it("gera uma linha de tarefa por cenário reportado", () => {
      const task = new Task(project, "t1", "T1", null,);
      re.generateIntermediateFormat();
      const lines = re.getTable()!.getLines();
      assertEquals(lines.length, 1,);
      assertEquals(lines[0]!.property, task,);
    });
  });

  describe("lista de recursos sem filtro (14.14.5)", () => {
    /** Stub de `hasResourceAllocated` (engine Fase 7) — retorno configurável. */
    function stubAllocation(result: boolean,): void {
      // deno-lint-ignore no-explicit-any
      (Task.prototype as any).hasResourceAllocated = () => result;
      restores.push(() => {
        // deno-lint-ignore no-explicit-any
        delete (Task.prototype as any).hasResourceAllocated;
      },);
    }

    it("não chama filterResourceList no preparo", () => {
      const calls = spy(re, "filterResourceList",);
      new Resource(project, "r1", "R1", null,);
      stubAllocation(false,);
      re.generateIntermediateFormat();
      assertEquals(calls.length, 0, "recurso não é filtrado antes da tabela",);
    });

    it("anexa recursos alocados sob a linha da tarefa", () => {
      const task = new Task(project, "t1", "T1", null,);
      const resource = new Resource(project, "r1", "R1", null,);
      stubAllocation(true,);
      re.generateIntermediateFormat();
      const lines = re.getTable()!.getLines();
      // Tarefa + recurso aninhado (cabeçalho vive nas colunas, não em linhas).
      assertEquals(lines.length, 2,);
      assertEquals(lines[0]!.property, task,);
      assertEquals(lines[1]!.property, resource,);
      assertEquals(
        lines[1]!.scopeLine,
        lines[0],
        "recurso no escopo da tarefa",
      );
    });
  });

  describe("cabeçalho por coluna (14.14.6)", () => {
    it("chama adjustColumnPeriod e generateHeaderCell uma vez por coluna", () => {
      const extra = new TableColumnDefinition("no", "No",);
      setup([new TableColumnDefinition("name", "Name",), extra,],);
      const adj = spy(re, "adjustColumnPeriod",);
      const header = spy(re, "generateHeaderCell",);
      re.generateIntermediateFormat();
      assertEquals(adj.length, 2,);
      assertEquals(header.length, 2,);
      assertEquals(header[1]![0], extra,);
    });

    it("sem colunas não gera cabeçalho", () => {
      setup([],);
      const header = spy(re, "generateHeaderCell",);
      re.generateIntermediateFormat();
      assertEquals(header.length, 0,);
      assertEquals(re.getTable()!.getLines().length, 0,);
    });
  });

  describe("generateTaskList (14.14.7)", () => {
    it("delega a geração das linhas com taskList, resourceList e scope null", () => {
      const calls = spy(re, "generateTaskList",);
      const task = new Task(project, "t1", "T1", null,);
      re.generateIntermediateFormat();
      assertEquals(calls.length, 1,);
      const [taskList, resourceList, scopeLine,] = calls[0] as [
        PropertyList<Task>,
        PropertyList<Resource>,
        unknown,
      ];
      assert(taskList.includes(task,), "taskList contém a tarefa",);
      assert(resourceList, "resourceList é passado",);
      assertEquals(scopeLine, null,);
    });

    it("coluna 'no' produz o número da linha na célula", () => {
      // Coluna calculada determinística (não depende do wiring de Query/Fase 11).
      setup([new TableColumnDefinition("no", "No",),],);
      new Task(project, "t1", "T1", null,);
      re.generateIntermediateFormat();
      const lines = re.getTable()!.getLines();
      const cell = lines[0]!.cells[0] as ReportTableCell;
      assertEquals(cell.text, "1",);
    });
  });

  describe("geração completa (14.14.8/14.14.9)", () => {
    it("generateIntermediateFormat produz tabela com cabeçalho e linhas", () => {
      new Task(project, "t1", "T1", null,);
      new Task(project, "t2", "T2", null,);
      re.generateIntermediateFormat();
      const table = re.getTable()!;
      // Cabeçalho são colunas; linhas = 2 tarefas.
      assertEquals(table!.getLines().length, 2,);
      assertEquals(table!.getColumns().length, 1, "uma coluna de cabeçalho",);
      const html = re.to_html();
      assert(Array.isArray(html,) && html.length === 2, "to_html montado",);
      assert(
        (html[1] as XMLElementLike).toHTML().includes("tj_table_frame",),
      );
    });

    it("coluna chart integra o GanttChart ao taskreport (Fase 15.12)", () => {
      const chart = new TableColumnDefinition("chart", undefined,);
      setup([chart,],);
      // O `now` do chart vem do projeto por herança de atributos. Aqui o
      // relatório é criado à mão (sem `inheritAttributes`), então o valor é
      // definido explicitamente — igual ao que o parse real entrega.
      report.set("now", TjTime.fromString("2026-06-01",),);
      new Task(project, "t1", "T1", null,);
      re.generateIntermediateFormat();
      const table = re.getTable()!;
      const col = table.getColumns()[0] as ReportTableColumn;
      assert(col.cell1.special instanceof GanttChart,);
      assertEquals(col.cell2.hidden, true,);
      assertEquals(table.equiLines, true,);
    });
  });

  describe("registro na fábrica de conteúdo (14.11/14.14)", () => {
    it("taskreport está registrado e o dispatch do Report o instancia", () => {
      // O módulo registra a fábrica como efeito colateral do import.
      const factory = contentFactories.get("taskreport",);
      assert(factory, "fábrica taskreport registrada",);
      // Envolvia a fábrica real para inspecionar o objeto criado.
      const prev = factory!;
      let created: TestTaskListRE | null = null;
      contentFactories.set("taskreport", (report: unknown,) => {
        created = new TestTaskListRE(report as Report,);
        return created;
      },);
      restores.push(() => contentFactories.set("taskreport", prev,));
      new Task(project, "t1", "T1", null,);
      report.generateIntermediateFormat();
      assert(report.content instanceof TaskListRE,);
      const table = created!.getTable();
      assert(table !== null, "tabela intermediária criada pela fábrica",);
      assert(table!.getLines().length > 0, "linhas geradas via dispatch",);
    });
  });
});
