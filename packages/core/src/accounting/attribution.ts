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
 * Representa uma linha de custo para atribuição.
 *
 * Semelhante a um evento de custo, mas usado para atribuição.
 */
export interface CostLine {
  type: "task_charge" | "resource_effort" | "material_usage";
  amount: number;
  explicitAccount?: Account;
  task?: Task;
  resource?: Resource;
  material?: Material;
}

/**
 * Converte um CostEventType (linha de custo) para CostType (chargeset).
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
 * Resolve uma linha de custo para uma conta e regra de atribuição.
 *
 * Implementa as regras de atribuição conforme definido no TaskJuggler.
 *
 * @param line - A linha de custo a ser atribuída
 * @returns O resultado da atribuição contendo a conta e a regra usada
 * @throws TjArgumentError se nenhum nível de conta puder ser encontrado
 * @throws TjInternalError se o tipo for desconhecido
 */
export function resolveAccount(line: CostLine,): AttributionResult {
  const { type, amount, explicitAccount, task, resource, material, } = line;

  // Regra 1: explicitAccount presente → 'explicit'
  if (explicitAccount) {
    return {
      account: explicitAccount,
      rule: "explicit",
      explicit: true,
    };
  }

  // Regra 2: origin_chargeset (resource_effort ou material_usage)
  // Regra 2: task_charge ignora origin (sem origem separada)
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

  // Regra 3: task_chargeset_fallback (task.chargeset.forType(type))
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
    // Se o tipo for task_charge ou resource_effort e não houver chargeset, ainda podemos resolver
    // usando a conta default do projeto (regra 4). Isso permite que charges
    // sejam emitidos como CostEvents mesmo sem um chargeset.
    if (type === "task_charge" || type === "resource_effort") {
      // TODO: Implementar project.defaultAccount
      // Nota: project.defaultAccount não está implementado ainda, usando {} como placeholder
      return {
        account: null,
        rule: "project_default",
        projectDefault: {},
      };
    }
    // Task existe mas não tem chargeset do tipo → erro claro
    throw new TjArgumentError(
      `Nenhum chargeset encontrado para task '${task.id}' do tipo '${type}'`,
    );
  }

  // Regra 4: conta default do projeto (project.defaultAccount)
  // Nota: project.defaultAccount não está implementado ainda, usando {} como placeholder
  // TODO: Implementar project.defaultAccount
  return {
    account: null,
    rule: "project_default",
    projectDefault: {},
  };
}
