import { TjArgumentError, } from "./tj-time.ts";
import { Interval, } from "./interval.ts";
import { TjTime, } from "./tj-time.ts";

/**
 * ScoreboardInterval — interval expressed as slot indices over a scoreboard
 * that starts at `sbStart` and uses slots of `slotDuration` seconds.
 *
 * Port of `ScoreboardInterval.rb`. `start` and `end` are indices; the setters
 * accept a `TjTime` as well and convert it to the matching index.
 */
export class ScoreboardInterval extends Interval<number> {
  /** Date of slot 0. */
  readonly sbStart: TjTime;
  /** Length of one slot, in seconds. */
  readonly slotDuration: number;

  /**
   * Creates the interval from another one, a start, or a start and an end.
   *
   * Accepted argument lists: `(other)`, `(sbStart, slotDuration, start)` and
   * `(sbStart, slotDuration, start, end)`; `start` and `end` may be slot
   * indices or `TjTime` values.
   *
   * @param args Arguments as described above.
   * @throws TjArgumentError When the arguments do not match those forms.
   */
  constructor(...args: unknown[]) {
    // super() is called with defaults first to satisfy the constructor-super
    // lint rule; the real values are assigned in the branches below.
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
      // Converts TjTime to an index when needed
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
      // Converts TjTime to an index when needed
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

  /**
   * Start of the interval, as a slot index.
   *
   * @returns The start index.
   */
  override get start(): number {
    return this._start;
  }

  /**
   * Sets the start from a slot index or a date.
   *
   * @param value Start index, or the date that maps to it.
   */
  // @ts-expect-error: setter widens base type number to number | TjTime (required by spec 5.9.6)
  set start(value: number | TjTime,) {
    if (value instanceof TjTime) {
      this._start = Math.trunc(value.diff(this.sbStart,) / this.slotDuration,);
    } else {
      this._start = value;
    }
  }

  /**
   * End of the interval, as a slot index.
   *
   * @returns The end index.
   */
  override get end(): number {
    return this._end;
  }

  /**
   * Sets the end from a slot index or a date.
   *
   * @param value End index, or the date that maps to it.
   */
  // @ts-expect-error: setter widens base type number to number | TjTime (required by spec 5.9.6)
  set end(value: number | TjTime,) {
    if (value instanceof TjTime) {
      this._end = Math.trunc(value.diff(this.sbStart,) / this.slotDuration,);
    } else {
      this._end = value;
    }
  }

  /**
   * Date of the start slot.
   *
   * @returns The start date.
   */
  startDate(): TjTime {
    return this.sbStart.addSeconds(this.start * this.slotDuration,);
  }

  /**
   * Date of the end slot.
   *
   * @returns The end date.
   */
  endDate(): TjTime {
    return this.sbStart.addSeconds(this.end * this.slotDuration,);
  }

  /**
   * Length of the interval.
   *
   * @returns The duration in seconds.
   */
  duration(): number {
    return (this.end - this.start) * this.slotDuration;
  }

  /**
   * Slot index of a date.
   *
   * @param date Date to locate.
   * @returns The matching slot index.
   */
  dateToIndex(date: TjTime,): number {
    return Math.trunc(date.diff(this.sbStart,) / this.slotDuration,);
  }

  /**
   * Date of a slot index.
   *
   * @param idx Slot index.
   * @returns The matching date.
   */
  indexToDate(idx: number,): TjTime {
    return this.sbStart.addSeconds(idx * this.slotDuration,);
  }

  /**
   * Renders the interval as `start - end`.
   *
   * @returns The textual range of dates.
   */
  to_s(): string {
    return this.indexToDate(this.start,).to_s() + " - " +
      this.indexToDate(this.end,).to_s();
  }
}
