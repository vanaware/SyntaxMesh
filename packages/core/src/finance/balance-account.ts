/**
 * Utilitário de meta-conta para cálculo de turnover.
 *
 * Calcula o turnover líquido como -cost + revenue.
 *
 * @see docs/taskjuggler/lib/taskjuggler/BalanceAccount.rb
 */

import { Account, } from "../model/account.ts";
import { AccountCredit, } from "./account-credit.ts";
import { TjTime, } from "../time/tj-time.ts";

/**
 * Contador de módulo para gerar IDs únicos para contas meta temporárias.
 *
 * Garante que cada conta meta criada por `createBalanceAccount` tenha um ID
 * único (`_balance_1`, `_balance_2`, ...), evitando colisões com a conta
 * especial `'0'` e com outras contas meta.
 */
let balanceCounter = 0;

/**
 * Calcula o turnover líquido para uma conta meta.
 *
 * Uma conta meta consiste em duas subcontas:
 * - Uma conta "cost" (despesas)
 * - Uma conta "revenue" (receitas)
 *
 * O turnover líquido é calculado como: -cost + revenue
 *
 * @param metaAccount A conta meta (deve ter exatamente dois filhos:
 *                    um chamado "cost" e outro chamado "revenue").
 * @param startIdx Índice de início do intervalo de tempo.
 * @param endIdx Índice de fim do intervalo de tempo.
 * @returns O turnover líquido.
 * @throws TjArgumentError se a conta meta não tiver exatamente dois filhos
 *         ou se os filhos não forem chamados "cost" e "revenue".
 */
export function balanceAccount(
  metaAccount: Account,
  startIdx: number,
  endIdx: number,
): number {
  // Obter os filhos da conta meta
  const adoptees = metaAccount.adoptees;

  // Validar que existem exatamente dois filhos
  if (adoptees.length !== 2) {
    throw new Error(
      `Meta-account deve ter exatamente dois filhos, encontrado ${adoptees.length}.`,
    );
  }

  // Usar os dois filhos diretamente (ordem: cost, revenue)
  const costAccount = adoptees[0] as Account;
  const revenueAccount = adoptees[1] as Account;

  // Calcular turnover líquido: -cost + revenue
  const costTurnover = costAccount.scenarioData(0,).turnover(startIdx, endIdx,);
  const revenueTurnover = revenueAccount.scenarioData(0,).turnover(
    startIdx,
    endIdx,
  );

  return -costTurnover + revenueTurnover;
}

/**
 * Calcula o turnover líquido para uma conta meta usando um objeto AccountScenario.
 *
 * Esta é uma versão mais conveniente que aceita diretamente um AccountScenario
 * em vez de uma Account completa.
 *
 * @param metaAccountScenario O AccountScenario da conta meta.
 * @param startIdx Índice de início do intervalo de tempo.
 * @param endIdx Índice de fim do intervalo de tempo.
 * @returns O turnover líquido.
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
 * Cria uma conta meta temporária para cálculo de balance.
 *
 * Esta é uma versão mais conveniente que aceita diretamente contas cost e revenue,
 * criando uma conta meta temporária que adota ambas.
 *
 * @param project O projeto.
 * @param costAccount A conta de custo.
 * @param revenueAccount A conta de receita.
 * @returns A conta meta temporária.
 */
export function createBalanceAccount(
  project: {
    newAccount(id: string, name: string, parent: Account | null,): Account;
  },
  costAccount: Account,
  revenueAccount: Account,
): Account {
  // Criar uma conta meta temporária com um id único
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
 * Remove uma conta meta temporária.
 *
 * Esta função remove a conta meta e propaga a remoção para suas referências.
 *
 * @param project O projeto.
 * @param account A conta meta a ser removida.
 */
export function removeBalanceAccount(
  project: { removeAccount(account: Account,): void },
  account: Account,
): void {
  project.removeAccount(account,);
}
