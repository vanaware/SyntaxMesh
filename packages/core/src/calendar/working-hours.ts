import { TjArgumentError, TjTime, } from "../time/tj-time.ts";
import { Scoreboard, } from "../time/scoreboard.ts";
import { TimeInterval, } from "../time/time-interval.ts";

export class WorkingHours {
  readonly days: Array<Array<[number, number,]>>;
  readonly startDate: Date;
  readonly endDate: Date;
  readonly slotDuration: number;
  private _timezone: string | null;
  scoreboard: Scoreboard<boolean> | null;

  get timezone(): string | null {
    return this._timezone;
  }

  set timezone(zone: string,) {
    this.scoreboard = null;
    this._timezone = zone;
  }

  constructor(
    arg1?: WorkingHours | number,
    startDate?: Date,
    endDate?: Date,
    timeZone?: string,
  ) {
    // @days initialized with 7 empty arrays (default: Sat/Sun off)
    this.days = [[], [], [], [], [], [], [],] as Array<
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

  deepClone(): WorkingHours {
    return new WorkingHours(this,);
  }

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

  getWorkingHours(dayOfWeek: number,): Array<[number, number,]> {
    return this.days[dayOfWeek] || [];
  }

  onShift(arg: TjTime | number,): boolean {
    this.initScoreboard();
    if (arg instanceof TjTime) {
      return this.scoreboard!.getByDate(arg.toDate(),);
    }
    return this.scoreboard!.get(arg,);
  }

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

  weeklyWorkingHours(): number {
    let seconds = 0;
    for (const day of this.days) {
      for (const [from, to,] of day) {
        seconds += to - from;
      }
    }
    return seconds / (60 * 60);
  }

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

  private timeToS(t: number,): string {
    if (t >= 24 * 60 * 60) return "24:00";
    return `${Math.floor(t / 3600,)}:${t % 3600}`;
  }

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
      const weekday = tjDate.wday();
      const secondsOfDay = tjDate.secondsOfDay();

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
