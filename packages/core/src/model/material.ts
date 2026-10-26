import { PropertyTreeNode, } from "./property-tree-node.ts";
import { type ProjectLike, } from "./project-like.ts";
import { MaterialScenario, } from "./material-scenario.ts";
import { ChargeSetCollection, } from "../finance/charge-set-collection.ts";

/**
 * Entidade de primeira classe representando um insumo físico do projeto
 * (aço, concreto, tinta etc.), com quantidade, preço unitário e
 * distribuição temporal.
 *
 * Desde a Fase 10 Complemento (C1), `Material` é uma entidade de árvore
 * registrada em `project.materials` — indexável por ID e navegável na
 * árvore do projeto, com suporte a `note`/`journalentry`/rollup de
 * allocations. Os campos `unit`/`unitPrice`/`chargeset`/`totalQuantity`
 * são mantidos como campos de compatibilidade (C1.4); o parser (C3) é a
 * fonte canônica dos atributos.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C1)
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
    parent: Material | null = null,
  ) {
    // Registra no PropertySet hierárquico do projeto (C1.1).
    super(project.materials, id, id, parent,);
    this.unit = unit;
    this.unitPrice = unitPrice;
    this.chargeset = chargeset ?? new ChargeSetCollection();
    this.totalQuantity = totalQuantity;
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new MaterialScenario(
        this,
        i,
        this.getScenarioAttributes(i,),
      );
    }
  }

  override scenarioData(scIdx: number,): MaterialScenario {
    return this.data[scIdx]! as MaterialScenario;
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
  override deepClone(): this {
    return this;
  }
}
