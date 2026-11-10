/**
 * Cost attribution rule.
 *
 * Defines how a cost is associated with an account.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Charge.rb
 */
export type AttributionRule =
  | "explicit"
  | "origin_chargeset"
  | "task_chargeset_force"
  | "task_chargeset_fallback"
  | "project_default";
