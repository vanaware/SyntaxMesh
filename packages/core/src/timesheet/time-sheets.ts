/**
 * TimeSheets — every time sheet of a project.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/TimeSheets.rb` — the
 * `TimeSheets < Array` class (l.389-403).
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.3)
 */
import type { TimeSheet, } from "./time-sheet.ts";

/**
 * Collection of the time sheets loaded for a project.
 */
export class TimeSheets extends Array<TimeSheet> {
  /**
   * Collection alias kept from the Phase 9 stub (`project.timeSheets.sheets`).
   * In Ruby the instance **is** the array; here both accesses are exposed.
   *
   * @returns This same collection, typed as an array.
   */
  get sheets(): TimeSheet[] {
    return this;
  }

  /**
   * Drops the loaded sheets (Ruby `Array#clear`).
   *
   * Used by `TaskJuggler#checkTimeSheet` so stale sheet data is not reused.
   */
  clear(): void {
    this.length = 0;
  }

  /**
   * Ruby `TimeSheets#check`: validates every sheet.
   */
  check(): void {
    for (const sheet of this) {
      sheet.check();
    }
  }

  /**
   * Ruby `TimeSheets#warnOnDelta`: compares every sheet with the plan.
   */
  warnOnDelta(): void {
    for (const sheet of this) {
      sheet.warnOnDelta();
    }
  }
}
