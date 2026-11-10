/**
 * Charge attribute associated with a task.
 *
 * Represents a cost with a value and a temporal distribution mode.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Charge.rb
 */

import { TjArgumentError, } from "../attributes/errors.ts";
import { TjInternalError, } from "../model/errors.ts";
import { type Task, } from "../model/task.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { TjTime, } from "../time/tj-time.ts";

/**
 * Distribution modes of a `Charge`.
 *
 * Corresponds to Ruby's `Charge#mode` (`:onStart`, `:onEnd`, `:perDiem`).
 */
export type ChargeMode = "onStart" | "onEnd" | "perDiem";

/**
 * Represents a cost associated with a task.
 *
 * Each `Charge` has an amount (`amount`), a distribution mode (`mode`), the
 * owning task (`task`) and the scenario index (`scenarioIdx`).
 *
 * Ruby source: `docs/taskjuggler/lib/taskjuggler/Charge.rb`
 */
export class Charge {
  /** Monetary amount of the charge. */
  readonly amount: number;
  /** How the amount is spread over time. */
  readonly mode: ChargeMode;
  /** Task the charge belongs to. */
  readonly task: Task;
  /** Scenario index the attributes are read from. */
  readonly scenarioIdx: number;

  /**
   * Creates a charge.
   *
   * @param amount Monetary amount of the charge.
   * @param mode Distribution mode of the amount.
   * @param task Task the charge belongs to.
   * @param scenarioIdx Scenario index the attributes are read from.
   * @throws {TjArgumentError} When `mode` is not a supported distribution mode.
   */
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
