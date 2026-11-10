/**
 * How a cost ends up attributed to an account.
 *
 * The order of the union members is the precedence order used by
 * `resolveAccount`: an explicit `chargeset` on the booking wins, then the
 * chargeset the cost originated from, then the task's own chargeset (forced or
 * fallback), and finally the project's `defaultaccount`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Charge.rb
 */
export type AttributionRule =
  | "explicit"
  | "origin_chargeset"
  | "task_chargeset_force"
  | "task_chargeset_fallback"
  | "project_default";

/**
 * Outcome of attributing one cost: which account received it and by which
 * rule.
 *
 * The optional fields preserve the candidates that lost or that were inspected
 * along the way, so the accounting audit can explain a zero or a surprise
 * booking without re-running the classification.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Charge.rb
 */
export interface AttributionResult {
  /** Account that received the cost. */
  account: unknown;
  /** Rule that decided the attribution. */
  rule: AttributionRule;
  /** `true` when the account came from an explicit `chargeset`. */
  explicit?: boolean;
  /** Chargeset the cost originated from, when there was one. */
  originChargeset?: unknown;
  /** Chargeset declared on the task. */
  taskChargeset?: unknown;
  /** Project `defaultaccount` that was considered. */
  projectDefault?: unknown;
}

/**
 * Auditable record of one monetary amount.
 *
 * Every cost the accounting layer produces is a `CostEvent`: it carries the
 * amount together with the account it was booked on, the rule that chose that
 * account, the scenario and whether the value is planned or actual. That
 * traceability is what lets the balance sheets be reproduced and explained.
 */
export class CostEvent {
  /** Source of the cost: a task charge, resource effort or material usage. */
  readonly type: "task_charge" | "resource_effort" | "material_usage";
  /** Monetary amount, always positive; the sign comes from the account side. */
  readonly amount: number;
  /** Account the cost was booked on. */
  readonly account: unknown;
  /** Rule that attributed the cost to `account`. */
  readonly rule: AttributionRule;
  /** Scenario the cost belongs to. */
  readonly scenarioIdx: number;
  /** Whether the amount is planned or already actual. */
  readonly mode: "planned" | "actual";
  /** Task that generated the cost, when applicable. */
  readonly task?: unknown;
  /** Resource whose effort generated the cost, when applicable. */
  readonly resource?: unknown;
  /** Material whose usage generated the cost, when applicable. */
  readonly material?: unknown;

  /**
   * Creates a cost event.
   *
   * @param type Source of the cost.
   * @param amount Monetary amount.
   * @param account Account the cost is booked on.
   * @param rule Rule that chose the account.
   * @param scenarioIdx Scenario the cost belongs to.
   * @param mode Planned or actual.
   * @param task Generating task, when applicable.
   * @param resource Generating resource, when applicable.
   * @param material Generating material, when applicable.
   */
  constructor(
    type: "task_charge" | "resource_effort" | "material_usage",
    amount: number,
    account: unknown,
    rule: AttributionRule,
    scenarioIdx: number,
    mode: "planned" | "actual",
    task?: unknown,
    resource?: unknown,
    material?: unknown,
  ) {
    this.type = type;
    this.amount = amount;
    this.account = account;
    this.rule = rule;
    this.scenarioIdx = scenarioIdx;
    this.mode = mode;
    this.task = task;
    this.resource = resource;
    this.material = material;
  }
}
