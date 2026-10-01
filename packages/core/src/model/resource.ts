import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { ResourceScenario, } from "./resource-scenario.ts";

export class Resource extends PropertyTreeNode {
  constructor(
    project: ProjectLike,
    id: string | null,
    name: string | null,
    parent: Resource | null,
  ) {
    super(project.resources, id, name, parent,);
    project.addResource(this);
    this.data = Array.from({ length: project.scenarioCount }, () => null as any);
    for (let i = 0; i < project.scenarioCount; i++) {
      new ResourceScenario(this, i, this.getScenarioAttributes(i));
    }
  }

  override scenarioData(scIdx: number): ResourceScenario {
    return this.data[scIdx]!;
  }
}