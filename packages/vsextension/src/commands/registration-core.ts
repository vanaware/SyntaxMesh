/**
 * Host-free composition for the shared Desktop/Web command bootstrap (22.12.19).
 *
 * The runtime adapter supplies VS Code's registrar and one dependency object. This
 * core invokes each command group once, verifies the exact public set, then adds
 * runtime-only compatibility commands and the active console adapter.
 */
import type { ExtensionContext, } from "vscode";
import {
  type CommandExecutor,
  type LegacyAliasOverrides,
  registerLegacyAliases,
} from "./aliases.ts";
import {
  type ConsoleAdapter,
  PUBLIC_COMMAND_IDS,
  RUNTIME_ONLY_COMMAND_IDS,
} from "./contracts.ts";
import { type CommandRegistrar, CommandRegistry, } from "./registry.ts";

/** Registration groups owned by the shared canonical bootstrap. */
export interface CommandGroups<Shared,> {
  project(registry: CommandRegistry, shared: Shared,): void;
  execution(registry: CommandRegistry, shared: Shared,): void;
  report(registry: CommandRegistry, shared: Shared,): void;
  misc(registry: CommandRegistry, shared: Shared,): void;
  console(registry: CommandRegistry, shared: Shared,): void;
}

/** Host-free inputs for one complete command registration pass. */
export interface CommandSetRegistrationOptions<Shared,> {
  registrar: CommandRegistrar;
  context: Pick<ExtensionContext, "subscriptions">;
  shared: Shared;
  groups: CommandGroups<Shared>;
  executor: CommandExecutor;
  console: ConsoleAdapter;
  legacyOverrides?: LegacyAliasOverrides;
}

/**
 * Registers the exact public command set, then runtime-only aliases and console.
 *
 * @param options registrar, extension lifetime, shared dependencies and groups.
 * @returns the completed registry, useful for host-free verification.
 */
export function registerCommandSet<Shared,>(
  options: CommandSetRegistrationOptions<Shared>,
): CommandRegistry {
  const registry = new CommandRegistry(options.registrar,);
  options.groups.project(registry, options.shared,);
  options.groups.execution(registry, options.shared,);
  options.groups.report(registry, options.shared,);
  options.groups.misc(registry, options.shared,);
  options.groups.console(registry, options.shared,);
  registry.assertExact(PUBLIC_COMMAND_IDS,);

  registerLegacyAliases(
    registry,
    options.executor,
    options.legacyOverrides,
  );
  for (const id of RUNTIME_ONLY_COMMAND_IDS) {
    if (id !== "syntaxmesh.console.clear") {
      throw new Error(`unsupported runtime-only command: ${id}`,);
    }
    registry.register(id, () => options.console.clear(),);
  }
  options.context.subscriptions.push(
    ...registry.disposables,
    options.console,
  );
  return registry;
}
