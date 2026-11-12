/**
 * `docgen/mod.ts` — barrel of `doc-core` (sub-phase 22.1b).
 *
 * Entry point published as `@vanaware/syntaxmesh/doc-core`. It is not
 * re-exported by the root `mod.ts`: the syntax reference builds the parser
 * tables and is expensive, so whoever does not generate documentation does not
 * pay for it.
 *
 * Boundary constraint (enforced by `deno task check:doccore`): no file under
 * `src/docgen/` uses `Deno.*`, `node:` or `npm:` — the package returns
 * **data** and never writes, reads, prints or exits the process.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco D/F/G
 * @see ./man.ts (facade used by the `man` section of phase 24)
 */

export { blue, bold, cyan, paint, red, } from "./ansi.ts";
export { ExampleSnippet, } from "./example-snippet.ts";
export { KeywordDocumentation, } from "./keyword-documentation.ts";
export { keywordToMarkdown, } from "./keyword-markdown.ts";
export { generateMan, } from "./man.ts";
export type {
  ManFile,
  ManFormat,
  ManMessage,
  ManOutput,
  ManRequest,
} from "./man.ts";
export type { ManualPageContext, } from "./manual-context.ts";
export {
  getManualPage,
  getManualToc,
  resetManualPageCache,
} from "./manual-pages.ts";
export {
  resetSyntaxReferenceCache,
  SyntaxReference,
  syntaxReference,
} from "./syntax-reference.ts";
export { normalize, SyntaxCore, } from "./syntax-core.ts";
export type { IndentSettings, Region, TokenRule, } from "./syntax-core.ts";
export { TernarySearchTree, } from "../utils/ternary-search-tree.ts";
export { UserManual, } from "./user-manual.ts";
export type { ManualTocEntry, UserManualOptions, } from "./user-manual.ts";
export { MANUAL_CHAPTER_NAMES, MANUAL_CHAPTERS, } from "./manual/chapters.ts";
export type { ManualChapter, } from "./manual/chapters.ts";
export { EXAMPLE_CORPUS, } from "./manual/example-corpus.ts";
export {
  MANUAL_STYLESHEET,
  MANUAL_STYLESHEET_NAME,
} from "./manual/manual-css.ts";
