/**
 * Public console command group shared by Desktop and Web (22.12.19).
 *
 * The shared command set owns the adapter lifetime and registers runtime-only
 * commands after validating the exact public command set.
 */
import type { ConsoleAdapter, } from "../commands/contracts.ts";
import type { CommandRegistry, } from "../commands/registry.ts";

/** Registers only the public console-open command against the shared registry. */
export function registerConsoleGroup(
  registry: CommandRegistry,
  adapter: ConsoleAdapter,
): void {
  registry.register("syntaxmesh.console.open", () => adapter.open(),);
}
