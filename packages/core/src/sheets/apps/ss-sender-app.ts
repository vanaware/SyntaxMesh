/**
 * SsSenderApp — the `tj3ss_sender` app: sends the status sheet templates.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/apps/Tj3SsSender.rb`. Identical to
 * `TsSenderApp`, with three differences from Ruby: the period defaults to the
 * next **Wednesday** (`nextDayOfWeek(3)`), it has `--hideresource` and the
 * interval is adjustable (`-i/--interval`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3SsSender.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18.6)
 */

import { StatusSheetSender, } from "../status-sheet-sender.ts";
import type { EmailMessage, } from "../email-message.ts";
import {
  SheetAppBase,
  type SheetAppContext,
  type SheetAppOptions,
} from "./app-base.ts";

/**
 * Options specific to `tj3ss_sender`.
 */
export interface SsSenderAppOptions extends SheetAppOptions {
  /** `-r/--resource <ID>` (repeatable). */
  resources?: string[];
  /** `-f/--force`. */
  force?: boolean;
  /** `-i/--interval <DURATION>` (`1w`, `5d`, `72h`...). */
  intervalDuration?: string | null;
  /** `--hideresource <EXPR>`: filter applied to the template resources. */
  hideResource?: string | null;
}

/**
 * App that emits one status sheet template per resource for the period.
 */
export class SsSenderApp extends SheetAppBase {
  /** Sender that builds and queues the template emails. */
  readonly handler: StatusSheetSender;

  /** `-r/--resource`: empty = every resource. */
  readonly resources: string[];

  /** `-f/--force`. */
  force: boolean;

  /** `-i/--interval`, or `null` to keep the sender default. */
  readonly intervalDuration: string | null;

  /** `--hideresource`, or `null` to keep the sender default. */
  readonly hideResource: string | null;

  /**
   * Creates the app.
   *
   * @param options Typed options produced by the CLI layer.
   */
  constructor(options: SsSenderAppOptions = {},) {
    // Ruby: `@date = TjTime.new.nextDayOfWeek(3).to_s('%Y-%m-%d')`.
    super("tj3ss_sender", 3, options,);

    this.handler = new StatusSheetSender(this.appName,);
    this.resources = [...(options.resources ?? []),];
    this.force = options.force ?? false;
    this.intervalDuration = options.intervalDuration ?? null;
    this.hideResource = options.hideResource ?? null;
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
   * Builds one status sheet template per requested resource and queues it as an
   * email.
   *
   * @param context Project, file store and raw email of the run.
   */
  protected async appMain(context: SheetAppContext,): Promise<void> {
    this.prepare(this.handler, "statussheets", "sender",);
    this.attach(this.handler, context,);

    this.handler.setProject(context.project,);
    this.handler.date = this.date;
    this.handler.force = this.force;
    if (this.intervalDuration !== null) {
      this.handler.intervalDuration = this.intervalDuration;
    }
    if (this.hideResource !== null) {
      this.handler.hideResource = this.hideResource;
    }

    await this.handler.sendTemplates(this.resources,);
  }
}
