import { Interval } from './interval.ts';
import { TjArgumentError } from './tj-time.ts';
import { Comparable } from './interval.ts';

function lessThan<T extends Comparable>(a: T, b: T): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a < b;
  if (a instanceof Date && b instanceof Date) return a.getTime() < b.getTime();
  return (a as unknown as { compareTo: (other: T) => number }).compareTo(b) < 0;
}

function equals<T extends Comparable>(a: T, b: T): boolean {
  if (typeof a === 'number' && typeof b === 'number') return a === b;
  if (a instanceof Date && b instanceof Date) return a.getTime() === b.getTime();
  return (a as unknown as { equals: (other: T) => boolean }).equals(b);
}

export class IntervalList<T extends Comparable> extends Array<Interval<T>> {
  static override [Symbol.species] = Array;

  append(iv: Interval<T>): void {
    super.push(iv);
  }

  override push(iv: Interval<T>): number {
    const last = this.length > 0 ? this[this.length - 1] : undefined;
    if (last) {
      if (lessThan(iv.start, last.end)) {
        throw new TjArgumentError(
          'Intervals may not overlap and must be added in ascending order.'
        );
      } else if (equals(last.end, iv.start)) {
        this[this.length - 1] = new (last.constructor as any)(last.start, iv.end);
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
      this.addCase(res, si, li, list);
    }

    return res;
  }

  private addCase(res: IntervalList<T>, si: number, li: number, list: IntervalList<T>): void {
    const selfIv = this[si] as Interval<T>;
    const listIv = list[li] as Interval<T>;

    if (lessThan(selfIv.start, listIv.start)) {
      if (!lessThan(listIv.start, selfIv.end)) {
        si += 1;
      } else if (lessThan(selfIv.end, listIv.end)) {
        res.push(new (selfIv.constructor as any)(listIv.start, selfIv.end));
        si += 1;
      } else {
        res.push(new (selfIv.constructor as any)(listIv.start, listIv.end));
        li += 1;
      }
    } else if (lessThan(listIv.start, selfIv.start)) {
      if (!lessThan(selfIv.start, listIv.end)) {
        li += 1;
      } else if (lessThan(listIv.end, selfIv.end)) {
        res.push(new (selfIv.constructor as any)(selfIv.start, listIv.end));
        li += 1;
      } else {
        res.push(new (selfIv.constructor as any)(selfIv.start, selfIv.end));
        si += 1;
      }
    } else {
      if (equals(selfIv.end, listIv.end)) {
        res.push(selfIv);
        li += 1;
        si += 1;
      } else if (lessThan(selfIv.end, listIv.end)) {
        res.push(selfIv);
        si += 1;
      } else {
        res.push(listIv);
        li += 1;
      }
    }
  }
}