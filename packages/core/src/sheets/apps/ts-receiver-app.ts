/**
 * TsReceiverApp — app `tj3ts_receiver`: aceita as folhas devolvidas por email.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/apps/Tj3TsReceiver.rb`. O Ruby lia a
 * mensagem do STDIN; aqui ela chega em {@link SheetAppContext.rawEmail} (o
 * wrapper da F24 lê arquivo/stdin) e o resto do fluxo é o `SheetReceiver`
 * (18.7) — `cutOut` + `processEmail`.
 *
 * `endDate` é aceito por simetria com os demais apps, mas **não** é usado: o
 * Ruby não expõe `-e` aqui e o período vem do cabeçalho da folha.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3TsReceiver.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18.4)
 */

import { TimeSheetReceiver, } from "../time-sheet-receiver.ts";
import {
  SheetAppBase,
  type SheetAppContext,
  type SheetAppOptions,
} from "./app-base.ts";

export class TsReceiverApp extends SheetAppBase {
  readonly handler: TimeSheetReceiver;

  constructor(options: SheetAppOptions = {},) {
    super("tj3ts_receiver", 1, options,);
    this.handler = new TimeSheetReceiver(this.appName,);
  }

  /** Emails de resposta enfileirados (aceite, recusa, erro — ADR 036). */
  get messages() {
    return this.handler.sentMessages;
  }

  protected async appMain(context: SheetAppContext,): Promise<void> {
    this.prepare(this.handler, "timesheets", "receiver",);
    this.attach(this.handler, context,);

    const rawEmail = context.rawEmail ?? null;
    if (rawEmail === null || rawEmail === "") {
      // O Ruby lia STDIN e falhava no parse; sem mensagem, falhamos antes.
      this.handler.error("No email text provided on the input",);
    }

    this.handler.setProject(context.project,);
    await this.handler.processEmail(rawEmail,);
  }
}
