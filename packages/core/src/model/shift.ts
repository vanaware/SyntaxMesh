import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { ShiftScenario, } from "./shift-scenario.ts";

/**
 * A shift — a named working-time pattern assigned to resources.
 *
 * Like every model entity it participates in the hierarchy and keeps one
 * {@link ShiftScenario} per scenario, which holds the actual interval list.
 */
export class Shift extends PropertyTreeNode {
  /**
   * Creates a shift and registers it in the project.
   *
   * Every scenario gets its own `ShiftScenario`.
   *
   * @param project Project that owns the shift.
   * @param id Explicit id, or `null` to derive one from the parent path.
   * @param name Human-readable name.
   * @param parent Parent shift, or `null` at the root of the hierarchy.
   */
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

  /**
   * Typed access to the scenario data of this shift.
   *
   * @param scIdx Scenario index.
   * @returns The `ShiftScenario` of that scenario.
   */
  override scenarioData(scIdx: number,): ShiftScenario {
    return this.data[scIdx]! as ShiftScenario;
  }

  /**
   * Ruby `Shift#scenario` (l.43-45): the _scenarioIdx_-th scenario.
   *
   * @param scIdx Scenario index.
   */
  scenario(scIdx: number,): ShiftScenario {
    return this.scenarioData(scIdx,);
  }
}
