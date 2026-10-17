import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { AccountScenario, } from "./account-scenario.ts";

type CostType = 'task' | 'resource' | 'material';

export class Account extends PropertyTreeNode {
  private allowedTypes: Set<CostType> = new Set();

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

  override scenarioData(scIdx: number,): AccountScenario {
    return this.data[scIdx]! as AccountScenario;
  }

  canAccept(type: CostType): boolean {
    return this.allowedTypes.size === 0 || this.allowedTypes.has(type);
  }

  setAllowedTypes(types: CostType[]): void {
    this.allowedTypes = new Set(types);
  }

  getAllowedTypes(): CostType[] {
    return Array.from(this.allowedTypes);
  }
}
