/**
 * `web/purity.ts` — pure browser-graph purity scanner (22.8.1).
 *
 * The Web extension host (vscode.dev) runs `extension.web.ts` and everything it
 * reaches inside a Web Worker with no unbound runtime-specific globals (plan
 * §9.2). Optional host capabilities may be probed through `globalThis` or
 * injected ports. This module adapts the generated-bundle tokenizer for source
 * regressions, mirroring the `check:doccore`/`check:lspcore` gates while remaining
 * usable from a Deno BDD test. The host bootstrap that walks the real source tree
 * lives in the test; this file never touches the environment itself.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §9.2 (Web limitations)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.8.1
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.12.21
 */
import { scanBrowserBundle, } from "./bundle-purity.ts";

/** One environment-dependency violation found in a source line. */
export interface PurityViolation {
  /** 1-based line number of the offending line. */
  line: number;
  /** The trimmed offending line, for diagnostics. */
  snippet: string;
  /** Why the pattern is forbidden in the Web graph. */
  reason: string;
}

/**
 * Source files that only run on the Desktop (Node) extension host. They are the
 * sole members of the source tree allowed to depend on Node transport, so the
 * Web-graph regression excludes them by relative path.
 */
export const NODE_ONLY_BOOTSTRAPS: readonly string[] = [
  "extension.node.ts",
  "client/node.ts",
  "server/node.ts",
  "console/pty.ts",
];

/**
 * Scans source text for unbound runtime dependencies forbidden in the Web graph.
 *
 * The generated-bundle tokenizer ignores comments and non-executable text while
 * retaining executable template interpolations. Bound optional capabilities such
 * as `globalThis.Deno` are accepted; bare runtime globals are not.
 *
 * @param text the full source text of one module.
 * @returns the violations in line order (empty when the module is browser-safe).
 */
export function scanBrowserSource(text: string,): PurityViolation[] {
  return scanBrowserBundle("<source>", text,).map((violation,) => ({
    line: violation.line,
    snippet: violation.snippet,
    reason: violation.reason,
  }));
}
