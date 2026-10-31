/**
 * Testes de ResourceListRE (Fase 14.15).
 *
 * Cobre o construtor, o filtro da lista de recursos, a lista de tarefas sem
 * filtro, a união `assignedTaskList` (via `filterTaskList` por recurso), o
 * cabeçalho por coluna e a geração das linhas por `generateResourceList`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.15)
 */

import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import type { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { ReportTable, } from "../../src/reports/report-table.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { ResourceListRE, } from "../../src/reports/resource-list-re.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { contentFactories, } from "../../src/model/report-content.ts";

/** Subclasse que expõe a tabela usada nas asserções. */
class TestResourceListRE extends ResourceListRE {
  override getTable(): ReportTable | null {
    return this.table;
  }
}

/** Expressão lógica sob medida (evita a máquina de avaliação de Query). */
function fakeExpr(test: (property: unknown,) => boolean,): LogicalExpression {
  return {
    eval: (query: { property: unknown },) => test(query.property,),
  } as unknown as LogicalExpression;
}

const restores: Array<() => void> = [];

/** Espião de método na instância; registra argumentos de cada chamada. */
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

/** Mapeamento `tarefa#recurso` → alocado (stub de hasResourceAllocated). */
function stubAllocation(allocated: string[],): void {
  // deno-lint-ignore no-explicit-any
  (Task.prototype as any).hasResourceAllocated = function (
    this: Task,
    _scIdx: number,
    _iv: unknown,
    res: Resource,
  ) {
    return allocated.includes(`${this.id}#${res.id}`,);
  };
  restores.push(() => {
    // deno-lint-ignore no-explicit-any
    delete (Task.prototype as any).hasResourceAllocated;
  },);
}

describe("ResourceListRE (14.15)", () => {
  let project: Project;
  let report: Report;
  let re: TestResourceListRE;

  function setup(columns: TableColumnDefinition[],): void {
    project = createTestProject(2,);
    report = new Report(project, "rl", "rl.html", null,);
    report.typeSpec = ReportType.ResourceReport;
    report.set("start", TjTime.fromString("2026-01-01",),);
    report.set("end", TjTime.fromString("2026-12-31",),);
    report.set("scenarios", [0,],);
    if (columns.length > 0) report.set("columns", columns,);
    project.reportContexts.push(new ReportContext(project, report,),);
    re = new TestResourceListRE(report,);
  }

  beforeEach(() => {
    restores.length = 0;
    setup([new TableColumnDefinition("no", "No",),],);
  },);

  afterEach(() => {
    while (restores.length) restores.pop()!();
  },);

  describe("constructor (14.15.2)", () => {
    it("cria a ReportTable intermediária", () => {
      const table = re.getTable();
      assert(table instanceof ReportTable,);
      assertEquals(table!.selfcontained, false,);
      assertEquals(table!.auxDir, "",);
    });

    it("propaga selfcontained/auxdir e registra-se como conteúdo", () => {
      report.set("selfcontained", true,);
      report.set("auxdir", "aux/",);
      const child = new TestResourceListRE(report,);
      assertEquals(child.getTable()!.selfcontained, true,);
      assertEquals(child.getTable()!.auxDir, "aux/",);
      assertEquals(report.content, child,);
    });
  });

  describe("resourceList filtrado (14.15.3)", () => {
    it("chama filterResourceList com resource null e as expressões", () => {
      const hide = fakeExpr(() => false);
      const rollup = fakeExpr(() => false);
      report.set("hideResource", hide,);
      report.set("rollupResource", rollup,);
      const calls = spy(re, "filterResourceList",);
      re.generateIntermediateFormat();
      assertEquals(calls.length, 1,);
      const [, resource, aHide, aRollup,] = calls[0] as [
        unknown,
        unknown,
        unknown,
        unknown,
      ];
      assertEquals(resource, null,);
      assertEquals(aHide, hide,);
      assertEquals(aRollup, rollup,);
    });

    it("oculta recursos casados por hideResource", () => {
      const r1 = new Resource(project, "r1", "R1", null,);
      const r2 = new Resource(project, "r2", "R2", null,);
      report.set("hideResource", fakeExpr((p,) => p === r2),);
      re.generateIntermediateFormat();
      const lines = re.getTable()!.getLines();
      assertEquals(lines.length, 1,);
      assertEquals(lines[0]!.property, r1,);
      assert(r2,);
    });
  });

  describe("taskList sem filtro (14.15.4)", () => {
    it("filterTaskList só é chamado por recurso (nunca com resource null)", () => {
      const calls = spy(re, "filterTaskList",);
      new Resource(project, "r1", "R1", null,);
      new Resource(project, "r2", "R2", null,);
      new Task(project, "t1", "T1", null,);
      stubAllocation([],);
      re.generateIntermediateFormat();
      // Uma chamada por recurso na união + uma por linha de recurso em
      // generateResourceList; nenhuma com resource null.
      assert(
        calls.length >= 2,
        `esperadas chamadas por recurso: ${calls.length}`,
      );
      for (const args of calls) {
        assert(args[1] !== null, "filterTaskList sempre com recurso",);
      }
    });

    it("tasks não alocadas não geram linhas aninhadas", () => {
      new Resource(project, "r1", "R1", null,);
      new Task(project, "t1", "T1", null,);
      stubAllocation([],);
      re.generateIntermediateFormat();
      const lines = re.getTable()!.getLines();
      assertEquals(lines.length, 1, "apenas a linha do recurso",);
    });
  });

  describe("assignedTaskList (14.15.5/14.15.9)", () => {
    it("une as tarefas alocadas de todos os recursos, sem duplicatas", () => {
      new Resource(project, "r1", "R1", null,);
      new Resource(project, "r2", "R2", null,);
      const t1 = new Task(project, "t1", "T1", null,);
      const t2 = new Task(project, "t2", "T2", null,);
      new Task(project, "t3", "T3", null,); // nunca alocada
      stubAllocation(["t1#r1", "t1#r2", "t2#r2",],);
      const adj = spy(re, "adjustColumnPeriod",);
      re.generateIntermediateFormat();
      const tasks = adj[0]![1] as Task[];
      assertEquals(tasks.length, 2, "t1 + t2 (uniq)",);
      assert(tasks.includes(t1,),);
      assert(tasks.includes(t2,),);
    });

    it("passa a assignedTaskList a adjustColumnPeriod e o scenarioList", () => {
      new Resource(project, "r1", "R1", null,);
      const t1 = new Task(project, "t1", "T1", null,);
      stubAllocation(["t1#r1",],);
      const adj = spy(re, "adjustColumnPeriod",);
      re.generateIntermediateFormat();
      assertEquals(adj.length, 1, "uma chamada por coluna",);
      assertEquals(adj[0]![1], [t1,],);
      assertEquals(adj[0]![2], [0,],);
    });

    it("recurso com tarefas alocadas gera linhas aninhadas", () => {
      const resource = new Resource(project, "r1", "R1", null,);
      const task = new Task(project, "t1", "T1", null,);
      stubAllocation(["t1#r1",],);
      re.generateIntermediateFormat();
      const lines = re.getTable()!.getLines();
      // Linha do recurso + linha da tarefa aninhada.
      assertEquals(lines.length, 2,);
      assertEquals(lines[0]!.property, resource,);
      assertEquals(lines[1]!.property, task,);
      assertEquals(lines[1]!.scopeLine, lines[0],);
    });

    it("lista vazia não produz linhas", () => {
      re.generateIntermediateFormat();
      assertEquals(re.getTable()!.getLines().length, 0,);
    });
  });

  describe("cabeçalho por coluna (14.15.6)", () => {
    it("gera um cabeçalho de coluna por definição", () => {
      new Resource(project, "r1", "R1", null,);
      stubAllocation([],);
      re.generateIntermediateFormat();
      // Coluna 'no' → uma ReportTableColumn de cabeçalho.
      assertEquals(re.getTable()!.getColumns().length, 1,);
    });

    it("sem colunas não gera colunas de cabeçalho", () => {
      setup([],);
      re.generateIntermediateFormat();
      assertEquals(re.getTable()!.getColumns().length, 0,);
    });
  });

  describe("generateResourceList (14.15.7)", () => {
    it("delega com resourceList filtrada, taskList e scope null", () => {
      const calls = spy(re, "generateResourceList",);
      const r1 = new Resource(project, "r1", "R1", null,);
      new Task(project, "t1", "T1", null,);
      stubAllocation([],);
      re.generateIntermediateFormat();
      assertEquals(calls.length, 1,);
      const [resourceList, taskList, scopeLine,] = calls[0] as [
        { includes: (r: Resource,) => boolean },
        unknown,
        unknown,
      ];
      assert(resourceList.includes(r1,), "resourceList contém o recurso",);
      assert(taskList, "taskList sem filtro é passado",);
      assertEquals(scopeLine, null,);
    });
  });

  describe("geração básica e fábrica (14.15.8)", () => {
    it("generateIntermediateFormat produz linhas e to_html funciona", () => {
      new Resource(project, "r1", "R1", null,);
      re.generateIntermediateFormat();
      assertEquals(re.getTable()!.getLines().length, 1,);
      assertEquals(re.to_html().length, 2,);
    });

    it("resourcereport está registrado na fábrica de conteúdo", () => {
      assert(contentFactories.get("resourcereport",), "fábrica registrada",);
    });
  });
});
