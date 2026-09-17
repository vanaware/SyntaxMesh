import { TjArgumentError, TjTime, } from "./tj-time.ts";

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
    if (end < start) {
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
      return this.start <= arg.start && arg.end <= this.end;
    } else {
      return this.start <= arg && arg < this.end;
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
      return this.start <= arg.start && arg.start < this.end ||
        arg.start <= this.start && this.start < arg.end;
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
    const newStart = this.start > other.start ? this.start : other.start;
    const newEnd = this.end < other.end ? this.end : other.end;
    if (newStart >= newEnd) {
      return null;
    }
    return new Interval(newStart, newEnd,);
  }

  /**
   * Combine intervals (returns array with 1 element - Ruby bug)
   * @param iv - Other interval
   * @returns Array containing combined interval
   */
  combine(iv: Interval<T>,): Interval<T>[] {
    if (iv.end === this.start) {
      return [new Interval(iv.start, this.end,),];
    }
    if (this.end === iv.start) {
      return [new Interval(this.start, iv.end,),];
    }
    return [this,];
  }

  /**
   * Compare intervals
   * @param iv - Other interval
   * @returns -1 if end < iv.start, 1 if iv.end < start, 0 if overlaps
   */
  compareTo(iv: Interval<T>,): -1 | 0 | 1 {
    if (this.end < iv.start) {
      return -1;
    }
    if (iv.end < this.start) {
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
    return this.start === iv.start &&
      this.end === iv.end;
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
}
