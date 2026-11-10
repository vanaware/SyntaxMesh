/**
 * TsSummaryApp — the `tj3ts_summary` app: sends the accepted sheets and the
 * digest.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/apps/Tj3TsSummary.rb`. Without SMTP
 * (ADR 036) the result is the email texts: one per resource
 * (`sheetRecipients`) and one consolidated (`digestRecipients`).
 *
 * Options equivalent to the `OptionParser` ones (argv belongs to Phase 24):
 *  - `resources` — `-r/--resource <ID>`;
 *  - `sheetRecipients` — `--sheet <EMAIL>` (and also `-t/--to`);
 *  - `digestRecipients` — `--digest <EMAIL>` (and also `-t/--to`);
 *  - `endDate` — `-e/--enddate`, default = next Monday.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3TsSummary.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18.5)
 */

import { TimeSheetSummary, } from "../time-sheet-summary.ts";
import type { EmailMessage, } from "../email-message.ts";
import {
  SheetAppBase,
  type SheetAppContext,
  type SheetAppOptions,
} from "./app-base.ts";

/**
 * Options specific to `tj3ts_summary`.
 */
export interface TsSummaryAppOptions extends SheetAppOptions {
  /** `-r/--resource <ID>` (repeatable). */
  resources?: string[];
  /** `--sheet <EMAIL>`: recipients of the individual sheets. */
  sheetRecipients?: string[];
  /** `--digest <EMAIL>`: recipients of the consolidated digest. */
  digestRecipients?: string[];
}

/**
 * App that emits the accepted sheets plus a consolidated digest.
 */
export class TsSummaryApp extends SheetAppBase {
  /** Summary builder that produces the emails. */
  readonly handler: TimeSheetSummary;

  /** `-r/--resource`: empty = every resource with a template in the period. */
  readonly resources: string[];

  /** `--sheet <EMAIL>`. */
  readonly sheetRecipients: string[];

  /** `--digest <EMAIL>`. */
  readonly digestRecipients: string[];

  /**
   * Creates the app.
   *
   * @param options Typed options produced by the CLI layer.
   */
  constructor(options: TsSummaryAppOptions = {},) {
    // Ruby: `@date = TjTime.new.nextDayOfWeek(1).to_s('%Y-%m-%d')`.
    super("tj3ts_summary", 1, options,);

    this.handler = new TimeSheetSummary(this.appName,);
    this.resources = [...(options.resources ?? []),];
    this.sheetRecipients = [...(options.sheetRecipients ?? []),];
    this.digestRecipients = [...(options.digestRecipients ?? []),];
  }

  /**
   * Emails generated in this run: individual sheets plus the digest.
   *
   * @returns The summary emails produced by the run.
   */
  get messages(): EmailMessage[] {
    return this.handler.sentMessages;
  }

  /**
   * Builds the per-resource sheets and the digest for the period.
   *
   * @param context Project, file store and raw email of the run.
   */
  protected async appMain(context: SheetAppContext,): Promise<void> {
    this.prepare(this.handler, "timesheets", "summary",);
    this.attach(this.handler, context,);

    this.handler.setProject(context.project,);
    this.handler.date = this.date;
    // Ruby: `ts.sheetRecipients += @sheetRecipients` — the config is preserved.
    this.handler.sheetRecipients.push(...this.sheetRecipients,);
    this.handler.digestRecipients.push(...this.digestRecipients,);

    await this.handler.sendSummary(this.resources,);
  }
}
