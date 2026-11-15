/**
 * `mod.ts` — stdio bootstrap of the standalone SyntaxMesh LSP server
 * (22.9.3, P6).
 *
 * Exposes the **same** language services as the VS Code extension to external
 * editors (Neovim, Helix, …) over stdin/stdout. This package imports nothing
 * from the extension — only the `lsp-core` (plan §4.1): the bootstrap creates
 * the `vscode-languageserver` connection, adapts it with the shared pure
 * adapter (22.9.1) and wires every service with `registerLspServer`. No
 * protocol rule lives here (ADR 035).
 *
 * ❌ Never `console.log` while serving — stdout is the JSON-RPC channel.
 * Help/usage and the version banner are printed before any connection
 * exists; errors go to stderr (plan §7). The banner uses the build-injected
 * `APP_VERSION` (22.10.2) — the same source as the CLI `--version`.
 *
 * Run: `deno run --allow-read --allow-env src/mod.ts --stdio` (or the bundled
 * `dist/syntaxmesh-lsp.js`, 22.9.4). The transport reads environment
 * variables, hence `--allow-env`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §4.1/§4.2/§7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.9.3
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.10.1
 */

import {
  createConnection,
  ProposedFeatures,
} from "vscode-languageserver/node";
import {
  adaptConnection,
  asConnectionLike,
  registerLspServer,
} from "@vanaware/syntaxmesh/lsp-core";
import { APP_VERSION, } from "@vanaware/syntaxmesh/version";
import { parseArgs, USAGE, } from "./args.ts";

// Pure CLI surface re-exported so the package entry (`exports "."`) carries
// the documented, unit-testable parts of the server (ADR 041 ratchet).
export { parseArgs, USAGE, } from "./args.ts";
export type { ParsedArgs, } from "./args.ts";

const parsed = parseArgs(Deno.args,);
if (parsed.mode === "help") {
  console.log(USAGE.trimEnd(),);
  Deno.exit(0,);
}
if (parsed.mode === "version") {
  // Same banner shape as the CLI (`SyntaxMesh ${VERSION}`); APP_VERSION is
  // "" from source and injected by the build (22.10.2) — never hardcoded.
  console.log(`SyntaxMesh language server ${APP_VERSION}`,);
  Deno.exit(0,);
}
if (parsed.mode === "error") {
  console.error(`syntaxmesh-lsp: ${parsed.message}`,);
  console.error("Run with --help for usage.",);
  Deno.exit(1,);
}

// stdio mode: the connection reads stdin / writes stdout by default. The
// single deliberate cast isolates the lib/core enum boundary (22.9.1).
const connection = createConnection(ProposedFeatures.all,);
registerLspServer(adaptConnection(asConnectionLike(connection,),),);
connection.listen();
