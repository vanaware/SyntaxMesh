import { PropertyTreeNode, } from "./property-tree-node.ts";
import { type ProjectLike, } from "./project-like.ts";
import { PropertySet, } from "./property-set.ts";
import { ChargeSetCollection, } from "../finance/charge-set-collection.ts";

/**
 * Entidade de primeira classe representando um insumo físico do projeto
 * (aço, concreto, tinta etc.), com quantidade, preço unitário e
 * distribuição temporal.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 */
export class Material extends PropertyTreeNode {
  readonly unit: string;
  readonly unitPrice: number;
  readonly chargeset: ChargeSetCollection;
  readonly totalQuantity?: number;

  constructor(
    project: ProjectLike,
    id: string,
    unit: string,
    unitPrice: number,
    chargeset?: ChargeSetCollection,
    totalQuantity?: number,
  ) {
    // Material não é registrado em PropertySet — é uma entidade simples.
    // Usamos um PropertySet temporário apenas para satisfazer o construtor.
    const propertySet = new PropertySet(project, false);
    super(propertySet, id, id, null,);
    this.unit = unit;
    this.unitPrice = unitPrice;
    this.chargeset = chargeset ?? new ChargeSetCollection();
    this.totalQuantity = totalQuantity;
  }

  /**
   * Custo total do material (quantidade × preço unitário).
   */
  totalCost(): number {
    const quantity = this.totalQuantity ?? 0;
    return quantity * this.unitPrice;
  }

  /**
   * Cópia profunda imutável.
   * Retorna this (imutável) para compatibilidade com deepClone.
   */
  deepClone(): this {
    return this;
  }
}
