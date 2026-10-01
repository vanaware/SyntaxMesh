import { ScenarioData, } from "./scenario-data.ts";

/**
 * Lista exata de atributos pré-carregados pelo ResourceScenario do Ruby
 * (ResourceScenario.rb, linhas 42–56).
 */
export const RESOURCE_SCENARIO_ATTRS: string[] = [
  "alloctdeffort",
  "chargeset",
  "criticalness",
  "directreports",
  "duties",
  "efficiency",
  "effort",
  "limits",
  "managers",
  "rate",
  "reports",
  "shifts",
  "leaves",
  "leaveallowances",
  "workinghours",
];

export class ResourceScenario extends ScenarioData {
  constructor(resource: any, scIdx: number, attributes: Map<string, any>) {
    super(resource, scIdx, attributes);
    this.preloadAttributes(RESOURCE_SCENARIO_ATTRS);
  }
}