import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { TaskScenario, } from "./task-scenario.ts";

export class Task extends PropertyTreeNode {
  constructor(
    project: ProjectLike,
    id: string | null,
    name: string,
    parent: Task | null,
  ) {
    super(project.tasks, id, name, parent,);
    project.addTask(this,);
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new TaskScenario(this, i, this.getScenarioAttributes(i,),);
    }
  }

  override scenarioData(scIdx: number,): TaskScenario {
    return this.data[scIdx]! as TaskScenario;
  }
}
