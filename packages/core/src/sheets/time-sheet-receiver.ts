/**
 * TimeSheetReceiver — concrete receiver of time sheets (18.9).
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/TimeSheetReceiver.rb`. Configuration
 * only: the flow comes from `SheetReceiver` (18.7).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TimeSheetReceiver.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.9)
 */

import { SheetReceiver, } from "./sheet-receiver.ts";

/**
 * Receiver that ingests returned time sheets.
 */
export class TimeSheetReceiver extends SheetReceiver {
  /**
   * Creates the receiver with the time sheet defaults.
   *
   * @param appName Name of the app that signs replies and the log.
   */
  constructor(appName: string,) {
    super(appName, "time",);

    this.tj3clientOption = "check-ts";

    this.sheetDir = "TimeSheets";
    this.templateDir = "TimeSheetTemplates";
    this.failedMailsDir = `${this.sheetDir}/FailedMails`;
    this.failedSheetsDir = `${this.sheetDir}/FailedSheets`;
    this.signatureFile = `${this.templateDir}/acceptable_intervals`;
    this.logFile = "timesheets.log";

    // Group 1 = resource, group 2 = period end (`YYYY-MM-DD`).
    this.sheetHeader =
      /^[ ]*timesheet\s([a-zA-Z_][a-zA-Z0-9_]*)\s[0-9\-:+]*\s-\s([0-9]*-[0-9]*-[0-9]*)/mu;
    // Group 1 = full interval (the "signature" accepted by the receiver).
    this.signatureFilter =
      /^[ ]*timesheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/mu;
    this.emailSubject = "Report from %s for %s";
  }
}
