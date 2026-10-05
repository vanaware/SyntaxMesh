import { ScenarioData, } from "./scenario-data.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type TjTime, } from "../time/tj-time.ts";
import { LeaveListAttribute, } from "../attributes/time-interval/leave-list-attribute.ts";

export class ShiftScenario extends ScenarioData {
  constructor(shift: any, scIdx: number, attributes: Map<string, any>) {
    super(shift, scIdx, attributes);
  }

  /** Acesso público ao project do cenário (evita acessar `property` privado de ScenarioData). */
  get project(): ProjectLike {
    return (this.getProperty() as any).project;
  }

  /** Acesso público ao scenarioIdx (evita acessar o campo privado de ScenarioData). */
  get scenarioIndex(): number {
    return this.getScenarioIdx();
  }

  /**
   * Retorna true se o shift tem tempo de trabalho definido para a data.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ShiftScenario.rb:onShift?
   */
  onShift(date: TjTime): boolean {
    const wh = this.a("workinghours");
    if (!wh) {
      return true;
    }
    return (wh as any).onShift(date);
  }

  /**
   * Retorna true se o shift é um dia de substituição.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ShiftScenario.rb:replace?
   */
  replace(): boolean {
    return this.a("replace") as boolean;
  }

  /**
   * Retorna true se o shift tem férias definidas para a data.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ShiftScenario.rb:onLeave?
   */
  onLeave(date: TjTime): boolean {
    const leaves = this.a("leaves") as Iterable<{ interval: { contains(d: TjTime): boolean } }>;
    if (!leaves) {
      return false;
    }
    for (const leave of leaves) {
      if (leave.interval.contains(date)) {
        return true;
      }
    }
    return false;
  }
}