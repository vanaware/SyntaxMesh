import { TjArgumentError, } from "./tj-time.ts";
import { TjTime, } from "./tj-time.ts";

/** Values an {@link Interval} can hold. */
export type Comparable = number | Date | TjTime;

/**
 * Interval — closed-open range `[start, end)` of comparable values.
 *
 * Port of `Interval.rb`. Subclasses may override the start/end accessors (see
 * {@link ScoreboardInterval}, which works on slot indices).
 */
export class Interval<T extends Comparable,> {
  /** First value of the range. */
  protected _start: T;
  /** Value that closes the range (exclusive). */
  protected _end: T;

  /**
   * First value of the range.
   *
   * @returns The start value.
   */
  get start(): T {
    return this._start;
  }

  /**
   * Value that closes the range (exclusive).
   *
   * @returns The end value.
   */
  get end(): T {
    return this._end;
  }

  /**
   * Creates the interval.
   *
   * @param start First value of the range.
   * @param end Value that closes the range (exclusive).
   * @throws TjArgumentError When `end` is lower than `start`.
   */
  constructor(start: T, end: T,) {
    if (this._lt(end, start,)) {
      throw new TjArgumentError(`Invalid interval (${start} - ${end})`,);
    }
    this._start = start;
    this._end = end;
  }

  /**
   * Tells whether the interval contains another interval or a value.
   *
   * @param arg Interval or value to test.
   * @returns `true` when `arg` lies inside the interval.
   */
  contains(arg: T | Interval<T>,): boolean {
    this.checkClass(arg,);
    if (arg instanceof Interval) {
      return this._lte(this.start, arg.start,) && this._lt(arg.end, this.end,);
    } else {
      return this._lte(this.start, arg,) && this._lt(arg, this.end,);
    }
  }

  /**
   * Tells whether the interval overlaps another interval or contains a value.
   *
   * @param arg Interval or value to test.
   * @returns `true` when `arg` overlaps the interval.
   */
  overlaps(arg: T | Interval<T>,): boolean {
    this.checkClass(arg,);
    if (arg instanceof Interval) {
      return this._lt(this.start, arg.end,) && this._lt(arg.start, this.end,);
    } else {
      return this.contains(arg,);
    }
  }

  /**
   * Intersection of two intervals.
   *
   * @param other Interval to intersect with.
   * @returns The intersection, or `null` when they do not overlap.
   */
  intersection(other: Interval<T>,): Interval<T> | null {
    const newStart = this._gt(this.start, other.start,)
      ? this.start
      : other.start;
    const newEnd = this._lt(this.end, other.end,) ? this.end : other.end;
    if (!this._lt(newStart, newEnd,)) {
      return null;
    }
    return new Interval(newStart, newEnd,);
  }

  /**
   * Combines two touching intervals.
   *
   * RUBY-COMPAT-FIX (task 5.7.R.1 / 5.7.R.2): the original Ruby implementation
   * returns an Array with a single Interval element. This is a Category A bug —
   * it is always fixed regardless of `compat.keepRubyBugs`, because the return
   * type must be an Interval.
   *
   * @param iv Interval to combine with.
   * @returns The merged interval, or this one when they do not touch.
   */
  combine(iv: Interval<T>,): Interval<T> {
    if (this._equals(iv.end, this.start,)) {
      return new Interval(iv.start, this.end,);
    }
    if (this._equals(this.end, iv.start,)) {
      return new Interval(this.start, iv.end,);
    }
    return this;
  }

  /**
   * Orders two intervals by their coverage.
   *
   * @param iv Interval to compare with.
   * @returns `-1` when this interval ends before `iv` starts, `1` when `iv`
   *   ends before this one starts, and `0` when they overlap.
   */
  compareTo(iv: Interval<T>,): -1 | 0 | 1 {
    if (this._lt(this.end, iv.start,)) {
      return -1;
    }
    if (this._lt(iv.end, this.start,)) {
      return 1;
    }
    return 0;
  }

  /**
   * Tells whether two intervals have the same bounds.
   *
   * @param iv Interval to compare with.
   * @returns `true` when start and end are equal.
   */
  equals(iv: Interval<T>,): boolean {
    return this._equals(this.start, iv.start,) &&
      this._equals(this.end, iv.end,);
  }

  /**
   * Narrows a value to an {@link Interval}.
   *
   * @param arg Value to test.
   * @returns `true` when `arg` is an `Interval`.
   */
  static isInterval<T extends Comparable,>(arg: unknown,): arg is Interval<T> {
    return arg instanceof Interval;
  }

  /**
   * Rejects values whose class does not match the interval.
   *
   * @param arg Value to test.
   * @throws TjArgumentError When the class does not match.
   */
  private checkClass(arg: unknown,): void {
    if (arg instanceof Interval) {
      if (this.constructor !== arg.constructor) {
        throw new TjArgumentError("Class mismatch",);
      }
    } else if (
      typeof arg !== "number" && !(arg instanceof Date) &&
      !(arg instanceof TjTime)
    ) {
      throw new TjArgumentError("Class mismatch",);
    }
  }

  /**
   * Less-than comparison that works for number, Date and TjTime.
   *
   * @param a Left value.
   * @param b Right value.
   * @returns `true` when `a` is lower than `b`.
   */
  private _lt(a: T, b: T,): boolean {
    if (a instanceof TjTime) {
      return a.lessThan(b as TjTime,);
    }
    return a < b;
  }

  /**
   * Less-than-or-equal comparison that works for number, Date and TjTime.
   *
   * @param a Left value.
   * @param b Right value.
   * @returns `true` when `a` is lower than or equal to `b`.
   */
  private _lte(a: T, b: T,): boolean {
    if (a instanceof TjTime) {
      return a.lessThanOrEqual(b as TjTime,);
    }
    return a <= b;
  }

  /**
   * Greater-than comparison that works for number, Date and TjTime.
   *
   * @param a Left value.
   * @param b Right value.
   * @returns `true` when `a` is greater than `b`.
   */
  private _gt(a: T, b: T,): boolean {
    if (a instanceof TjTime) {
      return a.greaterThan(b as TjTime,);
    }
    return a > b;
  }

  /**
   * Equality comparison that works for number, Date and TjTime.
   *
   * @param a Left value.
   * @param b Right value.
   * @returns `true` when the values are equal.
   */
  private _equals(a: T, b: T,): boolean {
    if (a instanceof TjTime) {
      return a.equals(b as TjTime,);
    }
    return a === b;
  }
}
