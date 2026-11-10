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
 * Represents an auditable cost event for a single monetary amount.
 *
 * Similar to `MaterialAllocation`, but for monetary amounts.
 */
export type CostEventType =
  | "task_charge"
  | "resource_effort"
  | "material_usage";

/**
 * Re-export of the canonical `CostEvent`.
 *
 * The class lives in `model/cost-event.ts`, next to the attribution rule it
 * carries; this barrel used to declare an identical copy, which made the type
 * of `createCostEvent` unreachable from the package entry point.
 */
export { CostEvent, } from "../model/cost-event.ts";
import { CostEvent, } from "../model/cost-event.ts";

/**
 * Factory that creates a CostEvent from a cost line.
 *
 * @param line - The cost line to convert
 * @param account - The assigned account
 * @param rule - The attribution rule used
 * @param scenarioIdx - The scenario index
 * @param mode - The mode (planned/actual)
 * @returns A new CostEvent
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
