export let currentTimeZone: string = "UTC";

/**
 * Set the current timezone
 * @param zone - Timezone string to set
 * @returns Previous timezone string
 */
export function setCurrentTimeZone(zone: string,): string {
  const old = currentTimeZone;
  currentTimeZone = zone;
  return old;
}

/**
 * Check if a timezone string is valid
 * @param zone - Timezone string to validate
 * @returns true if timezone is valid, false otherwise
 */
export function isValidTimeZone(zone: string,): boolean {
  try {
    // Try to create a formatter for the timezone
    new Intl.DateTimeFormat("en-US", { timeZone: zone, },);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get offset in seconds for a given epoch and timezone
 * @param epochSecs - Epoch seconds (UTC)
 * @param timeZone - Timezone string (e.g., 'America/Sao_Paulo')
 * @returns Offset in seconds
 */
export function getOffsetSeconds(epochSecs: number, timeZone: string,): number {
  try {
    const date = new Date(epochSecs * 1000,);
    // Use shortOffset to get format like "GMT-03:00" instead of "BRT"
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZoneName: "shortOffset",
      timeZone,
    },);
    const parts = formatter.formatToParts(date,);
    const offsetPart = parts.find((part,) => part.type === "timeZoneName");
    if (!offsetPart) return 0;

    // Extract offset from timezone name (e.g., "GMT-03:00" or "GMT-3" -> -10800)
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
 * Format UTC offset as +HH:MM / -HH:MM string
 * @param epochSecs - Epoch seconds (UTC)
 * @param timeZone - Timezone string
 * @returns Offset string like "+00:00" or "-03:00"
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
  return `${sign}${hours}:${mins}`;
}

export interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
}

/**
 * Get local parts (year, month, day, hour, minute, second, weekday) for given epoch and timezone
 * @param epochSecs - Epoch seconds (UTC)
 * @param timeZone - Timezone string
 * @returns Object with local parts
 */
const weekdayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export function getLocalParts(
  epochSecs: number,
  timeZone: string,
): LocalParts {
  try {
    // Create a formatter for the target timezone
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
      weekday: "long",
    },);

    // Use formatToParts to get the parts directly
    const parts = formatter.formatToParts(new Date(epochSecs * 1000,),);

    // Extract the values from the parts
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
          result.hour = parseInt(part.value, 10,);
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
