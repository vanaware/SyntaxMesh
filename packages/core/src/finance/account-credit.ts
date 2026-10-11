import { TjTime, } from "../time/tj-time.ts";

export class AccountCredit {
  readonly date: TjTime;
  readonly description: string;
  readonly amount: number;

  constructor(date: TjTime, description: string, amount: number,) {
    this.date = date;
    this.description = description;
    this.amount = amount;
  }

  /**
   * Cópia profunda imutável.
   * Retorna this (imutável) para compatibilidade com deepClone.
   */
  deepClone(): this {
    return this;
  }
}
