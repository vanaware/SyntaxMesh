import { PropertyTreeNode, } from "./property-tree-node.ts";
import { type ProjectLike, } from "./project-like.ts";
import { MaterialScenario, } from "./material-scenario.ts";
import type { MaterialAllocation, } from "./material-allocation.ts";
import { ChargeSetCollection, } from "../finance/charge-set-collection.ts";

/**
 * Entidade de primeira classe representando um insumo físico do projeto
 * (aço, concreto, tinta etc.), com quantidade, preço unitário e
 * distribuição temporal.
 *
 * Desde a Fase 10 Complemento (C1), `Material` é uma entidade de árvore
 * registrada em `project.materials` — indexável por ID e navegável na
 * árvore do projeto, com suporte a `note`/`journalentry`/rollup de
 * allocations. Os campos `unit`/`unitPrice`/`chargeset` são mantidos como
 * campos de compatibilidade (C1.4); o parser (C3) é a fonte canônica dos
 * atributos.
 *
 * A quantidade de um material **não** é declarada: é derivada das alocações
 * das tarefas (Σ `MaterialAllocation.quantity`), conforme a 14C.11.10.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C1)
 */
export class Material extends PropertyTreeNode {
  readonly unit: string;
  readonly unitPrice: number;
  readonly chargeset: ChargeSetCollection;

  constructor(
    project: ProjectLike,
    id: string,
    unit: string,
    unitPrice: number,
    chargeset?: ChargeSetCollection,
    parent: Material | null = null,
  ) {
    // Registra no PropertySet hierárquico do projeto (C1.1).
    super(project.materials, id, id, parent,);
    this.unit = unit;
    this.unitPrice = unitPrice;
    this.chargeset = chargeset ?? new ChargeSetCollection();
    // Atributos base espelhados em `AttributeBase` para que consultas Query
    // (`<-name->`/`<-id->`, 14C.1.14) devolvam o identificador do material: o
    // PTN guarda esses dois valores em campos, não no atributo.
    this.set("name", id,);
    this.set("id", id,);
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
   * Alocações deste material nas tarefas do projeto no cenário `scIdx`
   * (14C.11.10). Percorre `project.tasks`, então reflete sempre o estado
   * atual do modelo — inclusive depois de um parse com referência futura.
   */
  allocations(scIdx: number,): MaterialAllocation[] {
    const out: MaterialAllocation[] = [];
    for (const node of this.project.tasks.toArray()) {
      const list = (node.getForScenario("materialallocations", scIdx,) ??
        []) as MaterialAllocation[];
      for (const allocation of list) {
        if (allocation.material === this) out.push(allocation,);
      }
    }
    return out;
  }

  /**
   * Quantidade total derivada: Σ `MaterialAllocation.quantity` no cenário.
   * Substitui o antigo `totalquantity` do bloco de material (14C.11.10).
   */
  allocatedQuantity(scIdx: number,): number {
    return this.allocations(scIdx,).reduce((sum, a,) => sum + a.quantity, 0,);
  }

  /**
   * Custo derivado das alocações: Σ quantidade × preço unitário efetivo da
   * alocação (alocação → material, 14C.11.6). O custo realizado (bookings)
   * é somado pelos relatórios.
   */
  allocatedCost(scIdx: number,): number {
    return this.allocations(scIdx,).reduce(
      (sum, a,) => sum + a.quantity * a.unitPriceFor(this,),
      0,
    );
  }

  /**
   * Preço unitário efetivo: o atributo `cost` quando o parser/usuário o
   * forneceu, senão o campo do construtor (default para materiais criados por
   * código).
   */
  unitPriceValue(): number {
    return this.providedNumber("cost",) ?? this.unitPrice;
  }

  /**
   * Unidade efetiva: o atributo `unit` quando preenchido (o default canônico
   * `"{}"` significa “não informado”), senão o campo do construtor.
   */
  unitValue(): string {
    const unit = this.get("unit",);
    if (typeof unit === "string" && unit !== "" && unit !== "{}") return unit;
    return this.unit;
  }

  /**
   * Valor numérico do atributo se ele foi explicitamente fornecido (parser,
   * `set`), senão `null` — deixa os campos do construtor valerem como default.
   */
  private providedNumber(id: string,): number | null {
    const attr = this.getAttribute(id,);
    const value = attr.get();
    return attr.provided && typeof value === "number" ? value : null;
  }

  /**
   * Cópia profunda imutável.
   * Retorna this (imutável) para compatibilidade com deepClone.
   */
  override deepClone(): this {
    return this;
  }
}
