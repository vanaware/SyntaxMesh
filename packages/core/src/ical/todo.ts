/**
 * Todo — port of `ICalendar::Todo` (Phase 17.6).
 *
 * The constructor **registers itself** in the document (`@ical.addTodo(self)`),
 * as in Ruby — whoever creates the `Todo` never has to call it on the
 * `ICalendar`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:97-130
 */

import { TjTime, } from "../time/tj-time.ts";
import { Component, } from "./component.ts";
import type { ICalendar, } from "./i-calendar.ts";

/**
 * Task entry (VTODO), optionally completed.
 */
export class Todo extends Component {
  /** `attr_accessor :priority` — value 0-9, default 0. */
  priority: number = 0;
  /** `attr_accessor :percentComplete` — default -1 (unknown). */
  percentComplete: number = -1;
  private readonly endDate: TjTime;

  /**
   * Creates a task and registers it in the document.
   *
   * @param ical Document that owns the task.
   * @param uid Base UID; the type suffix is appended.
   * @param summary Summary line of the task.
   * @param startDate Start instant of the task.
   * @param endDate Due (or completion) instant of the task.
   */
  constructor(
    ical: ICalendar,
    uid: string,
    summary: string,
    startDate: TjTime,
    endDate: TjTime,
  ) {
    super(ical, uid, summary, startDate,);
    ical.addTodo(this,);
    this.endDate = endDate;
  }

  /**
   * Ruby `to_s` with a block: `< 100.0` gives `DUE`, `>= 100` gives `COMPLETED`,
   * and `PERCENT-COMPLETE` is always emitted (including with the default `-1`).
   */
  override to_s(): string {
    return super.to_s(() => {
      let str = "";
      if (this.percentComplete < 100.0) {
        str += `DUE:${this.dateTime(this.endDate,)}\n`;
      } else {
        str += `COMPLETED:${this.dateTime(this.endDate,)}\n`;
      }
      str += `PERCENT-COMPLETE:${this.percentComplete}\n`;
      return str;
    },);
  }
}
