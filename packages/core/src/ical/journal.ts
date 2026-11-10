/**
 * Journal — port of `ICalendar::Journal` (Phase 17.6).
 *
 * It is the simplest component: it adds nothing to the `Component` body. In
 * Ruby `def to_s; super; end` — without a block, so the parent's `yield` is
 * skipped and only the mandatory fields come out.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:163-174
 */

import { TjTime, } from "../time/tj-time.ts";
import { Component, } from "./component.ts";
import type { ICalendar, } from "./i-calendar.ts";

/**
 * Journal entry (VJOURNAL): a component that only carries the mandatory fields.
 */
export class Journal extends Component {
  /**
   * Creates a journal entry and registers it in the document.
   *
   * @param ical Document that owns the entry.
   * @param uid Base UID; the type suffix is appended.
   * @param summary Summary line of the entry.
   * @param startDate Start instant of the entry.
   */
  constructor(
    ical: ICalendar,
    uid: string,
    summary: string,
    startDate: TjTime,
  ) {
    super(ical, uid, summary, startDate,);
    ical.addJournal(this,);
  }
}
