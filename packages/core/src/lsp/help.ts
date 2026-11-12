/**
 * `help.ts` — bridge from the lsp-core to the doc-core (I 7.5 / 7.6).
 *
 * `getKeywordHelp` is a **projection** of the doc-core, not a
 * reimplementation: it looks the keyword up in the shared
 * {@link syntaxReference} index and returns `KeywordDocumentation.toMarkdown()`.
 * Results are memoized per keyword (the reference itself is already memoized
 * by the doc-core; this cache avoids re-rendering the Markdown on every
 * hover).
 *
 * The manual bridges (`getManualToc`/`getManualPage`, I 7.6) re-export the
 * doc-core projections of 22.1b.5.13/5.14 unchanged — the memoized manual
 * lives there, shared with any other consumer.
 *
 * v1 is English-only: the `locale` parameter exists for the post-Fase 21
 * multilingual addendum and is deliberately ignored (plan §5).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (getKeywordHelp)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco I 7.5/7.6
 */
import { syntaxReference, } from "../docgen/syntax-reference.ts";
import type { Locale, } from "./locale.ts";
import type { MarkdownString, } from "./types.ts";

// Manual bridges (I 7.6): pure re-export of the doc-core projections.
export {
  getManualPage,
  getManualToc,
  resetManualPageCache,
} from "../docgen/manual-pages.ts";
export type { ManualTocEntry, } from "../docgen/user-manual.ts";

/** Memoized Markdown per keyword; `null` records an unknown keyword. */
const helpCache = new Map<string, MarkdownString | null>();

/**
 * Embedded syntax/usage reference of one keyword, as Markdown.
 *
 * @param keyword exact keyword name (e.g. `"task"`, `"depends"`).
 * @param locale accepted for the multilingual addendum; ignored in v1
 * (the doc-core texts are English-only).
 * @returns the Markdown page, or `null` when the keyword is not documented.
 */
export function getKeywordHelp(
  keyword: string,
  locale: Locale = "en",
): MarkdownString | null {
  void locale;
  const cached = helpCache.get(keyword,);
  if (cached !== undefined) return cached;
  // ignoreOld=true: same keyword universe as SyntaxCore/the editor grammar.
  const documentation = syntaxReference(null, true,).keywords.get(keyword,);
  const markdown = documentation === undefined
    ? null
    : documentation.toMarkdown();
  helpCache.set(keyword, markdown,);
  return markdown;
}

/** Forgets the memoized help pages (tests and asset reloading). */
export function clearKeywordHelpCache(): void {
  helpCache.clear();
}

/** Number of memoized pages, including unknown keywords (introspection). */
export function keywordHelpCacheSize(): number {
  return helpCache.size;
}
