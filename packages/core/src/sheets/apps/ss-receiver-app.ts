/**
 * SsReceiverApp — app `tj3ss_receiver`: aceita as folhas de status devolvidas.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/apps/Tj3SsReceiver.rb`. Mesmo fluxo
 * do `TsReceiverApp`, com o `StatusSheetReceiver` (18.10) e a seção
 * `statussheets` do config.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3SsReceiver.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18.6)
 */

import { StatusSheetReceiver, } from "../status-sheet-receiver.ts";
import {
  SheetAppBase,
  type SheetAppContext,
  type SheetAppOptions,
} from "./app-base.ts";

export class SsReceiverApp extends SheetAppBase {
  readonly handler: StatusSheetReceiver;

  constructor(options: SheetAppOptions = {},) {
    super("tj3ss_receiver", 1, options,);
    this.handler = new StatusSheetReceiver(this.appName,);
  }

  /** Emails de resposta enfileirados (aceite, recusa, erro — ADR 036). */
  get messages() {
    return this.handler.sentMessages;
  }

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
