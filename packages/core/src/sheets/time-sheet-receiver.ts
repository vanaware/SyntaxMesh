/**
 * TimeSheetReceiver — receiver concreto de time sheets (18.9).
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/TimeSheetReceiver.rb`. Só
 * configuração: o fluxo vem de `SheetReceiver` (18.7).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TimeSheetReceiver.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.9)
 */

import { SheetReceiver, } from "./sheet-receiver.ts";

export class TimeSheetReceiver extends SheetReceiver {
  constructor(appName: string,) {
    super(appName, "time",);

    this.tj3clientOption = "check-ts";

    this.sheetDir = "TimeSheets";
    this.templateDir = "TimeSheetTemplates";
    this.failedMailsDir = `${this.sheetDir}/FailedMails`;
    this.failedSheetsDir = `${this.sheetDir}/FailedSheets`;
    this.signatureFile = `${this.templateDir}/acceptable_intervals`;
    this.logFile = "timesheets.log";

    // Grupo 1 = recurso, grupo 2 = fim do período (`YYYY-MM-DD`).
    this.sheetHeader =
      /^[ ]*timesheet\s([a-zA-Z_][a-zA-Z0-9_]*)\s[0-9\-:+]*\s-\s([0-9]*-[0-9]*-[0-9]*)/mu;
    // Grupo 1 = intervalo completo (a "assinatura" aceita pelo receiver).
    this.signatureFilter =
      /^[ ]*timesheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/mu;
    this.emailSubject = "Report from %s for %s";
  }
}
