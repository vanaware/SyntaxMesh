import { Material, } from "./material.ts";
import { type Task, } from "./task.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { TjTime, } from "../time/tj-time.ts";
import {
  countEligibleDays,
  distributeFractions,
  type DistributionContext,
  type PeriodModifier,
  perPeriod,
} from "../accounting/distribution.ts";

/**
 * Material allocation modifier — defines how a material quantity is distributed
 * over time while a task runs.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 */
export type MaterialAllocationModifier =
  | "onstart"
  | "onend"
  | "perhour"
  | "perday"
  | "perweek"
  | "permonth"
  | "distributed"
  | "distribution";

/**
 * An allocation of material to a task, with a temporal modifier that determines
 * when and how the material is consumed.
 *
 * Phase 10 complement (C2.10): after `attach()`, `quantityIn(period)` delegates
 * to `distribution.ts` respecting `timebasis` (the same semantics as
 * `ExtendedCharge`, but in material units instead of money).
 */
export class MaterialAllocation {
  /** Material being allocated. */
  readonly material: Material;
  /** Quantity allocated, always expressed per the task as a whole. */
  readonly quantity: number;
  /** How the quantity is spread over the task execution. */
  readonly modifier: MaterialAllocationModifier;
  /** Explicit factional split used when `modifier` is `"distribution"`. */
  readonly distribution?: number[];
  /**
   * Unit price specific to this allocation (`unitprice <n>` after the quantity,
   * 14C.11.1). When absent the material `unitprice` applies.
   */
  readonly unitPrice?: number;

  private _task: Task | null = null;
  private _scIdx: number = 0;
  private _ctx: DistributionContext | null = null;

  /**
   * Creates an allocation.
   *
   * @param material Material being allocated.
   * @param quantity Quantity allocated; must not be negative.
   * @param modifier How the quantity is spread over time.
   * @param distribution Fractions used by the `"distribution"` modifier; must
   *   sum to 1.
   * @param unitPrice Price override for this allocation only.
   * @throws {Error} When `quantity` is negative or the fractions do not sum to
   *   1.
   */
  constructor(
    material: Material,
    quantity: number,
    modifier: MaterialAllocationModifier,
    distribution?: number[],
    unitPrice?: number,
  ) {
    this.material = material;
    this.quantity = quantity;
    this.modifier = modifier;
    this.distribution = distribution;
    this.unitPrice = unitPrice;

    // Validation
    if (quantity < 0) {
      throw new Error("Material allocation quantity cannot be negative",);
    }

    if (distribution) {
      const sum = distribution.reduce((a, b,) => a + b, 0,);
      if (Math.abs(sum - 1.0,) > 0.001) {
        throw new Error(
          `Material allocation distribution must sum to 1.0, got ${sum}`,
        );
      }
    }
  }

  /**
   * Attaches the calculation context (task, scenario, `DistributionContext`).
   *
   * @param task Task the allocation belongs to.
   * @param scIdx Scenario index.
   * @param ctx Distribution context (calendar, leaves, timebasis).
   */
  attach(task: Task, scIdx: number, ctx: DistributionContext,): void {
    this._task = task;
    this._scIdx = scIdx;
    this._ctx = ctx;
  }

  /**
   * Material quantity consumed inside `period` (§3.1–§3.6).
   *
   * @param period Window to measure.
   */
  quantityIn(period: TimeInterval,): number {
    if (!this._task || !this._ctx) return 0;
    const scenario = this._task.scenarioData(this._scIdx,);
    const taskStart = scenario.a("start",) as TjTime | null;
    const taskEnd = scenario.a("end",) as TjTime | null;
    if (!taskStart || !taskEnd) return 0;

    if (this.modifier === "onstart") {
      return dayInPeriod(taskStart.toDate(), period,) ? this.quantity : 0;
    }
    if (this.modifier === "onend") {
      return dayInPeriod(taskEnd.toDate(), period,) ? this.quantity : 0;
    }

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

    switch (this.modifier) {
      case "perhour":
      case "perday":
      case "perweek":
      case "permonth":
        return perPeriod(
          this.modifier as PeriodModifier,
          this.quantity,
          a,
          b,
          this._ctx,
        );
      case "distributed": {
        const totalEligible = countEligibleDays(
          taskStart.toDate(),
          taskEnd.toDate(),
          this._ctx,
        );
        if (totalEligible === 0) return 0;
        const interEligible = countEligibleDays(a, b, this._ctx,);
        return this.quantity * interEligible / totalEligible;
      }
      case "distribution": {
        const fr = this.distribution ?? [];
        if (fr.length === 0) return 0;
        const perDay = distributeFractions(
          this.quantity,
          fr,
          taskStart.toDate(),
          taskEnd.toDate(),
          this._ctx,
        );
        const MS_DAY = 86_400_000;
        const taskStartMs = dayStartMs(taskStart.toDate(),);
        const taskEndMs = dayStartMs(taskEnd.toDate(),);
        let sum = 0;
        let idx = 0;
        for (let t = taskStartMs; t <= taskEndMs; t += MS_DAY) {
          const eligible = this._ctx.timebasis === "duration" ||
            (this._ctx.isWorkingCalendarDay(new Date(t,),) &&
              !coveredByLeave(t, this._ctx,));
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
   * Effective unit price: the allocation one, otherwise that of the given
   * material (defaults to `this.material`).
   *
   * The material resolves `unitprice`/the legacy field on its own.
   *
   * @param material Material to ask for a price when the allocation has none.
   */
  unitPriceFor(material: Material = this.material,): number {
    return this.unitPrice ?? material.unitPriceValue();
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

/** Leave check — the same semantics used by `ExtendedCharge`. */
function coveredByLeave(ms: number, ctx: DistributionContext,): boolean {
  for (const l of ctx.leaves) {
    const s = dayStartMs(l.start,);
    const e = dayStartMs(l.end,);
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
