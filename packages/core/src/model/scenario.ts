import { type ProjectLike, } from "./project-like.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { PropertySet, } from "./property-set.ts";
import { ScenarioData, } from "./scenario-data.ts";

/**
 * A declared scenario (`scenario <id> "name"`).
 *
 * Scenarios form a tree: a scenario inherits the values of its parent and may
 * override them, which is how `delayed`, `baseline` and similar variants are
 * expressed. The node itself carries no scheduling state; that lives in the
 * `ScenarioData` of each entity, indexed by the scenario position.
 */
export class Scenario extends PropertyTreeNode {
  /**
   * Creates a scenario and registers it in the project.
   *
   * @param project Project that owns the scenario.
   * @param id Scenario id.
   * @param name Human-readable name.
   * @param parent Parent scenario, or `null` for the root scenario.
   */
  constructor(
    project: ProjectLike,
    id: string,
    name: string,
    parent: PropertyTreeNode | null,
  ) {
    super(project.scenarios, id, name, parent,);
  }

  /** The scenario and every scenario derived from it, depth first. */
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
   * Leaves of the scenario subtree.
   *
   * Ruby `PropertyTreeNode#allLeaves`: `withoutSelf` **excludes** the node
   * itself when it is a leaf — same semantics as the base class.
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

  /** State of the scenario itself; scenarios have no per-scenario overrides. */
  override scenarioData(scIdx: number,): ScenarioData {
    return this.data[scIdx]!;
  }
}
