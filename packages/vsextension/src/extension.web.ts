/**
 * `extension.web.ts` — Web extension entry point (22.2.5).
 *
 * The `browser` entry of the VS Code manifest, bundled to `dist/extension.web.js`
 * (22.4.7) with no `node:*` dependency. VS Code for the Web calls
 * {@link activate} when a `syntaxmesh` document opens and {@link deactivate} on
 * shutdown; both delegate to the browser language client (22.4.6), which runs
 * the core LSP services inside a Web Worker. No editor intelligence lives here
 * — it is a thin bootstrap (ADR 035).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.2.5
 */

import { commands, ViewColumn, window, workspace, } from "vscode";
import type { ExtensionContext, } from "vscode";
import { startClient, stopClient, } from "./client/browser.ts";
import { registerCanonicalCommands, } from "./commands/register.ts";
import { startDaemon, stopDaemon, } from "./daemon/host.ts";
import { InputConsoleAdapter, } from "./console/input-console.ts";
import { createConfirmedOutputHost, ReportPresenter, } from "./reports/host.ts";
import { startViews, stopViews, } from "./views/host.ts";

/**
 * Activates the extension on the Web extension host.
 *
 * Starts the browser language client and its Worker server, then the project
 * daemon, one confirmed output host/presenter, the views and the Web input
 * console. Both Desktop and Web register commands through the same canonical
 * registrar; user-triggered writes use the `stub-first` strategy (22.8.3).
 *
 * @param context the extension context provided by VS Code.
 */
export async function activate(context: ExtensionContext,): Promise<void> {
  await startClient(context,);
  const host = await startDaemon(context,);
  const output = createConfirmedOutputHost(context, "stub-first",);
  const presenter = new ReportPresenter(context, output,);
  startViews(context, host,);
  const consoleAdapter = new InputConsoleAdapter({
    executor: {
      async execute<T,>(id: string, ...args: unknown[]): Promise<T> {
        return await commands.executeCommand<T>(id, ...args,);
      },
    },
    port: {
      createOutputChannel: () =>
        window.createOutputChannel("SyntaxMesh Console",),
      showInputBox: async (options,) => await window.showInputBox(options,),
      openStdinDocument: async () => {
        const document = await workspace.openTextDocument({
          language: "syntaxmesh",
          content: "",
        },);
        await window.showTextDocument(document, ViewColumn.Beside, false,);
        const action = await window.showInformationMessage(
          "Enter stdin in the untitled SyntaxMesh document, then choose Use Stdin.",
          { modal: true, },
          "Use Stdin",
          "Cancel",
        );
        return action === "Use Stdin" ? document : undefined;
      },
    },
  },);
  registerCanonicalCommands(context, {
    host,
    presenter,
    output,
    writeStrategy: "stub-first",
    console: consoleAdapter,
  },);
}

/**
 * Deactivates the extension on the Web extension host.
 *
 * Releases the views, stops the daemon, then stops the language client and
 * terminates its Worker. Invoked by VS Code on shutdown; a no-op when nothing
 * was started.
 */
export async function deactivate(): Promise<void> {
  stopViews();
  await stopDaemon();
  await stopClient();
}
