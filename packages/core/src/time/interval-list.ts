import { Comparable, Interval, } from "./interval.ts";
import { TjArgumentError, } from "./tj-time.ts";

/**
 * Orders two comparable values.
 *
 * @param a Left value.
 * @param b Right value.
 * @returns `true` when `a` is lower than `b`.
 */
function lessThan<T,>(a: T, b: T,): boolean {
  if (typeof a === "number" && typeof b === "number") return a < b;
  if (a instanceof Date && b instanceof Date) return a.getTime() < b.getTime();
  return (a as { compareTo: (other: T,) => number }).compareTo(b,) < 0;
}

/**
 * Compares two comparable values for equality.
 *
 * @param a Left value.
 * @param b Right value.
 * @returns `true` when the values are equal.
 */
function equals<T,>(a: T, b: T,): boolean {
  if (typeof a === "number" && typeof b === "number") return a === b;
  if (a instanceof Date && b instanceof Date) {
    return a.getTime() === b.getTime();
  }
  return (a as { equals: (other: T,) => boolean }).equals(b,);
}

/**
 * IntervalList — ordered list of non-overlapping intervals.
 *
 * Port of `IntervalList.rb`. Pushing an interval keeps the list sorted and
 * merges it with the previous one when they touch; overlapping intervals are
 * rejected.
 */
export class IntervalList<T extends Interval<Comparable>,> extends Array<T> {
  /**
   * Species used by array combinators (`map`, `slice`, ...).
   *
   * Plain `Array`, so the helpers always return a real array instead of an
   * `IntervalList` that would enforce the ordering invariants.
   */
  static override [Symbol.species]: ArrayConstructor = Array;

  /**
   * Appends an interval without the ordering and merging checks of `push`.
   *
   * @param iv Interval to append.
   */
  append(iv: T,): void {
    super.push(iv,);
  }

  /**
   * Appends an interval, merging it when it touches the last one.
   *
   * @param iv Interval to append.
   * @returns The new length of the list.
   * @throws TjArgumentError When intervals overlap or arrive out of order.
   */
  override push(iv: T,): number {
    const last = this.length > 0 ? this[this.length - 1] : undefined;
    if (last) {
      if (lessThan(iv.start, last.end,)) {
        throw new TjArgumentError(
          "Intervals may not overlap and must be added in ascending order.",
        );
      } else if (equals(last.end, iv.start,)) {
        this[this.length - 1] =
          new (last.constructor as new (...args: unknown[]) => T)(
            last.start,
            iv.end,
          );
        return this.length;
      }
    }
    super.push(iv,);
    return this.length;
  }

  /**
   * Intersects two ordered lists of intervals.
   *
   * @param list Other list, in ascending order.
   * @returns The intervals present in both lists.
   */
  intersect(list: IntervalList<T>,): IntervalList<T> {
    const res = new IntervalList<T>();
    let si = 0;
    let li = 0;

    while (si < this.length && li < list.length) {
      const selfIv = this[si] as T;
      const listIv = list[li] as T;
      const result = this.addCase(selfIv, listIv, si, li,);
      if (result.type === "push") {
        res.push(result.interval!,);
      }
      si = result.si;
      li = result.li;
    }

    return res;
  }

  /**
   * Advances both cursors by one step of the intersection merge.
   *
   * @param selfIv Interval of this list at `si`.
   * @param listIv Interval of the other list at `li`.
   * @param si Cursor of this list.
   * @param li Cursor of the other list.
   * @returns The interval to push, if any, and the next cursors.
   */
  private addCase(
    selfIv: T,
    listIv: T,
    si: number,
    li: number,
  ): { type: "push" | "skip"; interval?: T; si: number; li: number } {
    if (lessThan(selfIv.start, listIv.start,)) {
      if (!lessThan(listIv.start, selfIv.end,)) {
        return { type: "skip", interval: undefined!, si: si + 1, li, };
      } else if (lessThan(selfIv.end, listIv.end,)) {
        return {
          type: "push",
          interval: new (selfIv.constructor as new (...args: unknown[]) => T)(
            listIv.start,
            selfIv.end,
          ),
          si: si + 1,
          li,
        };
      } else {
        return {
          type: "push",
          interval: new (selfIv.constructor as new (...args: unknown[]) => T)(
            listIv.start,
            listIv.end,
          ),
          si: si + 1,
          li: li + 1,
        };
      }
    } else if (lessThan(listIv.start, selfIv.start,)) {
      if (!lessThan(selfIv.start, listIv.end,)) {
        return { type: "skip", interval: undefined!, si, li: li + 1, };
      } else if (lessThan(listIv.end, selfIv.end,)) {
        return {
          type: "push",
          interval: new (selfIv.constructor as new (...args: unknown[]) => T)(
            selfIv.start,
            listIv.end,
          ),
          si,
          li: li + 1,
        };
      } else {
        return {
          type: "push",
          interval: new (selfIv.constructor as new (...args: unknown[]) => T)(
            selfIv.start,
            selfIv.end,
          ),
          si: si + 1,
          li: li + 1,
        };
      }
    } else {
      if (equals(selfIv.end, listIv.end,)) {
        return {
          type: "push",
          interval: selfIv,
          si: si + 1,
          li: li + 1,
        };
      } else if (lessThan(selfIv.end, listIv.end,)) {
        return {
          type: "push",
          interval: selfIv,
          si: si + 1,
          li,
        };
      } else {
        return {
          type: "push",
          interval: listIv,
          si,
          li: li + 1,
        };
      }
    }
  }
}
