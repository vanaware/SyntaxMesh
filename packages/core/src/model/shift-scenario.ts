import { ScenarioData, } from "./scenario-data.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type TjTime, } from "../time/tj-time.ts";
import { LeaveListAttribute, } from "../attributes/time-interval/leave-list-attribute.ts";
import { WorkingHours, } from "../calendar/working-hours.ts";
import { type PropertyTreeNode, } from "./property-tree-node.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";

/**
 * Scenario data of a {@link Shift}.
 *
 * Holds the working-hours definition, the `replace` flag and the leaves that
 * belong to the shift in one scenario. The properties it reads are preloaded in
 * the constructor so the accessors below stay allocation-free.
 */
export class ShiftScenario extends ScenarioData {
  /**
   * Creates the scenario data of a shift.
   *
   * @param shift Shift that owns this scenario data.
   * @param scIdx Scenario index.
   * @param attributes Attribute dictionary of the owning property set.
   */
  constructor(
    shift: unknown,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(shift as PropertyLike, scIdx, attributes,);
    this.preloadAttributes(["workinghours", "replace", "leaves",],);
  }

  /**
   * Project of the scenario.
   *
   * Public accessor that avoids reaching into the private `property` of
   * `ScenarioData`.
   */
  get project(): ProjectLike {
    return (this.getProperty() as PropertyTreeNode).project;
  }

  /**
   * Scenario index.
   *
   * Public accessor that avoids reaching into the private field of
   * `ScenarioData`.
   */
  get scenarioIndex(): number {
    return this.getScenarioIdx();
  }

  /**
   * Whether the shift has working time defined for the date.
   *
   * A shift without `workinghours` counts as on-shift all the time.
   *
   * @param date Date to test.
   * @see docs/taskjuggler/lib/taskjuggler/ShiftScenario.rb:onShift?
   */
  onShift(date: TjTime,): boolean {
    const wh = this.a("workinghours",);
    if (!wh) {
      return true;
    }
    return (wh as WorkingHours).onShift(date,);
  }

  /**
   * Whether the shift is a replacement day.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ShiftScenario.rb:replace?
   */
  replace(): boolean {
    return this.a("replace",) as boolean;
  }

  /**
   * Whether the shift has a leave covering the date.
   *
   * @param date Date to test.
   * @see docs/taskjuggler/lib/taskjuggler/ShiftScenario.rb:onLeave?
   */
  onLeave(date: TjTime,): boolean {
    const leaves = this.a("leaves",) as Iterable<
      { interval: { contains(d: TjTime,): boolean } }
    >;
    if (!leaves) {
      return false;
    }
    for (const leave of leaves) {
      if (leave.interval.contains(date,)) {
        return true;
      }
    }
    return false;
  }
}
