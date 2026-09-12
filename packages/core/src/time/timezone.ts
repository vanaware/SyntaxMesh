export const currentTimeZone: string = 'America/Sao_Paulo';

/**
 * Check if a timezone string is valid (IANA format)
 * @param zone - Timezone string to validate
 * @returns boolean
 */
export function isValidTimeZone(zone: string): boolean {
  try {
    // Use Intl.supportedValuesOf to check if timezone is supported
    // This is available in Deno and modern browsers
    if (Intl.supportedValuesOf) {
      const timezones = Intl.supportedValuesOf('timeZone');
      return timezones.includes(zone);
    }
    
    // Fallback: try creating a DateTimeFormat with the timezone
    // If it throws, the timezone is invalid
    new Intl.DateTimeFormat('en-US', { timeZone: zone });
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
export function getOffsetSeconds(epochSecs: number, timeZone: string): number {
  try {
    const date = new Date(epochSecs * 1000);
    // Use shortOffset to get format like "GMT-03:00" instead of "BRT"
    const formatter = new Intl.DateTimeFormat('en-US', { timeZoneName: 'shortOffset', timeZone });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');
    if (!offsetPart) return 0;
    
    // Extract offset from timezone name (e.g., "GMT-03:00" or "GMT-3" -> -10800)
    const match = offsetPart.value.match(/GMT?([+-])(\d{1,2})(?::(\d{2}))?/);
    if (!match) return 0;
    
    const sign = match[1] === '-' ? -1 : 1;
    const hours = parseInt(match[2] ?? '0');
    const minutes = parseInt(match[3] ?? '0');
    return sign * (hours * 3600 + minutes * 60);
  } catch {
    return 0;
  }
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
export function getLocalParts(epochSecs: number, timeZone: string): LocalParts {
  try {
    // Get the offset using getOffsetSeconds
    const offset = getOffsetSeconds(epochSecs, timeZone);
    
    // Add offset to epoch seconds to get local time in UTC
    // local = UTC + offset, so for UTC-3: local = UTC - 3 hours
    const localEpochSecs = epochSecs + offset;
    
    // Extract parts manually using UTC methods
    const localDate = new Date(localEpochSecs * 1000);
    const result: LocalParts = {
      year: localDate.getUTCFullYear(),
      month: localDate.getUTCMonth() + 1,
      day: localDate.getUTCDate(),
      hour: localDate.getUTCHours(),
      minute: localDate.getUTCMinutes(),
      second: localDate.getUTCSeconds(),
      weekday: localDate.getUTCDay()
    };
    
    return result;
  } catch {
    return {
      year: 0,
      month: 0,
      day: 0,
      hour: 0,
      minute: 0,
      second: 0,
      weekday: 0
    };
  }
}