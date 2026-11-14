/**
 * `commands/daemon.ts` — daemon command bootstraps (22.5.9).
 *
 * Registers the four daemon commands (add/remove/list/reload) over the
 * {@link DaemonHost}, each gated by Workspace Trust (plan §8.4) through the
 * pure {@link assertTrusted}. The handlers only wire VS Code UI (active editor,
 * quick picks, messages) to the host; all logic lives in the pure daemon core.
 * Command titles are English (plan §8.2); the manifest declares them (22.7.7).
 *
 * Imports the `vscode` runtime, so it is type-checked here and exercised inside
 * VS Code (acceptance deferred to P7). No automatic watcher feeds the daemon —
 * reload is an explicit user action (plan §3.2).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.2/§8.2/§8.4
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.5.9
 */
import { commands, window, } from "vscode";
import type { ExtensionContext, } from "vscode";
import type { DaemonHost, } from "../daemon/host.ts";
import { activeMasterUri, guarded, } from "./shared.ts";

/**
 * Registers the daemon commands on the extension context.
 *
 * @param context the extension context (owns the command disposables).
 * @param host the started daemon host.
 */
export function registerDaemonCommands(
  context: ExtensionContext,
  host: DaemonHost,
): void {
  context.subscriptions.push(
    commands.registerCommand(
      "syntaxmesh.addProject",
      () =>
        guarded(async () => {
          const uri = activeMasterUri();
          if (uri === undefined) {
            window.showWarningMessage(
              "SyntaxMesh: open a project file first.",
            );
            return;
          }
          const model = await host.addProject(uri,);
          window.showInformationMessage(
            `SyntaxMesh: loaded ${model.entry} (${model.status}).`,
          );
        },),
    ),
    commands.registerCommand(
      "syntaxmesh.reloadProject",
      () =>
        guarded(async () => {
          const uri = activeMasterUri();
          if (uri === undefined) {
            window.showWarningMessage(
              "SyntaxMesh: open a project file first.",
            );
            return;
          }
          const model = await host.reloadProject(uri,);
          window.showInformationMessage(
            `SyntaxMesh: reloaded ${model.entry} (${model.status}).`,
          );
        },),
    ),
    commands.registerCommand(
      "syntaxmesh.removeProject",
      () =>
        guarded(async () => {
          const summaries = host.core.listProjects();
          if (summaries.length === 0) {
            window.showInformationMessage("SyntaxMesh: no projects loaded.",);
            return;
          }
          const pick = await window.showQuickPick(
            summaries.map((s,) => ({
              label: s.entry,
              description: s.status,
              uri: s.uri,
            })),
            { placeHolder: "Select a project to remove", },
          );
          if (pick === undefined) return;
          host.core.removeProject(pick.uri,);
          await host.persist();
          window.showInformationMessage(`SyntaxMesh: removed ${pick.label}.`,);
        },),
    ),
    commands.registerCommand(
      "syntaxmesh.listProjects",
      () =>
        guarded(async () => {
          const summaries = host.core.listProjects();
          if (summaries.length === 0) {
            window.showInformationMessage("SyntaxMesh: no projects loaded.",);
            return;
          }
          await window.showQuickPick(
            summaries.map((s,) => ({
              label: s.entry,
              description: `${s.status} · ${s.reportCount} reports`,
            })),
            { placeHolder: "Loaded projects", },
          );
        },),
    ),
  );
}
