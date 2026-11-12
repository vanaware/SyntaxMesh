/**
 * `manual-pages.ts` — LSP-only projections of the user manual (22.1b.5.13/5.14).
 *
 * The editor needs the manual as **data**, not as HTML files: a flat table of
 * contents (`getManualToc`) and one page at a time (`getManualPage`), rendered
 * as plain text/Markdown — chapters through the RichText intermediate format's
 * `to_s` (no HTML), keywords through `KeywordDocumentation.toMarkdown()`.
 *
 * The manual is expensive to assemble (14 RichText chapters + the whole syntax
 * reference), so one instance is memoized per process; `resetManualPageCache`
 * exists for tests only, like `resetSyntaxReferenceCache`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco G (5.13/5.14)
 */

import { UserManual, } from "./user-manual.ts";
import type { ManualTocEntry, } from "./user-manual.ts";
import { MANUAL_CHAPTERS, } from "./manual/chapters.ts";

/** Memoized manual shared by the TOC and page projections. */
let cachedManual: UserManual | null = null;

/** The shared manual, assembled on first use. */
function manual(): UserManual {
  if (cachedManual === null) cachedManual = new UserManual();
  return cachedManual;
}

/**
 * The manual table of contents as `{ id, title, level }[]` (22.1b.5.13):
 * chapters in manual order, then appendix `A` with one entry per keyword.
 * Ids are stable across calls and resolvable by {@link getManualPage}.
 */
export function getManualToc(): ManualTocEntry[] {
  return manual().getManualToc();
}

/**
 * One manual page as plain text/Markdown, or `null` for an unknown id
 * (22.1b.5.14).
 *
 * Accepted ids: a chapter name (`Intro`, `Getting_Started`, … — a `#<tag>`
 * suffix is tolerated and serves the whole chapter) or a keyword (`task`,
 * `effort`, …). Chapters render through the RichText `to_s` (titles and
 * paragraphs, no HTML); keywords through `toMarkdown()` (`### keyword` +
 * fenced syntax). The result never contains raw HTML.
 *
 * @param id page id from {@link getManualToc} (or a bare keyword).
 */
export function getManualPage(id: string,): string | null {
  const name = id.split("#",)[0] ?? "";
  if (name === "") return null;
  const book = manual();
  // Chapter: assemble the snips once (shared section counters) and render
  // the matching one as plain text.
  if (MANUAL_CHAPTERS.some((chapter,) => chapter.name === name)) {
    book.getManualToc();
    const snip = book.snippets.find((s,) => s.name === name);
    return snip === undefined ? null : snip.toText();
  }
  // Keyword page: the Markdown projection of the reference documentation.
  return book.reference.keywords.get(name,)?.toMarkdown() ?? null;
}

/** Drops the memoized manual (tests only). */
export function resetManualPageCache(): void {
  cachedManual = null;
}
