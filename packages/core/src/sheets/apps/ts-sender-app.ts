/**
 * TsSenderApp — app `tj3ts_sender`: envia os templates de time sheet.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/apps/Tj3TsSender.rb`. O Ruby rodava
 * um por semana via cron, falava com o `tj3client` e mandava os emails por
 * SMTP. Aqui o projeto chega pronto e cada email sai como `EmailMessage`
 * (ADR 036) — **nada é transmitido**.
 *
 * Opções equivalentes às do `OptionParser` (a leitura de argv é da F24):
 *  - `resources` — `-r/--resource <ID>`, repetível;
 *  - `force` — `-f/--force`, reenvia template já existente;
 *  - `intervalDuration` — `@intervalDuration` do Ruby (declarado lá, mas sem
 *    flag própria: só o `tj3ss_sender` expunha `-i`);
 *  - `endDate` — `-e/--enddate`, default = próxima segunda-feira.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3TsSender.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18.3)
 */

import { TimeSheetSender, } from "../time-sheet-sender.ts";
import {
  SheetAppBase,
  type SheetAppContext,
  type SheetAppOptions,
} from "./app-base.ts";

/** Opções específicas do `tj3ts_sender`. */
export interface TsSenderAppOptions extends SheetAppOptions {
  /** `-r/--resource <ID>` (repetível). */
  resources?: string[];
  /** `-f/--force`. */
  force?: boolean;
  /** `@intervalDuration` (default do sender: `1w`). */
  intervalDuration?: string | null;
}

export class TsSenderApp extends SheetAppBase {
  readonly handler: TimeSheetSender;

  /** `-r/--resource`: vazio = todos os recursos. */
  readonly resources: string[];

  /** `-f/--force`. */
  force: boolean;

  /** `@intervalDuration`, ou `null` para manter o default do sender. */
  readonly intervalDuration: string | null;

  constructor(options: TsSenderAppOptions = {},) {
    // Ruby: `@date = TjTime.new.nextDayOfWeek(1).to_s('%Y-%m-%d')`.
    super("tj3ts_sender", 1, options,);

    this.handler = new TimeSheetSender(this.appName,);
    this.resources = [...(options.resources ?? []),];
    this.force = options.force ?? false;
    this.intervalDuration = options.intervalDuration ?? null;
  }

  /** Emails gerados nesta execução, na ordem de envio (ADR 036). */
  get messages() {
    return this.handler.sentMessages;
  }

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
