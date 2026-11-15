/**
 * `web/write-fallback.ts` — pure user-triggered write policy (22.8.2).
 *
 * On the Web host `workspace.fs.writeFile` only succeeds inside a short
 * permission window opened by a user gesture; the documented fallback is to
 * write an empty file immediately after the click and then overwrite it with
 * the real content (plan §9.2). This module owns that decision as pure logic
 * over a structural file-system seam, so it is unit-testable in Deno without
 * the `vscode` runtime. It never throws: a denied or failed write becomes a
 * friendly {@link WriteResult} the host surfaces to the user.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §9.2 (Web writes)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.8.2
 */

/**
 * Structural subset of `workspace.fs` used for user-triggered writes. The URI
 * type is generic so the host can pass `vscode.Uri` while tests pass strings.
 */
export interface WorkspaceFsLike<TUri = string,> {
  /** Writes bytes to `uri`, creating or overwriting the file. */
  writeFile(uri: TUri, content: Uint8Array,): PromiseLike<void>;
}

/**
 * How to perform the write: `direct` (Desktop, one call) or `stub-first` (Web,
 * an empty file first to stay inside the permission window, then the content).
 */
export type WriteStrategy = "direct" | "stub-first";

/** Outcome of a user-triggered write: success, or a friendly error message. */
export type WriteResult = { ok: true } | { ok: false; error: string };

/** Prefix of the message shown when a user-triggered write fails. */
export const WRITE_ERROR_MESSAGE = "SyntaxMesh: could not write the file";

/** Extracts a human-readable message from an unknown thrown value. */
function errorMessage(err: unknown,): string {
  return err instanceof Error ? err.message : String(err,);
}

/**
 * Writes user-requested content to `target`, applying the Web fallback when
 * asked. Any failure (permission denied, I/O error) is caught and returned as
 * `{ ok: false, error }` — this function never throws.
 *
 * @param fs the file-system seam (e.g. `workspace.fs`).
 * @param target the destination URI.
 * @param content the text to write.
 * @param strategy `direct` (default) or `stub-first` for the Web host.
 * @returns `{ ok: true }` on success, otherwise a friendly error.
 */
export async function writeUserFile<TUri,>(
  fs: WorkspaceFsLike<TUri>,
  target: TUri,
  content: string,
  strategy: WriteStrategy = "direct",
): Promise<WriteResult> {
  const bytes = new TextEncoder().encode(content,);
  try {
    if (strategy === "stub-first") {
      await fs.writeFile(target, new Uint8Array(0,),);
    }
    await fs.writeFile(target, bytes,);
    return { ok: true, };
  } catch (err) {
    return {
      ok: false,
      error: `${WRITE_ERROR_MESSAGE}: ${errorMessage(err,)}`,
    };
  }
}
