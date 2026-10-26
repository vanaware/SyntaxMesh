/**
 * Regra de atribuição de custo.
 *
 * Define como um custo é associado a uma conta.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Charge.rb
 */
export type AttributionRule =
  | "explicit"
  | "origin_chargeset"
  | "task_chargeset_force"
  | "task_chargeset_fallback"
  | "project_default";
