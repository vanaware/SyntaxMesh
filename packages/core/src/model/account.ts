import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { AccountScenario, } from "./account-scenario.ts";

/** Kind of cost an account may accept. */
type CostType = "task" | "resource" | "material";

export type { CostType, };

/**
 * A node of the chart of accounts.
 *
 * Accounts form a hierarchy exactly like tasks and resources, but they do not
 * schedule anything: they exist so every cost and revenue can be booked
 * somewhere. The optional `allowedTypes` filter restricts which kind of cost may
 * be attributed to the account — empty means "accepts everything".
 */
export class Account extends PropertyTreeNode {
  private allowedTypes: Set<CostType> = new Set();

  /**
   * Creates an account and registers it in the project.
   *
   * Every scenario gets its own `AccountScenario`.
   *
   * @param project Project that owns the account.
   * @param id Explicit id, or `null` to derive one from the parent path.
   * @param name Human-readable name.
   * @param parent Parent account, or `null` at the root of the chart.
   */
  constructor(
    project: ProjectLike,
    id: string | null,
    name: string,
    parent: Account | null,
  ) {
    super(project.accounts, id, name, parent,);
    project.addAccount(this,);
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new AccountScenario(
        this,
        i,
        this.getScenarioAttributes(i,),
      );
    }
  }

  /** Account state of the given scenario. */
  override scenarioData(scIdx: number,): AccountScenario {
    return this.data[scIdx]! as AccountScenario;
  }

  /** Whether a cost of that kind may be booked on this account. */
  canAccept(type: CostType,): boolean {
    return this.allowedTypes.size === 0 || this.allowedTypes.has(type,);
  }

  /** Restricts the account to the given kinds of cost. */
  setAllowedTypes(types: CostType[],): void {
    this.allowedTypes = new Set(types,);
  }

  /** Kinds of cost the account accepts; empty means all of them. */
  getAllowedTypes(): CostType[] {
    return Array.from(this.allowedTypes,);
  }
}
