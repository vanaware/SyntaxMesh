import { ScenarioData, } from "./scenario-data.ts";

/**
 * Lista exata de atributos pré-carregados pelo TaskScenario do Ruby
 * (TaskScenario.rb, linhas 28–36).
 */
export const TASK_SCENARIO_ATTRS: string[] = [
  "allocate",
  "assignedresources",
  "booking",
  "charge",
  "chargeset",
  "complete",
  "competitors",
  "criticalness",
  "depends",
  "duration",
  "effort",
  "effortdone",
  "effortleft",
  "end",
  "forward",
  "gauge",
  "length",
  "maxend",
  "maxstart",
  "minend",
  "minstart",
  "milestone",
  "pathcriticalness",
  "precedes",
  "priority",
  "projectionmode",
  "responsible",
  "scheduled",
  "shifts",
  "start",
  "status",
];

export class TaskScenario extends ScenarioData {
  constructor(task: any, scIdx: number, attributes: Map<string, any>) {
    super(task, scIdx, attributes);
    this.preloadAttributes(TASK_SCENARIO_ATTRS);
  }
}