import { ScenarioData, } from "./scenario-data.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";

export class ReportScenario extends ScenarioData {
  constructor(
    report: unknown,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(report as PropertyLike, scIdx, attributes,);
  }
}
