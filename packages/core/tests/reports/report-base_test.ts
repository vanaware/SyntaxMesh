/**
 * Testes de ReportBase (Fase 14.3).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.3)
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { type Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Account, } from "../../src/model/account.ts";
import { PropertyList, } from "../../src/model/property-list.ts";
import { type PropertyTreeNode, } from "../../src/model/property-tree-node.ts";
import { type Query, } from "../../src/query/query.ts";
import { type LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { type RichTextIntermediate, } from "../../src/richtext/rich-text-intermediate.ts";
import { XMLElement, } from "../../src/xml/xml-element.ts";
import type { XMLElementLike, } from "../../src/xml/xml-element-like.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { type OpenNodes, ReportBase, } from "../../src/reports/report-base.ts";

/** Subclasse concreta para exercitar a base abstrata + expor protegidos. */
class TestReport extends ReportBase {
  frame(): XMLElementLike {
    return this.generateHtmlTableFrame();
  }
  row(cell: XMLElementLike,): XMLElementLike {
    return this.generateHtmlTableRow(cell,);
  }
  rt(name: string,): XMLElementLike | null {
    return this.rt_to_html(name,);
  }
  standard<T extends PropertyTreeNode,>(
    list: PropertyList<T>,
    hideExpr: LogicalExpression | null,
    rollupExpr: LogicalExpression | null,
    openNodes: OpenNodes | null,
    scopeProperty: PropertyTreeNode | null,
    root: PropertyTreeNode | null,
  ): PropertyList<T> {
    return this.standardFilterOps(
      list,
      hideExpr,
      rollupExpr,
      openNodes,
      scopeProperty,
      root,
    );
  }
}

/** Fake de RichText que registra o Query propagado. */
function fakeRichText(calls: Query[],): RichTextIntermediate {
  return {
    sectionNumbers: true,
    setQuery(q: Query,) {
      calls.push(q,);
    },
    to_html() {
      return new XMLElement("span",);
    },
  } as unknown as RichTextIntermediate;
}

/** Fake de LogicalExpression oculta/rollup por identidade de nó. */
function fakeExpr(test: (q: Query,) => boolean,): LogicalExpression {
  return { eval: test, } as unknown as LogicalExpression;
}

describe("ReportBase (14.3)", () => {
  let project: Project;
  let report: Report;

  beforeEach(() => {
    project = createTestProject(2,);
    report = new Report(project, "r1", "r1.html", null,);
    project.reportContexts.push(new ReportContext(project, report,),);
  },);

  describe("estrutura + helpers", () => {
    it("constructor associa report e project", () => {
      const rb = new TestReport(report,);
      assertEquals(rb.report, report,);
      assertEquals(rb.project, project,);
    });

    it("a() lê atributo do report", () => {
      report.set("loadUnit", "day",);
      const rb = new TestReport(report,);
      assertEquals(rb.a("loadUnit",), "day",);
    });

    it("a() retorna null para atributo ausente", () => {
      const rb = new TestReport(report,);
      assertEquals(rb.a("header",), null,);
    });
  });

  describe("generateIntermediateFormat", () => {
    it("propaga query a todos os blocos presentes", () => {
      const calls: Query[] = [];
      const names = [
        "header",
        "left",
        "center",
        "right",
        "footer",
        "prolog",
        "headline",
        "caption",
        "epilog",
      ];
      for (const name of names) report.set(name, fakeRichText(calls,),);
      const rb = new TestReport(report,);
      rb.generateIntermediateFormat();
      assertEquals(calls.length, 9,);
      assertEquals(calls[0], project.reportContexts.at(-1,)?.query,);
    });

    it("ignora blocos ausentes", () => {
      const calls: Query[] = [];
      report.set("header", fakeRichText(calls,),);
      const rb = new TestReport(report,);
      rb.generateIntermediateFormat();
      assertEquals(calls.length, 1,);
    });
  });

  describe("filterAccountList", () => {
    it("mantém apenas descendentes de accountroot", () => {
      const root = new Account(project, "root", "Root", null,);
      const child = new Account(project, "root.child", "Child", root,);
      const outside = new Account(project, "outside", "Out", null,);
      report.force("accountroot", root,);
      const rb = new TestReport(report,);
      const list = new PropertyList<Account>(project.accounts,);
      const res = rb.filterAccountList(list, null, null, null,);
      const ids = res.toArray().map((a,) => a.name);
      assert(ids.includes("Child",), "child deve permanecer",);
      assert(!ids.includes("Out",), "outside deve sair",);
      assert(!ids.includes("Root",), "root não é descendente de si",);
    });

    it("aplica hideExpr", () => {
      const a1 = new Account(project, "a1", "A1", null,);
      const a2 = new Account(project, "a2", "A2", null,);
      const rb = new TestReport(report,);
      const list = new PropertyList<Account>(project.accounts,);
      const hide = fakeExpr((q,) => q.property === a2);
      const res = rb.filterAccountList(list, hide, null, null,);
      assertEquals(res.toArray().length, 1,);
      assertEquals(res.toArray()[0], a1,);
    });

    it("lista vazia permanece vazia", () => {
      const rb = new TestReport(report,);
      const list = new PropertyList<Account>(project.accounts,);
      list.clear();
      const res = rb.filterAccountList(list, null, null, null,);
      assertEquals(res.length(), 0,);
    });
  });

  describe("filterTaskList", () => {
    it("mantém apenas descendentes de taskroot", () => {
      const root = new Task(project, "root", "Root", null,);
      const child = new Task(project, "root.child", "Child", root,);
      const other = new Task(project, "other", "Other", null,);
      report.force("taskroot", root,);
      const rb = new TestReport(report,);
      const list = new PropertyList<Task>(project.tasks,);
      const res = rb.filterTaskList(list, null, null, null, null,);
      const names = res.toArray().map((t,) => t.name);
      assert(names.includes("Child",),);
      assert(!names.includes("Other",),);
    });

    it("aplica hideExpr", () => {
      const t1 = new Task(project, "t1", "T1", null,);
      const t2 = new Task(project, "t2", "T2", null,);
      const rb = new TestReport(report,);
      const list = new PropertyList<Task>(project.tasks,);
      const res = rb.filterTaskList(
        list,
        null,
        fakeExpr((q,) => q.property === t2),
        null,
        null,
      );
      assertEquals(res.toArray().length, 1,);
      assertEquals(res.toArray()[0], t1,);
    });

    it("filtra por resource alocado", () => {
      const task = new Task(project, "task", "Task", null,);
      const plain = new Task(project, "plain", "Plain", null,);
      const res = new Resource(project, "r", "R", null,);
      report.force("scenarios", [0,],);
      report.set("start", TjTime.fromString("2026-01-01",),);
      report.set("end", TjTime.fromString("2026-06-30",),);
      // Somente `task` responde ao recurso.
      (task as unknown as {
        hasResourceAllocated(
          s: number,
          iv: TimeInterval,
          r: Resource,
        ): boolean;
      }).hasResourceAllocated = (_s, _iv, r,) => r === res;
      (plain as unknown as {
        hasResourceAllocated(
          s: number,
          iv: TimeInterval,
          r: Resource,
        ): boolean;
      }).hasResourceAllocated = () => false;
      const rb = new TestReport(report,);
      const list = new PropertyList<Task>(project.tasks,);
      const out = rb.filterTaskList(list, res, null, null, null,);
      const names = out.toArray().map((t,) => t.name);
      assert(names.includes("Task",), "alocado fica",);
      assert(!names.includes("Plain",), "não-alocado sai",);
    });

    it("usa Task real nativo: sem booking, nada fica alocado (14.23)", () => {
      // Desde a integração do engine (14.23) `Task` implementa
      // `hasResourceAllocated` — o guard de `NotYetImplementedError` do
      // ReportBase só dispara em objetos-task sem o método (ramo defensivo).
      const task = new Task(project, "task", "Task", null,);
      const res = new Resource(project, "r", "R", null,);
      report.force("scenarios", [0,],);
      report.set("start", TjTime.fromString("2026-01-01",),);
      report.set("end", TjTime.fromString("2026-06-30",),);
      const rb = new TestReport(report,);
      const list = new PropertyList<Task>(project.tasks,);
      const out = rb.filterTaskList(list, res, null, null, null,);
      assertEquals(out.toArray().length, 0, "sem alocação → lista vazia",);
    });
  });

  describe("filterResourceList", () => {
    it("mantém apenas descendentes de resourceroot", () => {
      const root = new Resource(project, "root", "Root", null,);
      const child = new Resource(project, "root.child", "Child", root,);
      const other = new Resource(project, "other", "Other", null,);
      report.force("resourceroot", root,);
      const rb = new TestReport(report,);
      const list = new PropertyList<Resource>(project.resources,);
      const res = rb.filterResourceList(list, null, null, null, null,);
      const names = res.toArray().map((r,) => r.name);
      assert(names.includes("Child",),);
      assert(!names.includes("Other",),);
    });

    it("filtra por task que possui o recurso", () => {
      const task = new Task(project, "task", "Task", null,);
      const alloc = new Resource(project, "alloc", "Alloc", null,);
      const idle = new Resource(project, "idle", "Idle", null,);
      report.force("scenarios", [0,],);
      report.set("start", TjTime.fromString("2026-01-01",),);
      report.set("end", TjTime.fromString("2026-06-30",),);
      (task as unknown as {
        hasResourceAllocated(
          s: number,
          iv: TimeInterval,
          r: Resource,
        ): boolean;
      }).hasResourceAllocated = (_s, _iv, r,) => r === alloc;
      const rb = new TestReport(report,);
      const list = new PropertyList<Resource>(project.resources,);
      const out = rb.filterResourceList(list, task, null, null, null,);
      const names = out.toArray().map((r,) => r.name);
      assert(names.includes("Alloc",),);
      assert(!names.includes("Idle",),);
    });

    it("aplica hideExpr", () => {
      const r1 = new Resource(project, "r1", "R1", null,);
      const r2 = new Resource(project, "r2", "R2", null,);
      const rb = new TestReport(report,);
      const list = new PropertyList<Resource>(project.resources,);
      const out = rb.filterResourceList(
        list,
        null,
        fakeExpr((q,) => q.property === r1),
        null,
        null,
      );
      assertEquals(out.toArray().length, 1,);
      assertEquals(out.toArray()[0], r2,);
    });
  });

  describe("standardFilterOps", () => {
    it("remove descendentes de nós com rollupExpr", () => {
      const root = new Task(project, "root", "Root", null,);
      const child = new Task(project, "root.child", "Child", root,);
      const rb = new TestReport(report,);
      const list = new PropertyList<Task>(project.tasks,);
      // rollup em root → remove filhos de root.
      const rollup = fakeExpr((q,) => q.property === root);
      const out = rb.standard(list, null, rollup, null, null, null,);
      const names = out.toArray().map((t,) => t.name);
      assert(!names.includes("Child",), "filho de rollup sai",);
    });

    it("openNodes preserva nós listados", () => {
      const root = new Task(project, "root", "Root", null,);
      const child = new Task(project, "root.child", "Child", root,);
      const rb = new TestReport(report,);
      const list = new PropertyList<Task>(project.tasks,);
      // openNodes contendo [root, null] → root fica "aberto", child fica.
      const open: OpenNodes = [[root, null,],];
      const out = rb.standard(list, null, null, open, null, null,);
      const names = out.toArray().map((t,) => t.name);
      assert(names.includes("Child",), "aberto mantém filho",);
    });

    it("readiciona pais em tree mode", () => {
      const root = new Task(project, "root", "Root", null,);
      const mid = new Task(project, "root.mid", "Mid", root,);
      const leaf = new Task(project, "root.mid.leaf", "Leaf", mid,);
      const rb = new TestReport(report,);
      const list = new PropertyList<Task>(project.tasks,);
      list.resetSorting();
      list.addSortingCriteria("tree", true, -1,);
      // Oculta root e mid; em tree mode pais são readicionados.
      const hide = fakeExpr((q,) => q.property === root || q.property === mid);
      const out = rb.standard(list, hide, null, null, null, null,);
      const names = out.toArray().map((t,) => t.name);
      assert(names.includes("Leaf",),);
      assert(names.includes("Mid",), "pai readicionado",);
      assert(names.includes("Root",), "ancestral readicionado",);
    });

    it("não readiciona pais fora de tree mode", () => {
      const root = new Task(project, "root", "Root", null,);
      const leaf = new Task(project, "root.leaf", "Leaf", root,);
      const rb = new TestReport(report,);
      const list = new PropertyList<Task>(project.tasks,);
      const hide = fakeExpr((q,) => q.property === root);
      const out = rb.standard(list, hide, null, null, null, null,);
      const names = out.toArray().map((t,) => t.name);
      assert(names.includes("Leaf",),);
      assert(!names.includes("Root",), "sem tree mode não readiciona",);
    });
  });

  describe("HTML helpers", () => {
    it("generateHtmlTableFrame sem headline só tem a tabela", () => {
      const rb = new TestReport(report,);
      const table = rb.frame();
      assertEquals(table.tag, "table",);
      assertEquals(table.attrs.class, "tj_table_frame",);
      assertEquals(table.children.length, 0,);
    });

    it("generateHtmlTableFrame com headline adiciona linha", () => {
      report.set("headline", fakeRichText([],),);
      const rb = new TestReport(report,);
      const table = rb.frame();
      assertEquals(table.children.length, 1,);
      const tr = table.children[0] as XMLElementLike;
      assertEquals(tr.tag, "tr",);
    });

    it("generateHtmlTableRow envolve célula em <tr>", () => {
      const rb = new TestReport(report,);
      const cell = new XMLElement("td",);
      const tr = rb.row(cell,);
      assertEquals(tr.tag, "tr",);
      assertEquals(tr.children[0], cell,);
    });

    it("rt_to_html converte e desliga sectionNumbers", () => {
      const rt = fakeRichText([],);
      report.set("caption", rt,);
      const rb = new TestReport(report,);
      const el = rb.rt("caption",);
      assert(el, "deve produzir elemento",);
      assertEquals(rt.sectionNumbers, false,);
    });

    it("rt_to_html retorna null para bloco ausente", () => {
      const rb = new TestReport(report,);
      assertEquals(rb.rt("prolog",), null,);
    });
  });
});
