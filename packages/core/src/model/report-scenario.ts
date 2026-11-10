import { ScenarioData, } from "./scenario-data.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";

/**
 * Scenario data of a {@link Report}.
 *
 * Reports carry no scheduling state of their own; the class exists so every
 * property tree node has a `ScenarioData` behind it, which is what lets scenario
 * specific attributes (and the `active` flag that enables or disables a report
 * per scenario) be resolved uniformly.
 */
export class ReportScenario extends ScenarioData {
  /**
   * Creates the scenario data of a report.
   *
   * @param report Report that owns this scenario data.
   * @param scIdx Scenario index.
   * @param attributes Attribute dictionary of the owning property set.
   */
  constructor(
    report: unknown,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(report as PropertyLike, scIdx, attributes,);
  }
}
