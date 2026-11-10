/**
 * `manual-context.ts` — minimal contract that `KeywordDocumentation` asks of
 * the document hosting it (22.1b.3/22.1b.5).
 *
 * Ruby uses `@manual` (a concrete `UserManual` instance) for four page
 * callbacks (`generateStyleSheet`, `generateHTMLHeader`, `generateHTMLFooter`,
 * `generateHTMLNavigationBar`) and for the example corpus (`TjpExample`). Here
 * the dependency is **structural**: `doc-core` renders a keyword page without
 * importing `UserManual`, which avoids the cycle
 * `user-manual → syntax-reference → keyword-documentation`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/KeywordDocumentation.rb
 */

import type { XMLElementLike, } from "../xml/xml-element-like.ts";

/** Document hosting the keyword pages (the `UserManual`). */
export interface ManualPageContext {
  /** `<link>` to the manual stylesheet. */
  generateStyleSheet(): XMLElementLike;
  /** Header at the top of every page. */
  generateHTMLHeader(): XMLElementLike;
  /** Footer of every page. */
  generateHTMLFooter(): XMLElementLike;
  /**
   * Navigation bar `<< previous · index · next >>`.
   *
   * The four parameters are `null` when there is no neighbor (list ends).
   */
  generateHTMLNavigationBar(
    predLabel: string | null,
    predUrl: string | null,
    succLabel: string | null,
    succUrl: string | null,
  ): XMLElementLike;
  /**
   * Snippet of the annotated example (`# *** EXAMPLE: <tag> +`), or `null`
   * when the file is not in the distributed corpus.
   */
  exampleText(file: string, tag: string | null,): string | null;
}
