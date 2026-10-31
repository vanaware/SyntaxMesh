/**
 * AccountListRE (Fase 14.16) — relatório de listagem de contas.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/AccountListRE.rb`.
 * Especialização de `TableReport` que lista contas; em modo balance (custo e
 * receita configurados), separa as contas de custo e receita e acrescenta uma
 * linha "Total" calculada por meta-conta (equivalente ao `Account.new` +
 * `adopt` do Ruby; `Project.newAccount` não existe no port, então a conta
 * meta é criada diretamente, como em `balance-account.ts`).
 *
 * O conteúdo é registrado na fábrica de conteúdo (14.11) sob `accountreport`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.16)
 */
import type { Report, } from "../model/report.ts";
import { PropertyList, } from "../model/property-list.ts";
import { Account, } from "../model/account.ts";
import { ReportTable, } from "./report-table.ts";
import { TableReport, } from "./table-report.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/** Contador de IDs únicos para a meta-conta temporária "Total". */
let balanceCounter = 0;

export class AccountListRE extends TableReport {
  constructor(report: Report,) {
    super(report,);
    // TableReport define `report.content = this`; aqui criamos a tabela
    // intermediária real (14.6) que acumulará linhas e colunas.
    this.table = new ReportTable();
    this.table.selfcontained = !!this.a("selfcontained",);
    this.table.auxDir = (this.a("auxdir",) as string | undefined) ?? "";
  }

  /** Constrói o formato intermediário (tabela) linha a linha. */
  override generateIntermediateFormat(): void {
    // Propaga o Query corrente aos blocos de RichText (ReportBase).
    super.generateIntermediateFormat();

    // Prepara a lista de contas.
    let accountList = new PropertyList<Account>(this.project.accounts,);
    accountList.setSorting(
      this.a("sortAccounts",) as Array<[string, boolean, number,]>,
    );
    accountList.query = this.currentQuery();
    accountList = this.filterAccountList(
      accountList,
      this.a("hideAccount",) as never,
      this.a("rollupAccount",) as never,
      this.a("openNodes",) as never,
    );
    accountList.sort();

    // Gera o cabeçalho da tabela (uma coluna de cada vez). Contas não têm
    // período derivado de tarefas: `adjustColumnPeriod` usa só o relatório.
    for (const columnDef of this.columnList()) {
      this.adjustColumnPeriod(columnDef,);
      this.generateHeaderCell(columnDef,);
    }

    const costAccount = this.a("costaccount",) as Account | null;
    const revenueAccount = this.a("revenueaccount",) as Account | null;
    if (costAccount && revenueAccount) {
      // Modo balance: contas de custo, depois de receita, depois o total.
      const costAccountList = this.newAccountList();
      const revenueAccountList = this.newAccountList();

      // Separa a lista filtrada entre custo e receita.
      for (const account of accountList.toArray()) {
        if (account === costAccount || account.isChildOf(costAccount,)) {
          costAccountList.append([account,],);
        } else if (
          account === revenueAccount || account.isChildOf(revenueAccount,)
        ) {
          revenueAccountList.append([account,],);
        }
      }

      // As contas top-level de custo e receita entram sempre.
      if (!costAccountList.includes(costAccount,)) {
        costAccountList.append([costAccount,],);
      }
      if (!revenueAccountList.includes(revenueAccount,)) {
        revenueAccountList.append([revenueAccount,],);
      }

      this.generateAccountList(costAccountList, 0, "",);
      this.generateAccountList(
        revenueAccountList,
        costAccountList.length(),
        "",
      );

      // Linha "Total": meta-conta temporária que adota custo e receita
      // (Ruby: `Account.new(project, '0', 'Total', nil)` + `adopt`; aqui o
      // padrão único `_balance_N` de `balance-account.ts`).
      const totalAccount = new Account(
        this.project,
        `_balance_${++balanceCounter}`,
        "Total",
        null,
      );
      totalAccount.adopt(costAccount,);
      totalAccount.adopt(revenueAccount,);
      try {
        const totalAccountList = this.newAccountList();
        totalAccountList.append([totalAccount,],);
        this.generateAccountList(
          totalAccountList,
          costAccountList.length() + revenueAccountList.length(),
          "",
        );
      } finally {
        // Ruby: `@report.project.removeAccount(totalAccount)`.
        this.project.removeAccount(totalAccount,);
      }
    } else {
      // Sem modo balance: lista simples de todas as contas não filtradas.
      this.generateAccountList(accountList, 0, "",);
    }
  }

  /** Lista vazia de contas com o PropertySet e a ordenação do relatório. */
  private newAccountList(): PropertyList<Account> {
    const list = new PropertyList<Account>(this.project.accounts,);
    list.clear();
    list.setSorting(
      this.a("sortAccounts",) as Array<[string, boolean, number,]>,
    );
    list.query = this.currentQuery();
    return list;
  }
}

// Registra o conteúdo de `accountreport` na fábrica (14.11).
registerContentFactory(
  "accountreport",
  (report: unknown,): AccountListRE => new AccountListRE(report as Report,),
);
