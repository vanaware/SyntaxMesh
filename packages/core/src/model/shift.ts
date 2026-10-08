import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { ShiftScenario, } from "./shift-scenario.ts";

export class Shift extends PropertyTreeNode {
  constructor(
    project: ProjectLike,
    id: string | null,
    name: string,
    parent: Shift | null,
  ) {
    super(project.shifts, id, name, parent,);
    project.addShift(this,);
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new ShiftScenario(
        this,
        i,
        this.getScenarioAttributes(i,),
      );
    }
  }

  override scenarioData(scIdx: number,): ShiftScenario {
    return this.data[scIdx]! as ShiftScenario;
  }
}
