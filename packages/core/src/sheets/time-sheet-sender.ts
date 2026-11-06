/**
 * TimeSheetSender — sender concreto de templates de time sheet (18.8).
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/TimeSheetSender.rb`. O Ruby só
 * ajusta configuração; toda a lógica continua no `SheetSender` (18.6).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TimeSheetSender.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.8)
 */

import { SheetSender, } from "./sheet-sender.ts";

/** Texto de introdução do email (Ruby `@introText`). */
export const TIME_SHEET_INTRO_TEXT =
  `Please find enclosed your weekly report template. Please fill out
the form and send it back to the sender of this email. You can either
use the attached file or the body of the email. In case you send it
in the body of the email, make sure it only contains the 'timesheet'
syntax. No quote marks are allowed. It must be plain text, UTF-8
encoded and the time sheet header from 'timesheet' to the period end
date must be in a single line that starts at the beginning of the line.

`;

export class TimeSheetSender extends SheetSender {
  constructor(appName: string,) {
    super(appName, "time",);

    // Expressão lógica que esconde recursos do template.
    this.hideResource = "0";
    this.templateDir = "TimeSheetTemplates";
    this.signatureFile = `${this.templateDir}/acceptable_intervals`;
    this.logFile = "timesheets.log";

    this.signatureFilter =
      /^[ ]*timesheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/u;
    this.introText = TIME_SHEET_INTRO_TEXT;
    this.mailSubject = "Your weekly time sheet template for %s";
  }
}
