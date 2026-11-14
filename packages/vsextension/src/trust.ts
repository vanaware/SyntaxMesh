/**
 * `trust.ts` — pure Workspace Trust gate (22.7.5).
 *
 * Running a project (daemon) and generating reports execute user code paths
 * (the scheduler, report generators), so they are gated behind VS Code
 * Workspace Trust (plan §8.4). The decision logic lives here as pure functions
 * over a boolean — the host reads `workspace.isTrusted` and passes it in — so
 * the gate is unit-testable in Deno without the `vscode` runtime.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §8.4 (trust)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.7.5
 */

/** Message shown when a command is blocked in an untrusted workspace. */
export const UNTRUSTED_MESSAGE =
  "SyntaxMesh: this command requires a trusted workspace.";

/**
 * Whether a daemon/report command may run in the current workspace.
 *
 * @param isTrusted the value of `workspace.isTrusted`.
 * @returns `true` only when the workspace is trusted.
 */
export function canRun(isTrusted: boolean,): boolean {
  return isTrusted;
}

/**
 * Asserts that the workspace is trusted, throwing otherwise.
 *
 * The command bootstraps call this before touching the daemon; the thrown
 * {@link UNTRUSTED_MESSAGE} is surfaced to the user by the caller.
 *
 * @param isTrusted the value of `workspace.isTrusted`.
 * @throws when the workspace is not trusted.
 */
export function assertTrusted(isTrusted: boolean,): void {
  if (!isTrusted) throw new Error(UNTRUSTED_MESSAGE,);
}
