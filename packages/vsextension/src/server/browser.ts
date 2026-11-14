/**
 * `server/browser.ts` — Web (Worker) LSP server bootstrap (22.4.5).
 *
 * Creates the `vscode-languageserver` browser connection over the Web Worker
 * message port, adapts it to the structural {@link ServerConnection} and wires
 * every service with `registerLspServer`. Bundled to `dist/server.web.js`
 * (22.4.7) and run inside the Worker the Web client spawns (22.4.6); it is
 * type-checked here, run inside VS Code for the Web.
 *
 * In the Worker, `self` is the dedicated worker global scope at runtime; the
 * package `dom` lib types it as `Window`, so it is asserted once at this
 * boundary. ❌ Never `console.log` on the server channel (plan §7).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.4.5
 */

import {
  BrowserMessageReader,
  BrowserMessageWriter,
  createConnection,
} from "vscode-languageserver/browser";
import { registerLspServer, } from "@vanaware/syntaxmesh/lsp-core";
import { adaptConnection, asConnectionLike, } from "./adapter.ts";

const worker = self as unknown as DedicatedWorkerGlobalScope;
const connection = createConnection(
  new BrowserMessageReader(worker,),
  new BrowserMessageWriter(worker,),
);
registerLspServer(adaptConnection(asConnectionLike(connection,),),);
connection.listen();
