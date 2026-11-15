/**
 * `web/purity.ts` — pure browser-graph purity scanner (22.8.1).
 *
 * The Web extension host (vscode.dev) runs `extension.web.ts` and everything it
 * reaches inside a Web Worker: no `node:*`, no `process.*`, no `Deno.*` (plan
 * §9.2). This module is the pure heart of that guarantee — a line scanner over
 * source text, mirroring the `check:doccore`/`check:lspcore` gates but usable
 * from a Deno BDD test so the regression runs inside `deno test`. The host
 * bootstrap that walks the real source tree lives in the test; this file never
 * touches the environment itself.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §9.2 (Web limitations)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.8.1
 */

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
 * Patterns that must never appear in Web-reachable source. The regex literals
 * are escaped so they do not match their own definition when this file is
 * itself scanned (e.g. `from\s+` needs real whitespace, not the letters `\s`).
 */
const FORBIDDEN: Array<{ re: RegExp; reason: string }> = [
  {
    re: /from\s+["']node:/,
    reason: "import of 'node:*' is unavailable on the Web host",
  },
  {
    re: /\brequire\(\s*["']node:/,
    reason: "require of 'node:*' is unavailable on the Web host",
  },
  {
    re: /\bprocess\.(env|argv|exit|cwd|platform)/,
    reason: "process.* is unavailable on the Web host",
  },
  {
    re: /\bDeno\.[A-Za-z_$]/,
    reason: "Deno.* is unavailable on the Web host",
  },
];

/**
 * Source files that only run on the Desktop (Node) extension host. They are the
 * sole members of the source tree allowed to depend on Node transport, so the
 * Web-graph regression excludes them by relative path.
 */
export const NODE_ONLY_BOOTSTRAPS: readonly string[] = [
  "extension.node.ts",
  "client/node.ts",
  "server/node.ts",
];

/**
 * Scans source text for environment dependencies forbidden in the Web graph.
 *
 * Comment lines (`//`, `*`, `/*`) are skipped — prose may mention `node:` or
 * `Deno.*` without executing anything. Every other line is tested against the
 * forbidden patterns; a line may yield more than one violation.
 *
 * @param text the full source text of one module.
 * @returns the violations in line order (empty when the module is browser-safe).
 */
export function scanBrowserSource(text: string,): PurityViolation[] {
  const violations: PurityViolation[] = [];
  const lines = text.split("\n",);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    if (/^\s*(\/\/|\*|\/\*)/.test(line,)) continue;
    for (const rule of FORBIDDEN) {
      if (rule.re.test(line,)) {
        violations.push({
          line: i + 1,
          snippet: line.trim(),
          reason: rule.reason,
        },);
      }
    }
  }
  return violations;
}
