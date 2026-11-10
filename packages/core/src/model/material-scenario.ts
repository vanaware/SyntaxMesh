/**
 * Material scenario (phase 10 Complemento C1.2; queries from wave C / 14-C).
 *
 * Material is a new entity (there is no `MaterialScenario` in TaskJuggler Ruby),
 * so the shape mirrors `account-scenario.ts`, with ADR 016 pre-loading of the
 * `effortdone`/`effortleft` scenario attributes used by the material allocation
 * rollup.
 *
 * The `query_*` handlers (wave C) **mirror the computed columns of
 * `materialreport`**: each one delegates to the same single source of truth used
 * by `TableReport.genMaterialCell` (the `*InPeriod` methods of `Material`),
 * applying the period cut of the query itself (`query.start`/`query.end`). That
 * keeps `query_X` and the corresponding cell in parity without duplicating the
 * arithmetic. There is no Ruby oracle here: the BDD tests are the source of
 * truth.
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C1)
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento.md (Onda C)
 */
import { ScenarioData, } from "./scenario-data.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";
import type { Material, } from "./material.ts";
import type { TjTime, } from "../time/tj-time.ts";

/** Scenario attributes pre-loaded for Material (ADR 016). */
export const MATERIAL_SCENARIO_ATTRS: string[] = ["effortdone", "effortleft",];

/**
 * Structural subset of `Query` consumed by the MaterialScenario `query_*`
 * handlers.
 *
 * Declared locally (instead of importing the query layer) to keep the model
 * decoupled and avoid circular imports; the real `Query` object satisfies this
 * shape at runtime through dynamic dispatch
 * (`dataMethod.call(scenarioData, this)`).
 */
export interface MaterialScenarioQuery {
  /** Scenario the query is evaluated in. */
  scenarioIdx?: number | undefined;
  /** Start of the reporting period, or `null` for no lower bound. */
  start?: TjTime | null;
  /** End of the reporting period, or `null` for no upper bound. */
  end?: TjTime | null;
  /** Value used when the column is sorted. */
  sortable?: unknown;
  /** Numeric value of the column. */
  numerical?: number | null;
  /** Text value of the column. */
  string?: string | null;
  /** Formatter for the string column of numbers. */
  numberFormat?: { format(n: number,): string } | null;
}

/**
 * Computed state of one material in one scenario.
 *
 * The material variant of `ScenarioData`: it pre-loads the effort attributes
 * and answers the material-specific `query_*` columns for `materialreport`.
 */
export class MaterialScenario extends ScenarioData {
  /**
   * Creates the material scenario state and pre-loads its attributes.
   *
   * @param material Material this state belongs to.
   * @param scIdx Scenario index.
   * @param attributes Scenario attribute map of the material.
   */
  constructor(
    material: PropertyLike,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(material, scIdx, attributes,);
    this.preloadAttributes(MATERIAL_SCENARIO_ATTRS,);
  }

  /** The material that owns this scenario. */
  private get mat(): Material {
    return this.property as unknown as Material;
  }

  /** Index of the scenario this state belongs to. */
  private get scIdx(): number {
    return this.getScenarioIdx();
  }

  /** Closed period `[start, end]` of the query (`null` means no cut). */
  private period(
    query: MaterialScenarioQuery,
  ): [TjTime | null, TjTime | null,] {
    return [query.start ?? null, query.end ?? null,];
  }

  /** Publishes a numeric result (sortable = numerical = value). */
  private setNum(query: MaterialScenarioQuery, value: number,): void {
    query.sortable = query.numerical = value;
    query.string = query.numberFormat
      ? query.numberFormat.format(value,)
      : String(value,);
  }

  // ------------------------------------------------------------------
  // query_* — parity with the materialreport columns (wave C).
  // ------------------------------------------------------------------

  /** Effective unit price (`unitprice` column): per unit, not the total. */
  query_unitprice(query: MaterialScenarioQuery,): void {
    this.setNum(query, this.mat.unitPriceValue(),);
  }

  /** Quantity allocated in the period (`totalquantity` column). */
  query_effort(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(
      query,
      this.mat.allocatedQuantityInPeriod(this.scIdx, start, end,),
    );
  }

  /**
   * Total **planned** cost in the period (`totalcost` column): the cost the
   * material represents over the interval — `CostEvent` (planned + actual)
   * when there are events, otherwise allocations + bookings.
   *
   * It is called `query_totalcost` (not `query_cost`) on purpose: the material's
   * base `cost` attribute is the **price per unit** (`unitPriceValue` reads
   * `providedNumber("cost")`), and `Query.process` reaches
   * `query_<attributeId>` before the base attribute. A `query_cost` would
   * hijack `<-cost->` (which must return the unit price, cf.
   * `trace-report-material_14c_test.ts`). The name `totalcost` matches the real
   * keyword of the materialreport column.
   */
  query_totalcost(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(query, this.mat.totalCostInPeriod(this.scIdx, start, end,),);
  }

  /** Planned cost (`scheduledcost` column). */
  query_scheduledcost(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(
      query,
      this.mat.scheduledCostInPeriod(this.scIdx, start, end,),
    );
  }

  /** Actual cost (`actualcost` column). */
  query_actualcost(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(query, this.mat.actualCostInPeriod(this.scIdx, start, end,),);
  }

  /**
   * Remaining cost in the period: planned total minus the actual one. No
   * counterpart column in the materialreport — BDD definition (SyntaxMesh
   * extension).
   */
  query_remainingcost(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    const scIdx = this.scIdx;
    const total = this.mat.totalCostInPeriod(scIdx, start, end,);
    const actual = this.mat.actualCostInPeriod(scIdx, start, end,);
    this.setNum(query, total - actual,);
  }

  /**
   * Remaining quantity in the period: allocated minus consumed (Σ bookings with
   * a task). No counterpart column — BDD definition (SyntaxMesh extension).
   */
  query_remaining(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    const scIdx = this.scIdx;
    const allocated = this.mat.allocatedQuantityInPeriod(scIdx, start, end,);
    const consumed = this.mat.consumedQuantityInPeriod(scIdx, start, end,);
    this.setNum(query, allocated - consumed,);
  }

  /** Algebraic Σ of the stock quantities in the period (`stockquantity` column). */
  query_stockquantity(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(
      query,
      this.mat.stockQuantityInPeriod(this.scIdx, start, end,),
    );
  }

  /** Algebraic Σ of the stock values in the period (`stockcost` column). */
  query_stockcost(query: MaterialScenarioQuery,): void {
    const [start, end,] = this.period(query,);
    this.setNum(query, this.mat.stockCostInPeriod(this.scIdx, start, end,),);
  }
}
