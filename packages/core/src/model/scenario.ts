import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { PropertySet, } from "./property-set.ts";
import { ScenarioData, } from "./scenario-data.ts";

export class Scenario extends PropertyTreeNode {
  constructor(
    project: ProjectLike,
    id: string,
    name: string,
    parent: PropertyTreeNode | null,
  ) {
    super(project.scenarios, id, name, parent,);
  }

  override all(): Scenario[] {
    const result: Scenario[] = [this,];
    this.kids().forEach((child,) => {
      if (child instanceof Scenario) {
        result.push(...child.all(),);
      }
    },);
    return result;
  }

  /**
   * Ruby PropertyTreeNode#allLeaves (l.275-285): `withoutSelf` EXCLUI o
   * próprio nó quando ele é folha — mesma semântica da classe base.
   */
  override allLeaves(withoutSelf: boolean = false,): Scenario[] {
    const result: Scenario[] = [];
    if (this.leaf()) {
      if (!withoutSelf) {
        result.push(this,);
      }
    } else {
      this.kids().forEach((child,) => {
        if (child instanceof Scenario) {
          result.push(...child.allLeaves(),);
        }
      },);
    }
    return result;
  }

  override scenarioData(scIdx: number,): ScenarioData {
    return this.data[scIdx]!;
  }
}
