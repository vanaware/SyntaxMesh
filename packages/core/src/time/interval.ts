import { TjArgumentError, } from "./tj-time.ts";
import { TjTime, } from "./tj-time.ts";

// Type constraint for comparable values
export type Comparable = number | Date | TjTime;

export class Interval<T extends Comparable,> {
  protected _start: T;
  protected _end: T;

  get start(): T {
    return this._start;
  }

  get end(): T {
    return this._end;
  }

  constructor(start: T, end: T,) {
    if (this._lt(end, start,)) {
      throw new TjArgumentError(`Invalid interval (${start} - ${end})`,);
    }
    this._start = start;
    this._end = end;
  }

  /**
   * Check if interval contains another interval or value
   * @param arg - Interval or value to check
   * @returns true if contained
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
   * Check if interval overlaps with another interval or value
   * @param arg - Interval or value to check
   * @returns true if overlaps
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
   * Get intersection of two intervals
   * @param other - Other interval
   * @returns Intersection interval or null if no overlap
   */
  intersection(other: Interval<T>,): Interval<T> | null {
    const newStart = this._gt(this.start, other.start) ? this.start : other.start;
    const newEnd = this._lt(this.end, other.end) ? this.end : other.end;
    if (!this._lt(newStart, newEnd,)) {
      return null;
    }
    return new Interval(newStart, newEnd,);
  }

  /**
   * Combine intervals.
   *
   * RUBY-COMPAT-FIX (task 5.7.R.1 / 5.7.R.2): the original Ruby
   * implementation returns an Array with a single Interval element.
   * This is a Category A bug — it is always fixed regardless of
   * compat.keepRubyBugs because the return type must be Interval.
   *
   * @param iv - Other interval
   * @returns Combined interval
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
   * Compare intervals
   * @param iv - Other interval
   * @returns -1 if end < iv.start, 1 if iv.end < start, 0 if overlaps
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
   * Check if intervals are equal
   * @param iv - Other interval
   * @returns true if same class and start/end
   */
  equals(iv: Interval<T>,): boolean {
    return this._equals(this.start, iv.start,) &&
      this._equals(this.end, iv.end,);
  }

  /**
   * Check if another object is an Interval
   * @param arg - Object to check
   * @returns true if Interval
   */
  static isInterval<T extends Comparable,>(arg: unknown,): arg is Interval<T> {
    return arg instanceof Interval;
  }

  /**
   * Private method to check class mismatch
   * @param arg - Object to check
   * @throws TjArgumentError if class mismatch
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
   */
  private _lt(a: T, b: T,): boolean {
    if (a instanceof TjTime) {
      return a.lessThan(b as TjTime,);
    }
    return a < b;
  }

  /**
   * Less-than-or-equal comparison that works for number, Date and TjTime.
   */
  private _lte(a: T, b: T,): boolean {
    if (a instanceof TjTime) {
      return a.lessThanOrEqual(b as TjTime,);
    }
    return a <= b;
  }

  /**
   * Greater-than comparison that works for number, Date and TjTime.
   */
  private _gt(a: T, b: T,): boolean {
    if (a instanceof TjTime) {
      return a.greaterThan(b as TjTime,);
    }
    return a > b;
  }

  /**
   * Equality comparison that works for number, Date and TjTime.
   */
  private _equals(a: T, b: T,): boolean {
    if (a instanceof TjTime) {
      return a.equals(b as TjTime,);
    }
    return a === b;
  }
}