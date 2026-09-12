export const currentTimeZone: string = 'UTC';

/**
 * Check if a timezone string is valid (IANA format)
 * @param zone - Timezone string to validate
 * @returns boolean
 */
export function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat(zone);
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
    const formatter = new Intl.DateTimeFormat(timeZone, { timeZoneName: 'short' });
    const parts = formatter.formatToParts(date);
    const offsetPart = parts.find(part => part.type === 'timeZoneName');
    if (!offsetPart) return 0;
    
    // Extract offset from timezone name (e.g., "GMT-03:00" -> -18000)
    const match = offsetPart.value.match(/GMT?([+-])(\d{2}):(\d{2})/);
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
    const date = new Date(epochSecs * 1000);
    const formatter = new Intl.DateTimeFormat(timeZone, { 
      year: 'numeric', 
      month: '2-digit', 
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      weekday: 'short'
    });
    
    const parts = formatter.formatToParts(date);
    const result: LocalParts = {
      year: 0,
      month: 0,
      day: 0,
      hour: 0,
      minute: 0,
      second: 0,
      weekday: 0
    };
    
    for (const part of parts) {
      if (part.type === 'year') result.year = parseInt(part.value);
      else if (part.type === 'month') result.month = parseInt(part.value);
      else if (part.type === 'day') result.day = parseInt(part.value);
      else if (part.type === 'hour') result.hour = parseInt(part.value);
      else if (part.type === 'minute') result.minute = parseInt(part.value);
      else if (part.type === 'second') result.second = parseInt(part.value);
      else if (part.type === 'weekday') {
        const weekdayMap: Record<string, number> = {
          'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3,
          'Thursday': 4, 'Friday': 5, 'Saturday': 6,
          'Dom': 0, 'Seg': 1, 'Ter': 2, 'Qua': 3,
          'Qui': 4, 'Sex': 5, 'Sáb': 6,
        };
        result.weekday = weekdayMap[part.value] ?? 0;
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
      weekday: 0
    };
  }
}