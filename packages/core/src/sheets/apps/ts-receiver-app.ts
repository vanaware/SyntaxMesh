/**
 * TsReceiverApp — the `tj3ts_receiver` app: accepts the sheets returned by
 * email.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/apps/Tj3TsReceiver.rb`. Ruby read
 * the message from STDIN; here it arrives in {@link SheetAppContext.rawEmail}
 * (the Phase 24 wrapper reads file/stdin) and the rest of the flow is
 * `SheetReceiver` (18.7) — `cutOut` + `processEmail`.
 *
 * `endDate` is accepted for symmetry with the other apps but **is not used**:
 * Ruby does not expose `-e` here and the period comes from the sheet header.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3TsReceiver.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18.4)
 */

import { TimeSheetReceiver, } from "../time-sheet-receiver.ts";
import type { EmailMessage, } from "../email-message.ts";
import {
  SheetAppBase,
  type SheetAppContext,
  type SheetAppOptions,
} from "./app-base.ts";

/**
 * App that ingests time sheets returned by resources.
 */
export class TsReceiverApp extends SheetAppBase {
  /** Receiver that parses and applies the incoming time sheets. */
  readonly handler: TimeSheetReceiver;

  /**
   * Creates the app.
   *
   * @param options Typed options produced by the CLI layer.
   */
  constructor(options: SheetAppOptions = {},) {
    super("tj3ts_receiver", 1, options,);
    this.handler = new TimeSheetReceiver(this.appName,);
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
   * Parses the received time sheet email and applies it to the project.
   *
   * @param context Project, file store and raw RFC 822 email.
   */
  protected async appMain(context: SheetAppContext,): Promise<void> {
    this.prepare(this.handler, "timesheets", "receiver",);
    this.attach(this.handler, context,);

    const rawEmail = context.rawEmail ?? null;
    if (rawEmail === null || rawEmail === "") {
      // Ruby read STDIN and failed during parsing; without a message we fail
      // earlier.
      this.handler.error("No email text provided on the input",);
    }

    this.handler.setProject(context.project,);
    await this.handler.processEmail(rawEmail,);
  }
}
