import { PropertyTreeNode, } from "./property-tree-node.ts";
import { type ProjectLike, } from "./project-like.ts";
import { MaterialScenario, } from "./material-scenario.ts";
import type { MaterialAllocation, } from "./material-allocation.ts";
import type { MaterialBooking, } from "./material-booking.ts";
import type { Task, } from "./task.ts";
import type { TjTime, } from "../time/tj-time.ts";
import { ChargeSetCollection, } from "../finance/charge-set-collection.ts";
import type { ChargeSet, } from "../finance/charge-set.ts";
import type { Account, } from "./account.ts";
import { MaterialComponent, } from "./material-component.ts";

/**
 * First-class entity representing a physical input of the project (steel,
 * concrete, paint, …), with quantity, unit price and temporal distribution.
 *
 * Since phase 10 complement (C1), `Material` is a tree entity registered in
 * `project.materials` — indexable by id and navigable in the project tree, with
 * support for `note`/`journalentry` and rollup of allocations. The
 * `unit`/`unitPrice`/`chargeset` fields are kept as compatibility fields (C1.4);
 * the parser (C3) is the canonical source of attributes.
 *
 * The quantity of a material is **not** declared: it is derived from the task
 * allocations (Σ `MaterialAllocation.quantity`), as specified by 14C.11.10.
 *
 * @see docs/syntaxmesh/fases/fase-8.1-nova-funcionalidade-custos.md
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C1)
 */
export class Material extends PropertyTreeNode {
  /** Unit declared through the constructor (`kg`, `m3`, …). */
  readonly unit: string;
  /** Unit price declared through the constructor. */
  readonly unitPrice: number;
  /** Charge sets attached at construction time. */
  readonly chargeset: ChargeSetCollection;
  /**
   * Stock bookings that already produced a `CostEvent` (14C.13.7).
   *
   * The comparison is by **identity** — bookings are immutable, so a `Set` is
   * enough and turnover, which may run many times within the same parse, does
   * not duplicate the event.
   */
  private readonly emittedStockBookings = new Set<MaterialBooking>();
  /**
   * Composition visitation stack (14C.14.4): prevents a cycle between materials
   * from causing infinite recursion in `unitPriceValue()`.
   */
  private pricingStack: Set<string> | null = null;

  /**
   * Creates a material and registers it in the project tree (C1.1).
   *
   * The base `name` becomes the header label
   * (`material <id> "<label>"`), falling back to the id when no label is given
   * (compatible with an unquoted `material steel`) — this closes pending item
   * 14C.1.14.
   *
   * @param project Project that owns the material.
   * @param id Material id, also used as the fallback label.
   * @param unit Unit declared through the constructor.
   * @param unitPrice Unit price declared through the constructor.
   * @param chargeset Charge sets to attach, or `undefined` for an empty set.
   * @param parent Parent material, or `null` at the root of the hierarchy.
   * @param label Header label; defaults to `id`.
   */
  constructor(
    project: ProjectLike,
    id: string,
    unit: string,
    unitPrice: number,
    chargeset?: ChargeSetCollection,
    parent: Material | null = null,
    label?: string,
  ) {
    // Registers into the project's hierarchical PropertySet (C1.1). The base
    // `name` becomes the block label (`material <id> "<label>"`), falling back
    // to the id when not declared (compatible with a bare `material steel`) —
    // closes pending item 14C.1.14.
    super(project.materials, id, label ?? id, parent,);
    this.unit = unit;
    this.unitPrice = unitPrice;
    this.chargeset = chargeset ?? new ChargeSetCollection();
    // The base attributes `name` (label) and `id` are already written by the
    // `PropertyTreeNode` constructor (faithful to `PropertyTreeNode.rb:111,115`)
    // — hence Query lookups (`<-name->`/`<-id->`, 14C.1.14) return the label
    // and the identifier.
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new MaterialScenario(
        this,
        i,
        this.getScenarioAttributes(i,),
      );
    }
  }

  /**
   * Typed access to the scenario data of this material.
   *
   * @param scIdx Scenario index.
   * @returns The `MaterialScenario` of that scenario.
   */
  override scenarioData(scIdx: number,): MaterialScenario {
    return this.data[scIdx]! as MaterialScenario;
  }

  /**
   * Allocations of this material in the project tasks of scenario `scIdx`
   * (14C.11.10).
   *
   * It walks `project.tasks`, so it always reflects the current state of the
   * model — including after a parse with a forward reference.
   *
   * @param scIdx Scenario index.
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
   * Total quantity derived as Σ `MaterialAllocation.quantity` in the scenario.
   *
   * Replaces the old `totalquantity` of the material block (14C.11.10).
   *
   * @param scIdx Scenario index.
   */
  allocatedQuantity(scIdx: number,): number {
    return this.allocations(scIdx,).reduce((sum, a,) => sum + a.quantity, 0,);
  }

  /**
   * Cost derived from the allocations: Σ quantity × effective unit price of
   * the allocation (allocation → material, 14C.11.6).
   *
   * The realized cost (bookings) is added by the reports.
   *
   * @param scIdx Scenario index.
   */
  allocatedCost(scIdx: number,): number {
    return this.allocations(scIdx,).reduce(
      (sum, a,) => sum + a.quantity * a.unitPriceFor(this,),
      0,
    );
  }

  /**
   * Effective unit price of the material, following the precedence of Extra
   * Addendum §12.2 (confirmed in §12.4):
   *
   * 1. explicit `cost` (`unitprice` in the block or set by code);
   * 2. **computed** from the composition — Σ `quantity × component price`,
   *    recursively (a component may itself be composed);
   * 3. the constructor field (default for materials created by code).
   *
   * A composition cycle (impossible through the parser — 14C.14.6) returns 0
   * instead of overflowing the stack.
   */
  unitPriceValue(): number {
    const declared = this.providedNumber("cost",);
    if (declared !== null) return declared;
    const components = this.components(0,);
    if (components.length > 0) {
      const stack = this.pricingStack ?? new Set<string>();
      const ownsStack = this.pricingStack === null;
      if (stack.has(this.fullId,)) {
        // Cycle: returns 0 (the parser already flagged the problem).
        return 0;
      }
      stack.add(this.fullId,);
      this.pricingStack = stack;
      let total = 0;
      for (const component of components) {
        total += component.quantity * component.material.unitPriceValue();
      }
      stack.delete(this.fullId,);
      if (ownsStack) this.pricingStack = null;
      return total;
    }
    return this.unitPrice;
  }

  // ------------------------------------------------------------------
  // Composition (Extra Addendum §12.2 — 14C.14)
  // ------------------------------------------------------------------

  /**
   * Components declared in the material block (per unit of the composite).
   *
   * @param scIdx Scenario index.
   */
  components(scIdx: number,): MaterialComponent[] {
    return (this.getForScenario("materialcomponents", scIdx,) ??
      []) as MaterialComponent[];
  }

  /**
   * Whether the material is composed (computed price instead of a declared
   * one).
   *
   * @param scIdx Scenario index.
   */
  hasComponents(scIdx: number,): boolean {
    return this.components(scIdx,).length > 0;
  }

  /**
   * Walks the composition reach from this material looking for `target`.
   *
   * Used by the parser to reject cycles before attaching the component
   * (14C.14.6).
   *
   * @param target Full id of the material to look for.
   * @param scIdx Scenario index.
   */
  composes(target: string, scIdx: number,): boolean {
    for (const component of this.components(scIdx,)) {
      if (component.material.fullId === target) return true;
      if (component.material.composes(target, scIdx,)) return true;
    }
    return false;
  }

  // ------------------------------------------------------------------
  // Stock booking (Extra Addendum §12.1 — 14C.13.6)
  // ------------------------------------------------------------------

  /**
   * Stock movements declared in the material block itself (no task): positive
   * means an inflow, negative an outflow/reversal.
   *
   * @param scIdx Scenario index.
   */
  stockBookings(scIdx: number,): MaterialBooking[] {
    return (this.getForScenario("stockbookings", scIdx,) ??
      []) as MaterialBooking[];
  }

  /**
   * Quantity in stock: Σ of the movement bookings in the scenario.
   *
   * @param scIdx Scenario index.
   */
  stockQuantity(scIdx: number,): number {
    return this.stockBookings(scIdx,).reduce(
      (sum, b,) => sum + b.quantity,
      0,
    );
  }

  /**
   * Monetary value of the stock movements in the scenario (a reversal enters
   * with a negative sign).
   *
   * Not to be confused with `allocatedCost`: this is what entered/left the
   * stock, not what the tasks consumed.
   *
   * @param scIdx Scenario index.
   */
  stockCost(scIdx: number,): number {
    return this.stockBookings(scIdx,).reduce((sum, b,) => sum + b.cost(), 0,);
  }

  /**
   * Account that receives the stock movements: the material charge set in the
   * scenario (rule 2 of `resolveAccount`), otherwise the project default account
   * for materials (rule 4).
   *
   * `null` when there is no account — the parser rejects a stock booking in that
   * situation (14C.13.5).
   *
   * @param scIdx Scenario index.
   */
  stockAccount(scIdx: number,): Account | null {
    const sets = (this.getForScenario("chargeset", scIdx,) ??
      []) as ChargeSet[];
    for (const set of sets) {
      if (set.master) return set.master;
    }
    return this.project.defaultAccountFor?.("material",) ?? null;
  }

  /**
   * Whether the stock booking already produced its `CostEvent` (idempotent
   * turnover emission, 14C.13.7).
   *
   * @param booking Stock booking to test.
   */
  stockBookingEmitted(booking: MaterialBooking,): boolean {
    return this.emittedStockBookings.has(booking,);
  }

  /**
   * Marks `booking` as already emitted.
   *
   * @param booking Stock booking to record.
   */
  markStockBookingEmitted(booking: MaterialBooking,): void {
    this.emittedStockBookings.add(booking,);
  }

  /**
   * Effective unit: the `unit` attribute when set (the canonical default `"{}"`
   * means "not given"), otherwise the constructor field.
   */
  unitValue(): string {
    const unit = this.get("unit",);
    if (typeof unit === "string" && unit !== "" && unit !== "{}") return unit;
    return this.unit;
  }

  /**
   * Numeric value of the attribute when it was explicitly provided (parser,
   * `set`), otherwise `null` — this lets the constructor fields act as
   * defaults.
   *
   * @param id Attribute id to read.
   */
  private providedNumber(id: string,): number | null {
    const attr = this.getAttribute(id,);
    const value = attr.get();
    return attr.provided && typeof value === "number" ? value : null;
  }

  // ==================================================================
  // Period-derived calculations (wave C — single source of truth).
  //
  // Shared by the computed columns of `materialreport`
  // (`TableReport.genMaterialCell`) and by the `query_*` handlers of
  // `MaterialScenario`, so that `query_X` returns exactly the value of the
  // corresponding cell (query ⇄ column parity). The window is the closed period
  // `[start, end]`; a null `start`/`end` means "no window". When there are
  // `material_usage` `CostEvent`s, the cost comes from the events **without**
  // any period window — the same historical convention as the report
  // (14C.11.7 / C18).
  // ==================================================================

  /**
   * Allocations of this material together with the owning task (14C.11.10).
   *
   * @param scIdx Scenario index.
   */
  private allocationsWithTask(
    scIdx: number,
  ): Array<{ task: Task; quantity: number; allocation: MaterialAllocation }> {
    const out: Array<
      { task: Task; quantity: number; allocation: MaterialAllocation }
    > = [];
    for (const node of this.project.tasks.toArray()) {
      const list = (node.getForScenario("materialallocations", scIdx,) ??
        []) as MaterialAllocation[];
      for (const allocation of list) {
        if (allocation.material === this) {
          out.push({
            task: node as Task,
            quantity: allocation.quantity,
            allocation,
          },);
        }
      }
    }
    return out;
  }

  /**
   * Bookings (realized consumption) of this material together with the owning
   * task.
   *
   * @param scIdx Scenario index.
   */
  private bookingsWithTask(
    scIdx: number,
  ): Array<{ task: Task; booking: MaterialBooking }> {
    const out: Array<{ task: Task; booking: MaterialBooking }> = [];
    for (const node of this.project.tasks.toArray()) {
      const list = (node.getForScenario("materialbookings", scIdx,) ??
        []) as MaterialBooking[];
      for (const booking of list) {
        if (booking.material === this) {
          out.push({ task: node as Task, booking, },);
        }
      }
    }
    return out;
  }

  /**
   * Whether the owning task crosses the period `[start, end]`. Without a
   * schedule it always does.
   *
   * @param task Task that owns the allocation or booking.
   * @param scIdx Scenario index.
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   */
  private static crossesPeriod(
    task: Task,
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): boolean {
    if (!start || !end) return true;
    const s = task.getForScenario("start", scIdx,) as TjTime | null;
    const e = task.getForScenario("end", scIdx,) as TjTime | null;
    if (!s || !e) return true;
    return !(e.compareTo(start,) < 0 || s.compareTo(end,) > 0);
  }

  /**
   * Effective cost of a booking (precedence booking → allocation → material).
   *
   * @param booking Booking to price.
   * @param scIdx Scenario index.
   */
  private bookingEffectiveCost(
    booking: MaterialBooking,
    scIdx: number,
  ): number {
    const task = booking.task;
    const allocation = task
      ? this.allocationsWithTask(scIdx,)
        .find((a,) => a.task === task)?.allocation ?? null
      : null;
    return booking.cost(allocation,);
  }

  /**
   * Whether there is a `material_usage` `CostEvent` for this material in the
   * scenario.
   *
   * @param scIdx Scenario index.
   */
  private hasCostEvents(scIdx: number,): boolean {
    return this.project.costEvents.some((ce,) =>
      ce.type === "material_usage" && ce.material === this &&
      ce.scenarioIdx === scIdx
    );
  }

  /**
   * Sum of the `material_usage` `CostEvent`s; a null `mode` means planned +
   * actual.
   *
   * @param scIdx Scenario index.
   * @param mode Cost mode to filter by, or `null` for both.
   */
  private costEventsSum(
    scIdx: number,
    mode: "planned" | "actual" | null,
  ): number {
    let sum = 0;
    for (const ce of this.project.costEvents) {
      if (
        ce.type !== "material_usage" || ce.material !== this ||
        ce.scenarioIdx !== scIdx
      ) continue;
      if (mode === null || ce.mode === mode) sum += ce.amount;
    }
    return sum;
  }

  /** Cost of the allocations inside the period (with the effective allocation
   * price).
   *
   * @param scIdx Scenario index.
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   * @returns `null` when the material has no allocations at all.
   */
  private allocationCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number | null {
    const allocs = this.allocationsWithTask(scIdx,);
    if (allocs.length === 0) return null;
    let sum = 0;
    for (const { task, allocation, } of allocs) {
      if (!Material.crossesPeriod(task, scIdx, start, end,)) continue;
      sum += allocation.quantity * allocation.unitPriceFor(this,);
    }
    return sum;
  }

  /**
   * Cost of the bookings inside the period (with the effective booking price).
   *
   * @param scIdx Scenario index.
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   * @returns `null` when the material has no bookings at all.
   */
  private bookingCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number | null {
    const bookings = this.bookingsWithTask(scIdx,);
    if (bookings.length === 0) return null;
    let sum = 0;
    for (const { task, booking, } of bookings) {
      if (!Material.crossesPeriod(task, scIdx, start, end,)) continue;
      // Wave D3: a temporal booking only counts the part of the period; the
      // legacy path keeps the whole old route (per-task gate, full value).
      if (booking.isTemporal()) {
        if (!booking.overlapsPeriod(start, end,)) continue;
        const allocation = this.allocationsWithTask(scIdx,)
          .find((a,) => a.task === task)?.allocation ?? null;
        sum += booking.costInPeriod(start, end, allocation,);
        continue;
      }
      sum += this.bookingEffectiveCost(booking, scIdx,);
    }
    return sum;
  }

  /**
   * `totalquantity`: Σ of the quantities allocated inside the period.
   *
   * @param scIdx Scenario index.
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   */
  allocatedQuantityInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    let sum = 0;
    for (const { task, quantity, } of this.allocationsWithTask(scIdx,)) {
      if (!Material.crossesPeriod(task, scIdx, start, end,)) continue;
      sum += quantity;
    }
    return sum;
  }

  /**
   * Consumed quantity (Σ of the bookings that have a task inside the period).
   *
   * @param scIdx Scenario index.
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   */
  consumedQuantityInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    let sum = 0;
    for (const { task, booking, } of this.bookingsWithTask(scIdx,)) {
      if (!Material.crossesPeriod(task, scIdx, start, end,)) continue;
      // Wave D3: temporal ⇒ part of the period (with an overlap gate).
      if (booking.isTemporal()) {
        if (!booking.overlapsPeriod(start, end,)) continue;
        sum += booking.quantityInPeriod(start, end,);
        continue;
      }
      sum += booking.quantity;
    }
    return sum;
  }

  /**
   * `scheduledcost`: planned value (`CostEvent` first, then allocations in the
   * period).
   *
   * @param scIdx Scenario index.
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   */
  scheduledCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    if (this.hasCostEvents(scIdx,)) {
      return this.costEventsSum(scIdx, "planned",);
    }
    return this.allocationCostInPeriod(scIdx, start, end,) ?? 0;
  }

  /**
   * `actualcost`: actual value (`CostEvent` first, then bookings in the
   * period).
   *
   * @param scIdx Scenario index.
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   */
  actualCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    if (this.hasCostEvents(scIdx,)) return this.costEventsSum(scIdx, "actual",);
    return this.bookingCostInPeriod(scIdx, start, end,) ?? 0;
  }

  /**
   * `totalcost`: planned + actual (`CostEvent` first, then allocations +
   * bookings).
   *
   * @param scIdx Scenario index.
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   */
  totalCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    if (this.hasCostEvents(scIdx,)) return this.costEventsSum(scIdx, null,);
    return (this.allocationCostInPeriod(scIdx, start, end,) ?? 0) +
      (this.bookingCostInPeriod(scIdx, start, end,) ?? 0);
  }

  /**
   * Stock bookings (movements **without** a task) inside the closed period.
   *
   * @param scIdx Scenario index.
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   */
  private stockBookingsInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): MaterialBooking[] {
    return this.stockBookings(scIdx,).filter((booking,) => {
      if (!booking.isInventory()) return false;
      if (!start || !end) return true;
      // Wave D3: temporal ⇒ any interval crossing the period; legacy ⇒ the old
      // point comparison, untouched.
      if (booking.isTemporal()) {
        return booking.overlapsPeriod(start, end,);
      }
      return booking.date.compareTo(start,) >= 0 &&
        booking.date.compareTo(end,) <= 0;
    },);
  }

  /**
   * `stockquantity`: algebraic Σ of the stock quantities inside the period.
   *
   * @param scIdx Scenario index.
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   */
  stockQuantityInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    let sum = 0;
    for (const booking of this.stockBookingsInPeriod(scIdx, start, end,)) {
      sum += booking.isTemporal()
        ? booking.quantityInPeriod(start, end,)
        : booking.quantity;
    }
    return sum;
  }

  /**
   * `stockcost`: algebraic Σ of the stock values inside the period.
   *
   * @param scIdx Scenario index.
   * @param start Period start, or `null` for no lower bound.
   * @param end Period end, or `null` for no upper bound.
   */
  stockCostInPeriod(
    scIdx: number,
    start: TjTime | null,
    end: TjTime | null,
  ): number {
    let sum = 0;
    for (const booking of this.stockBookingsInPeriod(scIdx, start, end,)) {
      sum += booking.isTemporal()
        ? booking.costInPeriod(start, end,)
        : booking.cost();
    }
    return sum;
  }

  /**
   * Immutable deep copy.
   *
   * Returns `this` (immutable) for compatibility with `deepClone`.
   */
  override deepClone(): this {
    return this;
  }
}
