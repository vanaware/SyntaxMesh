/**
 * `args.ts` — pure CLI argument parsing for the standalone LSP server
 * (22.9.2, 22.10.1).
 *
 * The v1 CLI is minimal (plan §4.2): `--stdio` (the default transport),
 * `--help`/`-h` and `--version`/`-V`. Anything else is an error the bootstrap
 * reports on stderr with exit code 1. The version banner is printed by the
 * bootstrap from the build-injected `APP_VERSION` — never hardcoded here.
 *
 * Pure by design: no `Deno.args`, no process, no transport — the bootstrap
 * (`src/mod.ts`) feeds `Deno.args` in and acts on the result, so every branch
 * is unit-testable in Deno (ADR 035).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §4.2
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.9.2
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.10.1
 */

/**
 * Outcome of parsing the command line.
 *
 * - `stdio`: start the LSP server over stdin/stdout (the default).
 * - `help`: print {@link USAGE} and exit 0.
 * - `version`: print the version banner and exit 0.
 * - `error`: print `message` on stderr and exit 1.
 */
export interface ParsedArgs {
  /** What the bootstrap should do. */
  mode: "stdio" | "help" | "version" | "error";
  /** Human-readable reason; present only when `mode` is `"error"`. */
  message?: string;
}

/**
 * Usage text shown by `--help`/`-h`. The bootstrap prints it to stdout and
 * exits before any connection is created, so it never pollutes the JSON-RPC
 * channel of a running server.
 */
export const USAGE = `SyntaxMesh language server (LSP over stdio).

Usage: syntaxmesh-lsp [--stdio]

Options:
  --stdio        Serve LSP over stdin/stdout (default)
  -h, --help     Show this help and exit
  -V, --version  Show the version and exit
`;

/**
 * Parses the command-line arguments of the standalone server.
 *
 * `--help`/`-h` and `--version`/`-V` are terminal (help wins over version);
 * the first unrecognized argument short-circuits to an error naming it.
 * Flags start with `-`; anything else is rejected as a positional argument
 * (the server takes no project path — documents arrive via
 * `textDocument/didOpen`).
 *
 * @param args the raw arguments (e.g. `Deno.args`), without the program name.
 * @returns the mode the bootstrap should run, plus a message on error.
 */
export function parseArgs(args: readonly string[],): ParsedArgs {
  let help = false;
  let version = false;
  for (const arg of args) {
    if (arg === "--help" || arg === "-h") {
      help = true;
    } else if (arg === "--version" || arg === "-V") {
      version = true;
    } else if (arg === "--stdio") {
      // Default transport; accepted explicitly for editor configurations.
    } else if (arg.startsWith("-",)) {
      return { mode: "error", message: `Unknown option: ${arg}`, };
    } else {
      return { mode: "error", message: `Unexpected argument: ${arg}`, };
    }
  }
  if (help) return { mode: "help", };
  if (version) return { mode: "version", };
  return { mode: "stdio", };
}
