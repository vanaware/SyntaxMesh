/**
 * `client/node.ts` — Desktop (Node) language-client bootstrap (22.4.6).
 *
 * Creates the `vscode-languageclient` Node client, points its server module at
 * the bundled `dist/server.node.js` (22.4.7) over IPC, materializes the runtime
 * pieces of the pure {@link buildClientOptions} (the file watcher and the trace
 * level) and exposes `startClient`/`stopClient` for the entry point (22.2.5).
 *
 * All intelligence lives in the core (`registerLspServer`); this file only
 * wires the transport (ADR 035). It imports the `vscode`/library runtime, so it
 * is type-checked here and exercised inside VS Code (acceptance deferred to
 * P7); the pure options/settings it consumes are unit-tested in Deno.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.4.6
 */

import {
  LanguageClient,
  Trace,
  TransportKind,
} from "vscode-languageclient/node";
import type {
  LanguageClientOptions,
  ServerOptions,
} from "vscode-languageclient/node";
import { workspace, } from "vscode";
import type { ExtensionContext, } from "vscode";
import { readSettings, } from "../config/settings.ts";
import { buildClientOptions, CLIENT_ID, SERVER_ID, } from "./options.ts";

/** The running client, or `undefined` when stopped (single instance). */
let client: LanguageClient | undefined;

/**
 * Starts the Desktop language client and its embedded Node server.
 *
 * Reads the `syntaxmesh.*` settings, builds the client options, forks
 * `dist/server.node.js` over IPC (debug adds an inspector) and applies the
 * configured trace level once the connection is up.
 *
 * @param context the extension context (resolves the bundled server path).
 */
export async function startClient(context: ExtensionContext,): Promise<void> {
  const settings = readSettings(workspace.getConfiguration("syntaxmesh",),);
  const opts = buildClientOptions(settings,);
  const serverModule = context.asAbsolutePath("dist/server.node.js",);
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc, },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ["--nolazy", "--inspect=6009",], },
    },
  };
  const clientOptions: LanguageClientOptions = {
    documentSelector: opts.documentSelector,
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher(
        opts.synchronize.fileEvents,
      ),
    },
    initializationOptions: opts.initializationOptions,
  };
  const started = new LanguageClient(
    CLIENT_ID,
    SERVER_ID,
    serverOptions,
    clientOptions,
  );
  client = started;
  await started.start();
  await started.setTrace(Trace.fromString(opts.trace,),);
}

/** Stops the running client (no-op when already stopped). */
export async function stopClient(): Promise<void> {
  if (client !== undefined) {
    await client.stop();
    client = undefined;
  }
}
