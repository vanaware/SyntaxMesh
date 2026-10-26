/**
 * Idioma en (canônico) da linguagem TJP.
 *
 * Cada keyword canônico tem a própria forma como único sinônimo — o
 * inglês é a língua nativa do Core; os demais idiomas traduzem para cá.
 */
import type { LanguageDefinition, } from "./types.ts";
import type { CanonicalKeyword, } from "./canonical.ts";
import { CANONICAL_KEYWORDS, } from "./canonical.ts";

const keywords = Object.fromEntries(
  CANONICAL_KEYWORDS.map((k,) => [k, [k,],]),
) as Record<CanonicalKeyword, string[]>;

export const en: LanguageDefinition = {
  id: "en",
  name: "English",
  keywords,
  units: {
    minute: ["mn", "min", "minute", "minutes",],
    hour: ["h", "hour", "hours",],
    day: ["d", "day", "days",],
    week: ["w", "week", "weeks",],
    month: ["mo", "m", "month", "months",],
    quarter: ["q", "quarter", "quarters",],
    year: ["y", "year", "years",],
  },
};
