/**
 * StatusSheetReceiver — receiver concreto de status sheets (18.10).
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/StatusSheetReceiver.rb`. Só
 * configuração: o fluxo vem de `SheetReceiver` (18.7).
 *
 * @see docs/taskjuggler/lib/taskjuggler/StatusSheetReceiver.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.10)
 */

import { SheetReceiver, } from "./sheet-receiver.ts";

export class StatusSheetReceiver extends SheetReceiver {
  constructor(appName: string,) {
    super(appName, "status",);

    this.tj3clientOption = "check-ss";

    this.sheetDir = "StatusSheets";
    this.templateDir = "StatusSheetTemplates";
    this.failedMailsDir = `${this.sheetDir}/FailedMails`;
    this.failedSheetsDir = `${this.sheetDir}/FailedSheets`;
    this.signatureFile = `${this.templateDir}/acceptable_intervals`;
    this.logFile = "statussheets.log";

    // Grupo 1 = recurso, grupo 2 = fim do período (`YYYY-MM-DD`).
    this.sheetHeader =
      /^[ ]*statussheet\s([a-zA-Z_][a-zA-Z0-9_]*)\s[0-9\-:+]*\s-\s([0-9]*-[0-9]*-[0-9]*)/mu;
    // Grupo 1 = intervalo completo (a "assinatura" aceita pelo receiver).
    this.signatureFilter =
      /^[ ]*statussheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/mu;
    this.emailSubject = "Status report from %s for %s";
  }
}
