import type { AttributionRule, } from "./cost-event.ts";

/**
 * Cost attribution result.
 *
 * Defines which account receives a cost and which attribution rule was used.
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
