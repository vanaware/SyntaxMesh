import type { AttributionRule } from "./cost-event.ts";

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