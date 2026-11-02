import type { Material, } from "./material.ts";

/**
 * Componente de um material composto (Adendo Extra §12.2, 14C.14.1).
 *
 * `material "Cemento" 420` dentro do bloco de `material "Concreto"` declara
 * que **um** metro cúbico de concreto consome 420 kg de cimento. A quantidade
 * é sempre **por unidade do material composto**, nunca o total do projeto.
 *
 * O preço unitário do material dono dos componentes deixa de ser declarado e
 * passa a ser calculado: `Σ componente.quantity × componente.unitPrice()`,
 * recursivamente (um componente pode ser composto).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md §13.2
 */
export class MaterialComponent {
  readonly material: Material;
  readonly quantity: number;

  constructor(material: Material, quantity: number,) {
    if (quantity < 0) {
      throw new Error("Material component quantity cannot be negative",);
    }
    this.material = material;
    this.quantity = quantity;
  }

  /**
   * Custo deste componente para **uma** unidade do material composto.
   *
   * Usa o preço unitário efetivo do componente (explícito ou calculado pelos
   * próprios componentes dele).
   */
  cost(): number {
    return this.quantity * this.material.unitPriceValue();
  }

  /** Cópia profunda imutável — devolve `this`, como as demais alocações. */
  deepClone(): this {
    return this;
  }
}

/**
 * Os componentes de um material vivem no atributo de cenário
 * `materialcomponents` (14C.14.2) e só são consultados por preço — por isso
 * `MaterialComponent` não guarda referência ao material dono.
 */
