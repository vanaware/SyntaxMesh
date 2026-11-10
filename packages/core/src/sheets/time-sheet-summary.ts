/**
 * TimeSheetSummary — compiles and distributes the period's time sheet summary.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/TimeSheetSummary.rb`, inherited from
 * `SheetReceiver` (18.7) with the two adaptations of this phase — ADR 036 (no
 * SMTP: messages become `outbox/*.eml` files) and ADR 037 (all I/O goes
 * through the injected `FileStore`, so `sendSummary` is `async`).
 *
 * Ruby flow preserved: walks the period's resource list, collects the delivered
 * sheets (attaching each one to the summary), records the defaulters in
 * `missing-reports` (read by `StatusSheetSender`, 18.10), sends the summary to
 * the `digestRecipients` and chases each defaulter with `sendReminder`.
 *
 * Deliberate divergence: Ruby used the stdout of `tj3client check-ts` as the
 * summary body (the sheet already in RichText). Here validation runs
 * in-process and the returned excerpt is the sheet itself wrapped in
 * `<nowiki>` — raw TJP is not valid RichText and would make
 * `sendRichTextEmail` abort.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TimeSheetSummary.rb
 * @see docs/syntaxmesh/decisoes/036-sheets-sem-smtp.md
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.11)
 */

import { MessageHandlerInstance, } from "../message-handler.ts";
import { TjRuntimeError, } from "../model/errors.ts";
import type { AlertLevelDefinition, } from "../model/alert-levels.ts";
import type { TimeSheet, } from "../timesheet/time-sheet.ts";
import { type SheetResourceInfo, sprintf, } from "./sheet-handler-base.ts";
import { SHEET_EXTENSION, SheetReceiver, } from "./sheet-receiver.ts";

/** Section title for each resource in the summary (Ruby `@resourceIntro`). */
export const RESOURCE_INTRO = "== Weekly Report from <nowiki>%s</nowiki> ==\n";

/** Reminder text sent to the defaulters (Ruby `@reminderText`). */
export const REMINDER_TEXT =
  `The deadline for your time sheet submission has passed but we haven't received
it yet. Please submit your time sheet immediately so the content can still be
included in the management reports. Please send a copy of your submission
notification email to your manager. If possible, your manager will still try
to include your report data in his/her report.

Please be aware that post deadline submissions must be processed manually and
create an additional load for your manager and/or project manager.  Please try
to submit in time in the future.

Thanks for your cooperation!

`;

/** Header of the defaulters list (Ruby `@defaulterHeader`). */
export const DEFAULTER_HEADER =
  "The following %d person(s) have not yet submitted their time sheets:\n\n";

/** Message of an unknown `catch` (Ruby's `$!`). */
function errorText(error: unknown,): string {
  return error instanceof Error ? error.message : String(error,);
}

/** Material status tally for a sheet (extension 18.17.5). */
export interface MaterialStatusTally {
  /** Material records delivered in the sheet. */
  records: number;
  /** How many of those records carry a `status`. */
  withStatus: number;
  /** Count per alert level ID (`green`, `yellow`, `red`, …). */
  alerts: Record<string, number>;
}

/**
 * Summary line with the material tally (extension 18.17.5).
 *
 * Empty when the sheet reports no material, so that the summary of sheets
 * without material stays identical to the one from before the extension.
 */
export function materialTallyText(tally: MaterialStatusTally,): string {
  if (tally.records === 0) return "";
  const alerts = Object.entries(tally.alerts,)
    .map(([id, count,],) => `${id}: ${count}`)
    .join(", ",);
  return `Materials: ${tally.records} reported, ${tally.withStatus} with ` +
    `status${alerts === "" ? "" : ` (${alerts})`}\n`;
}

/**
 * Weekly summary of the received time sheets.
 *
 * Configuration (all public, mirroring Ruby's `attr_accessor`): `date`,
 * `sheetRecipients`, `digestRecipients`, `hideResource` and the email texts.
 */
export class TimeSheetSummary extends SheetReceiver {
  /** Recipients of each individual sheet (empty = do not send). */
  sheetRecipients: string[] = [];
  /** Recipients of the consolidated summary (empty = do not send). */
  digestRecipients: string[] = [];

  /**
   * Logical expression of the resources left out of the summary (Ruby
   * `@hideResource = '0'`).
   *
   * As in `SheetSender`, it is forwarded to the `resourcereport` that produces
   * the resource list — `TimeSheetSummary` itself filters nothing.
   */
  hideResource: string = "0";

  /** Title of each resource in the summary. */
  resourceIntro: string = RESOURCE_INTRO;
  /** Subject of the individual sheet (`%s` = period date). */
  resourceSheetSubject: string = "Weekly report %s";
  /** Subject of the summary (`%s` = period date). */
  summarySubject: string = "Weekly staff reports %s";
  /** Subject of the reminder (`%s` = period date). */
  reminderSubject: string =
    "Your time sheet for the period ending %s is overdue!";
  /** Reminder text; empty disables sending the reminders. */
  reminderText: string = REMINDER_TEXT;
  /** Header of the defaulters list (`%d` = count). */
  defaulterHeader: string = DEFAULTER_HEADER;

  /**
   * Creates the summary app.
   *
   * @param appName Application name used in logs and in the CLI.
   */
  constructor(appName = "tj3ts_summary",) {
    super(appName, "summary",);

    this.templateDir = "TimeSheetTemplates";
    this.sheetDir = "TimeSheets";
    this.logFile = "timesheets.log";
  }

  /**
   * Compiles the period summary and dispatches the emails (Ruby
   * `sendSummary`, l.57-141).
   *
   * @param resourceIds restricts the summary to these resources; empty includes
   *   every resource that has a template for the period.
   */
  async sendSummary(resourceIds: string[] = [],): Promise<void> {
    await this.setWorkingDir();
    const store = this.requireFileStore("sendSummary",);
    const date = this.date;
    if (date === null || date === "") this.fatal("@date not set",);

    let summary = "";
    const defaulters: SheetResourceInfo[] = [];

    for (const resource of await this.getResourceList()) {
      if (resourceIds.length > 0 && !resourceIds.includes(resource.id,)) {
        continue;
      }

      const templateFile = await this.findSheetFile(
        `${this.templateDir}/${date}`,
        `${resource.id}_${date}`,
      );
      const sheetFile = await this.findSheetFile(
        `${this.sheetDir}/${date}`,
        `${resource.id}_${date}`,
      );
      // Without a template the resource was not invited to report in this
      // period.
      if (templateFile === null) continue;

      if (sheetFile === null) {
        defaulters.push(resource,);
        this.info(`Report from ${resource.id} is missing`,);
        continue;
      }

      // With no recipients, compiling the summary would be wasted work.
      if (
        this.digestRecipients.length === 0 && this.sheetRecipients.length === 0
      ) {
        continue;
      }

      const journal = await this.getResourceJournal(sheetFile,);
      summary += sprintf(this.resourceIntro, resource.name,);
      summary += `${journal}\n----\n`;
      this.info(`Adding report from ${resource.name} to summary`,);

      for (const to of this.sheetRecipients) {
        await this.sendRichTextEmail(
          to,
          sprintf(this.resourceSheetSubject, date,),
          journal,
          null,
          `${resource.name} <${resource.email}>`,
        );
      }
    }

    if (defaulters.length > 0) {
      // The defaulters list opens the summary.
      let text = sprintf(this.defaulterHeader, defaulters.length,);
      for (const resource of defaulters) {
        text += `* <nowiki>${resource.name}</nowiki>\n`;
      }
      text += "\n----\n";
      summary = text + summary;
      await this.writeMissingReports(defaulters,);
    }

    for (const to of this.digestRecipients) {
      await this.sendRichTextEmail(
        to,
        sprintf(this.summarySubject, date,),
        summary,
      );
    }

    // Optional reminder (the app can disable it by clearing `reminderText`).
    if (this.reminderText !== "") {
      for (const resource of defaulters) {
        await this.sendReminder(
          resource.id,
          resource.name,
          resource.email,
        );
      }
    }
  }

  /**
   * Validates an already archived sheet and returns the excerpt that goes into
   * the summary (Ruby `getResourceJournal`, l.166-190).
   *
   * Ruby called `tj3client check-ts` and used its stdout; here the sheet is
   * applied in-process (same path as `checkSheet`) and the result is the sheet
   * itself, verbatim.
   */
  protected async getResourceJournal(sheetFile: string,): Promise<string> {
    const store = this.requireFileStore("getResourceJournal",);
    let sheet: string;
    try {
      sheet = await store.read(sheetFile,);
    } catch (error) {
      this.fatal(`Cannot summarize sheet: ${errorText(error,)}`,);
    }

    const handler = MessageHandlerInstance.instance;
    const errorCount = handler.errors;
    let applied: unknown = null;
    try {
      applied = this.applySheet(sheet,);
    } catch (error) {
      // A `TjRuntimeError` already carries its own message and reply.
      if (error instanceof TjRuntimeError) throw error;
      this.fatal(`Cannot summarize sheet: ${errorText(error,)}`,);
    }
    if (handler.errors !== errorCount) {
      // Ruby: `error("summary sheets: #{err}")`, with `err` always empty.
      this.error("summary sheets: ",);
    }
    return materialTallyText(
      this.tallyMaterials(applied as TimeSheet | null,),
    ) +
      `<nowiki>${sheet}</nowiki>`;
  }

  /**
   * Aggregates the material statuses of the applied sheet (extension 18.17.5):
   * how many records came in, how many carry a `status` and the count per alert
   * level — the same levels the `statussheet` uses.
   */
  protected tallyMaterials(sheet: TimeSheet | null,): MaterialStatusTally {
    const tally: MaterialStatusTally = {
      records: 0,
      withStatus: 0,
      alerts: {},
    };
    if (sheet === null) return tally;
    const levels =
      (this.project?.get("alertLevels",) ?? []) as AlertLevelDefinition[];
    for (const record of sheet.materialRecords) {
      tally.records++;
      const status = record.status;
      if (status === null) continue;
      tally.withStatus++;
      const id = levels[status.alertLevel]?.id ?? String(status.alertLevel,);
      tally.alerts[id] = (tally.alerts[id] ?? 0) + 1;
    }
    return tally;
  }

  /**
   * Resends the template to a defaulter together with the reminder text (Ruby
   * `sendReminder`, l.150-164).
   *
   * The email is plain text with the sheet attached (`.smx`; the legacy `.tji`
   * template is also accepted — 24.2.36) — the user can fill in the attachment
   * or the body and send it back.
   */
  protected async sendReminder(
    id: string,
    name: string,
    email: string,
  ): Promise<void> {
    const store = this.requireFileStore("sendReminder",);
    const attachment = await this.findSheetFile(
      `${this.templateDir}/${this.date}`,
      `${id}_${this.date}`,
    ) ?? `${this.templateDir}/${this.date}/${id}_${this.date}` +
        SHEET_EXTENSION;
    let sheet: string;
    try {
      sheet = await store.read(attachment,);
    } catch {
      this.error(
        "sendReportTemplates: " +
          `time sheet ${attachment} for ${name} not found`,
      );
    }

    const message = `Hello ${name}!\n\n${this.reminderText}${sheet}`;
    await this.sendEmail(
      email,
      sprintf(this.reminderSubject, this.date ?? "",),
      message,
      attachment,
    );
  }

  /**
   * Writes `<sheetDir>/<date>/missing-reports` with one ID per line (Ruby
   * l.116-126) — the file `StatusSheetSender` reads in `defaulterList` (18.10).
   */
  protected async writeMissingReports(
    defaulters: SheetResourceInfo[],
  ): Promise<void> {
    const store = this.requireFileStore("sendSummary",);
    const dir = `${this.sheetDir}/${this.date}`;
    const missingFile = `${dir}/missing-reports`;
    try {
      // Ruby relied on the folder already created by the receiver; here `write`
      // requires the parent directory (ADR 037).
      await store.mkdir(dir,);
      await store.write(
        missingFile,
        defaulters.map((resource,) => `${resource.id}\n`).join("",),
      );
    } catch (error) {
      this.error(
        `Cannot write file with missing reports (${missingFile}): ` +
          errorText(error,),
      );
    }
  }
}
