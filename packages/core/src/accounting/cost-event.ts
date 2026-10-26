import { type Account, } from "../model/account.ts";
import { type Resource, } from "../model/resource.ts";
import { type Task, } from "../model/task.ts";
import { type Material, } from "../model/material.ts";
import { type ChargeSetCollection, } from "../finance/charge-set-collection.ts";
import { type CostType, } from "../model/account.ts";
import {
  type AttributionResult,
  type AttributionRule,
} from "../model/cost-event.ts";

/**
 * Representa um evento de custo auditável para um único valor monetário.
 *
 * Semelhante a `MaterialAllocation`, mas para valores monetários.
 */
export type CostEventType =
  | "task_charge"
  | "resource_effort"
  | "material_usage";

/**
 * Representa um evento de custo auditável para um único valor monetário.
 *
 * Semelhante a `MaterialAllocation`, mas para valores monetários.
 */
export class CostEvent {
  readonly type: CostEventType;
  readonly amount: number;
  readonly account: unknown;
  readonly rule: AttributionRule;
  readonly scenarioIdx: number;
  readonly mode: "planned" | "actual";
  readonly task?: unknown;
  readonly resource?: unknown;
  readonly material?: unknown;

  constructor(
    type: CostEventType,
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

/**
 * Factory para criar um CostEvent a partir de uma linha de custo.
 *
 * @param line - A linha de custo a ser convertida
 * @param account - A conta atribuída
 * @param rule - A regra de atribuição usada
 * @param scenarioIdx - O índice do cenário
 * @param mode - O modo (planned/actual)
 * @returns Um novo CostEvent
 */
export function createCostEvent(
  line: {
    type: CostEventType;
    amount: number;
    explicitAccount?: Account;
    task?: Task;
    resource?: Resource;
    material?: Material;
  },
  account: unknown,
  rule: AttributionRule,
  scenarioIdx: number,
  mode: "planned" | "actual",
): CostEvent {
  return new CostEvent(
    line.type,
    line.amount,
    account,
    rule,
    scenarioIdx,
    mode,
    line.task,
    line.resource,
    line.material,
  );
}
