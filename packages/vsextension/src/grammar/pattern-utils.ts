/**
 * `grammar/pattern-utils.ts` — shared regex helpers of the generators (22.3).
 *
 * Small, dependency-free utilities used by the TextMate grammar generators to
 * turn literal keyword/suffix lists into deterministic regular expressions.
 * Kept separate so `textmate.ts`, `tji.ts` and `language-config.ts` project the
 * same data with the same escaping rules.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.3
 */

/** Escapes the regular-expression metacharacters of a literal string. */
export function escapeRegExp(value: string,): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&",);
}

/**
 * Builds a deterministic alternation: longest first (so `ULL` wins over `U`),
 * then lexicographic, each alternative regex-escaped.
 *
 * @param values literal alternatives (keyword names, numeric suffixes, …).
 * @returns the `a|b|c` body, without the surrounding group.
 */
export function alternation(values: readonly string[],): string {
  const sorted = [...values,].sort(
    (a, b,) => b.length - a.length || (a < b ? -1 : a > b ? 1 : 0),
  );
  return sorted.map(escapeRegExp,).join("|",);
}
