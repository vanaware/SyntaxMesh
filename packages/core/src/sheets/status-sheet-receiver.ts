/**
 * StatusSheetReceiver — concrete receiver of status sheets (18.10).
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/StatusSheetReceiver.rb`. Configuration
 * only: the flow comes from `SheetReceiver` (18.7).
 *
 * @see docs/taskjuggler/lib/taskjuggler/StatusSheetReceiver.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.10)
 */

import { SheetReceiver, } from "./sheet-receiver.ts";

/**
 * Receiver that ingests returned status sheets.
 */
export class StatusSheetReceiver extends SheetReceiver {
  /**
   * Creates the receiver with the status sheet defaults.
   *
   * @param appName Name of the app that signs replies and the log.
   */
  constructor(appName: string,) {
    super(appName, "status",);

    this.tj3clientOption = "check-ss";

    this.sheetDir = "StatusSheets";
    this.templateDir = "StatusSheetTemplates";
    this.failedMailsDir = `${this.sheetDir}/FailedMails`;
    this.failedSheetsDir = `${this.sheetDir}/FailedSheets`;
    this.signatureFile = `${this.templateDir}/acceptable_intervals`;
    this.logFile = "statussheets.log";

    // Group 1 = resource, group 2 = period end (`YYYY-MM-DD`).
    this.sheetHeader =
      /^[ ]*statussheet\s([a-zA-Z_][a-zA-Z0-9_]*)\s[0-9\-:+]*\s-\s([0-9]*-[0-9]*-[0-9]*)/mu;
    // Group 1 = full interval (the "signature" accepted by the receiver).
    this.signatureFilter =
      /^[ ]*statussheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/mu;
    this.emailSubject = "Status report from %s for %s";
  }
}
