/**
 * Leaves, leave lists, leave allowances and allowance lists.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/LeaveList.rb` (the whole file). The
 * order of {@link LeaveTypes} is semantic: a higher index overrides the lower
 * one in the same slot, which is how the `ResourceScenario` scoreboard encodes
 * absence.
 *
 * Divergences from Ruby (category A/C — see `cheat-sheet-ruby-ts.md` §12):
 * • `typeIdx` is a **method** (`typeIdx()`), as in Ruby, not a getter;
 * • `LeaveAllowance#to_s` prints `type date slots` (Ruby's `Struct#to_s`
 *   returns the struct `inspect`, useless for `to_tjp`);
 * • errors use `Error` with the same message as Ruby's `ArgumentError`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LeaveList.rb
 * @see docs/syntaxmesh/decisoes/029-journal-alertlevel.md
 */

import { TjTime, } from "../time/tj-time.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { ScoreboardInterval, } from "../time/scoreboard-interval.ts";

/**
 * Supported leave types (Ruby `Leave::Types`).
 *
 * The order matters: a type with a higher index overrides the previous one over
 * the same period.
 */
export const LeaveTypes = {
  project: 1,
  annual: 2,
  special: 3,
  sick: 4,
  unpaid: 5,
  holiday: 6,
  unemployed: 7,
} as const;

/** Name of a leave type (`:project`, `:annual`, … in Ruby). */
export type LeaveType = keyof typeof LeaveTypes;

/** Type accepted by the APIs (open string at the boundary — parser, directives). */
export type LeaveTypeLike = LeaveType | (string & Record<never, never>);

/** `true` when `type` is a known leave type. */
export function isLeaveType(type: string,): type is LeaveType {
  // `hasOwnProperty` rather than `in`: `in` would accept "constructor"/
  // "toString".
  return Object.prototype.hasOwnProperty.call(LeaveTypes, type,);
}

/** Interval accepted by a leave (a date range or a slot index range). */
export type LeaveInterval = TimeInterval | ScoreboardInterval;

/**
 * One absence (vacation, sick leave, holiday, …) over one interval.
 *
 * The class is a value object: it is compared by identity of its interval and
 * never mutated, which is why `deepClone` returns `this`.
 */
export class Leave {
  /** Same types as Ruby, exposed as a class constant. */
  static readonly Types: typeof LeaveTypes = LeaveTypes;

  /** Kind of absence. */
  readonly type: LeaveType;
  /** Period the absence covers. */
  readonly interval: LeaveInterval;
  /** Free-form reason, or `null` when none was given. */
  readonly reason: string | null;

  /**
   * Creates a leave.
   *
   * @param type Kind of absence; validated against {@link LeaveTypes}.
   * @param interval Period covered.
   * @param reason Free-form justification, when there is one.
   * @throws {Error} When `type` is not a known leave type.
   */
  constructor(
    type: LeaveTypeLike,
    interval: LeaveInterval,
    reason: string | null = null,
  ) {
    if (!isLeaveType(type,)) {
      throw new Error(`Unsupported leave type ${String(type,)}`,);
    }
    this.type = type;
    this.interval = interval;
    this.reason = reason;
  }

  /** Index of the type (1–7), used by the scoreboard bit encoding. */
  typeIdx(): number {
    return LeaveTypes[this.type];
  }

  /**
   * TJP representation (Ruby `Leave#to_s`): `type "reason" interval`.
   *
   * A missing reason keeps Ruby's two spaces
   * (`"#{type} #{reason ? … : ""} #{interval}"`).
   */
  to_s(): string {
    return `${this.type} ${this.reason ? `"${this.reason}"` : ""} ` +
      this.interval.to_s();
  }

  /** Idiomatic alias of {@link to_s} (used by `join` and template strings). */
  toString(): string {
    return this.to_s();
  }

  /**
   * A leave is an immutable value object (16.13.1): the copy returns `this`,
   * like the other frozen Ruby types in `deep_copy.rb`.
   */
  deepClone(): this {
    return this;
  }
}

/** List of `Leave` (Ruby `LeaveList < Array`). */
export class LeaveList extends Array<Leave> {}

/**
 * Yearly leave allowance, in slots (hours) — may be negative to model expiry.
 */
export class LeaveAllowance {
  /** Kind of absence the allowance applies to. */
  readonly type: LeaveType;
  /** Date the allowance is granted for. */
  readonly date: TjTime;
  /** Allowance in slots; negative values subtract from the balance. */
  readonly slots: number;

  /**
   * Creates an allowance.
   *
   * @param type Kind of absence; validated against {@link LeaveTypes}.
   * @param date Date the allowance is granted for.
   * @param slots Allowance in slots (may be negative).
   * @throws {Error} When `type` is not a known leave type.
   */
  constructor(type: LeaveTypeLike, date: TjTime, slots: number,) {
    if (!isLeaveType(type,)) {
      throw new Error(`Unsupported leave type ${String(type,)}`,);
    }
    this.type = type;
    this.date = date;
    this.slots = slots;
  }

  /**
   * `type date slots` format.
   *
   * Ruby does not define `to_s`: as `LeaveAllowance < Struct`, `to_s` returns
   * the struct `inspect`, which is useless for `to_tjp`. This format is the one
   * {@link LeaveAllowanceList#to_tjp} consumes.
   */
  to_s(): string {
    return `${this.type} ${this.date.to_s()} ${this.slots}`;
  }

  /** Idiomatic alias of {@link to_s}. */
  toString(): string {
    return this.to_s();
  }

  /** An allowance is immutable: the copy returns `this` (16.13.1). */
  deepClone(): this {
    return this;
  }
}

/** List of `LeaveAllowance` with per-period balance computation. */
export class LeaveAllowanceList extends Array<LeaveAllowance> {
  /**
   * Balance of type `type` inside `[startDate, endDate)` (Ruby
   * `LeaveAllowanceList#balance`). Negative `slots` subtract (expiry).
   *
   * @param type Kind of absence.
   * @param startDate Start of the period (inclusive).
   * @param endDate End of the period (exclusive).
   * @throws {Error} When `type` is not a known leave type.
   */
  balance(type: LeaveTypeLike, startDate: TjTime, endDate: TjTime,): number {
    if (!isLeaveType(type,)) {
      throw new Error(`Unsupported leave type ${String(type,)}`,);
    }
    let balance = 0.0;
    for (const al of this) {
      if (
        al.type === type && al.date.compareTo(startDate,) >= 0 &&
        al.date.compareTo(endDate,) < 0
      ) {
        balance += al.slots;
      }
    }
    return balance;
  }

  /** One allowance per line (`leaveallowance <type> <date> <slots>`). */
  to_tjp(): string {
    return this.map((al,) => al.to_s()).join(",\n",);
  }
}
