/**
 * `client/browser.ts` — Web language-client bootstrap (22.4.6).
 *
 * Creates the `vscode-languageclient` browser client over a Web Worker that
 * runs the bundled `dist/server.web.js` (22.4.7), materializes the runtime
 * pieces of the pure {@link buildClientOptions} (the file watcher and the trace
 * level) and exposes `startClient`/`stopClient` for the Web entry point
 * (22.2.5). The document selector is scheme-agnostic, so the same options serve
 * Desktop and Web (plan §7).
 *
 * All intelligence lives in the core (`registerLspServer`); this file only
 * wires the transport (ADR 035). It imports the `vscode`/library runtime, so it
 * is type-checked here and exercised inside VS Code for the Web (acceptance
 * deferred to P7); the pure options/settings it consumes are unit-tested.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.4.6
 */

import { LanguageClient, Trace, } from "vscode-languageclient/browser";
import type { LanguageClientOptions, } from "vscode-languageclient/browser";
import { workspace, } from "vscode";
import type { ExtensionContext, } from "vscode";
import { readSettings, } from "../config/settings.ts";
import { buildClientOptions, CLIENT_ID, SERVER_ID, } from "./options.ts";

/** The running client, or `undefined` when stopped (single instance). */
let client: LanguageClient | undefined;

/**
 * Starts the Web language client and its embedded Worker server.
 *
 * Reads the `syntaxmesh.*` settings, builds the client options, spawns a Worker
 * running `dist/server.web.js` and applies the configured trace level once the
 * connection is up.
 *
 * @param context the extension context (resolves the bundled server path).
 */
export async function startClient(context: ExtensionContext,): Promise<void> {
  const settings = readSettings(workspace.getConfiguration("syntaxmesh",),);
  const opts = buildClientOptions(settings,);
  const serverWeb = context.asAbsolutePath("dist/server.web.js",);
  const worker = new Worker(serverWeb,);
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
    clientOptions,
    worker,
  );
  client = started;
  await started.start();
  await started.setTrace(Trace.fromString(opts.trace,),);
}

/** Stops the running client and terminates its Worker (no-op when stopped). */
export async function stopClient(): Promise<void> {
  if (client !== undefined) {
    await client.stop();
    client = undefined;
  }
}
