/**
 * Modificador de extended charge — define como um valor monetário é distribuído
 * no tempo durante a execução de uma tarefa.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 */
export type ExtendedChargeModifier =
  | "onstart"
  | "onend"
  | "perhour"
  | "perday"
  | "perweek"
  | "permonth"
  | "distributed"
  | "distribution";

/**
 * Representa uma charge estendida com distribuição temporal não-linear.
 *
 * Semelhante a `MaterialAllocation`, mas para valores monetários.
 */
export class ExtendedCharge {
  readonly amount: number;
  readonly modifier: ExtendedChargeModifier;
  readonly distribution?: number[];

  constructor(
    amount: number,
    modifier: ExtendedChargeModifier,
    distribution?: number[],
  ) {
    this.amount = amount;
    this.modifier = modifier;
    this.distribution = distribution;

    // Validação
    if (distribution) {
      const sum = distribution.reduce((a, b) => a + b, 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        throw new Error(
          `Extended charge distribution must sum to 1.0, got ${sum}`,
        );
      }
    }
  }

  /**
   * Cópia profunda imutável.
   * Retorna this (imutável) para compatibilidade com deepClone.
   */
  deepClone(): this {
    return this;
  }
}