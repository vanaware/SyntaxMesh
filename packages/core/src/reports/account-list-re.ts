/**
 * AccountListRE (phase 14.16) — account list report.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/AccountListRE.rb`. A specialization
 * of `TableReport` that lists accounts; in balance mode (both a cost and a
 * revenue account configured) it separates the cost and revenue accounts and
 * appends a `Total` row computed from a meta-account (the equivalent of Ruby's
 * `Account.new` plus `adopt`; the port has no `Project.newAccount`, so the
 * meta-account is created directly, as in `balance-account.ts`).
 *
 * The content is registered in the content factory (14.11) under
 * `accountreport`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.16)
 */
import type { Report, } from "../model/report.ts";
import { PropertyList, } from "../model/property-list.ts";
import { Account, } from "../model/account.ts";
import { ReportTable, } from "./report-table.ts";
import { TableReport, } from "./table-report.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/** Unique-id counter for the temporary `Total` meta-account. */
let balanceCounter = 0;

/** Renders the `accountreport` list of accounts. */
export class AccountListRE extends TableReport {
  /**
   * Creates the account list generator.
   *
   * @param report Report node the generator renders.
   */
  constructor(report: Report,) {
    super(report,);
    // TableReport sets `report.content = this`; here we create the real
    // intermediate table (14.6) that accumulates rows and columns.
    this.table = new ReportTable();
    this.table.selfcontained = !!this.a("selfcontained",);
    this.table.auxDir = (this.a("auxdir",) as string | undefined) ?? "";
  }

  /** Builds the intermediate format (the table) row by row. */
  override generateIntermediateFormat(): void {
    // Propagates the current Query to the RichText blocks (ReportBase).
    super.generateIntermediateFormat();

    // Prepares the account list.
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

    // Generates the table header (one column at a time). Accounts have no
    // period derived from tasks: `adjustColumnPeriod` uses the report only.
    for (const columnDef of this.columnList()) {
      this.adjustColumnPeriod(columnDef,);
      this.generateHeaderCell(columnDef,);
    }

    const costAccount = this.a("costaccount",) as Account | null;
    const revenueAccount = this.a("revenueaccount",) as Account | null;
    if (costAccount && revenueAccount) {
      // Balance mode: cost accounts, then revenue accounts, then the total.
      const costAccountList = this.newAccountList();
      const revenueAccountList = this.newAccountList();

      // Splits the filtered list into cost and revenue.
      for (const account of accountList.toArray()) {
        if (account === costAccount || account.isChildOf(costAccount,)) {
          costAccountList.append([account,],);
        } else if (
          account === revenueAccount || account.isChildOf(revenueAccount,)
        ) {
          revenueAccountList.append([account,],);
        }
      }

      // The top-level cost and revenue accounts are always included.
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

      // `Total` row: a temporary meta-account adopting cost and revenue
      // (Ruby: `Account.new(project, '0', 'Total', nil)` plus `adopt`; here the
      // single `_balance_N` pattern of `balance-account.ts`).
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
      // No balance mode: a plain list of every unfiltered account.
      this.generateAccountList(accountList, 0, "",);
    }
  }

  /** Empty account list carrying the property set and the report sorting. */
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

// Registers the `accountreport` content in the factory (14.11).
registerContentFactory(
  "accountreport",
  (report: unknown,): AccountListRE => new AccountListRE(report as Report,),
);
