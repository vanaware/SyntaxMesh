/**
 * `include` references of a TJP text (phase 24 — task 24.3.6).
 *
 * The CLI must deliver the **complete closure** of `include`s inside
 * `request.files` before calling `execute`: the core resolves by *lookup* in
 * memory and never touches the disk. Since the parser only discovers the
 * included files during the scan, this function reads the text statically.
 *
 * Rules:
 *  - line by line, a `#` comment outside a string is discarded;
 *  - the first identifier of the line must be the `include` keyword —
 *    canonical or a synonym of any registered language (`incluir` in
 *    pt-BR/es, ADR 023). This is a static read: the real language of the file
 *    is not resolved here, so the synonym set is the union of all registered
 *    ones;
 *  - the path is the first quoted literal.
 *
 * Covers the three forms of the grammar: `prologInclude` (before the header),
 * `projectBodyInclude` (inside the header, with attributes) and `includeFile`
 * (`include "file"` in the body) — all of them start with `include "name"`.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli.md §5.1
 * @see packages/core/src/parser/rules/project.ts (`include*` rules)
 */
import { globalRegistry, type LanguageRegistry, } from "../i18n/mod.ts";

/**
 * Words that open an `include`, union of all registered languages.
 *
 * The canonical one is always present, even when no language lists it.
 */
export function includeKeywords(
  registry: LanguageRegistry = globalRegistry,
): string[] {
  const words = new Set<string>(["include",],);
  for (const language of registry.all()) {
    for (const synonym of language.keywords.include ?? []) {
      words.add(synonym,);
    }
  }
  return [...words,];
}

/** Removes a `#` comment that is outside a string. */
function stripComment(line: string,): string {
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i]!;
    if (char === '"') {
      quoted = !quoted;
    } else if (char === "#" && !quoted) {
      return line.slice(0, i,);
    }
  }
  return line;
}

/** Identifier in the first column followed by a string: `include "x"`. */
const INCLUDE_LINE = /^\s*([A-Za-z_][\w-]*)\s+"([^"]*)"/;

/**
 * Paths referenced by `include` in the text, in order of appearance.
 *
 * Returns the names **as written** (relative to the including file or
 * absolute); resolving them against the parent path is the caller's job.
 */
export function scanIncludeReferences(
  content: string,
  keywords: readonly string[] = includeKeywords(),
): string[] {
  const known = new Set(keywords,);
  const references: string[] = [];
  for (const raw of content.split("\n",)) {
    const match = stripComment(raw,).match(INCLUDE_LINE,);
    if (match === null) continue;
    if (!known.has(match[1]!,)) continue;
    references.push(match[2]!,);
  }
  return references;
}
