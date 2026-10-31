/**
 * Testes de AccountListRE (Fase 14.16).
 *
 * Cobre o construtor, o filtro da lista de contas, o cabeçalho por coluna e o
 * modo balance (separação custo/receita, inclusão forçada das contas top,
 * linhas em ordem com offsets e a meta-conta "Total" temporária removida ao
 * final), além do caminho simples fora do modo balance.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.16)
 */

import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import type { Project, } from "../../src/model/project.ts";
import { Report, } from "../../src/model/report.ts";
import { Account, } from "../../src/model/account.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import type { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { PropertyList, } from "../../src/model/property-list.ts";
import { ReportContext, } from "../../src/reports/report-context.ts";
import { ReportTable, } from "../../src/reports/report-table.ts";
import { TableColumnDefinition, } from "../../src/reports/table-column-definition.ts";
import { AccountListRE, } from "../../src/reports/account-list-re.ts";
import { ReportType, } from "../../src/model/report-type.ts";
import { contentFactories, } from "../../src/model/report-content.ts";

/** Subclasse que expõe a tabela usada nas asserções. */
class TestAccountListRE extends AccountListRE {
  override getTable(): ReportTable | null {
    return this.table;
  }
}

/** Expressão lógica sob medida. */
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

describe("AccountListRE (14.16)", () => {
  let project: Project;
  let report: Report;
  let re: TestAccountListRE;

  function setup(columns: TableColumnDefinition[],): void {
    project = createTestProject(2,);
    report = new Report(project, "al", "al.html", null,);
    report.typeSpec = ReportType.AccountReport;
    report.set("start", TjTime.fromString("2026-01-01",),);
    report.set("end", TjTime.fromString("2026-12-31",),);
    report.set("scenarios", [0,],);
    if (columns.length > 0) report.set("columns", columns,);
    project.reportContexts.push(new ReportContext(project, report,),);
    re = new TestAccountListRE(report,);
  }

  beforeEach(() => {
    restores.length = 0;
    setup([new TableColumnDefinition("no", "No",),],);
  },);

  afterEach(() => {
    while (restores.length) restores.pop()!();
  },);

  describe("constructor (14.16.2)", () => {
    it("cria a ReportTable com selfcontained/auxdir do relatório", () => {
      const table = re.getTable();
      assert(table instanceof ReportTable,);
      assertEquals(table!.selfcontained, false,);
      assertEquals(table!.auxDir, "",);
      report.set("selfcontained", true,);
      report.set("auxdir", "aux/",);
      const child = new TestAccountListRE(report,);
      assertEquals(child.getTable()!.selfcontained, true,);
      assertEquals(child.getTable()!.auxDir, "aux/",);
    });
  });

  describe("accountList filtrado (14.16.3)", () => {
    it("chama filterAccountList com as expressões do relatório", () => {
      const hide = fakeExpr(() => false);
      const rollup = fakeExpr(() => false);
      report.set("hideAccount", hide,);
      report.set("rollupAccount", rollup,);
      const calls = spy(re, "filterAccountList",);
      re.generateIntermediateFormat();
      assertEquals(calls.length, 1,);
      assertEquals(calls[0]!.slice(1,), [hide, rollup, null,],);
    });

    it("oculta contas casadas por hideAccount", () => {
      const a1 = new Account(project, "a1", "A1", null,);
      const a2 = new Account(project, "a2", "A2", null,);
      report.set("hideAccount", fakeExpr((p,) => p === a2),);
      re.generateIntermediateFormat();
      const lines = re.getTable()!.getLines();
      assertEquals(lines.length, 1,);
      assertEquals(lines[0]!.property, a1,);
      assert(a2,);
    });
  });

  describe("cabeçalho por coluna (14.16.4)", () => {
    it("ajusta o período e gera o cabeçalho de cada coluna", () => {
      const adj = spy(re, "adjustColumnPeriod",);
      const header = spy(re, "generateHeaderCell",);
      re.generateIntermediateFormat();
      assertEquals(adj.length, 1,);
      assertEquals(adj[0]!.length, 1, "contas não usam tarefas no período",);
      assertEquals(header.length, 1,);
      assertEquals(re.getTable()!.getColumns().length, 1,);
    });
  });

  describe("modo balance (14.16.5–14.16.11)", () => {
    let cost: Account;
    let revenue: Account;
    let costChild: Account;

    beforeEach(() => {
      cost = new Account(project, "cost", "Cost", null,);
      revenue = new Account(project, "rev", "Revenue", null,);
      costChild = new Account(project, "cc", "Cost Child", cost,);
      report.force("costaccount", cost,);
      report.force("revenueaccount", revenue,);
    },);

    it("separa a lista filtrada entre custo e receita", () => {
      const other = new Account(project, "other", "Other", null,);
      const calls = spy(re, "generateAccountList",);
      re.generateIntermediateFormat();
      assertEquals(calls.length, 3, "custo, receita e total",);
      const costList = calls[0]![0] as PropertyList<Account>;
      const revenueList = calls[1]![0] as PropertyList<Account>;
      assertEquals(
        costList.toArray(),
        [cost, costChild,],
        "ordem de custo (seqno)",
      );
      assertEquals(revenueList.toArray(), [revenue,],);
      assert(!costList.toArray().includes(other,), "outra conta fora",);
      assert(!revenueList.toArray().includes(other,),);
    });

    it("inclui as contas top-level mesmo quando filtradas da lista", () => {
      // hideAccount esconde tudo exceto 'other': top ainda entra por regra.
      report.set(
        "hideAccount",
        fakeExpr((p,) => (p as Account).id !== "other"),
      );
      new Account(project, "other", "Other", null,);
      const calls = spy(re, "generateAccountList",);
      re.generateIntermediateFormat();
      const costList = calls[0]![0] as PropertyList<Account>;
      const revenueList = calls[1]![0] as PropertyList<Account>;
      assert(costList.includes(cost,), "custo top sempre incluído",);
      assert(revenueList.includes(revenue,), "receita top sempre incluída",);
      assertEquals(costList.length(), 1,);
      assertEquals(revenueList.length(), 1,);
    });

    it("gera custo com offset 0 e receita após o tamanho de custo", () => {
      const calls = spy(re, "generateAccountList",);
      re.generateIntermediateFormat();
      assertEquals(calls[0]!.slice(1, 3,), [0, "",],);
      assertEquals(calls[1]!.slice(1, 3,), [2, "",],);
    });

    it("meta-conta Total adota custo e receita e é removida depois", () => {
      const calls = spy(re, "generateAccountList",);
      const removed: Account[] = [];
      const origRemove = project.removeAccount.bind(project,);
      project.removeAccount = (account: unknown,) => {
        removed.push(account as Account,);
        origRemove(account,);
      };
      restores.push(() => {
        project.removeAccount = origRemove;
      },);
      re.generateIntermediateFormat();
      const totalList = calls[2]![0] as PropertyList<Account>;
      assertEquals(totalList.length(), 1,);
      const total = totalList.toArray()[0]!;
      assertEquals(total.name, "Total",);
      assertEquals(total.adoptees, [cost, revenue,],);
      assertEquals(
        calls[2]!.slice(1, 3,),
        [3, "",],
        "offset = custo + receita",
      );
      assertEquals(removed, [total,], "removeBalanceAccount ao final",);
      assert(!project.accounts.get(total.id,), "conta meta fora do projeto",);
    });

    it("linhas saem em ordem: custo, receita e total", () => {
      re.generateIntermediateFormat();
      const lines = re.getTable()!.getLines();
      assertEquals(lines.length, 4, "2 custo + 1 receita + 1 total",);
      assertEquals(lines[0]!.property, cost,);
      assertEquals(lines[1]!.property, costChild,);
      assertEquals(lines[2]!.property, revenue,);
      // Última linha é a meta-conta temporária "Total".
      const total = lines[3]!.property as Account;
      assertEquals(total.name, "Total",);
      assert(total.id.startsWith("_balance_",), `id = ${total.id}`,);
    });

    it("sem receita não entra em modo balance", () => {
      report.force("revenueaccount", null,);
      const calls = spy(re, "generateAccountList",);
      re.generateIntermediateFormat();
      assertEquals(calls.length, 1,);
      assertEquals(calls[0]!.slice(1, 3,), [0, "",],);
    });
  });

  describe("fora do modo balance (14.16.12)", () => {
    it("gera a lista completa com offset 0", () => {
      const a1 = new Account(project, "a1", "A1", null,);
      const a2 = new Account(project, "a2", "A2", null,);
      const calls = spy(re, "generateAccountList",);
      re.generateIntermediateFormat();
      assertEquals(calls.length, 1,);
      const list = calls[0]![0] as PropertyList<Account>;
      assertEquals(list.toArray(), [a1, a2,],);
      assertEquals(calls[0]!.slice(1, 3,), [0, "",],);
      assertEquals(re.getTable()!.getLines().length, 2,);
    });

    it("accountreport está registrado na fábrica de conteúdo", () => {
      assert(contentFactories.get("accountreport",), "fábrica registrada",);
    });
  });
});
