/**
 * `server/node.ts` — Desktop (Node) LSP server bootstrap (22.4.4).
 *
 * Creates the `vscode-languageserver` connection over the IPC channel VS Code
 * opens, adapts it to the structural {@link ServerConnection} and wires every
 * service with `registerLspServer` (the intelligence stays in the core). This
 * module is bundled to `dist/server.node.js` (22.4.7) and launched by the
 * Desktop client (22.4.6); it is type-checked here, run inside VS Code.
 *
 * ❌ Never `console.log` on the server channel — it corrupts JSON-RPC. Use
 * `connection.console` for diagnostics (plan §7).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.4.4
 */

import {
  createConnection,
  ProposedFeatures,
} from "vscode-languageserver/node";
import { registerLspServer, } from "@vanaware/syntaxmesh/lsp-core";
import { adaptConnection, asConnectionLike, } from "./adapter.ts";

const connection = createConnection(ProposedFeatures.all,);
registerLspServer(adaptConnection(asConnectionLike(connection,),),);
connection.listen();
