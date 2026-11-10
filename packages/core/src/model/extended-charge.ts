/**
 * Extended charge modifier — defines how a monetary amount is distributed over
 * time while a task runs.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 * @see docs/syntaxmesh/fases/fase-10-complemento2.md (§3.1–§3.6)
 */
import { type Task, } from "./task.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { TjTime, } from "../time/tj-time.ts";
import {
  countEligibleDays,
  distributeDays,
  distributeFractions,
  type DistributionContext,
  type PeriodModifier,
  perPeriod,
} from "../accounting/distribution.ts";

/** Distribution vocabulary of an extended charge. */
export type ExtendedChargeModifier =
  | "onstart"
  | "onend"
  | "perhour"
  | "perday"
  | "perweek"
  | "permonth"
  | "distributed"
  | "distribution";

/**
 * An extended charge with non-linear temporal distribution.
 *
 * Similar to `MaterialAllocation`, but for monetary amounts.
 *
 * Phase 10 complement (C2.10): after `attach()`, `turnover(period)` uses the
 * unified distribution of `distribution.ts` respecting `timebasis`
 * (§3.1–§3.6). It replaces the ad-hoc calculation (`amount/7` for
 * perweek/permonth, `perDiem` for perday) the parser used to do.
 */
export class ExtendedCharge {
  /** Amount distributed over the task execution. */
  readonly amount: number;
  /** How the amount is spread over the task execution. */
  readonly modifier: ExtendedChargeModifier;
  /** Explicit fractional split used when `modifier` is `"distribution"`. */
  readonly distribution?: number[];

  // Filled in by attach(). When missing, turnover() returns 0.
  private _task: Task | null = null;
  private _scIdx: number = 0;
  private _ctx: DistributionContext | null = null;

  /**
   * Creates an extended charge.
   *
   * @param amount Amount to distribute.
   * @param modifier How the amount is spread over time.
   * @param distribution Fractions used by the `"distribution"` modifier; must
   *   sum to 1.
   * @throws {Error} When the fractions do not sum to 1.
   */
  constructor(
    amount: number,
    modifier: ExtendedChargeModifier,
    distribution?: number[],
  ) {
    this.amount = amount;
    this.modifier = modifier;
    this.distribution = distribution;

    // Validation
    if (distribution) {
      const sum = distribution.reduce((a, b,) => a + b, 0,);
      if (Math.abs(sum - 1.0,) > 0.001) {
        throw new Error(
          `Extended charge distribution must sum to 1.0, got ${sum}`,
        );
      }
    }
  }

  /**
   * Attaches the calculation context: the owning task, the scenario and an
   * already resolved `DistributionContext` — typically built from the task
   * `resolvedTimebasis` in `prepareScheduling()`.
   *
   * @param task Task that owns the charge.
   * @param scIdx Scenario index.
   * @param ctx Distribution context (calendar, leaves, timebasis).
   */
  attach(task: Task, scIdx: number, ctx: DistributionContext,): void {
    this._task = task;
    this._scIdx = scIdx;
    this._ctx = ctx;
  }

  /**
   * Portion of this charge that falls on `period` (§3.1–§3.6).
   *
   * Returns 0 when the charge was not attached to a scheduled task, or when the
   * period does not intersect the task interval.
   *
   * @param period Window to measure.
   */
  turnover(period: TimeInterval,): number {
    if (!this._task || !this._ctx) return 0;
    const scenario = this._task.scenarioData(this._scIdx,);
    const taskStart = scenario.a("start",) as TjTime | null;
    const taskEnd = scenario.a("end",) as TjTime | null;
    if (!taskStart || !taskEnd) return 0;

    // Point case (§3.2): onstart/onEnd — we check whether the UTC day of the
    // key date is contained in the period (inclusive on both ends).
    if (this.modifier === "onstart") {
      return dayInPeriod(taskStart.toDate(), period,) ? this.amount : 0;
    }
    if (this.modifier === "onend") {
      return dayInPeriod(taskEnd.toDate(), period,) ? this.amount : 0;
    }

    // Day-level intersection (inclusive) — `distribution.ts` iterates discrete
    // days, so a half-open `Interval.intersection` [start, end) would fail when
    // the period and the task share only a single day.
    const aMs = Math.max(
      dayStartMs(taskStart.toDate(),),
      dayStartMs(period.start.toDate(),),
    );
    const bMs = Math.min(
      dayStartMs(taskEnd.toDate(),),
      dayStartMs(period.end.toDate(),),
    );
    if (aMs > bMs) return 0;
    const a = new Date(aMs,);
    const b = new Date(bMs,);
    const ctx = this._ctx;

    switch (this.modifier) {
      case "perhour":
      case "perday":
      case "perweek":
      case "permonth":
        return perPeriod(
          this.modifier as PeriodModifier,
          this.amount,
          a,
          b,
          ctx,
        );
      case "distributed": {
        const totalEligible = countEligibleDays(
          taskStart.toDate(),
          taskEnd.toDate(),
          ctx,
        );
        if (totalEligible === 0) return 0;
        const interEligible = countEligibleDays(a, b, ctx,);
        return this.amount * interEligible / totalEligible;
      }
      case "distribution": {
        const fr = this.distribution ?? [];
        if (fr.length === 0) return 0;
        // Array of values per eligible day of the TASK.
        const perDay = distributeFractions(
          this.amount,
          fr,
          taskStart.toDate(),
          taskEnd.toDate(),
          ctx,
        );
        // Determine which eligible task days fall in the intersection.
        const MS_DAY = 86_400_000;
        const taskStartMs = dayStartMs(taskStart.toDate(),);
        const taskEndMs = dayStartMs(taskEnd.toDate(),);
        let sum = 0;
        let idx = 0;
        for (let t = taskStartMs; t <= taskEndMs; t += MS_DAY) {
          const eligible = ctx.timebasis === "duration" ||
            (ctx.isWorkingCalendarDay(new Date(t,),) &&
              !coveredByLeave(t, ctx,));
          if (!eligible) continue;
          if (t >= aMs && t <= bMs) sum += perDay[idx] ?? 0;
          idx++;
        }
        return sum;
      }
      default:
        return 0;
    }
  }

  /**
   * Immutable deep copy.
   *
   * Returns `this` (immutable) for compatibility with `deepClone`.
   */
  deepClone(): this {
    return this;
  }
}

/** UTC midnight of a `Date` (day arithmetic kept in UTC). */
function dayStartMs(d: Date,): number {
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),);
}

/** Whether a UTC day (in ms) is covered by any of the `ctx` leaves. */
function coveredByLeave(ms: number, ctx: DistributionContext,): boolean {
  for (const l of ctx.leaves) {
    const s = Date.UTC(
      l.start.getUTCFullYear(),
      l.start.getUTCMonth(),
      l.start.getUTCDate(),
    );
    const e = Date.UTC(
      l.end.getUTCFullYear(),
      l.end.getUTCMonth(),
      l.end.getUTCDate(),
    );
    if (ms >= s && ms <= e) return true;
  }
  return false;
}

/** Whether the UTC day of `d` falls inside `period` (inclusive). */
function dayInPeriod(d: Date, period: TimeInterval,): boolean {
  const ms = dayStartMs(d,);
  return ms >= dayStartMs(period.start.toDate(),) &&
    ms <= dayStartMs(period.end.toDate(),);
}
