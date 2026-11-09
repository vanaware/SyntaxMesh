/**
 * `chapters.ts` — ordem canônica dos capítulos do manual (22.1b.5).
 *
 * A ordem importa: a navegação `<< anterior · próximo >>` e a numeração de
 * seções seguem a sequência dos snips, e o apêndice da referência entra
 * depois de todos os capítulos (`UserManual.rb:49-67`).
 *
 * @see ./user-manual.ts
 */

import { BASIC_CHAPTERS, type ManualChapter, } from "./chapters-basics.ts";
import { SYNTAX_CHAPTERS, } from "./chapters-syntax.ts";
import { USAGE_CHAPTERS, } from "./chapters-usage.ts";

export type { ManualChapter, };

/** Capítulos na ordem em que aparecem no manual. */
export const MANUAL_CHAPTERS: readonly ManualChapter[] = [
  ...BASIC_CHAPTERS,
  ...SYNTAX_CHAPTERS,
  ...USAGE_CHAPTERS,
];

/** Nomes dos arquivos gerados, na ordem do manual. */
export const MANUAL_CHAPTER_NAMES: readonly string[] = MANUAL_CHAPTERS.map(
  (chapter,) => chapter.name,
);
