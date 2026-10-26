import { Material, } from "./material.ts";

/**
 * Modificador de alocação de material — define como uma quantidade de material
 * é distribuída no tempo durante a execução de uma tarefa.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 */
export type MaterialAllocationModifier =
  | "onstart"
  | "onend"
  | "perhour"
  | "perday"
  | "perweek"
  | "permonth"
  | "distributed"
  | "distribution";

/**
 * Representa uma alocação de material a uma tarefa, com um modificador
 * temporal que determina quando e como o material é consumido.
 */
export class MaterialAllocation {
  readonly material: Material;
  readonly quantity: number;
  readonly modifier: MaterialAllocationModifier;
  readonly distribution?: number[];

  constructor(
    material: Material,
    quantity: number,
    modifier: MaterialAllocationModifier,
    distribution?: number[],
  ) {
    this.material = material;
    this.quantity = quantity;
    this.modifier = modifier;
    this.distribution = distribution;

    // Validação
    if (quantity < 0) {
      throw new Error("Material allocation quantity cannot be negative",);
    }

    if (distribution) {
      const sum = distribution.reduce((a, b,) => a + b, 0,);
      if (Math.abs(sum - 1.0,) > 0.001) {
        throw new Error(
          `Material allocation distribution must sum to 1.0, got ${sum}`,
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
