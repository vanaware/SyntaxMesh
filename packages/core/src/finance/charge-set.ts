/**
 * Set of accounts describing how an amount is distributed among accounts.
 *
 * Each account has a share between 0.0 and 1.0. The total must be 100% (1.0).
 * Accounts without a share are distributed evenly by the `complete()` method.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb
 */

import { TjArgumentError, } from "../attributes/errors.ts";
import { type Account, } from "../model/account.ts";

/**
 * Set of accounts with shares for cost distribution.
 *
 * Ruby source: `docs/taskjuggler/lib/taskjuggler/ChargeSet.rb`
 */
export class ChargeSet {
  private set: Map<Account, number | null>;
  private masterAccount: Account | null;

  constructor() {
    this.set = new Map();
    this.masterAccount = null;
  }

  /**
   * Root account (master) of the charge set — the first account added.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#master
   */
  get master(): Account | null {
    return this.masterAccount;
  }

  /**
   * Adds an account to the set with its share.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#addAccount
   */
  addAccount(account: Account, share: number | null | undefined,): void {
    // Ruby: a missing optionalPercent arrives as nil. A residual `undefined`
    // from the parser must be treated the same (share === null), otherwise
    // complete() sums NaN and complains about "Total share ... NaN".
    const s = share ?? null;
    if (!account.leaf()) {
      throw new TjArgumentError(
        `Account ${account.fullId} is a group account and cannot be used in a chargeset.`,
      );
    }
    if (this.set.has(account,)) {
      throw new TjArgumentError(
        `Account ${account.fullId} is already a member of the charge set.`,
      );
    }
    if (this.masterAccount === null) {
      this.masterAccount = account.root() as Account;
    } else if (this.masterAccount !== account.root()) {
      throw new TjArgumentError(
        `All members of this charge set must belong to the ${this.masterAccount.fullId} account. ${account.fullId} belongs to ${account.root().fullId}.`,
      );
    }
    if (account.container()) {
      throw new TjArgumentError(
        `${account.fullId} is a group account. Only leaf accounts are allowed for a charge set.`,
      );
    }
    if (s !== null && (s < 0.0 || s > 1.0)) {
      throw new TjArgumentError(
        "Charge set shares must be between 0 and 100%",
      );
    }
    this.set.set(account, s,);
  }

  /**
   * Iterates over all accounts of the set.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#each
   */
  each(fn: (account: Account, share: number | null,) => void,): void {
    for (const [account, share,] of this.set) {
      fn(account, share,);
    }
  }

  /**
   * Distributes the remainder up to 100% evenly among the accounts without a
   * share.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#complete
   */
  complete(): void {
    let totalPercent = 0.0;
    // Ruby `ChargeSet.rb#complete` uses `undefined_count`; we avoid the name
    // `undefined` (it would shadow the restricted global).
    let undefinedCount = 0;
    for (const share of this.set.values()) {
      if (share !== null) {
        totalPercent += share;
      } else {
        undefinedCount += 1;
      }
    }
    if (totalPercent > 1.0) {
      throw new TjArgumentError(
        `Total share of this set (${totalPercent * 100}%) exceeds 100%.`,
      );
    }
    if (undefinedCount > 0) {
      const commonShare = (1.0 - totalPercent) / undefinedCount;
      if (commonShare <= 0) {
        throw new TjArgumentError(
          `Total share is 100% but ${undefinedCount} account(s) still exist.`,
        );
      }
      for (const [account, share,] of this.set) {
        if (share === null) {
          this.set.set(account, commonShare,);
        }
      }
    } else if (totalPercent !== 1.0) {
      throw new TjArgumentError(
        `Total share of this set is ${totalPercent * 100} instead of 100%.`,
      );
    }
  }

  /**
   * Returns the share of an account, or null when not defined.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#share
   */
  share(account: Account,): number | null {
    return this.set.get(account,) ?? null;
  }

  /**
   * Text representation of the set.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#to_s
   */
  to_s(): string {
    let str = "(";
    for (const [account, share,] of this.set) {
      if (str !== "(") {
        str += ", ";
      }
      str += `${account.fullId} ${share! * 100}%`;
    }
    str += ")";
    return str;
  }
}
