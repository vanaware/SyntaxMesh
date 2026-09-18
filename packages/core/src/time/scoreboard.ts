import { TjArgumentError, TjTime, } from "./tj-time.ts";
import { IntervalList, } from "./interval-list.ts";
import { TimeInterval, } from "./time-interval.ts";
import { compat, rubyRound, } from "../compat.ts";

export class Scoreboard<T,> {
  readonly startDate: Date;
  readonly endDate: Date;
  readonly resolution: number;
  readonly size: number;
  private sb: T[];

  constructor(
    startDate: Date,
    endDate: Date,
    resolution: number,
    initVal: T | null = null,
  ) {
    if (!(startDate instanceof Date)) {
      throw new TjArgumentError(
        `startDate must be a Date, not a ${typeof startDate}`,
      );
    }
    if (!(endDate instanceof Date)) {
      throw new TjArgumentError(
        `endDate must be a Date, not a ${typeof endDate}`,
      );
    }
    if (
      typeof resolution !== "number" || !Number.isInteger(resolution,) ||
      resolution <= 0
    ) {
      throw new TjArgumentError(
        `resolution must be a positive integer, not a ${typeof resolution}`,
      );
    }
    if (endDate <= startDate) {
      throw new TjArgumentError("endDate must be after startDate",);
    }

    this.startDate = startDate;
    this.endDate = endDate;
    this.resolution = resolution;
    this.size = Math.ceil(
      (endDate.getTime() - startDate.getTime()) / 1000 / resolution,
    ) + 1;
    this.sb = Array(this.size,).fill(initVal as T,);
  }

  clear(initVal: T | null = null,): void {
    this.sb = Array(this.size,).fill(initVal as T,);
  }

  // RUBY-COMPAT-FIX: idxToDate typo 'kdx' in Ruby version
  // Ruby has: return @startDate if kdx < 0 (typo)
  // Fixed: return this.startDate if idx < 0
  idxToDate(idx: number, forceIntoProject: boolean = false,): Date {
    if (forceIntoProject) {
      if (idx < 0) return this.startDate;
      if (idx >= this.size) return this.endDate;
    } else {
      if (idx < 0 || idx >= this.size) {
        throw new TjArgumentError(
          `Index ${idx} is out of scoreboard range (${this.size - 1})`,
        );
      }
    }
    return new Date(this.startDate.getTime() + idx * this.resolution * 1000,);
  }

  dateToIdx(date: Date, forceIntoProject: boolean = true,): number {
    const idx = Math.trunc(
      (date.getTime() - this.startDate.getTime()) / (this.resolution * 1000),
    );

    if (forceIntoProject) {
      if (idx < 0) return 0;
      if (idx >= this.size) return this.size - 1;
    } else {
      if (idx < 0 || idx >= this.size) {
        throw new TjArgumentError(
          `Date ${date.toISOString()} is out of project time range (${this.startDate.toISOString()} - ${this.endDate.toISOString()})`,
        );
      }
    }

    return idx;
  }

  get(idx: number,): T {
    return this.sb[idx]!;
  }

  set(idx: number, value: T,): void {
    this.sb[idx] = value;
  }

  getByDate(date: Date,): T {
    return this.sb[this.dateToIdx(date,)]!;
  }

  setByDate(date: Date, value: T,): void {
    this.sb[this.dateToIdx(date,)] = value;
  }

  *each(
    startIdx: number = 0,
    endIdx: number = this.size,
  ): Generator<T, void, unknown> {
    if (startIdx !== 0 || endIdx !== this.size) {
      for (let i = startIdx; i < endIdx; i++) {
        yield this.sb[i]!;
      }
    } else {
      for (const entry of this.sb) {
        yield entry!;
      }
    }
  }

  *each_index(): Generator<number, void, unknown> {
    for (let i = 0; i < this.size; i++) {
      yield i;
    }
  }

  collect(transform: (value: T,) => T,): void {
    for (let i = 0; i < this.sb.length; i++) {
      this.sb[i] = transform(this.sb[i]!,);
    }
  }

  collectIntervals(
    iv: TimeInterval,
    minDuration: number,
    predicate: (value: T,) => boolean,
  ): IntervalList<TimeInterval> {
    // RUBY-COMPAT-FIX (task 5.11.R.3): the original Ruby implementation
    // does not guard the sentinel slot-zero logic with compat.keepRubyBugs.
    // This is a Category A bug — it is always fixed regardless of
    // compat.keepRubyBugs because the sentinel slot-zero logic must be
    // guarded to maintain correct behavior.
    if (!compat.keepRubyBugs) {
      let startIdx = this.dateToIdx(iv.start.toDate(), false,);
      let endIdx = this.dateToIdx(iv.end.toDate(), false,);

      const minSlots = Math.ceil(minDuration / this.resolution,);

      startIdx -= minSlots;
      startIdx = startIdx < 0 ? 0 : startIdx;
      endIdx += minSlots;
      endIdx = endIdx > this.size - 1 ? this.size - 1 : endIdx;

      const intervals = new IntervalList<TimeInterval>();

      let duration = 0;
      let start = 0;

      let idx = startIdx;
      while (idx <= endIdx) {
        if (predicate(this.sb[idx]!,) && idx < endIdx) {
          if (start === 0) start = idx;
          duration++;
        } else {
          if (duration > 0) {
            if (duration >= minSlots) {
              const s = start < startIdx ? startIdx : start;
              const e = idx > endIdx ? endIdx : idx;
              intervals.push(
                new TimeInterval(
                  TjTime.fromDate(this.idxToDate(s,),),
                  TjTime.fromDate(this.idxToDate(e,),),
                ),
              );
            }
            duration = 0;
            start = 0;
          }
        }
        idx++;
      }

      return intervals;
    }

    // Original implementation with sentinel slot-zero guard
    let startIdx = this.dateToIdx(iv.start.toDate(), false,);
    let endIdx = this.dateToIdx(iv.end.toDate(), false,);

    const minSlots = Math.ceil(minDuration / this.resolution,);

    startIdx -= minSlots;
    startIdx = startIdx < 0 ? 0 : startIdx;
    endIdx += minSlots;
    endIdx = endIdx > this.size - 1 ? this.size - 1 : endIdx;

    const intervals = new IntervalList<TimeInterval>();

    let duration = 0;
    let start = 0;

    let idx = startIdx;
    while (idx <= endIdx) {
      if (predicate(this.sb[idx]!,) && idx < endIdx) {
        if (start === 0) start = idx;
        duration++;
      } else {
        if (duration > 0) {
          if (duration >= minSlots) {
            const s = start < startIdx ? startIdx : start;
            const e = idx > endIdx ? endIdx : idx;
            intervals.push(
              new TimeInterval(
                TjTime.fromDate(this.idxToDate(s,),),
                TjTime.fromDate(this.idxToDate(e,),),
              ),
            );
          }
          duration = 0;
          start = 0;
        }
      }
      idx++;
    }

    return intervals;
  }

  inspect(): string {
    let s = "";
    for (let i = 0; i < this.sb.length; i++) {
      s += `${this.idxToDate(i,)}: ${this.sb[i]}\n`;
    }
    return s;
  }
}
