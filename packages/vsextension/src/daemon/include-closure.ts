/**
 * `daemon/include-closure.ts` — pure `include` closure builder (22.5.4).
 *
 * The core resolves `include`s by *lookup* in the request file list and never
 * touches the disk (ADR 034), so the daemon must hand `execute` the **complete
 * closure** of the master file. This module reads that closure through an
 * injected `read` (the host backs it with `workspace.fs`/open buffers), keeping
 * the logic pure and testable in Deno. It mirrors the CLI's `collectInputFiles`
 * (fase-24-cli §5.1): discovery order, canonical paths, cycle guard, and a
 * missing file recorded as data rather than thrown as an FS exception.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.2 (daemon)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.5.4
 * @see packages/cli/src/cli.ts (`collectInputFiles`)
 */
import {
  type ExecutionInputFile,
  normalizeInputPath,
  scanIncludeReferences,
} from "@vanaware/syntaxmesh";

/** Files read for the request, with the ones that could not be opened. */
export interface InputClosure {
  /** Master + `include`s, with a canonical `path` (`normalizeInputPath`). */
  files: ExecutionInputFile[];
  /**
   * Requested paths that could not be read. A missing master leaves `files`
   * empty (the daemon treats it as fatal); a missing `include` is surfaced here
   * and becomes `bad_include` in the core, faithful to `tj3`.
   */
  missing: string[];
}

/**
 * Paths referenced by `include` in a text, in order of appearance.
 *
 * Delegates to the core scanner ({@link scanIncludeReferences}) — the single
 * source of truth for the `include` syntax: `#` comments outside strings are
 * discarded, the keyword may be a synonym of any registered language
 * (`incluir`, ADR 023), and the path is the first quoted literal. The names
 * come back **as written**; resolving them against the parent is
 * {@link buildClosure}'s job.
 *
 * @param text the full text of one project file.
 * @returns the referenced include paths, as written.
 */
export function extractIncludes(text: string,): string[] {
  return scanIncludeReferences(text,);
}

/** POSIX `File.dirname`, like the core's `SourceFileInfo.dirname()`. */
function dirnameOf(path: string,): string {
  const index = path.lastIndexOf("/",);
  if (index < 0) return ".";
  if (index === 0) return "/";
  return path.slice(0, index,);
}

/** `include` path relative to the file that declares it. */
function resolveIncludePath(from: string, reference: string,): string {
  if (reference.startsWith("/",)) return normalizeInputPath(reference,);
  return normalizeInputPath(`${dirnameOf(from,)}/${reference}`,);
}

/**
 * Reads the master and transitively closes every `include`.
 *
 * The order follows discovery (master first, then the includes in order of
 * appearance); repeated paths enter only once, which also cuts cycles before
 * the parser — recursion remains an error of the core. A path that `read`
 * rejects is recorded in `missing` and skipped, never thrown.
 *
 * @param master path of the master file (canonicalised on entry).
 * @param read injected reader (host: `workspace.fs`/open buffer); rejects when
 *   the path cannot be opened.
 * @returns the closed file set plus the paths that could not be read.
 */
export async function buildClosure(
  master: string,
  read: (path: string,) => Promise<string>,
): Promise<InputClosure> {
  const files: ExecutionInputFile[] = [];
  const missing: string[] = [];
  const seen = new Set<string>();
  const pending: string[] = [normalizeInputPath(master,),];

  while (pending.length > 0) {
    const path = pending.shift()!;
    if (seen.has(path,)) continue;
    seen.add(path,);

    let content: string;
    try {
      content = await read(path,);
    } catch {
      missing.push(path,);
      continue;
    }
    files.push({ path, content, },);

    for (const reference of extractIncludes(content,)) {
      const resolved = resolveIncludePath(path, reference,);
      if (!seen.has(resolved,)) pending.push(resolved,);
    }
  }

  return { files, missing, };
}
