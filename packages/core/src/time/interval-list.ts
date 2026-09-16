import { Interval } from './interval.ts';
import { TjArgumentError } from './tj-time.ts';

function lessThan<T>(a: T, b: T): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a < b;
  if (a instanceof Date && b instanceof Date) return a.getTime() < b.getTime();
  return (a as { compareTo: (other: T) => number }).compareTo(b) < 0;
}

function equals<T>(a: T, b: T): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return (a as { equals: (other: T) => boolean }).equals(b);
}

export class IntervalList<T extends Interval<any>> extends Array<T> {
  static override [Symbol.species] = Array;

  append(iv: T): void {
    super.push(iv);
  }

  override push(iv: T): number {
    const last = this.length > 0 ? this[this.length - 1] : undefined;
    if (last) {
      if (lessThan(iv.start, last.end)) {
        throw new TjArgumentError(
          'Intervals may not overlap and must be added in ascending order.'
        );
      } else if (equals(last.end, iv.start)) {
        this[this.length - 1] = new (last.constructor as new (...args: unknown[]) => T)(last.start, iv.end);
        return this.length;
      }
    }
    super.push(iv);
    return this.length;
  }

  intersect(list: IntervalList<T>): IntervalList<T> {
    const res = new IntervalList<T>();
    let si = 0;
    let li = 0;

    while (si < this.length && li < list.length) {
      const selfIv = this[si] as T;
      const listIv = list[li] as T;
      const result = this.addCase(selfIv, listIv, si, li);
      if (result.type === "push") {
        res.push(result.interval!);
      }
      si = result.si;
      li = result.li;
    }

    return res;
  }

  private addCase(
    selfIv: T,
    listIv: T,
    si: number,
    li: number
  ): { type: "push" | "skip"; interval?: T; si: number; li: number } {
    if (lessThan(selfIv.start, listIv.start)) {
      if (!lessThan(listIv.start, selfIv.end)) {
        return { type: "skip", interval: undefined!, si: si + 1, li };
      } else if (lessThan(selfIv.end, listIv.end)) {
        return {
          type: "push",
          interval: new (selfIv.constructor as new (...args: unknown[]) => T)(listIv.start, selfIv.end),
          si: si + 1,
          li,
        };
      } else {
        return {
          type: "push",
          interval: new (selfIv.constructor as new (...args: unknown[]) => T)(listIv.start, listIv.end),
          si: si + 1,
          li: li + 1,
        };
      }
    } else if (lessThan(listIv.start, selfIv.start)) {
      if (!lessThan(selfIv.start, listIv.end)) {
        return { type: "skip", interval: undefined!, si, li: li + 1 };
      } else if (lessThan(listIv.end, selfIv.end)) {
        return {
          type: "push",
          interval: new (selfIv.constructor as new (...args: unknown[]) => T)(selfIv.start, listIv.end),
          si,
          li: li + 1,
        };
      } else {
        return {
          type: "push",
          interval: new (selfIv.constructor as new (...args: unknown[]) => T)(selfIv.start, selfIv.end),
          si: si + 1,
          li: li + 1,
        };
      }
    } else {
      if (equals(selfIv.end, listIv.end)) {
        return {
          type: "push",
          interval: selfIv,
          si: si + 1,
          li: li + 1,
        };
      } else if (lessThan(selfIv.end, listIv.end)) {
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