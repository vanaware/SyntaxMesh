/**
 * SsSenderApp — app `tj3ss_sender`: envia os templates de status sheet.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/apps/Tj3SsSender.rb`. Idêntico ao
 * `TsSenderApp`, com três diferenças do Ruby: o default do período é a próxima
 * **quarta-feira** (`nextDayOfWeek(3)`), existe `--hideresource` e o
 * intervalo é ajustável (`-i/--interval`).
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3SsSender.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18.6)
 */

import { StatusSheetSender, } from "../status-sheet-sender.ts";
import {
  SheetAppBase,
  type SheetAppContext,
  type SheetAppOptions,
} from "./app-base.ts";

/** Opções específicas do `tj3ss_sender`. */
export interface SsSenderAppOptions extends SheetAppOptions {
  /** `-r/--resource <ID>` (repetível). */
  resources?: string[];
  /** `-f/--force`. */
  force?: boolean;
  /** `-i/--interval <DURATION>` (`1w`, `5d`, `72h`…). */
  intervalDuration?: string | null;
  /** `--hideresource <EXPR>`: filtro dos recursos do template. */
  hideResource?: string | null;
}

export class SsSenderApp extends SheetAppBase {
  readonly handler: StatusSheetSender;

  /** `-r/--resource`: vazio = todos os recursos. */
  readonly resources: string[];

  /** `-f/--force`. */
  force: boolean;

  /** `-i/--interval`, ou `null` para manter o default do sender. */
  readonly intervalDuration: string | null;

  /** `--hideresource`, ou `null` para manter o default do sender. */
  readonly hideResource: string | null;

  constructor(options: SsSenderAppOptions = {},) {
    // Ruby: `@date = TjTime.new.nextDayOfWeek(3).to_s('%Y-%m-%d')`.
    super("tj3ss_sender", 3, options,);

    this.handler = new StatusSheetSender(this.appName,);
    this.resources = [...(options.resources ?? []),];
    this.force = options.force ?? false;
    this.intervalDuration = options.intervalDuration ?? null;
    this.hideResource = options.hideResource ?? null;
  }

  /** Emails gerados nesta execução, na ordem de envio (ADR 036). */
  get messages() {
    return this.handler.sentMessages;
  }

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
