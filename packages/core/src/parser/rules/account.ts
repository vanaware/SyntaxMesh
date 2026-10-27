/**
 * TjpSyntaxRules — bloco account (subfase 10.12).
 *
 * Port das regras `account*` de `TjpSyntaxRules.rb`. `supplementAccount`
 * já vive em common.ts; `flags` e `accountId` vêm de scenario.ts / daqui.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb
 */
import { Account, } from "../../model/account.ts";
import { AccountCredit, } from "../../finance/account-credit.ts";
import { TjTime, } from "../../time/tj-time.ts";
import type { ProjectFileParser, } from "../project-file-parser.ts";
import { rule, } from "./helpers.ts";

const asProp = (parser: ProjectFileParser,): NonNullable<
  ProjectFileParser["property"]
> => parser.property!;

/** Registra o bloco de regras de contas. */
export function registerAccountRules(p: ProjectFileParser,): void {
  // ------------------------------------------------------------------
  // account / header / body / attributes
  // ------------------------------------------------------------------
  rule(p, "account", () => {
    p.pattern(
      ["!accountHeader", "!accountBody",],
      function (this: ProjectFileParser,): unknown {
        this.property = asProp(this,).parent;
        return null;
      },
    );
    p.doc(
      "account",
      "Accounts can be used to keep track of the costs and revenues of a " +
        "project. Accounts form a hierarchy.",
    );
    p.example("Account", "1",);
  },);

  rule(p, "accountAttributes", () => {
    p.repeatable();
    p.optional();

    p.pattern(["!account",],);

    // Fase 10 Complemento C3.2.2 — `note` e `journalentry` em conta.
    p.pattern(
      ["_note", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set(
          "note",
          this.newRichText(
            String(this.val[1],),
            this.sourceFileInfo[1] ?? null,
          ),
        );
        return null;
      },
    );
    p.doc("note.account", "Attach a note to the account.",);

    p.pattern(["!journalEntry",],);

    p.pattern(["!accountScenarioAttributes",],);
    p.pattern(
      ["!scenarioIdCol", "!accountScenarioAttributes",],
      function (this: ProjectFileParser,): unknown {
        this.scenarioIdx = 0;
        return null;
      },
    );
    // Outros atributos são adicionados automaticamente.
  },);

  rule(p, "accountBody", () => {
    p.optionsRule("accountAttributes",);
  },);

  rule(p, "accountHeader", () => {
    p.pattern(
      ["_account", "!optionalID", "$STRING",],
      function (this: ProjectFileParser,): unknown {
        const project = this.project!;
        if (!this.property && this.accountprefix !== "") {
          this.property = (project.account(this.accountprefix,)) ??
            this.property;
        }
        const id = this.val[1] as string | null;
        if (id && project.account(id,)) {
          this.error(
            "account_exists",
            `Account ${id} has already been defined.`,
            this.sourceFileInfo[1] ?? this.getSourceFileInfo()!,
            this.property,
          );
        }
        this.property = new Account(
          project,
          id,
          String(this.val[2],),
          this.property as Account | null,
        );
        this.property.sourceFileInfo = this.sourceFileInfo[0] ?? null;
        this.property.inheritAttributes();
        this.scenarioIdx = 0;
        return null;
      },
    );
    p.arg(2, "name", "A name or short description of the account.",);
  },);

  // ------------------------------------------------------------------
  // ID de conta
  // ------------------------------------------------------------------
  rule(p, "accountId", () => {
    p.pattern(["$ID",], function (this: ProjectFileParser,): unknown {
      let id = String(this.val[0],);
      if (this.accountprefix !== "") id = this.accountprefix + "." + id;
      // Supplement aninhado: precisa prefixar o ID do pai.
      const prop = this.property;
      if (prop && prop instanceof Account) {
        id = prop.fullId + "." + id;
      }
      const account = this.project!.account(id,);
      if (!account) {
        this.error(
          "unknown_account",
          `Unknown account ${id}`,
          this.sourceFileInfo[0] ?? this.getSourceFileInfo()!,
        );
      }
      return account;
    },);
  },);

  // ------------------------------------------------------------------
  // Credits
  // ------------------------------------------------------------------
  rule(p, "accountCredit", () => {
    p.pattern(
      ["!valDate", "$STRING", "!number",],
      function (this: ProjectFileParser,): unknown {
        return new AccountCredit(
          this.val[0] as TjTime,
          String(this.val[1],),
          this.val[2] as number,
        );
      },
    );
    p.arg(1, "description", "Short description of the transaction",);
    p.arg(2, "amount", "Amount to be booked.",);
  },);

  rule(p, "accountCredits", () => {
    p.listRule("moreAccountCredits", "!accountCredit",);
  },);

  // ------------------------------------------------------------------
  // Atributos de cenário da conta
  // ------------------------------------------------------------------
  rule(p, "accountScenarioAttributes", () => {
    p.pattern(
      ["_aggregate", "!aggregate",],
      function (this: ProjectFileParser,): unknown {
        asProp(this,).set("aggregate", this.val[1],);
        return null;
      },
    );
    p.doc(
      "aggregate",
      "Selects which elements of the project structure the account " +
        "aggregates.",
    );
    p.example("AccountReport",);

    p.pattern(
      ["_credits", "!accountCredits",],
      function (this: ProjectFileParser,): unknown {
        this.appendScListAttribute(
          "credits",
          this.val[1] as AccountCredit[],
        );
        return null;
      },
    );
    p.doc(
      "credits",
      "Direct credits and debits to the account (opening balance and so " +
        "on).",
    );
    p.example("Account", "1",);

    p.pattern(["!flags",],);
    p.doc("flags.account", "Flags assigned to the account.",);
    // Outros atributos são adicionados automaticamente.
  },);
}
