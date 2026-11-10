/**
 * `chapters.ts` — canonical order of the manual chapters (22.1b.5).
 *
 * The order matters: the `<< previous · next >>` navigation and the section
 * numbering follow the sequence of the snippets, and the reference appendix
 * comes after all chapters (`UserManual.rb:49-67`).
 *
 * @see ./user-manual.ts
 */

import { BASIC_CHAPTERS, type ManualChapter, } from "./chapters-basics.ts";
import { SYNTAX_CHAPTERS, } from "./chapters-syntax.ts";
import { USAGE_CHAPTERS, } from "./chapters-usage.ts";

export type { ManualChapter, };

/** Chapters in the order they appear in the manual. */
export const MANUAL_CHAPTERS: readonly ManualChapter[] = [
  ...BASIC_CHAPTERS,
  ...SYNTAX_CHAPTERS,
  ...USAGE_CHAPTERS,
];

/** Names of the generated files, in manual order. */
export const MANUAL_CHAPTER_NAMES: readonly string[] = MANUAL_CHAPTERS.map(
  (chapter,) => chapter.name,
);
