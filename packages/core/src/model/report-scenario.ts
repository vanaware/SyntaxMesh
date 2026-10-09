import { ScenarioData, } from "./scenario-data.ts";
import { type PropertyLike, } from "./property-like.ts";

export class ReportScenario extends ScenarioData {
  constructor(
    report: unknown,
    scIdx: number,
    attributes: Map<string, unknown>,
  ) {
    super(
      report as PropertyLike,
      scIdx,
      attributes as Map<string, unknown>,
    );
  }
}
