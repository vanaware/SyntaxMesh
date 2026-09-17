import { TjArgumentError, } from "./tj-time.ts";
import { Interval, } from "./interval.ts";
import { TjTime, } from "./tj-time.ts";

export class ScoreboardInterval extends Interval<number> {
  readonly sbStart: TjTime;
  readonly slotDuration: number;

  constructor(...args: unknown[]) {
    // Call super() with default values first to satisfy constructor-super lint rule
    // The actual values will be set in the conditional branches
    super(0, 0,);

    if (args.length === 1) {
      const arg = args[0];
      if (arg instanceof ScoreboardInterval) {
        this._start = arg.start;
        this._end = arg.end;
        this.sbStart = arg.sbStart;
        this.slotDuration = arg.slotDuration;
      } else {
        throw new TjArgumentError(`Illegal argument 1: ${typeof arg}`,);
      }
    } else if (args.length === 3) {
      const sbStart = args[0];
      const slotDuration = args[1];
      let start = args[2];
      if (!(sbStart instanceof TjTime)) {
        throw new TjArgumentError(
          `sbStart must be a date, not a ${typeof sbStart}`,
        );
      }
      if (
        typeof slotDuration !== "number" || !Number.isInteger(slotDuration,)
      ) {
        throw new TjArgumentError(
          `slotDuration must be an integer, not a ${typeof slotDuration}`,
        );
      }
      // Convert TjTime to index if needed
      if (start instanceof TjTime) {
        start = Math.trunc(start.diff(sbStart,) / slotDuration,);
      }
      if (typeof start !== "number" || !Number.isInteger(start,)) {
        throw new TjArgumentError(
          `start must be an integer or TjTime, not ${typeof start}`,
        );
      }
      this._start = start;
      this._end = start;
      this.sbStart = sbStart;
      this.slotDuration = slotDuration;
    } else if (args.length === 4) {
      const sbStart = args[0];
      const slotDuration = args[1];
      let start = args[2];
      let end = args[3];
      if (!(sbStart instanceof TjTime)) {
        throw new TjArgumentError(
          `sbStart must be a date, not a ${typeof sbStart}`,
        );
      }
      if (
        typeof slotDuration !== "number" || !Number.isInteger(slotDuration,)
      ) {
        throw new TjArgumentError(
          `slotDuration must be an integer, not a ${typeof slotDuration}`,
        );
      }
      // Convert TjTime to index if needed
      if (start instanceof TjTime) {
        start = Math.trunc(start.diff(sbStart,) / slotDuration,);
      }
      if (end instanceof TjTime) {
        end = Math.trunc(end.diff(sbStart,) / slotDuration,);
      }
      if (typeof start !== "number" || !Number.isInteger(start,)) {
        throw new TjArgumentError(
          `start must be an integer or TjTime, not ${typeof start}`,
        );
      }
      if (typeof end !== "number" || !Number.isInteger(end,)) {
        throw new TjArgumentError(
          `end must be an integer or TjTime, not ${typeof end}`,
        );
      }
      this._start = start;
      this._end = end;
      this.sbStart = sbStart;
      this.slotDuration = slotDuration;
    } else {
      throw new TjArgumentError(`Too many arguments: ${args.length}`,);
    }
  }

  override get start(): number {
    return this._start;
  }

  // @ts-expect-error: setter widens base type number to number | TjTime (required by spec 5.9.6)
  set start(value: number | TjTime,) {
    if (value instanceof TjTime) {
      this._start = Math.trunc(value.diff(this.sbStart,) / this.slotDuration,);
    } else {
      this._start = value;
    }
  }

  override get end(): number {
    return this._end;
  }

  // @ts-expect-error: setter widens base type number to number | TjTime (required by spec 5.9.6)
  set end(value: number | TjTime,) {
    if (value instanceof TjTime) {
      this._end = Math.trunc(value.diff(this.sbStart,) / this.slotDuration,);
    } else {
      this._end = value;
    }
  }

  startDate(): TjTime {
    return this.sbStart.addSeconds(this.start * this.slotDuration,);
  }

  endDate(): TjTime {
    return this.sbStart.addSeconds(this.end * this.slotDuration,);
  }

  duration(): number {
    return (this.end - this.start) * this.slotDuration;
  }

  dateToIndex(date: TjTime,): number {
    return Math.trunc(date.diff(this.sbStart,) / this.slotDuration,);
  }

  indexToDate(idx: number,): TjTime {
    return this.sbStart.addSeconds(idx * this.slotDuration,);
  }

  to_s(): string {
    return this.indexToDate(this.start,).to_s() + " - " +
      this.indexToDate(this.end,).to_s();
  }
}
