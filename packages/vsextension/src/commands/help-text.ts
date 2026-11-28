/**
 * Pure text rendering for the structured execution help section (22.12.11).
 *
 * The core envelope owns the option table. This formatter deliberately depends
 * only on that plain-data contract, never on Cliffy or the CLI process entry.
 */
import type { OptionSpec, } from "@vanaware/syntaxmesh";

/**
 * Renders usage, aliases and every option specification as ANSI-free text.
 *
 * @param specs structured options from `ExecutionResult.results.help`.
 * @returns help text suitable for an editor output channel.
 */
export function formatHelp(specs: OptionSpec[],): string {
  const lines = [
    "Usage:",
    "  syntaxmesh run [options] <project.smx|project.tjp>",
    "  smx [options] <project.smx|project.tjp>",
    "  tj3 [options] <project.smx|project.tjp>",
    "",
    "Aliases: run, smx, tj3",
    "",
    "Options:",
  ];

  for (const spec of specs) {
    const flags = spec.short === null
      ? `--${spec.name}`
      : `-${spec.short}, --${spec.name}`;
    const usage = spec.argument === null ? flags : `${flags} ${spec.argument}`;
    const deferred = spec.deferred === undefined
      ? ""
      : ` (not yet available: ${spec.deferred})`;
    lines.push(`  ${usage}`, `      ${spec.description}${deferred}`,);
  }

  return lines.join("\n",);
}
