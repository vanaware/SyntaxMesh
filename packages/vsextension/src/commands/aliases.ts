/**
 * Runtime-only compatibility aliases for the canonical command API (22.12.19).
 *
 * Legacy ids contain no scheduling, rendering or output logic. They only forward
 * to the canonical command executor, with one optional routing override for the
 * old combined Generate Report flow.
 */
import type { Disposable, } from "vscode";
import { LEGACY_COMMAND_IDS, PUBLIC_COMMAND_IDS, } from "./contracts.ts";
import type { CommandHandler, CommandRegistry, } from "./registry.ts";

/** One legacy command id retained for programmatic callers. */
export type LegacyCommandId = typeof LEGACY_COMMAND_IDS[number];

/** One contributed canonical command id. */
export type CanonicalCommandId = typeof PUBLIC_COMMAND_IDS[number];

/** Canonical forwarding target for every legacy command id. */
export const LEGACY_COMMAND_ALIASES = {
  "syntaxmesh.addProject": "syntaxmesh.project.add",
  "syntaxmesh.reloadProject": "syntaxmesh.project.refresh",
  "syntaxmesh.removeProject": "syntaxmesh.project.remove",
  "syntaxmesh.listProjects": "syntaxmesh.project.list",
  "syntaxmesh.generateReport": "syntaxmesh.report.open",
} as const satisfies Record<LegacyCommandId, CanonicalCommandId>;

/** Host command executor used by compatibility aliases. */
export interface CommandExecutor {
  execute<T = unknown,>(id: string, ...args: unknown[]): Promise<T>;
}

/** Optional legacy routing that still delegates all real work to canonical ids. */
export type LegacyAliasOverrides = Partial<
  Record<LegacyCommandId, CommandHandler>
>;

/** Registers every legacy id once and returns its extension-owned disposable. */
export function registerLegacyAliases(
  registry: CommandRegistry,
  executor: CommandExecutor,
  overrides: LegacyAliasOverrides = {},
): Disposable[] {
  return LEGACY_COMMAND_IDS.map((id,) => {
    const target = LEGACY_COMMAND_ALIASES[id];
    const handler = overrides[id] ??
      ((...args: unknown[]) => executor.execute(target, ...args,));
    return registry.register(id, handler,);
  },);
}
