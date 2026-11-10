import type { Task, } from "./task.ts";
import type { Resource, } from "./resource.ts";
import type { Material, } from "./material.ts";
import type { TjTime, } from "../time/tj-time.ts";
import {
  isTemporalTail,
  legacyTail,
  valueInPeriod,
} from "./booking-period.ts";
import type { BookingTail, } from "./booking-period.ts";

/**
 * A **charge** booking (Extra Addendum §12.3, 14C.15.4).
 *
 * `booking charge [<description>] [value] <amount> on <date>` records a realized
 * expense (or a reversal, when the amount is negative) **of a task**, on the
 * given date. The declaring site may be the task itself (no reference — the
 * money belongs to it), a resource or a material (the reference is then the
 * task); the owner of the reference is called `owner` here and is `null` in the
 * task form (2026-11-02 revision: a resource reference is **not** accepted — a
 * charge booking consumes no effort and has no resource endpoint). The
 * `description` is optional free text (operation/identification of the
 * expense).
 *
 * The booking lives in the `chargebookings` scenario attribute of the **task**,
 * because the money belongs to the task: the destination account is the task
 * charge set (rule 3 of `resolveAccount`), otherwise the project default account
 * (rule 4) — exactly like a `charge` declared in the task body.
 *
 * Single source of truth for the charge booking: the orphan `ExtendedBooking`
 * (phase 8.1, generic `effort|charge|material` that nothing in the parser used)
 * was removed on 2026-11-02 — effort and material already have `Booking` and
 * `MaterialBooking`; charge lives exclusively here. See plan §13.7.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §13.3
 */
export class ChargeBooking {
  /** Owner of the reference: a resource or a material (`null` in the task form). */
  readonly owner: Resource | Material | null;
  /**
   * Id or name of the task that owns the expense — kept for when the task is
   * declared after the booking (forward reference).
   */
  readonly taskRef: string | null;
  /** Resolved task (`null` while the reference is still forward). */
  task: Task | null;
  /** Amount in the project currency; negative means a reversal. */
  readonly amount: number;
  /**
   * Anchor of the booking: start of the first interval (the date in
   * `on <date>`).
   */
  readonly date: TjTime;
  /** Period + modifier (wave D3): a legacy tail when only the date exists. */
  readonly tail: BookingTail;
  /** Optional free text identifying the expense (Extra Addendum §12.3). */
  readonly description: string | null;

  /**
   * Creates a charge booking.
   *
   * @param owner Declaring resource or material, or `null` when the task itself
   *   declares the booking.
   * @param taskRef Id/name of the task that owns the expense, or `null` when the
   *   task is already resolved.
   * @param amount Amount in the project currency; may be negative.
   * @param date Date of the legacy `on` clause.
   * @param task Already resolved task, when available.
   * @param description Optional free text.
   * @param tail Explicit period + modifier; defaults to a legacy tail built from
   *   `date`.
   * @throws {Error} When neither `taskRef` nor `task` is given.
   */
  constructor(
    owner: Resource | Material | null,
    taskRef: string | null,
    amount: number,
    date: TjTime,
    task: Task | null = null,
    description: string | null = null,
    tail?: BookingTail,
  ) {
    if (taskRef === null && task === null) {
      throw new Error("Charge booking needs a task reference",);
    }
    this.owner = owner;
    this.taskRef = taskRef;
    this.amount = amount;
    this.tail = tail ?? legacyTail(date,);
    this.date = this.tail.intervals[0]!.start;
    this.task = task;
    this.description = description;
  }

  /**
   * Whether the booking expresses anything beyond the legacy `on <date>` point
   * (wave D3).
   */
  isTemporal(): boolean {
    return isTemporalTail(this.tail,);
  }

  /**
   * Part of the amount that falls inside the closed period `[start, end]` under
   * the tail modifier (wave D3).
   *
   * Without a period the full amount is returned; for a legacy booking the full
   * amount is returned when the point is inside the period and 0 outside.
   *
   * @param start Period start, or `null` for the full amount.
   * @param end Period end, or `null` for the full amount.
   */
  amountInPeriod(start: TjTime | null, end: TjTime | null,): number {
    return valueInPeriod(this.amount, this.tail, start, end,);
  }

  /**
   * Resolves the forward reference against the project (`true` when linked).
   *
   * @param project Lookup used to resolve the task reference.
   */
  resolveTask(project: { task(id: string,): Task | null },): boolean {
    if (this.task) return true;
    if (this.taskRef === null) return false;
    const task = project.task(this.taskRef,);
    if (!task) return false;
    this.task = task;
    return true;
  }

  /** Immutable deep copy — returns `this`, like the other bookings. */
  deepClone(): this {
    return this;
  }
}
