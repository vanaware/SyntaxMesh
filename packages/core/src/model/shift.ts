import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { ShiftScenario, } from "./shift-scenario.ts";

export class Shift extends PropertyTreeNode {
  constructor(
    project: ProjectLike,
    id: string | null,
    name: string | null,
    parent: Shift | null,
  ) {
    super(project.shifts, id, name, parent,);
    project.addShift(this);
    this.data = Array.from({ length: project.scenarioCount }, () => null as any);
    for (let i = 0; i < project.scenarioCount; i++) {
      new ShiftScenario(this, i, this.getScenarioAttributes(i));
    }
  }

  override scenarioData(scIdx: number): ShiftScenario {
    return this.data[scIdx]!;
  }
}