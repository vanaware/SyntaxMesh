/**
 * Meta-account utility for turnover computation.
 *
 * Computes the net turnover as -cost + revenue.
 *
 * @see docs/taskjuggler/lib/taskjuggler/BalanceAccount.rb
 */

import { Account, } from "../model/account.ts";
import { AccountCredit, } from "./account-credit.ts";
import { TjTime, } from "../time/tj-time.ts";

/**
 * Modulo counter used to generate unique IDs for temporary meta-accounts.
 *
 * Ensures every meta-account created by `createBalanceAccount` gets a unique
 * ID (`_balance_1`, `_balance_2`, ...), avoiding collisions with the special
 * `'0'` account and with other meta-accounts.
 */
let balanceCounter = 0;

/**
 * Computes the net turnover for a meta-account.
 *
 * A meta-account consists of two sub-accounts:
 * - a "cost" account (expenses)
 * - a "revenue" account (revenues)
 *
 * The net turnover is computed as: -cost + revenue
 *
 * @param metaAccount The meta-account (must have exactly two children: one
 *                    named "cost" and another named "revenue").
 * @param startIdx Start index of the time interval.
 * @param endIdx End index of the time interval.
 * @returns The net turnover.
 * @throws TjArgumentError when the meta-account does not have exactly two
 *         children or when they are not named "cost" and "revenue".
 */
export function balanceAccount(
  metaAccount: Account,
  startIdx: number,
  endIdx: number,
): number {
  // Get the children of the meta-account
  const adoptees = metaAccount.adoptees;

  // Validate that there are exactly two children
  if (adoptees.length !== 2) {
    throw new Error(
      `Meta-account deve ter exatamente dois filhos, encontrado ${adoptees.length}.`,
    );
  }

  // Use the two children directly (order: cost, revenue)
  const costAccount = adoptees[0] as Account;
  const revenueAccount = adoptees[1] as Account;

  // Compute the net turnover: -cost + revenue
  const costTurnover = costAccount.scenarioData(0,).turnover(startIdx, endIdx,);
  const revenueTurnover = revenueAccount.scenarioData(0,).turnover(
    startIdx,
    endIdx,
  );

  return -costTurnover + revenueTurnover;
}

/**
 * Computes the net turnover for a meta-account using an AccountScenario.
 *
 * A more convenient variant that accepts an AccountScenario directly instead
 * of a complete Account.
 *
 * @param metaAccountScenario The AccountScenario of the meta-account.
 * @param startIdx Start index of the time interval.
 * @param endIdx End index of the time interval.
 * @returns The net turnover.
 */
export function balanceAccountScenario(
  metaAccountScenario: { getProperty(): Account },
  startIdx: number,
  endIdx: number,
): number {
  const metaAccount = metaAccountScenario.getProperty();
  return balanceAccount(metaAccount, startIdx, endIdx,);
}

/**
 * Creates a temporary meta-account for the balance computation.
 *
 * A more convenient variant that accepts the cost and revenue accounts
 * directly, creating a temporary meta-account that adopts both.
 *
 * @param project The project.
 * @param costAccount The cost account.
 * @param revenueAccount The revenue account.
 * @returns The temporary meta-account.
 */
export function createBalanceAccount(
  project: {
    newAccount(id: string, name: string, parent: Account | null,): Account;
  },
  costAccount: Account,
  revenueAccount: Account,
): Account {
  // Create a temporary meta-account with a unique id
  const metaAccount = project.newAccount(
    "_balance_" + (++balanceCounter).toString(),
    "Total",
    null,
  );
  metaAccount.adopt(costAccount,);
  metaAccount.adopt(revenueAccount,);
  return metaAccount;
}

/**
 * Removes a temporary meta-account.
 *
 * Removes the meta-account and propagates the removal to its references.
 *
 * @param project The project.
 * @param account The meta-account to remove.
 */
export function removeBalanceAccount(
  project: { removeAccount(account: Account,): void },
  account: Account,
): void {
  project.removeAccount(account,);
}
