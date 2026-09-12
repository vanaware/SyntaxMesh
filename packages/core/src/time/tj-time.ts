import { isValidTimeZone, getOffsetSeconds, getLocalParts, currentTimeZone } from './timezone.ts';
import { assertEquals, assertNotEquals } from "@std/assert";

export class TjArgumentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TjArgumentError';
  }
}

export class TjTime {
  private readonly seconds: number;

  private constructor(seconds: number) {
    this.seconds = seconds;
  }

  /**
   * Returns current time
   */
  static now(): TjTime {
    return new TjTime(Math.floor(Date.now() / 1000));
  }

  /**
   * Create TjTime from seconds since epoch
   * @param secs - Seconds since epoch (UTC)
   */
  static fromSeconds(secs: number): TjTime {
    return new TjTime(secs);
  }

  /**
   * Create TjTime from Date object
   * @param date - Date object
   */
  static fromDate(date: Date): TjTime {
    return new TjTime(Math.floor(date.getTime() / 1000));
  }

  /**
   * Create TjTime from parts
   * @param year - Year (1970-2035)
   * @param month - Month (1-12)
   * @param day - Day (1-31)
   * @param hour - Hour (0-23, default 0)
   * @param minute - Minute (0-59, default 0)
   * @param second - Second (0-59, default 0)
   * @param tz - Timezone (optional, defaults to currentTimeZone)
   */
  static fromParts(
    year: number,
    month: number,
    day: number,
    hour: number = 0,
    minute: number = 0,
    second: number = 0,
    tz: string = currentTimeZone
  ): TjTime {
    if (!isValidTimeZone(tz)) {
      throw new TjArgumentError(`Invalid time zone: ${tz}`);
    }
    
    // Validate ranges
    if (year < 1970 || year > 2035) {
      throw new TjArgumentError(`Year ${year} out of range (1970 - 2035)`);
    }
    if (month < 1 || month > 12) {
      throw new TjArgumentError(`Month ${month} out of range (1 - 12)`);
    }
    if (hour < 0 || hour > 23) {
      throw new TjArgumentError(`Hour ${hour} out of range (0 - 23)`);
    }
    if (minute < 0 || minute > 59) {
      throw new TjArgumentError(`Minute ${minute} out of range (0 - 59)`);
    }
    if (second < 0 || second > 59) {
      throw new TjArgumentError(`Second ${second} out of range (0 - 59)`);
    }
    
    // Validate day for month
    const maxDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let maxDay: number = maxDays[month]!;
    if (month === 2 && TjTime.isLeapYear(year)) {
      maxDay = 29;
    }
    if (day < 1 || day > maxDay) {
      throw new TjArgumentError(`Day ${day} out of range (1 - ${maxDay}) for month ${month}`);
    }
    
    // Convert to UTC seconds
    const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
    const utcSeconds = Math.floor(date.getTime() / 1000);
    
    // Apply timezone offset
    const offset = getOffsetSeconds(utcSeconds, tz);
    return new TjTime(utcSeconds - offset);
  }

  /**
   * Parse string in format YYYY-MM-DD[-HH:MM[:SS][-TZ]]
   * @param str - String to parse
   */
  static fromString(str: string): TjTime {
    const regex = /^(\d{4})-(\d{2})-(\d{2})(?:-(\d{2}):(\d{2})(?::(\d{2}))?)?(?:([+-]\d{4}))?$/;
    const match = str.match(regex);
    if (!match) {
      throw new TjArgumentError(`Invalid date format: ${str}`);
    }

    const year = parseInt(match[1]!);
    const month = parseInt(match[2]!);
    const day = parseInt(match[3]!);

    let hour = 0;
    let minute = 0;
    let second = 0;
    const tz: string = currentTimeZone;

    if (match[4]) {
      hour = parseInt(match[4]);
      minute = parseInt(match[5]!);
      second = match[6] ? parseInt(match[6]) : 0;
    }

    if (match[7]) {
      const tzPart = match[7];
      if (!/^[+-]\d{4}$/.test(tzPart)) {
        throw new TjArgumentError(`Time zone adjustment out of range (-1200 - +1400) but is ${tzPart})`);
      }

      const sign = tzPart[0] === '-' ? -1 : 1;
      const hours = parseInt(tzPart.substring(1, 3));
      const minutes = parseInt(tzPart.substring(3, 5));

      if (hours < 0 || hours > 12 || (hours === 12 && minutes > 0) || minutes < 0 || minutes > 59) {
        throw new TjArgumentError(`Time zone adjustment out of range (-1200 - +1400) but is ${tzPart})`);
      }

      const offsetHours = hours * 60 + minutes;
      const offsetSeconds = sign * offsetHours * 60;

      // Validate range
      if (offsetSeconds < -12 * 3600 || offsetSeconds > 14 * 3600) {
        throw new TjArgumentError(`Time zone adjustment out of range (-1200 - +1400) but is ${tzPart})`);
      }

      // Fixed-offset timezones are not valid IANA identifiers, so compute UTC
      // seconds directly instead of routing through fromParts/isValidTimeZone.
      // offsetSeconds is positive for +HHMM (local ahead of UTC), so subtract to get UTC.
      const date = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
      const utcSeconds = Math.floor(date.getTime() / 1000);
      return new TjTime(utcSeconds - offsetSeconds);
    }

    return TjTime.fromParts(year, month, day, hour, minute, second, tz);
  }

  /**
   * Get seconds since epoch
   */
  toSeconds(): number {
    return this.seconds;
  }

  /**
   * Convert to Date object (for debugging)
   */
  toDate(): Date {
    return new Date(this.seconds * 1000);
  }

  /**
   * Check if year is leap year
   */
  static isLeapYear(year: number): boolean {
    return (year % 400 === 0) || (year % 4 === 0 && year % 100 !== 0);
  }

  /**
   * Add seconds to TjTime
   * @param secs - Seconds to add
   */
  addSeconds(secs: number): TjTime {
    return new TjTime(this.seconds + secs);
  }

  /**
   * Subtract seconds from TjTime
   * @param secs - Seconds to subtract
   */
  subSeconds(secs: number): TjTime {
    return new TjTime(this.seconds - secs);
  }

  /**
   * Get difference in seconds between two TjTime instances
   * @param other - Other TjTime instance
   */
  diff(other: TjTime): number {
    return this.seconds - other.seconds;
  }

  /**
   * Get modulo of seconds
   * @param val - Value to modulo by
   */
  modulo(val: number): number {
    return this.seconds % val;
  }

  /**
   * Compare to another TjTime instance
   * @param other - Other TjTime instance
   * @returns -1 if less, 0 if equal, 1 if greater
   */
  compareTo(other: TjTime): -1 | 0 | 1 {
    if (this.seconds < other.seconds) return -1;
    if (this.seconds > other.seconds) return 1;
    return 0;
  }

  /**
   * Check if this TjTime is less than another
   * @param other - Other TjTime instance
   */
  lessThan(other: TjTime): boolean {
    return this.seconds < other.seconds;
  }

  /**
   * Check if this TjTime is greater than another
   * @param other - Other TjTime instance
   */
  greaterThan(other: TjTime): boolean {
    return this.seconds > other.seconds;
  }

  /**
   * Check if this TjTime equals another
   * @param other - Other TjTime instance
   */
  equals(other: TjTime): boolean {
    return this.seconds === other.seconds;
  }

  /**
   * Check if this TjTime is less than or equal to another
   * @param other - Other TjTime instance
   */
  lessThanOrEqual(other: TjTime): boolean {
    return this.seconds <= other.seconds;
  }

  /**
   * Check if this TjTime is greater than or equal to another
   * @param other - Other TjTime instance
   */
  greaterThanOrEqual(other: TjTime): boolean {
    return this.seconds >= other.seconds;
  }

  /**
   * Zero minutes and seconds in local time
   */
  beginOfHour(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return TjTime.fromParts(parts.year, parts.month, parts.day, parts.hour, 0, 0, currentTimeZone);
  }

  /**
   * Zero hours, minutes, seconds in local time
   */
  midnight(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return TjTime.fromParts(parts.year, parts.month, parts.day, 0, 0, 0, currentTimeZone);
  }

  /**
   * Beginning of week. If startMonday=true, week starts Monday; otherwise Sunday.
   * Algorithm: go to noon, subtract (weekday - (startMonday?1:0)) days, then midnight.
   */
  beginOfWeek(startMonday: boolean = true): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    const noon = TjTime.fromParts(parts.year, parts.month, parts.day, 12, 0, 0, currentTimeZone);
    const daysToSubtract = parts.weekday - (startMonday ? 1 : 0);
    const noonMinusDays = noon.subSeconds(daysToSubtract * 86400);
    const np = getLocalParts(noonMinusDays.toSeconds(), currentTimeZone);
    return TjTime.fromParts(np.year, np.month, np.day, 0, 0, 0, currentTimeZone);
  }

  /**
   * Beginning of month: day=1, h/m/s=0 in local time
   */
  beginOfMonth(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return TjTime.fromParts(parts.year, parts.month, 1, 0, 0, 0, currentTimeZone);
  }

  /**
   * Beginning of quarter: month = ((m-1) % 3) + 1, h/m/s=0
   */
  beginOfQuarter(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    const quarterMonth = ((parts.month - 1) % 3) + 1;
    return TjTime.fromParts(parts.year, quarterMonth, 1, 0, 0, 0, currentTimeZone);
  }

  /**
   * Beginning of year: month=1, day=1, h/m/s=0
   */
  beginOfYear(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return TjTime.fromParts(parts.year, 1, 1, 0, 0, 0, currentTimeZone);
  }

  /**
   * Weekday in local time (0=Sunday, 1=Monday, ..., 6=Saturday)
   */
  wday(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return parts.weekday;
  }

  /**
   * Hour in local time
   */
  hour(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return parts.hour;
  }

  /**
   * Day in local time
   */
  day(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return parts.day;
  }

  /**
   * Month in local time
   */
  month(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return parts.month;
  }

  /**
   * Year in local time
   */
  year(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return parts.year;
  }

  /**
   * Return [year, month, day, hour, minute, second, weekday] in local time
   */
  to_a(): number[] {
    const parts = getLocalParts(this.seconds, currentTimeZone);
    return [parts.year, parts.month, parts.day, parts.hour, parts.minute, parts.second, parts.weekday];
  }

  /**
   * Iterate from this TjTime to end with step
   * @param end - End TjTime (exclusive)
   * @param step - Step in seconds (default 1)
   * @param fn - Callback function
   */
  upto(end: TjTime, step: number = 1, fn: (t: TjTime) => void): void {
    let current = TjTime.fromSeconds(this.seconds);
    while (current.seconds < end.seconds) {
      fn(current);
      current = TjTime.fromSeconds(current.seconds + step);
    }
  }
}