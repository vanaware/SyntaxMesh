import {
  currentTimeZone,
  formatTimezoneOffset,
  getLocalParts,
  getOffsetSeconds,
  isValidTimeZone,
  setCurrentTimeZone,
} from "./timezone.ts";
import { assertEquals, assertNotEquals, } from "@std/assert";
import { TjArgumentError, } from "../attributes/errors.ts";
import { compat, } from "../compat.ts";
export { TjArgumentError, };

export class TjTime {
  private readonly seconds: number;

  private constructor(seconds: number,) {
    this.seconds = seconds;
  }

  /**
   * Order two times from smaller to larger
   * @param date - Other TjTime instance
   * @returns Array [smaller, larger]
   */
  public order(date: TjTime,): [TjTime, TjTime,] {
    return this.lessThan(date,) ? [this, date,] : [date, this,];
  }

  /**
   * Count intervals between start and end time
   * @param start - Start TjTime instance
   * @param end - End TjTime instance (assumed >= start)
   * @param stepFunc - Function to advance time by one interval
   * @returns Number of intervals
   */
  public countIntervals(
    start: TjTime,
    end: TjTime,
    stepFunc: (t: TjTime,) => TjTime,
  ): number {
    let i = 0;
    let t = start;
    while (t.lessThan(end,)) {
      t = stepFunc(t,);
      i++;
    }
    return i;
  }

  /**
   * Returns current time
   */
  static now(): TjTime {
    return new TjTime(Math.floor(Date.now() / 1000,),);
  }

  /**
   * Create TjTime from seconds since epoch
   * @param secs - Seconds since epoch (UTC)
   */
  static fromSeconds(secs: number,): TjTime {
    return new TjTime(secs,);
  }

  /**
   * Create TjTime from Date object
   * @param date - Date object
   */
  static fromDate(date: Date,): TjTime {
    return new TjTime(Math.floor(date.getTime() / 1000,),);
  }

  /**
   * Create TjTime from parts
   * @param year - Year (1970-2035)
   * @param month - Month (1-12)
   * @param day - Day (1-31) - may be invalid for the month, will roll over like Ruby's Time.mktime
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
    tz: string = currentTimeZone,
  ): TjTime {
    if (!isValidTimeZone(tz,)) {
      throw new TjArgumentError(`Invalid time zone: ${tz}`,);
    }

    // Validate ranges
    if (year < 1970 || year > 2035) {
      throw new TjArgumentError(`Year ${year} out of range (1970 - 2035)`,);
    }
    if (month < 1 || month > 12) {
      throw new TjArgumentError(`Month ${month} out of range (1 - 12)`,);
    }
    if (hour < 0 || hour > 23) {
      throw new TjArgumentError(`Hour ${hour} out of range (0 - 23)`,);
    }
    if (minute < 0 || minute > 59) {
      throw new TjArgumentError(`Minute ${minute} out of range (0 - 59)`,);
    }
    if (second < 0 || second > 59) {
      throw new TjArgumentError(`Second ${second} out of range (0 - 59)`,);
    }

    // RUBY-COMPAT-DOC: Ruby's Time.mktime does rollover (e.g. mktime(2024,4,31) → 2024-05-01).
    // JavaScript's Date.UTC also does rollover naturally, so we don't validate day range here.
    // fromString() does its own strict validation before calling fromParts().

    // Convert to UTC seconds
    const date = new Date(
      Date.UTC(year, month - 1, day, hour, minute, second,),
    );
    const utcSeconds = Math.floor(date.getTime() / 1000,);

    // Apply timezone offset
    const offset = getOffsetSeconds(utcSeconds, tz,);
    return new TjTime(utcSeconds - offset,);
  }

  /**
   * Parse string in format YYYY-MM-DD[-HH:MM[:SS][-TZ]]
   * @param str - String to parse
   */
  static fromString(str: string,): TjTime {
    // Use split('-', 5) to properly parse the string with timezone
    const parts = str.split("-", 5,);
    if (parts.length < 3) {
      throw new TjArgumentError(`Invalid date format: ${str}`,);
    }

    const year = parseInt(parts[0]!,);
    const month = parseInt(parts[1]!,);
    const day = parseInt(parts[2]!,);

    let hour = 0;
    let minute = 0;
    let second = 0;
    let tzPart: string | undefined = undefined;

    if (parts.length > 3) {
      // Check if timezone is embedded in time part (e.g. "14:30+0300")
      const tzMatch = parts[3]!.match(/([+-]\d{4})$/,);
      if (tzMatch) {
        // Timezone is at the end of the time part
        const timeWithoutTz = parts[3]!.slice(0, -(tzMatch[1]!.length),);
        if (!/^\d{2}:\d{2}(:\d{2})?$/.test(timeWithoutTz,)) {
          throw new TjArgumentError(`Invalid time format: ${parts[3]}`,);
        }
        const timeParts = timeWithoutTz.split(":", 3,);
        hour = parseInt(timeParts[0]!,);
        minute = parseInt(timeParts[1]!,);
        if (timeParts.length > 2) {
          second = parseInt(timeParts[2]!,);
        }
        tzPart = tzMatch[1];
      } else {
        // Parse time part (HH:MM[:SS]) — must be strictly digits/colons
        if (!/^\d{2}:\d{2}(:\d{2})?$/.test(parts[3]!,)) {
          throw new TjArgumentError(`Invalid time format: ${parts[3]}`,);
        }
        const timeParts = parts[3]!.split(":", 3,);
        hour = parseInt(timeParts[0]!,);
        minute = parseInt(timeParts[1]!,);
        if (timeParts.length > 2) {
          second = parseInt(timeParts[2]!,);
        }
      }

      // If we have a 5th part, the timezone is '-' + parts[4] (the '-' was consumed as delimiter)
      if (parts.length > 4) {
        tzPart = "-" + parts[4]!;
      }
    }

    if (tzPart) {
      if (!/^[+-]\d{4}$/.test(tzPart,)) {
        throw new TjArgumentError(
          `Time zone adjustment out of range (-1200 - +1400} but is ${tzPart}`,
        );
      }

      const sign = tzPart[0] === "-" ? -1 : 1;
      const hours = parseInt(tzPart.substring(1, 3,),);
      const minutes = parseInt(tzPart.substring(3, 5,),);

      if (
        hours < 0 || hours > 12 || (hours === 12 && minutes > 0) ||
        minutes < 0 || minutes > 59
      ) {
        throw new TjArgumentError(
          `Time zone adjustment out of range (-1200 - +1400} but is ${tzPart}`,
        );
      }

      const offsetHours = hours * 60 + minutes;
      const offsetSeconds = sign * offsetHours * 60;

      // Validate range
      if (offsetSeconds < -12 * 3600 || offsetSeconds > 14 * 3600) {
        throw new TjArgumentError(
          `Time zone adjustment out of range (-1200 - +1400} but is ${tzPart}`,
        );
      }

      // Fixed-offset timezones are not valid IANA identifiers, so compute UTC
      // seconds directly instead of routing through fromParts/isValidTimeZone.
      // offsetSeconds is positive for +HHMM (local ahead of UTC), so subtract to get UTC.
      const date = new Date(
        Date.UTC(year, month - 1, day, hour, minute, second,),
      );
      const utcSeconds = Math.floor(date.getTime() / 1000,);
      return new TjTime(utcSeconds - offsetSeconds,);
    }

    // Validate day for month (strict validation, unlike fromParts which allows rollover)
    const maxDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,];
    let maxDay: number = maxDays[month]!;
    if (month === 2 && TjTime.isLeapYear(year,)) {
      maxDay = 29;
    }
    if (day < 1 || day > maxDay) {
      throw new TjArgumentError(
        `Day ${day} out of range (1 - ${maxDay}) for month ${month}`,
      );
    }

    // RUBY-COMPAT-DOC: Ruby's Time.mktime does rollover (e.g. mktime(2024,4,31) → 2024-05-01).
    // JavaScript's Date.UTC also does rollover naturally, so we don't validate day range here.
    // fromString() does its own strict validation before calling fromParts().

    return TjTime.fromParts(year, month, day, hour, minute, second,);
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
    return new Date(this.seconds * 1000,);
  }

  /**
   * Check if year is leap year
   */
  static isLeapYear(year: number,): boolean {
    return (year % 400 === 0) || (year % 4 === 0 && year % 100 !== 0);
  }

  /**
   * Add seconds to TjTime
   * @param secs - Seconds to add
   */
  addSeconds(secs: number,): TjTime {
    return new TjTime(this.seconds + secs,);
  }

  /**
   * Align time to the given clock (in seconds), operating in local time.
   *
   * Algorithm (matches TjTime.rb:align):
   *   floor((this.toSeconds() + offset) / clock) * clock - offset
   *
   * where offset is the UTC offset for the current timezone.
   *
   * @param clock - Clock in seconds (must be positive)
   * @returns Aligned TjTime
   */
  align(clock: number,): TjTime {
    if (clock <= 0) {
      throw new TjArgumentError(`clock must be positive, not ${clock}`,);
    }
    const offset = getOffsetSeconds(this.seconds, currentTimeZone,);
    const aligned = Math.floor((this.seconds + offset) / clock,) * clock -
      offset;
    return new TjTime(aligned,);
  }

  /**
   * Subtract seconds from TjTime
   * @param secs - Seconds to subtract
   */
  subSeconds(secs: number,): TjTime {
    return new TjTime(this.seconds - secs,);
  }

  /**
   * Get difference in seconds between two TjTime instances
   * @param other - Other TjTime instance
   */
  diff(other: TjTime,): number {
    return this.seconds - other.seconds;
  }

  /**
   * Get modulo of seconds
   * @param val - Value to modulo by
   */
  modulo(val: number,): number {
    return this.seconds % val;
  }

  /**
   * Compare to another TjTime instance
   * @param other - Other TjTime instance or null
   * @returns -1 if less, 0 if equal, 1 if greater
   */
  compareTo(other: TjTime | null,): -1 | 0 | 1 {
    if (other === null) return -1;
    if (this.seconds < other.seconds) return -1;
    if (this.seconds > other.seconds) return 1;
    return 0;
  }

  /**
   * Check if this TjTime is less than another
   * @param other - Other TjTime instance or null
   */
  lessThan(other: TjTime | null,): boolean {
    if (other === null) return false;
    return this.seconds < other.seconds;
  }

  /**
   * Check if this TjTime is greater than another
   * @param other - Other TjTime instance or null
   */
  greaterThan(other: TjTime | null,): boolean {
    if (other === null) return true;
    return this.seconds > other.seconds;
  }

  /**
   * Check if this TjTime equals another
   * @param other - Other TjTime instance or null
   */
  equals(other: TjTime | null,): boolean {
    if (other === null) return false;
    return this.seconds === other.seconds;
  }

  /**
   * Check if this TjTime is less than or equal to another
   * @param other - Other TjTime instance
   */
  lessThanOrEqual(other: TjTime,): boolean {
    return this.seconds <= other.seconds;
  }

  /**
   * Check if this TjTime is greater than or equal to another
   * @param other - Other TjTime instance
   */
  greaterThanOrEqual(other: TjTime,): boolean {
    return this.seconds >= other.seconds;
  }

  /**
   * Zero minutes and seconds in local time
   */
  beginOfHour(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    return TjTime.fromParts(
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      0,
      0,
      currentTimeZone,
    );
  }

  /**
   * Zero hours, minutes, seconds in local time
   */
  midnight(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    return TjTime.fromParts(
      parts.year,
      parts.month,
      parts.day,
      0,
      0,
      0,
      currentTimeZone,
    );
  }

  /**
   * Beginning of week. If startMonday=true, week starts Monday; otherwise Sunday.
   * Algorithm: go to noon, subtract (weekday - (startMonday?1:0)) days, then midnight.
   */
  beginOfWeek(startMonday: boolean = true,): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    const noon = TjTime.fromParts(
      parts.year,
      parts.month,
      parts.day,
      12,
      0,
      0,
      currentTimeZone,
    );
    const daysToSubtract = (parts.weekday - (startMonday ? 1 : 0) + 7) % 7;
    const noonMinusDays = noon.subSeconds(daysToSubtract * 86400,);
    const np = getLocalParts(noonMinusDays.toSeconds(), currentTimeZone,);
    return TjTime.fromParts(
      np.year,
      np.month,
      np.day,
      0,
      0,
      0,
      currentTimeZone,
    );
  }

  /**
   * Beginning of month: day=1, h/m/s=0 in local time
   */
  beginOfMonth(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    return TjTime.fromParts(
      parts.year,
      parts.month,
      1,
      0,
      0,
      0,
      currentTimeZone,
    );
  }

  /**
   * Beginning of quarter: month = floor((m-1)/3)*3 + 1, h/m/s=0
   */
  beginOfQuarter(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    const quarterMonth = Math.floor((parts.month - 1) / 3,) * 3 + 1;
    return TjTime.fromParts(
      parts.year,
      quarterMonth,
      1,
      0,
      0,
      0,
      currentTimeZone,
    );
  }

  /**
   * Beginning of year: month=1, day=1, h/m/s=0
   */
  beginOfYear(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    return TjTime.fromParts(parts.year, 1, 1, 0, 0, 0, currentTimeZone,);
  }

  /**
   * Weekday in local time (0=Sunday, 1=Monday, ..., 6=Saturday)
   */
  wday(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    return parts.weekday;
  }

  /**
   * Hour in local time
   */
  hour(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    return parts.hour;
  }

  /**
   * Day in local time
   */
  day(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    return parts.day;
  }

  /**
   * Month in local time
   */
  month(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    return parts.month;
  }

  /**
   * Year in local time
   */
  year(): number {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    return parts.year;
  }

  /**
   * Return [year, month, day, hour, minute, second, weekday] in local time
   */
  to_a(): number[] {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    return [
      parts.year,
      parts.month,
      parts.day,
      parts.hour,
      parts.minute,
      parts.second,
      parts.weekday,
    ];
  }

  /**
   * Iterate from this TjTime to end with step
   * @param end - End TjTime (exclusive)
   * @param step - Step in seconds (default 1)
   * @param fn - Callback function
   */
  upto(end: TjTime, step: number = 1, fn: (t: TjTime,) => void,): void {
    let current = TjTime.fromSeconds(this.seconds,);
    while (current.seconds < end.seconds) {
      fn(current,);
      current = TjTime.fromSeconds(current.seconds + step,);
    }
  }

  /**
   * Collect intervals between this TjTime and end with step
   * @param end - End TjTime (exclusive)
   * @param step - Step in seconds (default 1)
   * @returns Array of intervals [{start: TjTime, end: TjTime}]
   */
  collectIntervals(
    end?: TjTime,
    step: number = 1,
  ): { start: TjTime; end: TjTime }[] {
    if (!end) return [];
    const intervals: { start: TjTime; end: TjTime }[] = [];
    let current = TjTime.fromSeconds(this.seconds,);
    while (current.seconds < end.seconds) {
      const next = TjTime.fromSeconds(current.seconds + step,);
      intervals.push({ start: current, end: next, },);
      current = next;
    }
    return intervals;
  }

  /**
   * Add hours to TjTime
   * @param hours - Hours to add
   */
  hoursLater(hours: number,): TjTime {
    return this.addSeconds(hours * 3600,);
  }

  /**
   * Get same time next hour
   */
  sameTimeNextHour(): TjTime {
    return this.hoursLater(1,);
  }

  /**
   * Get same time next day
   */
  sameTimeNextDay(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    let day = parts.day + 1;
    let month = parts.month;
    let year = parts.year;

    // Get max days for current month
    const maxDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,];
    let monMax = maxDays[month]!;
    if (month === 2 && TjTime.isLeapYear(year,)) {
      monMax = 29;
    }

    // Handle overflow
    while (day > monMax) {
      day = 1;
      month++;
      if (month > 12) {
        month = 1;
        year++;
      }
      // Update max days for new month
      monMax = maxDays[month]!;
      if (month === 2 && TjTime.isLeapYear(year,)) {
        monMax = 29;
      }
    }

    return TjTime.fromParts(
      year,
      month,
      day,
      parts.hour,
      parts.minute,
      parts.second,
      currentTimeZone,
    );
  }

  /**
   * Get same time next week (day += 7 with max 1 month overflow)
   */
  sameTimeNextWeek(): TjTime {
    if (compat.keepRubyBugs) {
      // RUBY-COMPAT: Ruby does `day += 7` with 1-month overflow, not +7 exact days
      const parts = getLocalParts(this.seconds, currentTimeZone,);
      let day = parts.day + 7;
      let month = parts.month;
      let year = parts.year;

      const maxDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,];
      let monMax = maxDays[month]!;
      if (month === 2 && TjTime.isLeapYear(year,)) {
        monMax = 29;
      }

      if (day > monMax) {
        day = day - monMax;
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
        monMax = maxDays[month]!;
        if (month === 2 && TjTime.isLeapYear(year,)) {
          monMax = 29;
        }
        if (day > monMax) {
          day = monMax;
        }
      }

      return TjTime.fromParts(
        year,
        month,
        day,
        parts.hour,
        parts.minute,
        parts.second,
        currentTimeZone,
      );
    }
    // Corrected: +7 exact days
    return this.addSeconds(7 * 24 * 3600,);
  }

  /**
   * Get same time next month (clamp bug from old month's monMax)
   */
  sameTimeNextMonth(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    let month = parts.month + 1;
    let year = parts.year;

    if (month > 12) {
      month = 1;
      year++;
    }

    if (compat.keepRubyBugs) {
      // RUBY-COMPAT: clamp in OLD month's monMax (bug)
      const maxDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,];
      let monMax = maxDays[parts.month]!;
      if (parts.month === 2 && TjTime.isLeapYear(parts.year,)) {
        monMax = 29;
      }

      let day = parts.day;
      if (day >= TjTime.lastDayOfMonth(month, year,)) {
        day = monMax;
      }

      // Handle rollover if day is still invalid for new month
      const newLastDay = TjTime.lastDayOfMonth(month, year,);
      if (day > newLastDay) {
        const excessDays = day - newLastDay;
        day = excessDays;
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }

      return TjTime.fromParts(
        year,
        month,
        day,
        parts.hour,
        parts.minute,
        parts.second,
        currentTimeZone,
      );
    }
    // Corrected: clamp in NEW month's lastDayOfMonth
    let day = parts.day;
    const newLastDay = TjTime.lastDayOfMonth(month, year,);
    if (day > newLastDay) {
      day = newLastDay;
    }

    return TjTime.fromParts(
      year,
      month,
      day,
      parts.hour,
      parts.minute,
      parts.second,
      currentTimeZone,
    );
  }

  /**
   * Get same time next quarter (NO clamp, rollover)
   */
  sameTimeNextQuarter(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    let month = parts.month + 3;
    let year = parts.year;

    if (month > 12) {
      month -= 12;
      year++;
    }

    if (compat.keepRubyBugs) {
      // RUBY-COMPAT: no clamp, rollover via Time.mktime
      let day = parts.day;
      const newLastDay = TjTime.lastDayOfMonth(month, year,);
      if (day > newLastDay) {
        day = day - newLastDay;
        month++;
        if (month > 12) {
          month = 1;
          year++;
        }
      }

      return TjTime.fromParts(
        year,
        month,
        day,
        parts.hour,
        parts.minute,
        parts.second,
        currentTimeZone,
      );
    }
    // Corrected: clamp to last day of new month
    let day = parts.day;
    const newLastDay = TjTime.lastDayOfMonth(month, year,);
    if (day > newLastDay) {
      day = newLastDay;
    }

    return TjTime.fromParts(
      year,
      month,
      day,
      parts.hour,
      parts.minute,
      parts.second,
      currentTimeZone,
    );
  }

  /**
   * Get same time next year (NO clamp, rollover)
   */
  sameTimeNextYear(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    const year = parts.year + 1;

    if (compat.keepRubyBugs) {
      // RUBY-COMPAT: no clamp, rollover (e.g. 29/02/2024 → 01/03/2025)
      let day = parts.day;
      const newLastDay = TjTime.lastDayOfMonth(parts.month, year,);
      if (day > newLastDay) {
        const excessDays = day - newLastDay;
        day = excessDays;
        let month = parts.month + 1;
        if (month > 12) {
          month = 1;
        }
        return TjTime.fromParts(
          year,
          month,
          day,
          parts.hour,
          parts.minute,
          parts.second,
          currentTimeZone,
        );
      }

      return TjTime.fromParts(
        year,
        parts.month,
        day,
        parts.hour,
        parts.minute,
        parts.second,
        currentTimeZone,
      );
    }
    // Corrected: clamp to last day of new month
    let day = parts.day;
    const newLastDay = TjTime.lastDayOfMonth(parts.month, year,);
    if (day > newLastDay) {
      day = newLastDay;
    }

    return TjTime.fromParts(
      year,
      parts.month,
      day,
      parts.hour,
      parts.minute,
      parts.second,
      currentTimeZone,
    );
  }

  /**
   * Get difference in hours between this time and another time.
   * The result is rounded up. Positive when end >= start, negative when end < start.
   * @param date - Other TjTime instance
   */
  public hoursTo(date: TjTime,): number {
    const [smaller, larger,] = this.order(date,);
    // countIntervals always returns positive count from smaller to larger
    const count = this.countIntervals(
      smaller,
      larger,
      (t,) => t.sameTimeNextHour(),
    );
    // Return positive if this is the smaller, negative if this is the larger
    return smaller === this ? count : -count;
  }

  /**
   * Get difference in days between this time and another time.
   * The result is always rounded up (positive).
   * @param date - Other TjTime instance
   */
  public daysTo(date: TjTime,): number {
    const [smaller, larger,] = this.order(date,);
    const count = this.countIntervals(
      smaller,
      larger,
      (t,) => t.sameTimeNextDay(),
    );
    return count;
  }

  /**
   * Get difference in weeks between this time and another time.
   * The result is always rounded up (positive).
   * @param date - Other TjTime instance
   */
  public weeksTo(date: TjTime,): number {
    const [smaller, larger,] = this.order(date,);
    const count = this.countIntervals(
      smaller,
      larger,
      (t,) => t.sameTimeNextWeek(),
    );
    return count;
  }

  /**
   * Get difference in months between this time and another time.
   * The result is always rounded up (positive).
   * @param date - Other TjTime instance
   */
  public monthsTo(date: TjTime,): number {
    const [smaller, larger,] = this.order(date,);
    const count = this.countIntervals(
      smaller,
      larger,
      (t,) => t.sameTimeNextMonth(),
    );
    return count;
  }

  /**
   * Get difference in quarters between this time and another time.
   * The result is always rounded up (positive).
   * @param date - Other TjTime instance
   */
  public quartersTo(date: TjTime,): number {
    const [smaller, larger,] = this.order(date,);
    const count = this.countIntervals(
      smaller,
      larger,
      (t,) => t.sameTimeNextQuarter(),
    );
    return count;
  }

  /**
   * Get difference in years between this time and another time.
   * The result is always rounded up (positive).
   * @param date - Other TjTime instance
   */
  public yearsTo(date: TjTime,): number {
    const [smaller, larger,] = this.order(date,);
    const count = this.countIntervals(
      smaller,
      larger,
      (t,) => t.sameTimeNextYear(),
    );
    return count;
  }

  /**
   * Get next day of week
   * @param dow - Day of week (0=Sunday, 1=Monday, ..., 6=Saturday)
   */
  nextDayOfWeek(dow: number,): TjTime {
    if (dow < 0 || dow > 6) {
      throw new TjArgumentError("Day of week must be 0 - 6.",);
    }

    const parts = getLocalParts(this.seconds, currentTimeZone,);

    // Start from midnight of next day (always at least tomorrow)
    const d = this.midnight().sameTimeNextDay();
    const currentDoW = d.wday();

    // Calculate iterations needed
    const iterations = (dow + 7 - currentDoW) % 7;

    // Iterate sameTimeNextDay
    let result = d;
    for (let i = 0; i < iterations; i++) {
      result = result.sameTimeNextDay();
    }

    // Add original time back
    const timeSeconds = parts.hour * 3600 + parts.minute * 60 + parts.second;
    return result.addSeconds(timeSeconds,);
  }

  /**
   * Format time according to the given format string.
   * @param format - Format string (e.g., "%Y %m %d %H %M %S")
   * @param tz - Optional timezone (defaults to currentTimeZone)
   * @returns Formatted time string
   */
  strftime(format: string, tz?: string,): string {
    // Validate timezone - use UTC if not specified
    const timeZone = tz ?? "UTC";
    if (!isValidTimeZone(timeZone,)) {
      throw new TjArgumentError(`Invalid time zone: ${timeZone}`,);
    }

    // Get local parts for the given timezone
    const parts = getLocalParts(this.seconds, timeZone,);

    // Get timezone abbreviation
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timeZone,
      timeZoneName: "short",
    },);
    const tzParts = formatter.formatToParts(this.toDate(),);
    const tzAbbr = tzParts.find((p,) => p.type === "timeZoneName")?.value ||
      timeZone;

    // Day of week names
    const dayNames = [
      "Sunday",
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
    ];
    const dayAbbr = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",];

    // Month names
    const monthNames = [
      "",
      "January",
      "February",
      "March",
      "April",
      "May",
      "June",
      "July",
      "August",
      "September",
      "October",
      "November",
      "December",
    ];
    const monthAbbr = [
      "",
      "Jan",
      "Feb",
      "Mar",
      "Apr",
      "May",
      "Jun",
      "Jul",
      "Aug",
      "Sep",
      "Oct",
      "Nov",
      "Dec",
    ];

    // Replace %% with a placeholder first to protect it from validation
    const PLACEHOLDER = "\x00";
    let result = format.replace(/%%/g, PLACEHOLDER,);

    // Replace format specifiers
    result = result.replace("%Y", String(parts.year,).padStart(4, "0",),);
    result = result.replace("%y", String(parts.year % 100,).padStart(2, "0",),);
    result = result.replace("%m", String(parts.month,).padStart(2, "0",),);
    result = result.replace("%d", String(parts.day,).padStart(2, "0",),);
    result = result.replace("%H", String(parts.hour,).padStart(2, "0",),);
    result = result.replace("%M", String(parts.minute,).padStart(2, "0",),);
    result = result.replace("%S", String(parts.second,).padStart(2, "0",),);
    result = result.replace("%A", dayNames[parts.weekday] ?? "Unknown",);
    result = result.replace("%a", dayAbbr[parts.weekday] ?? "Unknown",);
    result = result.replace("%B", monthNames[parts.month] ?? "Unknown",);
    result = result.replace("%b", monthAbbr[parts.month] ?? "Unknown",);
    // %z: UTC offset in +HH:MM / -HH:MM format
    result = result.replace(
      "%z",
      formatTimezoneOffset(this.seconds, timeZone,),
    );
    result = result.replace(
      "%Q",
      String(Math.floor((parts.month - 1) / 3,) + 1,),
    );
    // %Z: timezone abbreviation
    result = result.replace("%Z", tzAbbr,);
    // %p: AM/PM
    const ampm = parts.hour < 12 ? "AM" : "PM";
    result = result.replace("%p", ampm,);
    // %I: 12-hour hour (1-12)
    const hour12 = parts.hour % 12 || 12;
    result = result.replace("%I", String(hour12,).padStart(2, "0",),);
    // %j: day of year (001-366)
    let dayOfYear = 0;
    for (let i = 1; i < parts.month; i++) {
      const maxDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,];
      let monMax = maxDays[i]!;
      if (i === 2 && TjTime.isLeapYear(parts.year,)) {
        monMax = 29;
      }
      dayOfYear += monMax;
    }
    dayOfYear += parts.day;
    result = result.replace("%j", String(dayOfYear,).padStart(3, "0",),);
    // %W: week number (00-53, Monday as first day of week)
    const firstDayOfYear = TjTime.fromParts(parts.year, 1, 1, 0, 0, 0, tz,);
    const firstWeekday = firstDayOfYear.wday(); // 0=Sunday, 1=Monday, etc.
    const daysSinceMonday = parts.weekday === 0 ? 6 : parts.weekday - 1;
    const dayOfYearForWeek = dayOfYear - 1;
    const weekNumber = Math.floor((dayOfYearForWeek + daysSinceMonday) / 7,);
    result = result.replace("%W", String(weekNumber,).padStart(2, "0",),);
    // %x: date format (MM/DD/YY)
    const monthStr = String(parts.month,).padStart(2, "0",);
    const dayStr = String(parts.day,).padStart(2, "0",);
    const year2Str = String(parts.year % 100,).padStart(2, "0",);
    result = result.replace("%x", `${monthStr}/${dayStr}/${year2Str}`,);
    // %X: time format (HH:MM:SS)
    const hourStr = String(parts.hour,).padStart(2, "0",);
    const minuteStr = String(parts.minute,).padStart(2, "0",);
    const secondStr = String(parts.second,).padStart(2, "0",);
    result = result.replace("%X", `${hourStr}:${minuteStr}:${secondStr}`,);
    // %%: literal %
    result = result.replace(new RegExp(PLACEHOLDER, "g",), "%",);

    // Validate that no unsupported format specifiers remain.
    // Ruby's strftime is lenient, but TjTime raises TjArgumentError for
    // formats outside the supported list (%Y %y %m %d %H %M %S %A %a %B %b %z %Q %Z %p %I %j %W %x %X %%).
    // The placeholder \x00 is not a format specifier, so it won't match.
    // Match % followed by any character that is NOT % (to avoid matching %%)
    // Then check if that character is NOT one of the valid specifiers
    const unsupportedMatch = result.match(/%(?!%)(.)/,);
    if (unsupportedMatch) {
      const specifier = unsupportedMatch[0]; // Full match like %c, %x, etc.
      const validSpecifiers = [
        "Y",
        "y",
        "m",
        "d",
        "H",
        "M",
        "S",
        "A",
        "a",
        "B",
        "b",
        "z",
        "Q",
        "Z",
        "p",
        "I",
        "j",
        "W",
        "x",
        "X",
      ];
      const specifierChar = unsupportedMatch[1]; // Just the letter after %
      if (specifierChar && !validSpecifiers.includes(specifierChar,)) {
        throw new TjArgumentError(`Invalid format specifier: ${specifier}`,);
      }
    }

    // Restore %% placeholder to literal %
    result = result.replace(new RegExp(PLACEHOLDER, "g",), "%",);

    return result;
  }

  /**
   * Convert TjTime to string.
   *
   * With no format argument, uses the default `'%Y-%m-%d-%H:%M'` plus
   * `:%S` when the original seconds are non-zero, plus `-%z`.
   *
   * // RUBY-COMPAT-DOC: `to_s` decides whether to include `:%S` from
   * `@time.sec` (the original UTC second), NOT from `localtime().sec`.
   * // RUBY-COMPAT-DOC: with `tz === 'UTC'` the Ruby implementation routes
   * through `gmtime`; in TS the equivalent is `strftime(format, 'UTC')`,
   * which yields the same UTC wall-clock parts.
   *
   * @param format - Optional format string
   * @param tz - Optional timezone (defaults to currentTimeZone)
   * @returns Formatted time string
   */
  to_s(format?: string, tz: string = currentTimeZone,): string {
    if (format === undefined || format === null) {
      if (compat.keepRubyBugs) {
        const sec = this.seconds % 60;
        format = "%Y-%m-%d-%H:%M" + (sec === 0 ? "" : ":%S") + "-%z";
      } else {
        format = "%Y-%m-%d %H:%M:%S %z";
      }
    }
    return this.strftime(format, tz,);
  }

  /**
   * Get last day of month
   * @param month - Month (1-12)
   * @param year - Year
   */
  static lastDayOfMonth(month: number, year: number,): number {
    const maxDays = [0, 31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31,];
    let maxDay = maxDays[month]!;
    if (month === 2 && TjTime.isLeapYear(year,)) {
      maxDay = 29;
    }
    return maxDay;
  }

  /**
   * Get total seconds of day in local time
   * @param tz - Optional timezone (defaults to currentTimeZone)
   * @returns Seconds since midnight in local time
   */
  secondsOfDay(tz: string = currentTimeZone,): number {
    const parts = getLocalParts(this.seconds, tz,);
    return parts.hour * 3600 + parts.minute * 60 + parts.second;
  }

  /**
   * Get time in UTC
   */
  utc(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    const offset = getOffsetSeconds(this.seconds, currentTimeZone,);
    return TjTime.fromSeconds(this.seconds - offset,);
  }

  /**
   * Get time in local timezone
   */
  localtime(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    const offset = getOffsetSeconds(this.seconds, currentTimeZone,);
    return TjTime.fromSeconds(this.seconds + offset,);
  }

  /**
   * Get time in GMT
   */
  gmtime(): TjTime {
    const parts = getLocalParts(this.seconds, currentTimeZone,);
    const offset = getOffsetSeconds(this.seconds, currentTimeZone,);
    return TjTime.fromSeconds(this.seconds - offset,);
  }

  /**
   * Check if a timezone string is valid
   * @param zone - Timezone string to validate
   * @returns boolean
   */
  static checkTimeZone(zone: string,): boolean {
    try {
      if (zone === "UTC") return true;
      if (!zone.includes("/",)) return false;
      new Intl.DateTimeFormat("en-US", { timeZone: zone, },);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Set a new active time zone
   * @param zone - Timezone string to set
   * @returns Previous timezone string, or null if none was set
   */
  static setTimeZone(zone: string,): string | null {
    if (!TjTime.checkTimeZone(zone,)) {
      throw new TjArgumentError(`Illegal time zone ${zone}`,);
    }
    return setCurrentTimeZone(zone,);
  }

  /**
   * Get the currently active time zone
   * @returns Timezone string
   */
  static getTimeZone(): string {
    return currentTimeZone;
  }
}
