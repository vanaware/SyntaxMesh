/**
 * 14C.6.1 — auditoria das diretivas `hide*`/`rollup*` (absorve 14.26.1a/b).
 *
 * A auditoria confirma que as diretivas **existentes** não são apenas
 * parseadas: chegam ao relatório e são avaliadas pela máquina de expressões
 * lógicas (`ReportBase#standardFilterOps`), removendo as propriedades casadas.
 * Cada teste usa um `.tjp` real (parser) para garantir expressão de verdade.
 *
 * `hidejournalentry` é o único caso ancorado: a filtragem acontece **por
 * entrada** de journal (`Journal#hidden`, Ruby l.738), e avaliar expressões com
 * um `JournalEntry` como contexto é Fase 16 (`LogicalFlag`/`NotYetImplementedError`).
 * Aqui auditamos o encanamento relatório → `ReportContext.query`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.6.1)
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { parseProject, } from "../parser/parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Report, } from "../../src/model/report.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { ReportTable, } from "../../src/reports/report-table.ts";
import { TaskListRE, } from "../../src/reports/task-list-re.ts";
import { ResourceListRE, } from "../../src/reports/resource-list-re.ts";
import { AccountListRE, } from "../../src/reports/account-list-re.ts";
import type { PropertyTreeNode, } from "../../src/model/property-tree-node.ts";

const HEADER =
  `project prj "Auditoria hide/rollup" "1.0" 2026-01-01 - 2026-12-31 {
  timezone "UTC"
}
`;

const BODY = `
task g1 "Grupo 1" {
  task a "Tarefa A" { milestone }
  task b "Tarefa B" { milestone }
}

task g2 "Grupo 2" {
  task c "Tarefa C" { milestone }
}

resource team1 "Equipe 1" {
  resource r1 "Recurso 1"
}

resource team2 "Equipe 2" {
  resource r2 "Recurso 2"
}

account acc "Contas" {
  account a1 "Conta 1"
  account a2 "Conta 2"
}
`;

/** Subclasses que expõem a tabela intermediária para as asserções. */
class TestTaskListRE extends TaskListRE {
  override getTable(): ReportTable | null {
    return this.table;
  }
}
class TestResourceListRE extends ResourceListRE {
  override getTable(): ReportTable | null {
    return this.table;
  }
}
class TestAccountListRE extends AccountListRE {
  override getTable(): ReportTable | null {
    return this.table;
  }
}

/** Parseia o TJP com o relatório indicado e devolve projeto + relatório. */
function parseReport(id: string, body: string,): {
  project: Project;
  report: Report;
} {
  const out = parseProject(`${HEADER}${BODY}${body}`,);
  assertEquals(
    out.messageIds,
    [],
    `msgs=${out.messageIds.join(",",)}: ${
      out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)
    }`,
  );
  assert(out.result !== false, "parse falhou",);
  const project = out.result as Project;
  const report = project.report(id,) as Report | null;
  assert(report !== null, `relatório ${id} não registrado`,);
  return { project, report, };
}

/** Propriedades das linhas geradas (na ordem). */
function rowProps(table: ReportTable | null,): PropertyTreeNode[] {
  return (table?.getLines() ?? []).map((line,) =>
    line.property as PropertyTreeNode
  );
}

/** IDs das linhas, ordenados (a ordem das linhas depende do treeMode). */
function rowIds(table: ReportTable | null,): string[] {
  return rowProps(table,).map((p,) => p.id).sort();
}

describe("14C.6.1 auditoria hide/rollup", () => {
  it("hidetask oculta as tarefas casadas e rolluptask remove os descendentes", () => {
    const hide = parseReport(
      "tr",
      'taskreport tr "T" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns name\n  hidetask ischildof(g1)\n}\n",
    );
    hide.project.reportContexts.push(
      new ReportContext(hide.project, hide.report,),
    );
    const hideRe = new TestTaskListRE(hide.report,);
    hideRe.generateIntermediateFormat();
    assertEquals(
      rowIds(hideRe.getTable(),),
      ["g1", "g2", "g2.c",],
      "hide remove as tarefas filhas de g1",
    );

    const rollup = parseReport(
      "tr2",
      'taskreport tr2 "T2" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns name\n  rolluptask treelevel() = 1\n}\n",
    );
    rollup.project.reportContexts.push(
      new ReportContext(rollup.project, rollup.report,),
    );
    const rollupRe = new TestTaskListRE(rollup.report,);
    rollupRe.generateIntermediateFormat();
    assertEquals(
      rowIds(rollupRe.getTable(),),
      ["g1", "g2",],
      "rollup remove os descendentes e mantém os grupos",
    );
  });

  it("hideresource oculta os recursos casados e rollupresource remove os descendentes", () => {
    const hide = parseReport(
      "rr",
      'resourcereport rr "R" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns name\n  hideresource ischildof(team1)\n}\n",
    );
    hide.project.reportContexts.push(
      new ReportContext(hide.project, hide.report,),
    );
    const hideRe = new TestResourceListRE(hide.report,);
    hideRe.generateIntermediateFormat();
    assertEquals(
      rowIds(hideRe.getTable(),),
      ["r2", "team1", "team2",],
      "hide remove r1, filho de team1",
    );

    const rollup = parseReport(
      "rr2",
      'resourcereport rr2 "R2" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns name\n  rollupresource treelevel() = 1\n}\n",
    );
    rollup.project.reportContexts.push(
      new ReportContext(rollup.project, rollup.report,),
    );
    const rollupRe = new TestResourceListRE(rollup.report,);
    rollupRe.generateIntermediateFormat();
    assertEquals(
      rowIds(rollupRe.getTable(),),
      ["team1", "team2",],
      "rollup mantém só as equipes",
    );
  });

  it("hideaccount/rollupaccount filtram contas e hidejournalentry chega à Query", () => {
    const hide = parseReport(
      "ar",
      'accountreport ar "A" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns name\n  hideaccount ischildof(acc)\n" +
        "  hidejournalentry isleaf()\n}\n",
    );
    const query = new ReportContext(hide.project, hide.report,).query;
    assert(
      query.hideJournalEntry !== null,
      "hideJournalEntry deve chegar à Query do ReportContext",
    );
    hide.project.reportContexts.push(
      new ReportContext(hide.project, hide.report,),
    );
    const hideRe = new TestAccountListRE(hide.report,);
    hideRe.generateIntermediateFormat();
    assertEquals(
      rowIds(hideRe.getTable(),),
      ["acc",],
      "hide remove as subcontas de acc",
    );

    const rollup = parseReport(
      "ar2",
      'accountreport ar2 "A2" {\n  period 2026-01-01 - 2026-12-31\n' +
        "  columns name\n  rollupaccount treelevel() = 1\n}\n",
    );
    rollup.project.reportContexts.push(
      new ReportContext(rollup.project, rollup.report,),
    );
    const rollupRe = new TestAccountListRE(rollup.report,);
    rollupRe.generateIntermediateFormat();
    assertEquals(
      rowIds(rollupRe.getTable(),),
      ["acc",],
      "rollup mantém só a conta raiz",
    );
  });
});
