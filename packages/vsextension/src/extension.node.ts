/**
 * `extension.node.ts` — Desktop (Node) extension entry point (22.2.5).
 *
 * The `main` entry of the VS Code manifest, bundled to `dist/extension.node.js`
 * (22.4.7). VS Code calls {@link activate} when a `syntaxmesh` document opens
 * and {@link deactivate} on shutdown; both delegate to the Node language
 * client (22.4.6), which embeds the core LSP services over IPC. No editor
 * intelligence lives here — it is a thin bootstrap (ADR 035).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.2.5
 */

import type { ExtensionContext, } from "vscode";
import { startClient, stopClient, } from "./client/node.ts";
import { startDaemon, stopDaemon, } from "./daemon/host.ts";
import { registerDaemonCommands, } from "./commands/daemon.ts";
import { ReportPresenter, } from "./reports/host.ts";
import { registerReportCommands, } from "./commands/reports.ts";
import { startViews, stopViews, } from "./views/host.ts";
import { registerMiscCommands, } from "./commands/misc.ts";

/**
 * Activates the extension on the Desktop extension host.
 *
 * Starts the Node language client and its embedded server, then the project
 * daemon (22.5) and its commands, the report presenter and its Generate Report
 * command (22.6), then the views (tree + status bar) and the remaining commands
 * (22.7). Invoked by VS Code per the `onLanguage:syntaxmesh` activation event.
 *
 * @param context the extension context provided by VS Code.
 */
export async function activate(context: ExtensionContext,): Promise<void> {
  await startClient(context,);
  const host = await startDaemon(context,);
  registerDaemonCommands(context, host,);
  const presenter = new ReportPresenter(context,);
  registerReportCommands(context, host, presenter,);
  startViews(context, host,);
  registerMiscCommands(context, host,);
}

/**
 * Deactivates the extension on the Desktop extension host.
 *
 * Releases the views, persists and stops the daemon, then stops the language
 * client and its server. Invoked by VS Code on shutdown; a no-op when nothing
 * was started.
 */
export async function deactivate(): Promise<void> {
  stopViews();
  await stopDaemon();
  await stopClient();
}
