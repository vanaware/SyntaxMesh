import { TjArgumentError, } from "./tj-time.ts";
import { Interval, } from "./interval.ts";
import { TjTime, } from "./tj-time.ts";

export class TimeInterval extends Interval<TjTime> {
  constructor(...args: unknown[]) {
    // Call super() with default values first to satisfy constructor-super lint rule
    // The actual values will be set in the conditional branches
    super(TjTime.fromSeconds(0,), TjTime.fromSeconds(0,),);

    if (args.length === 1) {
      const arg = args[0];
      if (arg instanceof TimeInterval) {
        this._start = arg.start;
        this._end = arg.end;
      } else if (arg instanceof TjTime) {
        this._start = arg;
        this._end = arg;
      } else {
        throw new TjArgumentError(`Illegal argument 1: ${typeof arg}`,);
      }
    } else if (args.length === 2) {
      const start = args[0];
      const end = args[1];
      if (!(start instanceof TjTime)) {
        throw new TjArgumentError(
          `Interval start must be a date, not a ${typeof start}`,
        );
      }
      if (!(end instanceof TjTime)) {
        throw new TjArgumentError(
          `Interval end must be a date, not a ${typeof end}`,
        );
      }
      this._start = start;
      this._end = end;
    } else {
      throw new TjArgumentError(`Too many arguments: ${args.length}`,);
    }
  }

  override get start(): TjTime {
    return this._start;
  }

  override set start(value: TjTime,) {
    this._start = value;
  }

  override get end(): TjTime {
    return this._end;
  }

  override set end(value: TjTime,) {
    this._end = value;
  }

  duration(): number {
    return this.end.diff(this.start,);
  }

  to_s(): string {
    return `${this.start.to_s()} - ${this.end.to_s()}`;
  }

  static fromSingle(t: TjTime,): TimeInterval {
    return new TimeInterval(t,);
  }

  static fromInterval(iv: Interval<TjTime>,): TimeInterval {
    return new TimeInterval(iv.start, iv.end,);
  }
}
