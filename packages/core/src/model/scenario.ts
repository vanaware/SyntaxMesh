import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { PropertySet, } from "./property-set.ts";

export class Scenario extends PropertyTreeNode {
  constructor(
    project: ProjectLike,
    id: string,
    name: string,
    parent: PropertyTreeNode | null,
  ) {
    const propertySet = new PropertySet(project, false);
    super(propertySet, id, name, parent,);
    project.addScenario(this,);
  }

  override all(): Scenario[] {
    const result: Scenario[] = [this,];
    this.kids().forEach(child => {
      if (child instanceof Scenario) {
        result.push(...child.all(),);
      }
    });
    return result;
  }

  override allLeaves(includeSelf: boolean = false): Scenario[] {
    const result: Scenario[] = [];
    if (this.leaf()) {
      if (includeSelf) {
        result.push(this,);
      }
    } else {
      this.kids().forEach(child => {
        if (child instanceof Scenario) {
          result.push(...child.allLeaves(),);
        }
      });
    }
    return result;
  }
}