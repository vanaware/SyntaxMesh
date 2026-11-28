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

import { commands, window, } from "vscode";
import type { ExtensionContext, } from "vscode";
import { startClient, stopClient, } from "./client/node.ts";
import { registerCanonicalCommands, } from "./commands/register.ts";
import { startDaemon, stopDaemon, } from "./daemon/host.ts";
import { PtyConsoleAdapter, } from "./console/pty.ts";
import { createConfirmedOutputHost, ReportPresenter, } from "./reports/host.ts";
import { startViews, stopViews, } from "./views/host.ts";

/**
 * Activates the extension on the Desktop extension host.
 *
 * Starts the Node language client and its embedded server, then the project
 * daemon, one confirmed output host/presenter, the views and the Desktop
 * pseudo-terminal console. Both Desktop and Web register commands through the
 * same canonical registrar.
 *
 * @param context the extension context provided by VS Code.
 */
export async function activate(context: ExtensionContext,): Promise<void> {
  await startClient(context,);
  const host = await startDaemon(context,);
  const output = createConfirmedOutputHost(context, "direct",);
  const presenter = new ReportPresenter(context, output,);
  startViews(context, host,);
  const consoleAdapter = new PtyConsoleAdapter({
    executor: {
      async execute<T,>(id: string, ...args: unknown[]): Promise<T> {
        return await commands.executeCommand<T>(id, ...args,);
      },
    },
    createTerminal: (pty,) =>
      window.createTerminal({ name: "SyntaxMesh Console", pty, },),
  },);
  registerCanonicalCommands(context, {
    host,
    presenter,
    output,
    writeStrategy: "direct",
    console: consoleAdapter,
  },);
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
