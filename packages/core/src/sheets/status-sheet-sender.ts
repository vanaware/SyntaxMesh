/**
 * StatusSheetSender — concrete sender of status sheet templates (18.10).
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/StatusSheetSender.rb`.
 *
 * Beyond the configuration, Ruby builds the **defaulter list** in the
 * constructor (`defaulterList`): resources that did not deliver the previous
 * period's time sheet. Because the `FileStore` is asynchronous (ADR 037), the
 * constructor cannot read the disk; the list is appended to `introText` at the
 * start of `sendTemplates`, which keeps Ruby's effect without blocking
 * construction.
 *
 * @see docs/taskjuggler/lib/taskjuggler/StatusSheetSender.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.10)
 */

import { baseName, } from "./email-message.ts";
import { SheetSender, } from "./sheet-sender.ts";

/** Introductory text of the email (Ruby `@introText`). */
export const STATUS_SHEET_INTRO_TEXT =
  `Please find enclosed your weekly status report template. Please fill out the
form and send it back to the sender of this email. You can either use the
attached file or the body of the email. In case you send it in the body of the
email, make sure it only contains the 'statussheet' syntax. It must be plain
text, UTF-8 encoded and the status sheet header from 'statussheet' to the period
end date must be in a single line that starts at the beginning of the line.

`;

/** Warning appended to `introText` when there are defaulters (Ruby l.75-83). */
export const DEFAULTERS_WARNING_HEADER =
  `=============================== W A R N I N G ==============================

The following people have not submitted their report yet. The status reports
for the work they have done is not included in this template! You can either
manually add their status to the tasks or asked them to send their time sheet
immediately and re-request this template.

`;

/** `YYYY-MM-DD` → local `Date` at midnight (Ruby `Time.local(*split('-'))`). */
function parseLocalDate(text: string,): Date | null {
  const parts = text.split("-",);
  if (parts.length !== 3) return null;
  const year = Number(parts[0],);
  const month = Number(parts[1],);
  const day = Number(parts[2],);
  if (![year, month, day,].every((value,) => Number.isFinite(value,))) {
    return null;
  }
  return new Date(year, month - 1, day,);
}

/**
 * Sender that prepares status sheet templates.
 */
export class StatusSheetSender extends SheetSender {
  /** Base of the time sheets already received (Ruby `@timeSheetDir`). */
  timeSheetDir = "TimeSheets";

  /**
   * Creates the sender with the status sheet defaults.
   *
   * @param appName Name that signs the email (`X-TaskJuggler`) and the log.
   */
  constructor(appName: string,) {
    super(appName, "status",);

    this.hideResource = "0";
    this.templateDir = "StatusSheetTemplates";
    this.signatureFile = `${this.templateDir}/acceptable_intervals`;
    this.logFile = "statussheets.log";

    this.signatureFilter =
      /^[ ]*statussheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/u;
    this.introText = STATUS_SHEET_INTRO_TEXT;
    this.mailSubject = "Your weekly status report template for %s";
  }

  /** Appends the defaulters warning before generating/sending the templates. */
  override async sendTemplates(resourceList: string[],): Promise<void> {
    await this.addDefaulterWarning();
    await super.sendTemplates(resourceList,);
  }

  /**
   * Resources that did **not** file the time sheet of the previous period
   * (Ruby `defaulterList`, l.97-141).
   *
   * The status sheet and time sheet intervals are not identical: the status
   * sheet one is shorter and slightly later, but always contains the end date
   * of the time sheet period. That is why the chosen time sheet folder is the
   * last one dated **before** the end of the status sheet period.
   *
   * @returns IDs (in the order of the `missing-reports` file); empty when there
   *   is no matching folder, no `missing-reports`, or when everyone has already
   *   sent.
   */
  async defaulterList(): Promise<string[]> {
    const store = this.requireFileStore("defaulterList",);

    let names: string[];
    try {
      names = await store.list(this.timeSheetDir,);
    } catch {
      // Without the time sheet directory there is no way to know who is due.
      return [];
    }

    const reportDate = parseLocalDate(this.date,);
    if (reportDate === null) return [];

    const dirs: { name: string; date: Date }[] = [];
    for (const name of names) {
      const base = baseName(name,);
      const date = parseLocalDate(base,);
      if (date !== null) dirs.push({ name: base, date, },);
    }
    dirs.sort((a, b,) => a.date.getTime() - b.date.getTime());

    let timeSheetDir: string | null = null;
    for (const dir of dirs) {
      if (dir.date.getTime() < reportDate.getTime()) {
        timeSheetDir = dir.name;
      } else {
        break;
      }
    }
    if (timeSheetDir === null) return [];

    const missingFile = `${this.timeSheetDir}/${timeSheetDir}/missing-reports`;
    if (!(await store.exists(missingFile,))) return [];

    const ids = (await store.read(missingFile,))
      .split("\n",)
      .map((line,) => line.trim().replace(/\r$/u, "",))
      .filter((line,) => line !== "");

    // The sheet may have been filed after `tj3ts_summary` (18.11).
    // `.smx` is the native form; `.tji` stays accepted (24.2.36).
    const pending: string[] = [];
    for (const id of ids) {
      const sheet = await this.findSheetFile(
        `${this.timeSheetDir}/${timeSheetDir}`,
        `${id}_${timeSheetDir}`,
      );
      if (sheet === null) pending.push(id,);
    }
    return pending;
  }

  /**
   * Appends the defaulters warning to `introText` (Ruby did this in the
   * constructor). Without defaulters, the text is left unchanged.
   */
  protected async addDefaulterWarning(): Promise<void> {
    const defaulters = await this.defaulterList();
    if (defaulters.length === 0) return;
    this.introText += DEFAULTERS_WARNING_HEADER +
      defaulters.map((id,) => `${id}\n`).join("",);
  }
}
