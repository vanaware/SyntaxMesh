/**
 * Testes do bloco 2 de TjpSyntaxRules — account (subfase 10.12.2).
 *
 * Cobre `rule_account`/`rule_accountHeader` (criação e hierarquia),
 * `rule_accountScenarioAttributes` (aggregate, credits, flags),
 * `rule_accountId` e os erros `account_exists` e `unknown_account`.
 *
 * @see docs/syntaxmesh/fases/fase-10-parser-linguagem-tarefas.md §10.12.2
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import { Account, } from "../../src/model/account.ts";
import { AccountCredit, } from "../../src/finance/account-credit.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** Pega o Project resultante (lança se o parse não produziu um). */
function project(out: ReturnType<typeof parseProject>,): Project {
  assert(
    out.threw === null,
    "parse não deveria lançar: " + out.threw?.message,
  );
  assert(out.messageIds.length === 0, JSON.stringify(out.messages,),);
  return out.result as Project;
}

describe("rule_account + rule_accountHeader (10.12.2.1)", () => {
  it("cria Account com id e nome no projeto", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'account dev "Development" {\n}\n',),
    );
    const a = p.account("dev",);
    assert(a instanceof Account,);
    assertEquals(a!.name, "Development",);
    assertEquals(a!.fullId, "dev",);
  });

  it("contas aninhadas herdam o pai mas mantêm fullId curto (flat)", () => {
    // Ruby: Project.rb cria @accounts com namespace flat — o filho nichado
    // é registrado pelo ID curto; a hierarquia vem do pai do bloco.
    const p = project(
      parseProject(
        PROJECT_HEADER + 'account top "T" {\naccount kid "K" {\n}\n}\n',
      ),
    );
    const kid = p.account("kid",);
    assert(kid instanceof Account, "filho registrado como kid",);
    assertEquals(kid!.fullId, "kid",);
    assertEquals(kid!.parent, p.account("top",),);
  });

  it("id duplicado registra account_exists", () => {
    const out = parseProject(
      PROJECT_HEADER + 'account a1 "A" {\n}\naccount a1 "B" {\n}\n',
    );
    assert(out.messageIds.includes("account_exists",),);
  });
});

describe("rule_accountScenarioAttributes (10.12.2.2)", () => {
  it("aggregate tasks marca a conta (default já é tasks)", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'account dev "D" {\naggregate tasks\n}\n',
      ),
    );
    assertEquals(p.account("dev",)!.get("aggregate",), "tasks",);
  });

  it("credits acumula AccountCredit com data, descrição e valor", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'account dev "D" {\n' +
          'credits 2026-01-01 "Initial" 1000\n}\n',
      ),
    );
    const credits = p.account("dev",)!.getForScenario(
      "credits",
      0,
    ) as AccountCredit[];
    assertEquals(credits.length, 1,);
    assertEquals(credits[0]!.description, "Initial",);
    assertEquals(credits[0]!.amount, 1000,);
  });

  it("flags declarados no escopo global podem ser usados na conta", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'flags beta\naccount dev "D" {\nflags beta\n}\n',
      ),
    );
    const flags = p.account("dev",)!.getForScenario("flags", 0,) as string[];
    assert(flags.includes("beta",), "flags: " + JSON.stringify(flags,),);
  });

  it("flag não declarado registra undecl_flag", () => {
    const out = parseProject(
      PROJECT_HEADER + 'account dev "D" {\nflags zzz\n}\n',
    );
    assert(out.messageIds.includes("undecl_flag",),);
  });

  it("accountId inexistente registra unknown_account", () => {
    const out = parseProject(
      PROJECT_HEADER + 'account dev "D" {\naggregate tasks\n}\n' +
        'task t "T" {\nchargeset naoexiste 100%\n}\n',
    );
    assert(out.messageIds.includes("unknown_account",),);
  });

  it("aggregate resources não pode carregar tasks (account_bad_aggregate)", () => {
    const out = parseProject(
      PROJECT_HEADER + 'account fin "F" {\naggregate resources\n}\n' +
        'task t "T" {\nchargeset fin 100%\n}\n',
    );
    assert(out.messageIds.includes("account_bad_aggregate",),);
  });
});

describe("agregados de account (10.12.2.3)", () => {
  it("agregado: aggregate + credits juntos", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'account dev "Development" {\n' +
          'aggregate tasks\ncredits 2026-01-01 "Initial" 1000\n}\n',
      ),
    );
    const a = p.account("dev",)!;
    assertEquals(a.get("aggregate",), "tasks",);
    const credits = a.getForScenario("credits", 0,) as AccountCredit[];
    assertEquals(credits.length, 1,);
  });
});
