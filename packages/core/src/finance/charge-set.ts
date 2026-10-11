/**
 * Conjunto de contas que descreve como um valor é distribuído entre contas.
 *
 * Cada conta tem uma participação (share) entre 0.0 e 1.0. A soma total deve
 * ser 100% (1.0). Contas sem share definido são distribuídas igualmente pelo
 * método `complete()`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb
 */

import { TjArgumentError, } from "../attributes/errors.ts";
import { type Account, } from "../model/account.ts";

/**
 * Conjunto de contas com participações (shares) para distribuição de custos.
 *
 * Fonte Ruby: `docs/taskjuggler/lib/taskjuggler/ChargeSet.rb`
 */
export class ChargeSet {
  private set: Map<Account, number | null>;
  private masterAccount: Account | null;

  constructor() {
    this.set = new Map();
    this.masterAccount = null;
  }

  /**
   * Conta raiz (master) do charge set — a primeira conta adicionada.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#master
   */
  get master(): Account | null {
    return this.masterAccount;
  }

  /**
   * Adiciona uma conta ao conjunto com sua participação.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#addAccount
   */
  addAccount(account: Account, share: number | null): void {
    if (!account.leaf()) {
      throw new TjArgumentError(
        `Account ${account.fullId} is a group account and cannot be used in a chargeset.`,
      );
    }
    if (this.set.has(account)) {
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
    if (share !== null && (share < 0.0 || share > 1.0)) {
      throw new TjArgumentError("Charge set shares must be between 0 and 100%");
    }
    this.set.set(account, share);
  }

  /**
   * Itera sobre todas as contas do conjunto.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#each
   */
  each(fn: (account: Account, share: number | null) => void): void {
    for (const [account, share] of this.set) {
      fn(account, share);
    }
  }

  /**
   * Distribui o restante até 100% igualmente entre as contas sem share.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#complete
   */
  complete(): void {
    let totalPercent = 0.0;
    let undefined = 0;
    for (const share of this.set.values()) {
      if (share !== null) {
        totalPercent += share;
      } else {
        undefined += 1;
      }
    }
    if (totalPercent > 1.0) {
      throw new TjArgumentError(
        `Total share of this set (${totalPercent * 100}%) exceeds 100%.`,
      );
    }
    if (undefined > 0) {
      const commonShare = (1.0 - totalPercent) / undefined;
      if (commonShare <= 0) {
        throw new TjArgumentError(
          `Total share is 100% but ${undefined} account(s) still exist.`,
        );
      }
      for (const [account, share] of this.set) {
        if (share === null) {
          this.set.set(account, commonShare);
        }
      }
    } else if (totalPercent !== 1.0) {
      throw new TjArgumentError(
        `Total share of this set is ${totalPercent * 100} instead of 100%.`,
      );
    }
  }

  /**
   * Retorna a participação de uma conta, ou null se não definida.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#share
   */
  share(account: Account): number | null {
    return this.set.get(account) ?? null;
  }

  /**
   * Representação textual do conjunto.
   *
   * @see docs/taskjuggler/lib/taskjuggler/ChargeSet.rb#to_s
   */
  to_s(): string {
    let str = "(";
    for (const [account, share] of this.set) {
      if (str !== "(") {
        str += ", ";
      }
      str += `${account.fullId} ${share! * 100}%`;
    }
    str += ")";
    return str;
  }
}
