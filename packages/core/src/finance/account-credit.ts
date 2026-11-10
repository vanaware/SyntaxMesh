import { TjTime, } from "../time/tj-time.ts";

/**
 * Credit booked directly against an account, without going through a task.
 *
 * Used for manual adjustments (grants, refunds) that the financial engine adds
 * to the credit side of the balance.
 */
export class AccountCredit {
  /** Date the credit is booked on. */
  readonly date: TjTime;
  /** Free-text description shown in the reports. */
  readonly description: string;
  /** Monetary amount of the credit. */
  readonly amount: number;

  /**
   * Creates an account credit.
   *
   * @param date Date the credit is booked on.
   * @param description Free-text description of the credit.
   * @param amount Monetary amount of the credit.
   */
  constructor(date: TjTime, description: string, amount: number,) {
    this.date = date;
    this.description = description;
    this.amount = amount;
  }

  /**
   * Immutable deep copy.
   *
   * Returns `this` (immutable) to stay compatible with `deepClone`.
   *
   * @returns This same instance, since the class is immutable.
   */
  deepClone(): this {
    return this;
  }
}
