import { ScenarioData, } from "./scenario-data.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";
import { type Account, } from "./account.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type AccountCredit, } from "../finance/account-credit.ts";
import { type TjTime, } from "../time/tj-time.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { TjInternalError, } from "./errors.ts";

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
 * Interface para subtotais por tipo (task/resource/material).
 */
export interface AccountBuckets {
  task: number;
  resource: number;
  material: number;
}

/**
 * Lista exata de atributos pré-carregados pelo AccountScenario do Ruby
 * (AccountScenario.rb, linhas 17–20).
 */
export const ACCOUNT_SCENARIO_ATTRS: string[] = ["credits",];

export class AccountScenario extends ScenarioData {
  private buckets: AccountBuckets = { task: 0, resource: 0, material: 0, };

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
  turnover(startIdx: number, endIdx: number,): number {
    // Reset buckets a cada chamada.
    this.buckets = { task: 0, resource: 0, material: 0, };

    let amount = 0.0;

    // 1. Credits (manuais)
    const credits = this.a("credits",) as AccountCredit[];
    if (credits && credits.length > 0) {
      const project =
        (this.property as PropertyLike & { project: ProjectLike }).project;
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
          const childAmount = childAccount.scenarioData(this.scenarioIdx,)
            .turnover(startIdx, endIdx,);
          amount += childAmount;
          // Buckets herdam dos filhos.
          const childBuckets = childAccount.scenarioData(this.scenarioIdx,)
            .getBuckets();
          this.buckets.task += childBuckets.task;
          this.buckets.resource += childBuckets.resource;
          this.buckets.material += childBuckets.material;
        }
      } else {
        // Special case for meta account used to calculate a balance.
        // The first adoptee is the top-level cost account, the second the top-level revenue account.
        const costAmount = -(adoptees[0] as unknown as Account).scenarioData(
          this.scenarioIdx,
        ).turnover(startIdx, endIdx,);
        const revenueAmount = (adoptees[1] as unknown as Account).scenarioData(
          this.scenarioIdx,
        ).turnover(startIdx, endIdx,);
        amount += costAmount + revenueAmount;
        const costBuckets = (adoptees[0] as unknown as Account).scenarioData(
          this.scenarioIdx,
        ).getBuckets();
        const revenueBuckets = (adoptees[1] as unknown as Account).scenarioData(
          this.scenarioIdx,
        ).getBuckets();
        this.buckets.task += -costBuckets.task + revenueBuckets.task;
        this.buckets.resource += -costBuckets.resource +
          revenueBuckets.resource;
        this.buckets.material += -costBuckets.material +
          revenueBuckets.material;
      }
    } else {
      // Leaf: aggregate by type (tasks or resources)
      const aggregate = this.getAccountAttribute("aggregate",) as string;
      const project =
        (this.property as PropertyLike & { project: ProjectLike }).project;

      if (aggregate === "tasks") {
        project.tasks.each((task,) => {
          // Cast to Account to access scenarioData, then to TaskScenario for turnover with 5 args
          const taskAccount = task as unknown as Account;
          const taskScenario = taskAccount.scenarioData(
            this.scenarioIdx,
          ) as unknown as {
            turnover(
              startIdx: number,
              endIdx: number,
              account: unknown,
              resource: unknown,
              includeKids: boolean,
            ): number;
          };
          const taskAmount = taskScenario.turnover(
            startIdx,
            endIdx,
            this.property,
            null,
            false,
          );
          amount += taskAmount;
          this.buckets.task += taskAmount;
        },);
      } else if (aggregate === "resources") {
        project.resources.each((resource,) => {
          if (resource.leaf?.()) {
            const resourceAccount = resource as unknown as Account;
            const resourceScenario = resourceAccount.scenarioData(
              this.scenarioIdx,
            ) as unknown as {
              turnover(
                startIdx: number,
                endIdx: number,
                account: unknown,
                resource: unknown,
                includeKids: boolean,
              ): number;
            };
            const resourceAmount = resourceScenario.turnover(
              startIdx,
              endIdx,
              this.property,
              null,
              false,
            );
            amount += resourceAmount;
            this.buckets.resource += resourceAmount;
          }
        },);
      } else if (aggregate === "materials") {
        // Material aggregation: sum totalCost of all materials.
        project.resources.each?.((material,) => {
          const materialObj = material as unknown as {
            totalCost?: () => number;
          };
          if (typeof materialObj.totalCost === "function") {
            const materialAmount = materialObj.totalCost();
            amount += materialAmount;
            this.buckets.material += materialAmount;
          }
        },);
      } else {
        throw new Error(`Unknown aggregation type ${aggregate}`,);
      }
    }

    // Bloco I: Popula buckets a partir de CostEvents emitidos pelo motor de atribuição
    // Este é o novo comportamento para contas leaf (não container)
    if (!property.container?.()) {
      const project =
        (this.property as PropertyLike & { project: ProjectLike }).project;
      const scIdx = this.scenarioIdx;
      const account = this.property as unknown as Account;

      // Filtrar CostEvents para este cenário e conta (ou seus filhos)
      for (const event of project.costEvents) {
        if (event.scenarioIdx !== scIdx) continue;
        if (!event.account) continue;
        // Verificar se o evento pertence a esta conta ou a um filho
        if (
          event.account === account ||
          (event.account as any).isChildOf?.(account,)
        ) {
          // Classificar por tipo
          switch (event.type) {
            case "task_charge":
              this.buckets.task += event.amount;
              break;
            case "resource_effort":
              this.buckets.resource += event.amount;
              break;
            case "material_usage":
              this.buckets.material += event.amount;
              break;
          }
        }
      }
    }

    return amount;
  }

  /**
   * Retorna os buckets atuais (última chamada de turnover).
   */
  getBuckets(): AccountBuckets {
    return { ...this.buckets, };
  }

  /**
   * Calcula o turnover por tipo (task/resource/material).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb#turnover
   */
  turnoverByType(
    startIdx: number,
    endIdx: number,
    type: "task" | "resource" | "material",
  ): number {
    this.turnover(startIdx, endIdx,);
    switch (type) {
      case "task":
        return this.buckets.task;
      case "resource":
        return this.buckets.resource;
      case "material":
        return this.buckets.material;
      default:
        throw new TjInternalError(`Unknown cost type ${type as string}`,);
    }
  }

  /**
   * Popula um query de balance (startIdx = 0, endIdx = dateToIdx(query.start)).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb#query_balance
   */
  query_balance(query: Query,): void {
    const project =
      (this.property as PropertyLike & { project: ProjectLike }).project;
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
  query_turnover(query: Query,): void {
    const project =
      (this.property as PropertyLike & { project: ProjectLike }).project;
    const startIdx = project.dateToIdx(query.start,);
    const endIdx = project.dateToIdx(query.end,);
    const amount = this.turnover(startIdx, endIdx,);

    query.sortable = amount;
    query.numerical = amount;
    query.string = query.currencyFormat.format(amount,);
  }
}
