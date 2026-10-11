import { ScenarioData, } from "./scenario-data.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";
import { type Account, } from "./account.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type AccountCredit, } from "../finance/account-credit.ts";
import { type TjTime, } from "../time/tj-time.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";

/**
 * Interface para query de relatório (balance/turnover).
 *
 * Obrigatório: start, end, sortable, numerical, string, currencyFormat.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb#query_balance
 */
export interface Query {
  readonly start: TjTime;
  readonly end: TjTime;
  sortable: number;
  numerical: number;
  string: string;
  readonly currencyFormat: {
    format(amount: number,): string;
  };
}

/**
 * Lista exata de atributos pré-carregados pelo AccountScenario do Ruby
 * (AccountScenario.rb, linhas 17–20).
 */
export const ACCOUNT_SCENARIO_ATTRS: string[] = ["credits",];

export class AccountScenario extends ScenarioData {
  constructor(
    account: unknown,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(
      account as PropertyLike,
      scIdx,
      attributes,
    );
    this.preloadAttributes(ACCOUNT_SCENARIO_ATTRS,);
  }

  /**
   * Obtém o valor de um atributo da conta (não do cenário), incluindo
   * herança e valores padrão. Usado para atributos como 'aggregate'.
   */
  getAccountAttribute(id: string,): unknown {
    return (this.property as PropertyTreeNode).get(id,);
  }

  /**
   * Calcula o turnover para o período entre _startIdx_ e _endIdx_.
   *
   * Replicando o método Ruby `AccountScenario#turnover`.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb#turnover
   */
  turnover(startIdx: number, endIdx: number): number {
    let amount = 0.0;

    // 1. Credits (manuais)
    const credits = this.a("credits",) as AccountCredit[];
    if (credits && credits.length > 0) {
      const project = (this.property as PropertyLike & { project: ProjectLike, }).project;
      const startDate = project.idxToDate(startIdx,);
      const endDate = project.idxToDate(endIdx,);
      for (const credit of credits) {
        if (startDate <= credit.date && credit.date < endDate) {
          amount += credit.amount;
        }
      }
    }

    // 2. Container logic (filhos ou meta-account)
    const property = this.property as PropertyLike & {
      container?: () => boolean;
      adoptees?: PropertyLike[];
      children?: PropertyLike[];
    };
    if (property.container?.()) {
      const adoptees = property.adoptees ?? [];
      if (adoptees.length === 0) {
        // Normal case: accumulate turnover of child accounts
        for (const child of property.children ?? []) {
          const childAccount = child as unknown as Account;
          amount += childAccount.scenarioData(this.scenarioIdx,).turnover(startIdx, endIdx,);
        }
      } else {
        // Special case for meta account used to calculate a balance.
        // The first adoptee is the top-level cost account, the second the top-level revenue account.
        amount +=
          -(adoptees[0] as unknown as Account).scenarioData(this.scenarioIdx,).turnover(startIdx, endIdx,) +
          (adoptees[1] as unknown as Account).scenarioData(this.scenarioIdx,).turnover(startIdx, endIdx,);
      }
    } else {
      // Leaf: aggregate by type (tasks or resources)
      const aggregate = this.getAccountAttribute("aggregate",) as string;
      const project = (this.property as PropertyLike & { project: ProjectLike, }).project;

      if (aggregate === "tasks") {
        project.tasks.each((task) => {
          // Cast to Account to access scenarioData, then to TaskScenario for turnover with 5 args
          const taskAccount = task as unknown as Account;
          const taskScenario = taskAccount.scenarioData(this.scenarioIdx,) as unknown as {
            turnover(startIdx: number, endIdx: number, account: unknown, resource: unknown, includeKids: boolean,): number;
          };
          amount += taskScenario.turnover(startIdx, endIdx, this.property, null, false,);
        });
      } else if (aggregate === "resources") {
        project.resources.each((resource) => {
          if (resource.leaf?.()) {
            const resourceAccount = resource as unknown as Account;
            const resourceScenario = resourceAccount.scenarioData(this.scenarioIdx,) as unknown as {
              turnover(startIdx: number, endIdx: number, account: unknown, resource: unknown, includeKids: boolean,): number;
            };
            amount += resourceScenario.turnover(startIdx, endIdx, this.property, null, false,);
          }
        });
      } else {
        throw new Error(`Unknown aggregation type ${aggregate}`);
      }
    }

    return amount;
  }

  /**
   * Popula um query de balance (startIdx = 0, endIdx = dateToIdx(query.start)).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb#query_balance
   */
  query_balance(query: Query): void {
    const project = (this.property as PropertyLike & { project: ProjectLike, }).project;
    const startIdx = 0;
    const endIdx = project.dateToIdx(query.start,);
    const amount = this.turnover(startIdx, endIdx,);

    query.sortable = amount;
    query.numerical = amount;
    query.string = query.currencyFormat.format(amount,);
  }

  /**
   * Popula um query de turnover (startIdx = dateToIdx(query.start), endIdx = dateToIdx(query.end)).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb#query_turnover
   */
  query_turnover(query: Query): void {
    const project = (this.property as PropertyLike & { project: ProjectLike, }).project;
    const startIdx = project.dateToIdx(query.start,);
    const endIdx = project.dateToIdx(query.end,);
    const amount = this.turnover(startIdx, endIdx,);

    query.sortable = amount;
    query.numerical = amount;
    query.string = query.currencyFormat.format(amount,);
  }
}
