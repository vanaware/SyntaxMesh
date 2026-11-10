/**
 * TsSenderApp — the `tj3ts_sender` app: sends the time sheet templates.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/apps/Tj3TsSender.rb`. Ruby ran once
 * a week from cron, talked to `tj3client` and sent the emails over SMTP. Here the
 * project arrives ready and each email comes out as an `EmailMessage` (ADR 036)
 * — **nothing is transmitted**.
 *
 * Options equivalent to the `OptionParser` ones (argv reading belongs to Phase
 * 24):
 *  - `resources` — `-r/--resource <ID>`, repeatable;
 *  - `force` — `-f/--force`, resends an already existing template;
 *  - `intervalDuration` — Ruby's `@intervalDuration` (declared there, but without
 *    its own flag: only `tj3ss_sender` exposed `-i`);
 *  - `endDate` — `-e/--enddate`, default = next Monday.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3TsSender.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18.3)
 */

import { TimeSheetSender, } from "../time-sheet-sender.ts";
import type { EmailMessage, } from "../email-message.ts";
import {
  SheetAppBase,
  type SheetAppContext,
  type SheetAppOptions,
} from "./app-base.ts";

/**
 * Options specific to `tj3ts_sender`.
 */
export interface TsSenderAppOptions extends SheetAppOptions {
  /** `-r/--resource <ID>` (repeatable). */
  resources?: string[];
  /** `-f/--force`. */
  force?: boolean;
  /** `@intervalDuration` (sender default: `1w`). */
  intervalDuration?: string | null;
}

/**
 * App that emits one time sheet template per resource for the period.
 */
export class TsSenderApp extends SheetAppBase {
  /** Sender that builds and queues the template emails. */
  readonly handler: TimeSheetSender;

  /** `-r/--resource`: empty = every resource. */
  readonly resources: string[];

  /** `-f/--force`. */
  force: boolean;

  /** `@intervalDuration`, or `null` to keep the sender default. */
  readonly intervalDuration: string | null;

  /**
   * Creates the app.
   *
   * @param options Typed options produced by the CLI layer.
   */
  constructor(options: TsSenderAppOptions = {},) {
    // Ruby: `@date = TjTime.new.nextDayOfWeek(1).to_s('%Y-%m-%d')`.
    super("tj3ts_sender", 1, options,);

    this.handler = new TimeSheetSender(this.appName,);
    this.resources = [...(options.resources ?? []),];
    this.force = options.force ?? false;
    this.intervalDuration = options.intervalDuration ?? null;
  }

  /**
   * Emails generated in this run, in send order (ADR 036).
   *
   * @returns The template emails produced by the sender.
   */
  get messages(): EmailMessage[] {
    return this.handler.sentMessages;
  }

  /**
   * Builds one template per requested resource and queues it as an email.
   *
   * @param context Project, file store and raw email of the run.
   */
  protected async appMain(context: SheetAppContext,): Promise<void> {
    this.prepare(this.handler, "timesheets", "sender",);
    this.attach(this.handler, context,);

    this.handler.setProject(context.project,);
    this.handler.date = this.date;
    this.handler.force = this.force;
    if (this.intervalDuration !== null) {
      this.handler.intervalDuration = this.intervalDuration;
    }

    await this.handler.sendTemplates(this.resources,);
  }
}
