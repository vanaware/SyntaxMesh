/**
 * Atributo de cobrança (charge) associado a uma tarefa.
 *
 * Representa um custo com valor e modo de distribuição temporal.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Charge.rb
 */

import { TjArgumentError, } from "../attributes/errors.ts";
import { TjInternalError, } from "../model/errors.ts";
import { type Task, } from "../model/task.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { TjTime, } from "../time/tj-time.ts";

/**
 * Modos de distribuição de um Charge.
 *
 * Corresponde ao Ruby `Charge#mode` (:onStart, :onEnd, :perDiem).
 */
export type ChargeMode = "onStart" | "onEnd" | "perDiem";

/**
 * Representa um custo associado a uma tarefa.
 *
 * Cada Charge tem um valor (`amount`), um modo de distribuição (`mode`),
 * a tarefa dona (`task`) e o índice de cenário (`scenarioIdx`).
 *
 * Fonte Ruby: `docs/taskjuggler/lib/taskjuggler/Charge.rb`
 */
export class Charge {
  readonly amount: number;
  readonly mode: ChargeMode;
  readonly task: Task;
  readonly scenarioIdx: number;

  constructor(
    amount: number,
    mode: ChargeMode,
    task: Task,
    scenarioIdx: number,
  ) {
    if (!["onStart", "onEnd", "perDiem",].includes(mode,)) {
      throw new TjArgumentError(`Unsupported mode ${mode}`,);
    }
    this.amount = amount;
    this.mode = mode;
    this.task = task;
    this.scenarioIdx = scenarioIdx;
  }

  /**
   * Compute the total charge for the TimeInterval described by _period_.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Charge.rb#turnover
   */
  turnover(period: TimeInterval,): number {
    switch (this.mode) {
      case "onStart": {
        const start = this.task.getForScenario("start", this.scenarioIdx,) as
          | null
          | TjTime;
        if (start === null) {
          return 0.0;
        }
        return period.contains(start,) ? this.amount : 0.0;
      }
      case "onEnd": {
        const end = this.task.getForScenario("end", this.scenarioIdx,) as
          | null
          | TjTime;
        if (end === null) {
          return 0.0;
        }
        return period.contains(end,) ? this.amount : 0.0;
      }
      case "perDiem": {
        const start = this.task.getForScenario("start", this.scenarioIdx,) as
          | null
          | TjTime;
        const end = this.task.getForScenario("end", this.scenarioIdx,) as
          | null
          | TjTime;
        if (start === null || end === null) {
          return 0.0;
        }
        const iv = period.intersection(new TimeInterval(start, end,),);
        if (iv === null) {
          return 0.0;
        }
        return (iv.end.diff(iv.start,) / (60 * 60 * 24)) * this.amount;
      }
      default: {
        // TypeScript exhaustive check: this branch is unreachable.
        const _exhaustive: never = this.mode;
        throw new TjInternalError(
          `Unsupported mode ${(this as unknown as { mode: string }).mode}`,
        );
      }
    }
  }

  /**
   * Dump object in human readable form.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Charge.rb#to_s
   */
  to_s(): string {
    switch (this.mode) {
      case "onStart":
        return `${this.amount} on start`;
      case "onEnd":
        return `${this.amount} on end`;
      case "perDiem":
        return `${this.amount} per day`;
      default: {
        const _exhaustive: never = this.mode;
        return `${this.amount} unknown`;
      }
    }
  }
}
