import { TjArgumentError, } from "../attributes/errors.ts";
import { TjInternalError, } from "../model/errors.ts";
import type { Account, } from "../model/account.ts";
import type { Resource, } from "../model/resource.ts";
import type { Task, } from "../model/task.ts";
import type { Material, } from "../model/material.ts";
import type { ChargeSetCollection, } from "../finance/charge-set-collection.ts";
import type { CostType, } from "../model/account.ts";
import type {
  AttributionResult,
  AttributionRule,
} from "../model/cost-event.ts";

/**
 * Represents a cost line for attribution.
 *
 * Similar to a cost event, but used for attribution.
 */
export interface CostLine {
  type: "task_charge" | "resource_effort" | "material_usage";
  amount: number;
  explicitAccount?: Account;
  task?: Task;
  resource?: Resource;
  material?: Material;
  /**
   * Project that owns the line. Provides the default account of **rule 4**
   * (`defaultaccount <id>` — addendum §10 / 14C.9). Optional so that callers
   * without a project keep working (rule 4 falls back to `account: null` as
   * before).
   */
  project?: { defaultAccountFor?(type: CostType | null,): Account | null };
}

/**
 * Rule 4: project default account for the line type.
 *
 * Without a configured `defaultaccount` the result is `account: null`; with a
 * default account, `projectDefault` carries the resolved account.
 */
function projectDefaultResult(line: CostLine,): AttributionResult {
  const account = line.project?.defaultAccountFor?.(
    costTypeFromEventType(line.type,),
  ) ?? null;
  return {
    account,
    rule: "project_default",
    projectDefault: account ?? {},
  };
}

/**
 * Converts a CostEventType (cost line) into a CostType (chargeset).
 *
 * `task_charge` → `task`, `resource_effort` → `resource`,
 * `material_usage` → `material`.
 */
function costTypeFromEventType(type: CostLine["type"],): CostType {
  switch (type) {
    case "task_charge":
      return "task";
    case "resource_effort":
      return "resource";
    case "material_usage":
      return "material";
    default:
      throw new TjInternalError(`Unknown cost line type: ${type as string}`,);
  }
}

/**
 * Resolves a cost line into an account and an attribution rule.
 *
 * Implements the attribution rules as defined in TaskJuggler.
 *
 * @param line - The cost line to be attributed
 * @returns The attribution result containing the account and the rule used
 * @throws TjArgumentError when no account level can be found
 * @throws TjInternalError when the type is unknown
 */
export function resolveAccount(line: CostLine,): AttributionResult {
  const { type, amount, explicitAccount, task, resource, material, } = line;

  // Rule 1: explicitAccount present → 'explicit'
  if (explicitAccount) {
    return {
      account: explicitAccount,
      rule: "explicit",
      explicit: true,
    };
  }

  // Rule 2: origin_chargeset (resource_effort or material_usage)
  // Rule 2: task_charge ignores origin (no separate origin)
  if (type !== "task_charge") {
    // Determine if force mode should skip rule 2.
    // force only skips rule 2 when the task HAS a chargeset of the type
    // (otherwise it falls back naturally to rule 2).
    let skipOrigin = false;
    if (task?.chargesetMode === "force") {
      const taskChargeset = task.chargeset?.forType(
        costTypeFromEventType(type,),
        { task, },
      );
      skipOrigin = taskChargeset?.master !== null &&
        taskChargeset?.master !== undefined;
    }

    if (!skipOrigin) {
      if (type === "resource_effort" && resource) {
        const chargeset = resource.chargeset?.forType("resource", {
          resource,
        },);
        if (chargeset?.master) {
          return {
            account: chargeset.master,
            rule: "origin_chargeset",
            originChargeset: chargeset,
          };
        }
      }

      if (type === "material_usage" && material) {
        const chargeset = material.chargeset?.forType("material", {
          material,
        },);
        if (chargeset?.master) {
          return {
            account: chargeset.master,
            rule: "origin_chargeset",
            originChargeset: chargeset,
          };
        }
      }
    }
  }

  // Rule 3: task_chargeset_fallback (task.chargeset.forType(type))
  if (task) {
    const chargeset = task.chargeset?.forType(costTypeFromEventType(type,), {
      task,
    },);
    if (chargeset?.master) {
      return {
        account: chargeset.master,
        rule: "task_chargeset_fallback",
        taskChargeset: chargeset,
      };
    }
    // If the type is task_charge or resource_effort and there is no chargeset,
    // we can still resolve using the project default account (rule 4). This
    // allows charges to be emitted as CostEvents even without a chargeset.
    if (type === "task_charge" || type === "resource_effort") {
      return projectDefaultResult(line,);
    }
    // Task exists but has no chargeset of the type → clear error
    throw new TjArgumentError(
      `Nenhum chargeset encontrado para task '${task.id}' do tipo '${type}'`,
    );
  }

  // Rule 4: project default account (`defaultaccount`, 14C.9).
  return projectDefaultResult(line,);
}
