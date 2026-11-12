import { TjArgumentError, TjTime, } from "../time/tj-time.ts";
import { Scoreboard, } from "../time/scoreboard.ts";
import { TimeInterval, } from "../time/time-interval.ts";

/**
 * Weekly working hours of a resource or of the project.
 *
 * Port of `WorkingHours.rb`. Holds one list of intervals per weekday (index 0 =
 * Sunday .. 6 = Saturday), each interval expressed in seconds from midnight,
 * plus the slot grid used to materialise those intervals into a boolean
 * `Scoreboard`. The scoreboard is built lazily and invalidated whenever the
 * hours or the time zone change.
 */
export class WorkingHours {
  /**
   * Working intervals per weekday, in seconds from midnight.
   * Index 0 is Sunday; an empty array means the day is off.
   */
  readonly days: Array<Array<[number, number,]>>;
  /** First moment covered by the generated scoreboard. */
  readonly startDate: Date;
  /** Last moment covered by the generated scoreboard. */
  readonly endDate: Date;
  /** Length of one scoreboard slot, in seconds. */
  readonly slotDuration: number;
  /** Time zone used to map absolute instants to weekdays, or `null` for UTC. */
  private _timezone: string | null;
  /** Cached on-shift scoreboard, or `null` when it must be regenerated. */
  scoreboard: Scoreboard<boolean> | null;

  /**
   * Time zone used to resolve weekdays.
   *
   * @returns The IANA zone name, or `null` for UTC.
   */
  get timezone(): string | null {
    return this._timezone;
  }

  /**
   * Changes the time zone, invalidating the cached scoreboard.
   *
   * @param zone IANA zone name.
   */
  set timezone(zone: string,) {
    this.scoreboard = null;
    this._timezone = zone;
  }

  /**
   * Creates working hours from a copy of another instance, or from scratch.
   *
   * @param arg1 Source `WorkingHours` to copy, or the slot duration in seconds.
   * @param startDate First moment covered by the scoreboard.
   * @param endDate Last moment covered by the scoreboard.
   * @param timeZone IANA zone name used to resolve weekdays.
   * @throws TjArgumentError When `arg1` is a duration and the dates are missing.
   */
  constructor(
    arg1?: WorkingHours | number,
    startDate?: Date,
    endDate?: Date,
    timeZone?: string,
  ) {
    // @days initialized with 7 empty arrays (default: Sat/Sun off)
    // RUBY-COMPAT-FIX (task 5.12.R.1): the original Ruby implementation
    // uses a shared empty array reference across all 7 days, causing
    // Category A bug where modifying one day affects all days.
    // This is always fixed regardless of compat.keepRubyBugs.
    this.days = Array.from({ length: 7, }, () => [],) as Array<
      Array<[number, number,]>
    >;
    this.scoreboard = null;

    if (arg1 instanceof WorkingHours) {
      // Copy constructor: deep copy days, share scoreboard (copy-on-write)
      const wh = arg1;
      this._timezone = wh.timezone;
      for (let day = 0; day < 7; day++) {
        const hours: Array<[number, number,]> = [];
        for (const hrs of wh.days[day] || []) {
          hours.push([hrs[0], hrs[1],],);
        }
        this.setWorkingHours(day, hours,);
      }
      this.startDate = wh.startDate;
      this.endDate = wh.endDate;
      this.slotDuration = wh.slotDuration;
      // Trigger scoreboard creation on the source so we can share it
      wh.onShift(0,);
      this.scoreboard = wh.scoreboard;
    } else {
      const slotDuration = arg1;
      if (
        slotDuration === undefined || startDate === undefined ||
        endDate === undefined
      ) {
        throw new TjArgumentError(
          "You must supply values for slotDuration, start and end dates",
        );
      }
      this.startDate = startDate;
      this.endDate = endDate;
      this.slotDuration = slotDuration;
      this._timezone = timeZone ?? null;
      // Default working hours: Monday to Friday 9am - 5pm
      for (let day = 1; day <= 5; day++) {
        this.days[day] = [[9 * 60 * 60, 17 * 60 * 60,],];
      }
    }
  }

  /**
   * Creates an independent copy of these working hours.
   *
   * @returns A new instance sharing no mutable state.
   */
  deepClone(): WorkingHours {
    return new WorkingHours(this,);
  }

  /**
   * Replaces the working intervals of one weekday.
   *
   * @param dayOfWeek Weekday index (0 = Sunday .. 6 = Saturday).
   * @param intervals Intervals in seconds from midnight, `[from, to)`.
   * @throws TjArgumentError When the weekday is out of range, an interval falls
   * outside a single day or an interval is empty or inverted.
   */
  setWorkingHours(
    dayOfWeek: number,
    intervals: Array<[number, number,]>,
  ): void {
    // Changing working hours requires scoreboard regeneration
    this.scoreboard = null;

    if (dayOfWeek < 0 || dayOfWeek > 6) {
      throw new TjArgumentError(`dayOfWeek out of range: ${dayOfWeek}`,);
    }
    for (const iv of intervals) {
      if (
        iv[0] < 0 || iv[0] > 24 * 60 * 60 || iv[1] < 0 || iv[1] > 24 * 60 * 60
      ) {
        throw new TjArgumentError(`Time interval has illegal values`,);
      }
      if (iv[0] >= iv[1]) {
        throw new TjArgumentError(
          "Interval end time must be larger than start time",
        );
      }
    }
    this.days[dayOfWeek] = intervals;
  }

  /**
   * Reads the working intervals of one weekday.
   *
   * @param dayOfWeek Weekday index (0 = Sunday .. 6 = Saturday).
   * @returns The intervals in seconds from midnight; empty when the day is off.
   */
  getWorkingHours(dayOfWeek: number,): Array<[number, number,]> {
    return this.days[dayOfWeek] || [];
  }

  /**
   * Tells whether a moment falls inside the working hours.
   *
   * @param arg Instant to test, as a date or as a scoreboard slot index.
   * @returns `true` when the moment is on shift.
   */
  onShift(arg: TjTime | number,): boolean {
    this.initScoreboard();
    if (arg instanceof TjTime) {
      return this.scoreboard!.getByDate(arg.toDate(),);
    }
    return this.scoreboard!.get(arg,);
  }

  /**
   * Tells whether an interval is entirely outside the working hours.
   *
   * @param interval Interval to test.
   * @returns `true` when no slot of the interval is on shift.
   */
  timeOff(interval: TimeInterval,): boolean {
    this.initScoreboard();
    const startIdx = this.scoreboard!.dateToIdx(interval.start.toDate(),);
    const endIdx = this.scoreboard!.dateToIdx(interval.end.toDate(),);
    for (let i = startIdx; i < endIdx; i++) {
      if (this.scoreboard!.get(i,)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Sums the working hours of a whole week.
   *
   * @returns The total number of working hours per week.
   */
  weeklyWorkingHours(): number {
    let seconds = 0;
    for (const day of this.days) {
      for (const [from, to,] of day) {
        seconds += to - from;
      }
    }
    return seconds / (60 * 60);
  }

  /**
   * Renders the weekly hours as one line per weekday.
   *
   * @returns A human-readable summary (`"Mon: 9:00 - 17:00"`, ...).
   */
  to_s(): string {
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat",];
    let str = "";
    for (let day = 0; day < 7; day++) {
      str += `${dayNames[day]}: `;
      const dayHours = this.days[day] || [];
      if (dayHours.length === 0) {
        str += "off";
        if (day < 6) str += "\n";
        continue;
      }
      let first = true;
      for (const iv of dayHours) {
        if (first) {
          first = false;
        } else {
          str += ", ";
        }
        str += `${this.timeToS(iv[0],)} - ${this.timeToS(iv[1],)}`;
      }
      if (day < 6) str += "\n";
    }
    return str;
  }

  /**
   * Compares these working hours with another instance.
   *
   * @param other Instance to compare against.
   * @returns `true` when the time zone, the grid and every weekday match.
   */
  equals(other: WorkingHours,): boolean {
    if (
      other === null || this.timezone !== other.timezone ||
      this.startDate.getTime() !== other.startDate.getTime() ||
      this.endDate.getTime() !== other.endDate.getTime() ||
      this.slotDuration !== other.slotDuration
    ) {
      return false;
    }
    for (let d = 0; d < 7; d++) {
      const thisDay = this.days[d] || [];
      const otherDay = other.days[d] || [];
      if (thisDay.length !== otherDay.length) return false;
      for (let i = 0; i < thisDay.length; i++) {
        if (
          thisDay[i]![0] !== otherDay[i]![0] ||
          thisDay[i]![1] !== otherDay[i]![1]
        ) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Formats a second-of-day offset as `H:MM`.
   *
   * @param t Offset in seconds from midnight.
   * @returns The formatted time; `"24:00"` when `t` reaches the end of the day.
   */
  private timeToS(t: number,): string {
    if (t >= 24 * 60 * 60) return "24:00";
    return `${Math.floor(t / 3600,)}:${t % 3600}`;
  }

  /**
   * Builds the on-shift scoreboard when it is missing.
   *
   * The computation temporarily swaps the global time zone, so weekday and
   * second-of-day are resolved in the zone configured on this instance.
   */
  private initScoreboard(): void {
    if (this.scoreboard) {
      return;
    }

    this.scoreboard = new Scoreboard<boolean>(
      this.startDate,
      this.endDate,
      this.slotDuration,
      false,
    );

    const tz = this.timezone ?? "UTC";
    const oldTimezone = TjTime.setTimeZone(tz,);

    let date = this.startDate;
    this.scoreboard.collect!((slot: boolean,) => {
      const tjDate = TjTime.fromDate(date,);
      // One calendar decomposition per slot: wday() + secondsOfDay() would
      // each format the same instant through Intl.
      const parts = tjDate.to_a();
      const weekday = parts[6]!;
      const secondsOfDay = parts[3]! * 3600 + parts[4]! * 60 + parts[5]!;

      let result = false;
      const dayHours = this.days[weekday] || [];
      for (const iv of dayHours) {
        if (iv[0] <= secondsOfDay && secondsOfDay < iv[1]) {
          result = true;
          break;
        }
      }
      date = new Date(date.getTime() + this.slotDuration * 1000,);
      return result;
    },);

    TjTime.setTimeZone(oldTimezone ?? "UTC",);
  }
}
