/**
 * `en` (canonical) language of the TJP language.
 *
 * Every canonical keyword has its own form as the only synonym — English is
 * the native language of the Core; the other languages translate into it.
 */
import type { LanguageDefinition, } from "./types.ts";
import type { CanonicalKeyword, } from "./canonical.ts";
import { CANONICAL_KEYWORDS, } from "./canonical.ts";

const keywords = Object.fromEntries(
  CANONICAL_KEYWORDS.map((k,) => [k, [k,],]),
) as Record<CanonicalKeyword, string[]>;

/** Canonical English definition: every keyword maps to itself. */
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
