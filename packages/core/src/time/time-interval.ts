import { TjArgumentError, } from "./tj-time.ts";
import { Interval, } from "./interval.ts";
import { TjTime, } from "./tj-time.ts";

/**
 * TimeInterval — interval between two `TjTime` values.
 *
 * Port of `TimeInterval.rb`. A single date degenerates into an interval that
 * starts and ends at that date.
 */
export class TimeInterval extends Interval<TjTime> {
  /**
   * Creates the interval from another interval or from one or two dates.
   *
   * @param args `(other)`, `(date)` or `(start, end)`.
   * @throws TjArgumentError When the arguments do not match those forms.
   */
  constructor(...args: unknown[]) {
    // super() is called with defaults first to satisfy the constructor-super
    // lint rule; the real values are assigned in the branches below.
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

  /**
   * Start of the interval.
   *
   * @returns The start date.
   */
  override get start(): TjTime {
    return this._start;
  }

  /**
   * Sets the start date.
   *
   * @param value New start date.
   */
  override set start(value: TjTime,) {
    this._start = value;
  }

  /**
   * End of the interval.
   *
   * @returns The end date.
   */
  override get end(): TjTime {
    return this._end;
  }

  /**
   * Sets the end date.
   *
   * @param value New end date.
   */
  override set end(value: TjTime,) {
    this._end = value;
  }

  /**
   * Length of the interval.
   *
   * @returns The duration in seconds.
   */
  duration(): number {
    return this.end.diff(this.start,);
  }

  /**
   * Renders the interval as `start - end`.
   *
   * @returns The textual range of dates.
   */
  to_s(): string {
    return `${this.start.to_s()} - ${this.end.to_s()}`;
  }

  /**
   * Builds a degenerate interval from a single date.
   *
   * @param t The only date of the interval.
   * @returns The degenerate interval.
   */
  static fromSingle(t: TjTime,): TimeInterval {
    return new TimeInterval(t,);
  }

  /**
   * Builds a `TimeInterval` from any interval of `TjTime` values.
   *
   * @param iv Interval to convert.
   * @returns The equivalent `TimeInterval`.
   */
  static fromInterval(iv: Interval<TjTime>,): TimeInterval {
    return new TimeInterval(iv.start, iv.end,);
  }
}
