/**
 * TsSummaryApp — app `tj3ts_summary`: manda as folhas aceitas e o resumo.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/apps/Tj3TsSummary.rb`. Sem SMTP
 * (ADR 036), o resultado são os textos de email: um por recurso
 * (`sheetRecipients`) e um consolidado (`digestRecipients`).
 *
 * Opções equivalentes ao `OptionParser` (argv é da F24):
 *  - `resources` — `-r/--resource <ID>`;
 *  - `sheetRecipients` — `--sheet <EMAIL>` (e também `-t/--to`);
 *  - `digestRecipients` — `--digest <EMAIL>` (e também `-t/--to`);
 *  - `endDate` — `-e/--enddate`, default = próxima segunda-feira.
 *
 * @see docs/taskjuggler/lib/taskjuggler/apps/Tj3TsSummary.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md (18.18.5)
 */

import { TimeSheetSummary, } from "../time-sheet-summary.ts";
import {
  SheetAppBase,
  type SheetAppContext,
  type SheetAppOptions,
} from "./app-base.ts";

/** Opções específicas do `tj3ts_summary`. */
export interface TsSummaryAppOptions extends SheetAppOptions {
  /** `-r/--resource <ID>` (repetível). */
  resources?: string[];
  /** `--sheet <EMAIL>`: destinatários das folhas individuais. */
  sheetRecipients?: string[];
  /** `--digest <EMAIL>`: destinatários do resumo consolidado. */
  digestRecipients?: string[];
}

export class TsSummaryApp extends SheetAppBase {
  readonly handler: TimeSheetSummary;

  /** `-r/--resource`: vazio = todos com template no período. */
  readonly resources: string[];

  /** `--sheet <EMAIL>`. */
  readonly sheetRecipients: string[];

  /** `--digest <EMAIL>`. */
  readonly digestRecipients: string[];

  constructor(options: TsSummaryAppOptions = {},) {
    // Ruby: `@date = TjTime.new.nextDayOfWeek(1).to_s('%Y-%m-%d')`.
    super("tj3ts_summary", 1, options,);

    this.handler = new TimeSheetSummary(this.appName,);
    this.resources = [...(options.resources ?? []),];
    this.sheetRecipients = [...(options.sheetRecipients ?? []),];
    this.digestRecipients = [...(options.digestRecipients ?? []),];
  }

  /** Emails gerados nesta execução: folhas individuais + resumo. */
  get messages() {
    return this.handler.sentMessages;
  }

  protected async appMain(context: SheetAppContext,): Promise<void> {
    this.prepare(this.handler, "timesheets", "summary",);
    this.attach(this.handler, context,);

    this.handler.setProject(context.project,);
    this.handler.date = this.date;
    // Ruby: `ts.sheetRecipients += @sheetRecipients` — o config é preservado.
    this.handler.sheetRecipients.push(...this.sheetRecipients,);
    this.handler.digestRecipients.push(...this.digestRecipients,);

    await this.handler.sendSummary(this.resources,);
  }
}
