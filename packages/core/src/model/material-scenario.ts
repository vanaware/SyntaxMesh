/**
 * Cenário de Material (Fase 10 Complemento C1.2; queries da Onda C / 14-C).
 *
 * Material é entidade nova (sem MaterialScenario no TJ Ruby); a forma
 * espelha `account-scenario.ts`, com pré-carregamento ADR 016 dos
 * atributos de cenário `effortdone`/`effortleft` usados pelo rollup dos
 * allocations de material (#2).
 *
 * Os `query_*` (Onda C) **espelham as colunas calculadas do materialreport**:
 * cada um delega à mesma fonte única de verdade usada por
 * `TableReport.genMaterialCell` (os métodos `*InPeriod` de `Material`),
 * aplicando o recorte de período da própria query (`query.start`/`query.end`).
 * Isso garante paridade `query_X` ⇄ célula correspondente sem duplicar a
 * matemática. Não há oracle Ruby: os testes BDD são a fonte de verdade.
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C1)
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md (Onda C)
 */
import { ScenarioData, } from "./scenario-data.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";
import type { Material, } from "./material.ts";
import type { TjTime, } from "../time/tj-time.ts";

/** Atributos de cenário pré-carregados para Material (ADR 016). */
export const MATERIAL_SCENARIO_ATTRS: string[] = ["effortdone", "effortleft",];

/**
 * Subconjunto estrutural de `Query` consumido pelos `query_*` de
 * MaterialScenario. Definido localmente (em vez de importar a camada de
 * query) para manter o modelo desacoplado e evitar imports circulares; o
 * objeto `Query` real satisfaz esta forma em runtime via dispatch dinâmico
 * (`dataMethod.call(scenarioData, this)`).
 */
interface MaterialScenarioQuery {
  scenarioIdx?: number | undefined;
  start?: TjTime | null;
  end?: TjTime | null;
  sortable?: unknown;
  numerical?: number | null;
  string?: string | null;
  numberFormat?: { format(n: number,): string } | null;
}

export class MaterialScenario extends ScenarioData {
  constructor(
    material: PropertyLike,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(material, scIdx, attributes,);
    this.preloadAttributes(MATERIAL_SCENARIO_ATTRS,);
  }

  /** O material dono deste cenário. */
  private get mat(): Material {
    return this.property as unknown as Material;
  }

  private get scIdx(): number {
    return this.getScenarioIdx();
  }

  /** Período fechado `[start, end]` da query (null = sem recorte). */
  private period(
    query: MaterialScenarioQuery,
  ): [TjTime | null, TjTime | null,] {
    return [query.start ?? null, query.end ?? null,];
  }

  /** Publica um resultado numérico (sortable = numerical = valor). */
  private setNum(query: MaterialScenarioQuery, value: number,): void {
    query.sortable = query.numerical = value;
    query.string = query.numberFormat
      ? query.numberFormat.format(value,)
      : String(value,);
  }

  // ------------------------------------------------------------------
  // query_* — paridade com as colunas do materialreport (Onda C).
  // ------------------------------------------------------------------

  /** Preço unitário efetivo (coluna `unitprice`): unidade, não total. */
  query_unitprice(query: MaterialScenarioQuery,): void {
    this.setNum(query, this.mat.unitPriceValue(),);
  }

  /** Quantidade alocada no período (coluna `totalquantity`). */
  query_effort(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(
      query,
      this.mat.allocatedQuantityInPeriod(this.scIdx, start, end,),
    );
  }

  /**
   * Custo **planejado** total no período (coluna `totalcost`): o custo que o
   * material representa ao longo do intervalo — `CostEvent` (planejado +
   * realizado) quando há eventos, senão alocações + bookings.
   */
  query_cost(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(query, this.mat.totalCostInPeriod(this.scIdx, start, end,),);
  }

  /** Custo planejado (coluna `scheduledcost`). */
  query_scheduledcost(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(
      query,
      this.mat.scheduledCostInPeriod(this.scIdx, start, end,),
    );
  }

  /** Custo realizado (coluna `actualcost`). */
  query_actualcost(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(query, this.mat.actualCostInPeriod(this.scIdx, start, end,),);
  }

  /**
   * Custo restante no período: total planejado menos o realizado. Sem coluna
   * homóloga no materialreport — definição BDD (extensão SyntaxMesh).
   */
  query_remainingcost(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    const scIdx = this.scIdx;
    const total = this.mat.totalCostInPeriod(scIdx, start, end,);
    const actual = this.mat.actualCostInPeriod(scIdx, start, end,);
    this.setNum(query, total - actual,);
  }

  /**
   * Quantidade restante no período: alocada menos consumida (Σ bookings com
   * tarefa). Sem coluna homóloga — definição BDD (extensão SyntaxMesh).
   */
  query_remaining(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    const scIdx = this.scIdx;
    const allocated = this.mat.allocatedQuantityInPeriod(scIdx, start, end,);
    const consumed = this.mat.consumedQuantityInPeriod(scIdx, start, end,);
    this.setNum(query, allocated - consumed,);
  }

  /** Σ algébrico das quantidades de estoque no período (coluna `stockquantity`). */
  query_stockquantity(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(
      query,
      this.mat.stockQuantityInPeriod(this.scIdx, start, end,),
    );
  }

  /** Σ algébrico dos valores de estoque no período (coluna `stockcost`). */
  query_stockcost(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(query, this.mat.stockCostInPeriod(this.scIdx, start, end,),);
  }
}
