/**
 * Event — port de `ICalendar::Event` (Fase 17.6).
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:133-161
 */

import { TjTime, } from "../time/tj-time.ts";
import { Component, } from "./component.ts";
import type { ICalendar, } from "./i-calendar.ts";

export class Event extends Component {
  /** `@priority = 1` (diferente do `Todo`, que usa 0). */
  priority = 1;
  private readonly endDate: TjTime;

  constructor(
    ical: ICalendar,
    uid: string,
    summary: string,
    startDate: TjTime,
    endDate: TjTime,
  ) {
    super(ical, uid, summary, startDate,);
    ical.addEvent(this,);
    this.endDate = endDate;
  }

  /** Ruby `to_s`: PRIORITY + DTEND + TRANSP:TRANSPARENT. */
  override to_s(): string {
    return super.to_s(() => {
      return `PRIORITY:${this.priority}\n` +
        `DTEND:${this.dateTime(this.endDate,)}\n` +
        "TRANSP:TRANSPARENT\n";
    },);
  }
}
