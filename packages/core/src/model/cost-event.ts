/**
 * Regra de atribuição de custo.
 *
 * Define como um custo é associado a uma conta.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Charge.rb
 */
export type AttributionRule =
  |"explicit"
  |"origin_chargeset"
  |"task_chargeset_force"
  |"task_chargeset_fallback"
  |"project_default";


/**
 * Resultado de atribuição de custo.
 *
 * Define qual conta recebe um custo e qual regra de atribuição foi usada.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Charge.rb
 */
export interface AttributionResult {
  account: unknown;
  rule: AttributionRule;
  explicit?: boolean;
  originChargeset?: unknown;
  taskChargeset?: unknown;
  projectDefault?: unknown;
}

/**
 * Representa um evento de custo auditável para um único valor monetário.
 *
 * Semelhante a `MaterialAllocation`, mas para valores monetários.
 */
export class CostEvent {
  readonly type: "task_charge" | "resource_effort" | "material_usage";
  readonly amount: number;
  readonly account: unknown;
  readonly rule: AttributionRule;
  readonly scenarioIdx: number;
  readonly mode: "planned" | "actual";
  readonly task?: unknown;
  readonly resource?: unknown;
  readonly material?: unknown;

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