import { ScenarioData, } from "./scenario-data.ts";

export class ReportScenario extends ScenarioData {
  constructor(report: unknown, scIdx: number, attributes: Map<string, unknown>,) {
    super(report as any, scIdx, attributes as any,);
  }
}
