/**
 * Event — port of `ICalendar::Event` (Phase 17.6).
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:133-161
 */

import { TjTime, } from "../time/tj-time.ts";
import { Component, } from "./component.ts";
import type { ICalendar, } from "./i-calendar.ts";

/**
 * Calendar event (VEVENT): a component with a start and an end instant.
 */
export class Event extends Component {
  /** `@priority = 1` (unlike `Todo`, which uses 0). */
  priority: number = 1;
  private readonly endDate: TjTime;

  /**
   * Creates an event and registers it in the document.
   *
   * @param ical Document that owns the event.
   * @param uid Base UID; the type suffix is appended.
   * @param summary Summary line of the event.
   * @param startDate Start instant of the event.
   * @param endDate End instant of the event.
   */
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
