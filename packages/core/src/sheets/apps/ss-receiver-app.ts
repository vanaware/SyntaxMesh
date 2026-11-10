/**
 * SsReceiverApp — the `tj3ss_receiver` app: accepts the returned status sheets.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/apps/Tj3SsReceiver.rb`. Same flow as
 * `TsReceiverApp`, with `StatusSheetReceiver` (18.10) and the `statussheets`
 * section of the config.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3SsReceiver.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18.6)
 */

import { StatusSheetReceiver, } from "../status-sheet-receiver.ts";
import type { EmailMessage, } from "../email-message.ts";
import {
  SheetAppBase,
  type SheetAppContext,
  type SheetAppOptions,
} from "./app-base.ts";

/**
 * App that ingests status sheets returned by resources.
 */
export class SsReceiverApp extends SheetAppBase {
  /** Receiver that parses and applies the incoming status sheets. */
  readonly handler: StatusSheetReceiver;

  /**
   * Creates the app.
   *
   * @param options Typed options produced by the CLI layer.
   */
  constructor(options: SheetAppOptions = {},) {
    super("tj3ss_receiver", 1, options,);
    this.handler = new StatusSheetReceiver(this.appName,);
  }

  /**
   * Reply emails queued during the run (acceptance, rejection, error — ADR 036).
   *
   * @returns The emails produced by the receiver, in send order.
   */
  get messages(): EmailMessage[] {
    return this.handler.sentMessages;
  }

  /**
   * Parses the received status sheet email and applies it to the project.
   *
   * @param context Project, file store and raw RFC 822 email.
   */
  protected async appMain(context: SheetAppContext,): Promise<void> {
    this.prepare(this.handler, "statussheets", "receiver",);
    this.attach(this.handler, context,);

    const rawEmail = context.rawEmail ?? null;
    if (rawEmail === null || rawEmail === "") {
      this.handler.error("No email text provided on the input",);
    }

    this.handler.setProject(context.project,);
    await this.handler.processEmail(rawEmail,);
  }
}
