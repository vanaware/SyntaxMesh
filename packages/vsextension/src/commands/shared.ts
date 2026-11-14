/**
 * `commands/shared.ts` — shared command helpers (22.5.9/22.6.5).
 *
 * Small UI utilities reused by the daemon and report command bootstraps: the
 * active master document URI and the Workspace Trust guard. The gate logic is
 * the pure {@link assertTrusted}; this module only wires it to VS Code messages.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §8.2/§8.4
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.5.9
 */
import { window, workspace, } from "vscode";
import type { Uri, } from "vscode";
import { assertTrusted, } from "../trust.ts";

/** URI of the active editor's document, or `undefined` when none is open. */
export function activeMasterUri(): Uri | undefined {
  return window.activeTextEditor?.document.uri;
}

/**
 * Runs a command body behind the trust gate, surfacing any error as a message.
 *
 * @param action the command body (trust-gated by this wrapper).
 */
export async function guarded(action: () => Promise<void>,): Promise<void> {
  try {
    assertTrusted(workspace.isTrusted,);
    await action();
  } catch (error) {
    window.showErrorMessage(
      error instanceof Error ? error.message : String(error,),
    );
  }
}
