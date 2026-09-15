import { TjArgumentError } from './tj-time.ts';
import { Interval } from './interval.ts';
import { TjTime } from './tj-time.ts';

export class TimeInterval extends Interval<TjTime> {
  constructor(...args: unknown[]) {
    if (args.length === 1) {
      const arg = args[0];
      if (arg instanceof TimeInterval) {
        super(arg.start, arg.end);
      } else if (arg instanceof TjTime) {
        super(arg, arg);
      } else {
        throw new TjArgumentError(`Illegal argument 1: ${typeof arg}`);
      }
    } else if (args.length === 2) {
      const start = args[0];
      const end = args[1];
      if (!(start instanceof TjTime)) {
        throw new TjArgumentError(`Interval start must be a date, not a ${typeof start}`);
      }
      if (!(end instanceof TjTime)) {
        throw new TjArgumentError(`Interval end must be a date, not a ${typeof end}`);
      }
      super(start, end);
    } else {
      throw new TjArgumentError(`Too many arguments: ${args.length}`);
    }
  }

  override get start(): TjTime {
    return this._start;
  }

  override set start(value: TjTime) {
    this._start = value;
  }

  override get end(): TjTime {
    return this._end;
  }

  override set end(value: TjTime) {
    this._end = value;
  }

  duration(): number {
    return this.end.diff(this.start);
  }

  to_s(): string {
    return `${this.start.to_s()} - ${this.end.to_s()}`;
  }

  static fromSingle(t: TjTime): TimeInterval {
    return new TimeInterval(t);
  }

  static fromInterval(iv: Interval<TjTime>): TimeInterval {
    return new TimeInterval(iv.start, iv.end);
  }
}