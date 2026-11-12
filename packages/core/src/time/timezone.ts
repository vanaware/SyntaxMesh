/**
 * Time zone currently used to render dates — the `timezone` attribute of the
 * project, or `"UTC"` until it is set.
 */
export let currentTimeZone: string = "UTC";

/**
 * Sets the current time zone.
 *
 * @param zone Time zone string to set.
 * @returns The previous time zone string.
 */
export function setCurrentTimeZone(zone: string,): string {
  const old = currentTimeZone;
  currentTimeZone = zone;
  return old;
}

/**
 * Shared `Intl.DateTimeFormat` instances, keyed by profile and zone.
 *
 * Constructing a formatter costs tens of microseconds, and the scheduler
 * and the working-hours scoreboards request the same handful of profiles
 * thousands of times per project. Instances are immutable and resolve the
 * offset per formatted date, so reuse never freezes a DST offset. The map
 * is bounded (FIFO eviction) because zone names come from user input; only
 * successfully constructed formatters are cached.
 */
const formatterCache = new Map<string, Intl.DateTimeFormat>();
const MAX_CACHED_FORMATTERS = 64;

function sharedFormatter(
  kind: string,
  timeZone: string,
  options: Intl.DateTimeFormatOptions,
): Intl.DateTimeFormat {
  const key = `${kind}|${timeZone}`;
  let formatter = formatterCache.get(key,);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", { timeZone, ...options, },);
    if (formatterCache.size >= MAX_CACHED_FORMATTERS) {
      const oldest = formatterCache.keys().next().value;
      if (oldest !== undefined) formatterCache.delete(oldest,);
    }
    formatterCache.set(key, formatter,);
  }
  return formatter;
}

/**
 * Tells whether a time zone string is accepted by the runtime.
 *
 * @param zone Time zone string to validate.
 * @returns `true` when the zone is valid.
 */
export function isValidTimeZone(zone: string,): boolean {
  try {
    // Creating a formatter for the zone is the validation itself.
    sharedFormatter("validate", zone, {},);
    return true;
  } catch {
    return false;
  }
}

/**
 * Offset of a time zone for a given instant.
 *
 * @param epochSecs Instant, in epoch seconds (UTC).
 * @param timeZone Time zone string (e.g. `'America/Sao_Paulo'`).
 * @returns The offset in seconds.
 */
export function getOffsetSeconds(epochSecs: number, timeZone: string,): number {
  try {
    const date = new Date(epochSecs * 1000,);
    // `shortOffset` yields "GMT-03:00" instead of the "BRT" abbreviation.
    const formatter = sharedFormatter("offset", timeZone, {
      timeZoneName: "shortOffset",
    },);
    const parts = formatter.formatToParts(date,);
    const offsetPart = parts.find((part,) => part.type === "timeZoneName");
    if (!offsetPart) return 0;

    // Extracts the offset from the name ("GMT-03:00" or "GMT-3" → -10800).
    const match = offsetPart.value.match(/GMT?([+-])(\d{1,2})(?::(\d{2}))?/,);
    if (!match) return 0;

    const sign = match[1] === "-" ? -1 : 1;
    const hours = parseInt(match[2] ?? "0",);
    const minutes = parseInt(match[3] ?? "0",);
    return sign * (hours * 3600 + minutes * 60);
  } catch {
    return 0;
  }
}

/**
 * Formats the UTC offset in the Ruby `strftime %z` form: `+HHMM` / `-HHMM`,
 * without a colon.
 *
 * The colon-free form is required by the `DATE` regex of the TJ scanner
 * (`(-[-+]?\d{4})?`): with a colon, the `to_s` of a `TjTime` is not recognized
 * as a `DATE` when it comes back through the parser (date macros).
 *
 * @param epochSecs Instant, in epoch seconds (UTC).
 * @param timeZone Time zone string.
 * @returns The offset as `"+0000"` or `"-0300"`.
 */
export function formatTimezoneOffset(
  epochSecs: number,
  timeZone: string,
): string {
  const offset = getOffsetSeconds(epochSecs, timeZone,);
  const sign = offset < 0 ? "-" : "+";
  const abs = Math.abs(offset,);
  const hours = String(Math.floor(abs / 3600,),).padStart(2, "0",);
  const mins = String(Math.floor((abs % 3600) / 60,),).padStart(2, "0",);
  return `${sign}${hours}${mins}`;
}

/** Calendar fields of an instant, expressed in a given time zone. */
export interface LocalParts {
  /** Calendar year. */
  year: number;
  /** Month, 1-based. */
  month: number;
  /** Day of the month, 1-based. */
  day: number;
  /** Hour of the day, 0–23. */
  hour: number;
  /** Minute of the hour, 0–59. */
  minute: number;
  /** Second of the minute, 0–59. */
  second: number;
  /** Day of the week, 0 = Sunday. */
  weekday: number;
}

/** Weekday names as `Intl` renders them, indexed like JS `Date#getDay`. */
const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/**
 * Decomposes an instant into the calendar fields of a time zone.
 *
 * @param epochSecs Instant, in epoch seconds (UTC).
 * @param timeZone Time zone string.
 * @returns The local calendar fields, or all zeros when the zone is invalid.
 */
export function getLocalParts(
  epochSecs: number,
  timeZone: string,
): LocalParts {
  try {
    // `hourCycle: "h23"` (and **not** `hour12: false`): the Node ICU maps
    // `hour12: false` to the `h24` cycle, where midnight is **24** —
    // `TjTime.fromParts` rejects 24 and the CLI broke under Node/bundle. `h23`
    // returns 0 on every runtime (Deno, Node, Bun).
    const formatter = sharedFormatter("parts", timeZone, {
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hourCycle: "h23",
      weekday: "long",
    },);

    // `formatToParts` exposes the fields directly.
    const parts = formatter.formatToParts(new Date(epochSecs * 1000,),);

    // Collects the values from the parts.
    const result: LocalParts = {
      year: 0,
      month: 0,
      day: 0,
      hour: 0,
      minute: 0,
      second: 0,
      weekday: 0,
    };

    for (const part of parts) {
      switch (part.type) {
        case "year":
          result.year = parseInt(part.value, 10,);
          break;
        case "month":
          result.month = parseInt(part.value, 10,);
          break;
        case "day":
          result.day = parseInt(part.value, 10,);
          break;
        case "hour":
          // Belt and braces: no runtime should return 24 (see h23 above).
          result.hour = parseInt(part.value, 10,) % 24;
          break;
        case "minute":
          result.minute = parseInt(part.value, 10,);
          break;
        case "second":
          result.second = parseInt(part.value, 10,);
          break;
        case "weekday": {
          const idx = weekdayNames.indexOf(part.value,);
          result.weekday = idx >= 0 ? idx : 0;
          break;
        }
      }
    }

    return result;
  } catch {
    return {
      year: 0,
      month: 0,
      day: 0,
      hour: 0,
      minute: 0,
      second: 0,
      weekday: 0,
    };
  }
}

/**
 * Short time zone abbreviation of an instant (e.g. `"UTC"`, `"EST"`), as
 * rendered for `strftime("%Z")`.
 *
 * @param epochSecs Instant, in epoch seconds (UTC).
 * @param timeZone Time zone string.
 * @returns The abbreviation, or the zone name when ICU yields none.
 * @throws RangeError When the zone is invalid — same contract as the
 * previous inline formatter in `TjTime.strftime`.
 */
export function getTimeZoneAbbr(epochSecs: number, timeZone: string,): string {
  const formatter = sharedFormatter("abbr", timeZone, {
    timeZoneName: "short",
  },);
  const parts = formatter.formatToParts(new Date(epochSecs * 1000,),);
  return parts.find((p,) => p.type === "timeZoneName")?.value || timeZone;
}
