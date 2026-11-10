import type { Material, } from "./material.ts";
import type { Task, } from "./task.ts";
import type { ProjectLike, } from "./project-like.ts";
import type { TjTime, } from "../time/tj-time.ts";
import type { MaterialAllocation, } from "./material-allocation.ts";
import {
  isTemporalTail,
  legacyTail,
  tailOverlaps,
  valueInPeriod,
} from "./booking-period.ts";
import type { BookingTail, } from "./booking-period.ts";

/**
 * **Realized** consumption of a material: a quantity consumed on a date
 * (factual, not distributed) with its own unit price.
 *
 * Phase 14 complement (14C.11.3, addendum §10): a `booking` complements the
 * `MaterialAllocation` — the allocation describes the *planned* consumption
 * (split over time by the modifier) while the booking records the *actual*
 * consumption of a day.
 *
 * Phase 14 complement (14C.13.1, Extra Addendum §12): two roles of the same
 * verb. With a task (`taskId` present) the booking is realized consumption and
 * the quantity is **always positive**. Without a task (`taskId === null`) the
 * booking is a **stock** movement: an inflow (positive) or an
 * outflow/reversal (negative) — the only case where a negative quantity is
 * accepted.
 *
 * Precedence of the effective unit price (`unitPriceFor`), from the most
 * specific to the most general: booking → task allocation → material.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §11.4, §13.1
 */
export class MaterialBooking {
  /** Material being consumed or moved. */
  readonly material: Material;
  /** Quantity consumed or moved; negative only for stock outflows. */
  readonly quantity: number;
  /**
   * Real unit price of the booking (optional: falls back to the allocation or
   * the material).
   */
  readonly unitPrice?: number;
  /**
   * Anchor of the booking: start of the first interval (the date in
   * `on <date>`).
   */
  readonly date: TjTime;
  /** Period + modifier (wave D3): a legacy tail when only the date exists. */
  readonly tail: BookingTail;
  /**
   * Id of the task that owns the consumption; `null` in stock bookings (no task,
   * 14C.13.1). The object may not exist yet during the parse (forward
   * reference).
   */
  readonly taskId: string | null;
  /**
   * Resolved task.
   *
   * `null` while the task declaration has not been read — a `booking` in the
   * material body may precede the `task` it references (forward reference).
   * `Project#flushPendingBookings()` resolves it afterwards.
   */
  task: Task | null;

  /**
   * Creates a material booking.
   *
   * @param material Material being consumed or moved.
   * @param taskId Id of the task that owns the consumption, or `null` for a
   *   stock movement.
   * @param quantity Quantity consumed or moved.
   * @param date Date of the legacy `on` clause.
   * @param unitPrice Explicit price for this booking only.
   * @param task Already resolved task, when available.
   * @param tail Explicit period + modifier; defaults to a legacy tail built from
   *   `date`.
   * @throws {Error} When a negative `quantity` is given for a task booking.
   */
  constructor(
    material: Material,
    taskId: string | null,
    quantity: number,
    date: TjTime,
    unitPrice?: number,
    task: Task | null = null,
    tail?: BookingTail,
  ) {
    // A negative quantity only makes sense as a stock outflow (no task).
    if (quantity < 0 && taskId !== null) {
      throw new Error(
        "Material booking quantity cannot be negative for a task",
      );
    }
    this.material = material;
    this.taskId = taskId;
    this.quantity = quantity;
    this.tail = tail ?? legacyTail(date,);
    this.date = this.tail.intervals[0]!.start;
    this.unitPrice = unitPrice;
    this.task = task;
  }

  /**
   * Whether the booking expresses anything beyond the legacy `on <date>` point
   * (wave D3).
   */
  isTemporal(): boolean {
    return isTemporalTail(this.tail,);
  }

  /**
   * Whether any interval of the tail crosses the closed period
   * `[start, end]`.
   *
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   */
  overlapsPeriod(start: TjTime | null, end: TjTime | null,): boolean {
    return tailOverlaps(this.tail, start, end,);
  }

  /**
   * Part of the quantity that falls inside the closed period `[start, end]`
   * under the tail modifier (wave D3). Legacy/without period ⇒ full quantity.
   *
   * @param start Period start, or `null` for the full quantity.
   * @param end Period end, or `null` for the full quantity.
   */
  quantityInPeriod(start: TjTime | null, end: TjTime | null,): number {
    return valueInPeriod(this.quantity, this.tail, start, end,);
  }

  /**
   * Stock booking (an inflow/outflow movement without a task, 14C.13.1).
   */
  isInventory(): boolean {
    return this.taskId === null;
  }

  /**
   * Effective unit price: the booking one, then the given allocation, then the
   * material (`unitprice` of the block).
   *
   * @param allocation Allocation to fall back to, when the booking has no price.
   */
  unitPriceFor(allocation?: MaterialAllocation | null,): number {
    if (this.unitPrice !== undefined) return this.unitPrice;
    if (allocation?.unitPrice !== undefined) return allocation.unitPrice;
    return this.material.unitPriceValue();
  }

  /**
   * Cost of the booking: quantity × effective price.
   *
   * @param allocation Allocation to fall back to, when the booking has no price.
   */
  cost(allocation?: MaterialAllocation | null,): number {
    return this.quantity * this.unitPriceFor(allocation,);
  }

  /**
   * Cost of the booking restricted to the closed period `[start, end]`
   * (wave D3): quantity distributed by the modifier × effective price.
   *
   * @param start Period start, or `null` for the full quantity.
   * @param end Period end, or `null` for the full quantity.
   * @param allocation Allocation to fall back to, when the booking has no price.
   */
  costInPeriod(
    start: TjTime | null,
    end: TjTime | null,
    allocation?: MaterialAllocation | null,
  ): number {
    return this.quantityInPeriod(start, end,) * this.unitPriceFor(allocation,);
  }

  /**
   * Resolves the task from the project (forward reference).
   *
   * Returns `true` once the task exists — or when the booking is a stock one
   * (nothing to resolve, 14C.13.1).
   *
   * @param project Project that holds the task.
   */
  resolveTask(project: ProjectLike,): boolean {
    if (this.taskId === null) return true;
    if (this.task !== null) return true;
    const task = project.task(this.taskId,);
    if (!task) return false;
    this.task = task;
    return true;
  }

  /** Immutable deep copy (same contract as the other allocations). */
  deepClone(): this {
    return this;
  }
}
