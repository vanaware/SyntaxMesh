import { ScenarioData, } from "./scenario-data.ts";
import { type PropertyLike, } from "./property-like.ts";
import { type AttributeBase, } from "../attributes/attribute-base.ts";
import { type Account, } from "./account.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type AccountCredit, } from "../finance/account-credit.ts";
import { type TjTime, } from "../time/tj-time.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { TjInternalError, } from "./errors.ts";
import { Material, } from "./material.ts";
import type { MaterialBooking, } from "./material-booking.ts";
import { Task, } from "./task.ts";
import type { ChargeBooking, } from "./charge-booking.ts";
import { type CostLine, resolveAccount, } from "../accounting/attribution.ts";
import { createCostEvent, } from "../accounting/cost-event.ts";

/**
 * The slice of a query the balance and turnover reports rely on.
 *
 * Required members: `start`, `end`, `sortable`, `numerical`, `string` and
 * `currencyFormat`. The model declares its own shape instead of importing the
 * query layer, so the two never form a cycle; the object handed over by
 * `Query.process` satisfies it.
 *
 * `currencyFormat` is nullable while the project has no currency default: the
 * report inherits the attribute from the project, and without the guard an
 * account report failed with `Cannot read properties of null (reading
 * 'format')` instead of falling back to plain formatting.
 *
 * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb#query_balance
 */
export interface AccountScenarioQuery {
  /** Report interval start. */
  readonly start: TjTime;
  /** Report interval end. */
  readonly end: TjTime;
  /** Value used when the column is sorted. */
  sortable: number;
  /** Value used when the column is aggregated. */
  numerical: number;
  /** Textual value of the cell being produced. */
  string: string;
  /** Formatter for money amounts, or `null` when no currency is known. */
  readonly currencyFormat: {
    format(amount: number,): string;
  } | null;
}

/**
 * Subtotals per kind of cost (charge, resource, material).
 *
 * The `charge` bucket receives the `task_charge` events (task charge booking or
 * cost). The **event type** name (`task_charge`) is faithful to Ruby and does
 * not change; what changed — wave D1 — is the bucket name, previously `task`.
 */
export interface AccountBuckets {
  /** Totals of `task_charge` events. */
  charge: number;
  /** Totals of `resource_effort` events. */
  resource: number;
  /** Totals of `material_usage` events. */
  material: number;
}

/**
 * Attributes pre-loaded by the Ruby AccountScenario (AccountScenario.rb, lines
 * 17–20).
 */
export const ACCOUNT_SCENARIO_ATTRS: string[] = ["credits",];

/**
 * Accounting state of one account in one scenario.
 *
 * Holds the running subtotals (one bucket per kind of cost) plus the scenario
 * attribute layer inherited from `ScenarioData`, from which the `balance`,
 * `cost` and `revenue` columns are computed.
 */
export class AccountScenario extends ScenarioData {
  private buckets: AccountBuckets = { charge: 0, resource: 0, material: 0, };

  /**
   * Creates the accounting state and pre-loads the `credits` attribute.
   *
   * @param account Account this state belongs to.
   * @param scIdx Scenario index.
   * @param attributes Scenario attribute map of the account.
   */
  constructor(
    account: unknown,
    scIdx: number,
    attributes: Map<string, AttributeBase<unknown>>,
  ) {
    super(
      account as PropertyLike,
      scIdx,
      attributes,
    );
    this.preloadAttributes(ACCOUNT_SCENARIO_ATTRS,);
  }

  /**
   * Returns the value of an account attribute (not of the scenario), including
   * inheritance and default values. Used for attributes such as 'aggregate'.
   */
  getAccountAttribute(id: string,): unknown {
    return (this.property as PropertyTreeNode).get(id,);
  }

  /**
   * Computes the turnover for the period between _startIdx_ and _endIdx_.
   *
   * Replicates the Ruby method `AccountScenario#turnover`.
   *
   * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb#turnover
   */
  turnover(startIdx: number, endIdx: number,): number {
    // Reset the buckets on every call.
    this.buckets = { charge: 0, resource: 0, material: 0, };

    let amount = 0.0;

    // 1. Manual credits
    const credits = this.a("credits",) as AccountCredit[];
    if (credits && credits.length > 0) {
      const project =
        (this.property as PropertyLike & { project: ProjectLike }).project;
      const startDate = project.idxToDate(startIdx,);
      const endDate = project.idxToDate(endIdx,);
      for (const credit of credits) {
        if (startDate <= credit.date && credit.date < endDate) {
          amount += credit.amount;
        }
      }
    }

    // 2. Container logic (children or meta-account)
    const property = this.property as PropertyLike & {
      container?: () => boolean;
      adoptees?: PropertyLike[];
      children?: PropertyLike[];
    };
    if (property.container?.()) {
      const adoptees = property.adoptees ?? [];
      if (adoptees.length === 0) {
        // Normal case: accumulate turnover of child accounts
        for (const child of property.children ?? []) {
          const childAccount = child as unknown as Account;
          const childAmount = childAccount.scenarioData(this.scenarioIdx,)
            .turnover(startIdx, endIdx,);
          amount += childAmount;
          // Buckets are inherited from the children.
          const childBuckets = childAccount.scenarioData(this.scenarioIdx,)
            .getBuckets();
          this.buckets.charge += childBuckets.charge;
          this.buckets.resource += childBuckets.resource;
          this.buckets.material += childBuckets.material;
        }
      } else {
        // Special case for meta account used to calculate a balance.
        // The first adoptee is the top-level cost account, the second the top-level revenue account.
        const costAmount = -(adoptees[0] as unknown as Account).scenarioData(
          this.scenarioIdx,
        ).turnover(startIdx, endIdx,);
        const revenueAmount = (adoptees[1] as unknown as Account).scenarioData(
          this.scenarioIdx,
        ).turnover(startIdx, endIdx,);
        amount += costAmount + revenueAmount;
        const costBuckets = (adoptees[0] as unknown as Account).scenarioData(
          this.scenarioIdx,
        ).getBuckets();
        const revenueBuckets = (adoptees[1] as unknown as Account).scenarioData(
          this.scenarioIdx,
        ).getBuckets();
        this.buckets.charge += -costBuckets.charge + revenueBuckets.charge;
        this.buckets.resource += -costBuckets.resource +
          revenueBuckets.resource;
        this.buckets.material += -costBuckets.material +
          revenueBuckets.material;
      }
    } else {
      // Leaf: aggregate by type (tasks or resources)
      const aggregate = this.getAccountAttribute("aggregate",) as string;
      const project =
        (this.property as PropertyLike & { project: ProjectLike }).project;

      // Wave D2: `charges` is the canonical form; `tasks` is a reading alias
      // (tj3 / Ruby default :tasks) — the same aggregation regime.
      if (aggregate === "charges" || aggregate === "tasks") {
        project.tasks.each((task,) => {
          // Cast to Account to access scenarioData, then to TaskScenario for turnover with 5 args
          const taskAccount = task as unknown as Account;
          const taskScenario = taskAccount.scenarioData(
            this.scenarioIdx,
          ) as unknown as {
            turnover(
              startIdx: number,
              endIdx: number,
              account: unknown,
              resource: unknown,
              includeKids: boolean,
            ): number;
          };
          const taskAmount = taskScenario.turnover(
            startIdx,
            endIdx,
            this.property,
            null,
            false,
          );
          amount += taskAmount;
          this.buckets.charge += taskAmount;
        },);
        // 14C.15.4 / plan §13.7 (`booking charge …`): realized expenses
        // declared on a task (or via a resource/material pointing back to a
        // task). Each booking resolves to an account via `resolveAccount`
        // (rule 3: task chargeset; rule 4: project `defaultaccount`) and, when
        // the resolved account is this leaf or a descendant, contributes its
        // in-window amount. The emission is idempotent (`Task.emittedChargeBookings`).
        for (const node of project.tasks.toArray()) {
          if (!(node instanceof Task)) continue;
          amount += this.addChargeBookings(
            node,
            project,
            startIdx,
            endIdx,
          );
        }
      } else if (aggregate === "resources") {
        project.resources.each((resource,) => {
          if (resource.leaf?.()) {
            const resourceAccount = resource as unknown as Account;
            const resourceScenario = resourceAccount.scenarioData(
              this.scenarioIdx,
            ) as unknown as {
              turnover(
                startIdx: number,
                endIdx: number,
                account: unknown,
                resource: unknown,
                includeKids: boolean,
              ): number;
            };
            const resourceAmount = resourceScenario.turnover(
              startIdx,
              endIdx,
              this.property,
              null,
              false,
            );
            amount += resourceAmount;
            this.buckets.resource += resourceAmount;
          }
        },);
      } else if (aggregate === "materials") {
        // Material aggregation: sum the allocation-derived cost of all
        // materials (14C.1.19 / 14C.11.10 — materials live in
        // `project.materials`, the quantity comes from the allocations).
        const scIdx = this.scenarioIdx;
        project.materials.each?.((material,) => {
          const materialObj = material as unknown as {
            allocatedCost?: (scIdx: number,) => number;
          };
          if (typeof materialObj.allocatedCost === "function") {
            const materialAmount = materialObj.allocatedCost(scIdx,);
            amount += materialAmount;
            this.buckets.material += materialAmount;
          }
        },);
        // Stock bookings (Extra Addendum §12.1 / 14C.13.7): they enter the
        // account the material resolves to (chargeset → material
        // defaultaccount), with the date inside `[start, end)` — like
        // `@credits` above and `AccountScenario.rb:57-68`. Unlike the
        // allocations, a stock booking is a **real** value (`actual` mode) and
        // reverses when the quantity is negative.
        for (const node of project.materials.toArray()) {
          if (!(node instanceof Material)) continue;
          amount += this.addStockBookings(node, project, startIdx, endIdx,);
        }
      } else {
        throw new Error(`Unknown aggregation type ${aggregate}`,);
      }
    }

    // Block I: fills the buckets from the CostEvents emitted by the
    // attribution engine. This is the new behavior for leaf (non-container)
    // accounts.
    if (!property.container?.()) {
      const project =
        (this.property as PropertyLike & { project: ProjectLike }).project;
      const scIdx = this.scenarioIdx;
      const account = this.property as unknown as Account;

      // Filter the CostEvents for this scenario and account (or its children)
      for (const event of project.costEvents) {
        if (event.scenarioIdx !== scIdx) continue;
        if (!event.account) continue;
        // Check whether the event belongs to this account or to a child
        if (
          event.account === account ||
          (event.account as Account).isChildOf(account,)
        ) {
          // Classify by type
          switch (event.type) {
            case "task_charge":
              this.buckets.charge += event.amount;
              break;
            case "resource_effort":
              this.buckets.resource += event.amount;
              break;
            case "material_usage":
              this.buckets.material += event.amount;
              break;
          }
        }
      }
    }

    return amount;
  }

  /**
   * Returns the current buckets (as of the last turnover call).
   */
  getBuckets(): AccountBuckets {
    return { ...this.buckets, };
  }

  /**
   * Sums the stock bookings of `material` that belong **to this account**
   * (material chargeset → rule 2 of `resolveAccount`; project default account
   * for material → rule 4) and whose date is inside `[start, end)`.
   * Each booking also emits a `material_usage` `CostEvent` in `actual` mode for
   * the auditable reports (`breakdownreport`, RDO) — the emission is
   * idempotent: an already emitted booking does not enter again on subsequent
   * turnover calls.
   *
   * @returns The value (positive = incoming, negative = reversal) to add.
   */
  private addStockBookings(
    material: Material,
    project: ProjectLike,
    startIdx: number,
    endIdx: number,
  ): number {
    const account = this.property as unknown as Account;
    const scIdx = this.scenarioIdx;
    const startDate = project.idxToDate(startIdx,);
    const endDate = project.idxToDate(endIdx,);
    const destination = material.stockAccount(scIdx,);
    if (!destination) return 0;
    const isMine = destination === account ||
      destination.isChildOf(account as unknown as PropertyTreeNode,);
    if (!isMine) return 0;

    let added = 0;
    for (const booking of material.stockBookings(scIdx,)) {
      let value: number;
      if (booking.isTemporal()) {
        // Wave D3 (D-e): a temporal booking enters with the part falling in
        // the `[start, end]` turnover window; the window between buckets is
        // `[start, end)`.
        if (!booking.overlapsPeriod(startDate, endDate,)) continue;
        value = booking.costInPeriod(startDate, endDate,);
      } else {
        if (!(startDate <= booking.date && booking.date < endDate)) continue;
        value = booking.cost();
      }
      if (value === 0) continue;
      if (!material.stockBookingEmitted(booking,)) {
        const line: CostLine = {
          type: "material_usage",
          amount: value,
          material,
          project,
        };
        const attribution = resolveAccount(line,);
        project.costEvents.push(
          createCostEvent(
            line,
            attribution.account,
            attribution.rule,
            scIdx,
            "actual",
          ),
        );
        material.markStockBookingEmitted(booking,);
      }
      this.buckets.material += value;
      added += value;
    }
    return added;
  }

  /**
   * Sums the charge bookings of `task` (14C.15.4 / plan §13.7) that resolve to
   * **this account** (or a descendant) and whose value falls inside
   * `[start, end]`. Each booking also emits a `task_charge` `CostEvent` in
   * `actual` mode so auditable reports (`breakdownreport`, RDO) can trace it
   * back to the source. Emission is idempotent via
   * `Task#chargeBookingEmitted`/`markChargeBookingEmitted`.
   *
   * The destination follows `resolveAccount` — rule 3 (task chargeset) when the
   * task carries one, rule 4 (`defaultaccount`) otherwise. Symmetric to
   * {@link addStockBookings} for material stock bookings.
   *
   * @param task Task that owns the `chargebookings` scenario attribute.
   * @param project Project providing `idxToDate` and `costEvents`.
   * @param startIdx Turnover-window start (scoreboard index, inclusive).
   * @param endIdx Turnover-window end (scoreboard index, exclusive).
   * @returns The value to add (positive = outgoing, negative = reversal).
   */
  private addChargeBookings(
    task: Task,
    project: ProjectLike,
    startIdx: number,
    endIdx: number,
  ): number {
    const account = this.property as unknown as Account;
    const scIdx = this.scenarioIdx;
    const startDate = project.idxToDate(startIdx,);
    const endDate = project.idxToDate(endIdx,);

    let added = 0;
    for (const booking of task.chargeBookings(scIdx,) as ChargeBooking[]) {
      const value = booking.amountInPeriod(startDate, endDate,);
      if (value === 0) continue;

      const line: CostLine = {
        type: "task_charge",
        amount: value,
        task,
        project,
      };
      const attribution = resolveAccount(line,);
      const destination = attribution.account as Account | null;
      if (!destination) continue;
      const isMine = destination === account ||
        destination.isChildOf(account as unknown as PropertyTreeNode,);
      if (!isMine) continue;

      if (!task.chargeBookingEmitted(booking,)) {
        project.costEvents.push(
          createCostEvent(
            line,
            attribution.account,
            attribution.rule,
            scIdx,
            "actual",
          ),
        );
        task.markChargeBookingEmitted(booking,);
      }
      // Bucket accumulation happens in Block I below (leaf-account CostEvent
      // scan) — adding here too would double-count `this.buckets.charge`.
      added += value;
    }
    return added;
  }

  /**
   * Computes the turnover per cost type (charge/resource/material).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb#turnover
   */
  turnoverByType(
    startIdx: number,
    endIdx: number,
    type: "charge" | "resource" | "material",
  ): number {
    this.turnover(startIdx, endIdx,);
    switch (type) {
      case "charge":
        return this.buckets.charge;
      case "resource":
        return this.buckets.resource;
      case "material":
        return this.buckets.material;
      default:
        throw new TjInternalError(`Unknown cost type ${type as string}`,);
    }
  }

  /**
   * Fills a balance query (startIdx = 0, endIdx = dateToIdx(query.start)).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb#query_balance
   */
  query_balance(query: AccountScenarioQuery,): void {
    const project =
      (this.property as PropertyLike & { project: ProjectLike }).project;
    const startIdx = 0;
    const endIdx = project.dateToIdx(query.start,);
    const amount = this.turnover(startIdx, endIdx,);

    query.sortable = amount;
    query.numerical = amount;
    query.string = formatCurrency(query, amount,);
  }

  /**
   * Fills a turnover query (startIdx = dateToIdx(query.start), endIdx =
   * dateToIdx(query.end)).
   *
   * @see docs/taskjuggler/lib/taskjuggler/AccountScenario.rb#query_turnover
   */
  query_turnover(query: AccountScenarioQuery,): void {
    const project =
      (this.property as PropertyLike & { project: ProjectLike }).project;
    const startIdx = project.dateToIdx(query.start,);
    const endIdx = project.dateToIdx(query.end,);
    const amount = this.turnover(startIdx, endIdx,);

    query.sortable = amount;
    query.numerical = amount;
    query.string = formatCurrency(query, amount,);
  }
}

/**
 * Monetary value formatted with the report's `currencyFormat`.
 *
 * Without an inherited format it falls back to `String(amount)` — the same
 * output as `AttributeBase#to_s` for Float, as `task-scenario` and
 * `resource-scenario` do. Ruby never sees the null because the project default
 * (`Project.rb` l.77) always exists.
 */
function formatCurrency(query: AccountScenarioQuery, amount: number,): string {
  return query.currencyFormat
    ? query.currencyFormat.format(amount,)
    : `${amount}`;
}
