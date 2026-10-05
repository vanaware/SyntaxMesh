import { ScenarioData, } from "./scenario-data.ts";
import { ShiftAssignments, } from "../scheduling/shift-assignments.ts";
import { WorkingHours, } from "../calendar/working-hours.ts";

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

  /**
   * Retorna true se o recurso está disponível no slot do scoreboard especificado.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:onShift?
   */
  onShift(sbIdx: number): boolean {
    const shifts = this.a("shifts") as ShiftAssignments | null;
    if (shifts && shifts.assigned(sbIdx)) {
      return shifts.onShift(sbIdx);
    } else {
      const workinghours = this.a("workinghours") as WorkingHours | null;
      if (!workinghours) {
        return true;
      }
      return workinghours.onShift(sbIdx);
    }
  }
}