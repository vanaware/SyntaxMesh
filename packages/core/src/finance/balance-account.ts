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

  // Encontrar as contas cost e revenue
  let costAccount: Account | null = null;
  let revenueAccount: Account | null = null;

  for (const adoptee of adoptees) {
    if (adoptee instanceof Account) {
      if (adoptee.get("name",) === "cost") {
        costAccount = adoptee;
      } else if (adoptee.get("name",) === "revenue") {
        revenueAccount = adoptee;
      }
    }
  }

  // Validar que ambas as contas existem
  if (!costAccount || !revenueAccount) {
    throw new Error(
      `Meta-account deve ter exatamente dois filhos: "cost" e "revenue". ` +
        `Encontrado: ${adoptees.map((a) => a.get("name",)).join(", ")}`,
    );
  }

  // Calcular turnover líquido: -cost + revenue
  const costTurnover = costAccount.scenarioData(0,).turnover(startIdx, endIdx,);
  const revenueTurnover = revenueAccount.scenarioData(0,).turnover(startIdx, endIdx,);

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
  metaAccountScenario: { getProperty(): Account; },
  startIdx: number,
  endIdx: number,
): number {
  const metaAccount = metaAccountScenario.getProperty();
  return balanceAccount(metaAccount, startIdx, endIdx,);
}