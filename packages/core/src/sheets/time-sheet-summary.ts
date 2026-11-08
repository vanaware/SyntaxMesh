/**
 * TimeSheetSummary — compila e distribui o resumo das time sheets do período.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/TimeSheetSummary.rb`, herdeiro de
 * `SheetReceiver` (18.7) com as duas adaptações da fase — ADR 036 (sem SMTP:
 * as mensagens viram `outbox/*.eml`) e ADR 037 (todo I/O pelo `FileStore`
 * injetado, logo `sendSummary` é `async`).
 *
 * Fluxo do Ruby preservado: varre a lista de recursos do período, coleta as
 * folhas entregues (anexando cada uma ao resumo), registra os inadimplentes em
 * `missing-reports` (lido pelo `StatusSheetSender`, 18.10), envia o resumo aos
 * `digestRecipients` e cobra cada inadimplente com `sendReminder`.
 *
 * Divergência deliberada: o Ruby usava o stdout de `tj3client check-ts` como
 * corpo do resumo (a folha já em RichText). Aqui a validação roda in-process e
 * o trecho devolvido é a própria folha embrulhada em `<nowiki>` — TJP cru não
 * é RichText válido e faria o `sendRichTextEmail` abortar.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TimeSheetSummary.rb
 * @see docs/syntaxmesh/decisoes/036-sheets-sem-smtp.md
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.11)
 */

import { MessageHandlerInstance, } from "../message-handler.ts";
import { TjRuntimeError, } from "../model/errors.ts";
import type { AlertLevelDefinition, } from "../model/alert-levels.ts";
import type { TimeSheet, } from "../timesheet/time-sheet.ts";
import { type SheetResourceInfo, sprintf, } from "./sheet-handler-base.ts";
import { SHEET_EXTENSION, SheetReceiver, } from "./sheet-receiver.ts";

/** Título da seção de cada recurso no resumo (Ruby `@resourceIntro`). */
export const RESOURCE_INTRO = "== Weekly Report from <nowiki>%s</nowiki> ==\n";

/** Texto de cobrança enviado aos inadimplentes (Ruby `@reminderText`). */
export const REMINDER_TEXT =
  `The deadline for your time sheet submission has passed but we haven't received
it yet. Please submit your time sheet immediately so the content can still be
included in the management reports. Please send a copy of your submission
notification email to your manager. If possible, your manager will still try
to include your report data in his/her report.

Please be aware that post deadline submissions must be processed manually and
create an additional load for your manager and/or project manager.  Please try
to submit in time in the future.

Thanks for your cooperation!

`;

/** Cabeçalho da lista de inadimplentes (Ruby `@defaulterHeader`). */
export const DEFAULTER_HEADER =
  "The following %d person(s) have not yet submitted their time sheets:\n\n";

/** Mensagem de um `catch` desconhecido (`$!` do Ruby). */
function errorText(error: unknown,): string {
  return error instanceof Error ? error.message : String(error,);
}

/** Contagem de status de material de uma folha (extensão 18.17.5). */
export interface MaterialStatusTally {
  /** Registros de material entregues na folha. */
  records: number;
  /** Quantos desses registros trazem `status`. */
  withStatus: number;
  /** Quantidade por ID de nível de alerta (`green`, `yellow`, `red`, …). */
  alerts: Record<string, number>;
}

/**
 * Linha do resumo com a contagem de materiais (extensão 18.17.5).
 *
 * Vazia quando a folha não reporta material, para que o resumo de folhas
 * sem material fique idêntico ao de antes da extensão.
 */
export function materialTallyText(tally: MaterialStatusTally,): string {
  if (tally.records === 0) return "";
  const alerts = Object.entries(tally.alerts,)
    .map(([id, count,],) => `${id}: ${count}`)
    .join(", ",);
  return `Materials: ${tally.records} reported, ${tally.withStatus} with ` +
    `status${alerts === "" ? "" : ` (${alerts})`}\n`;
}

/**
 * Resumo semanal das time sheets recebidas.
 *
 * Configuração (todos públicos, como os `attr_accessor` do Ruby): `date`,
 * `sheetRecipients`, `digestRecipients`, `hideResource` e os textos dos
 * emails.
 */
export class TimeSheetSummary extends SheetReceiver {
  /** Destinatários de cada folha individual (vazio = não envia). */
  sheetRecipients: string[] = [];
  /** Destinatários do resumo consolidado (vazio = não envia). */
  digestRecipients: string[] = [];

  /**
   * Expressão lógica dos recursos fora do resumo (Ruby `@hideResource = '0'`).
   *
   * Como no `SheetSender`, é repassada ao `resourcereport` que produz a lista
   * de recursos — o `TimeSheetSummary` em si não filtra nada.
   */
  hideResource = "0";

  /** Título de cada recurso no resumo. */
  resourceIntro = RESOURCE_INTRO;
  /** Assunto da folha individual (`%s` = data do período). */
  resourceSheetSubject = "Weekly report %s";
  /** Assunto do resumo (`%s` = data do período). */
  summarySubject = "Weekly staff reports %s";
  /** Assunto da cobrança (`%s` = data do período). */
  reminderSubject = "Your time sheet for the period ending %s is overdue!";
  /** Texto da cobrança; vazio desliga o envio dos lembretes. */
  reminderText = REMINDER_TEXT;
  /** Cabeçalho da lista de inadimplentes (`%d` = quantidade). */
  defaulterHeader = DEFAULTER_HEADER;

  constructor(appName = "tj3ts_summary",) {
    super(appName, "summary",);

    this.templateDir = "TimeSheetTemplates";
    this.sheetDir = "TimeSheets";
    this.logFile = "timesheets.log";
  }

  /**
   * Compila o resumo do período e dispara os emails
   * (Ruby `sendSummary`, l.57-141).
   *
   * @param resourceIds restringe o resumo a estes recursos; vazio inclui todos
   *   os que têm template no período.
   */
  async sendSummary(resourceIds: string[] = [],): Promise<void> {
    await this.setWorkingDir();
    const store = this.requireFileStore("sendSummary",);
    const date = this.date;
    if (date === null || date === "") this.fatal("@date not set",);

    let summary = "";
    const defaulters: SheetResourceInfo[] = [];

    for (const resource of await this.getResourceList()) {
      if (resourceIds.length > 0 && !resourceIds.includes(resource.id,)) {
        continue;
      }

      const templateFile = await this.findSheetFile(
        `${this.templateDir}/${date}`,
        `${resource.id}_${date}`,
      );
      const sheetFile = await this.findSheetFile(
        `${this.sheetDir}/${date}`,
        `${resource.id}_${date}`,
      );
      // Sem template o recurso não foi convidado a reportar neste período.
      if (templateFile === null) continue;

      if (sheetFile === null) {
        defaulters.push(resource,);
        this.info(`Report from ${resource.id} is missing`,);
        continue;
      }

      // Sem destinatários, compilar o resumo seria trabalho perdido.
      if (
        this.digestRecipients.length === 0 && this.sheetRecipients.length === 0
      ) {
        continue;
      }

      const journal = await this.getResourceJournal(sheetFile,);
      summary += sprintf(this.resourceIntro, resource.name,);
      summary += `${journal}\n----\n`;
      this.info(`Adding report from ${resource.name} to summary`,);

      for (const to of this.sheetRecipients) {
        await this.sendRichTextEmail(
          to,
          sprintf(this.resourceSheetSubject, date,),
          journal,
          null,
          `${resource.name} <${resource.email}>`,
        );
      }
    }

    if (defaulters.length > 0) {
      // A lista de inadimplentes abre o resumo.
      let text = sprintf(this.defaulterHeader, defaulters.length,);
      for (const resource of defaulters) {
        text += `* <nowiki>${resource.name}</nowiki>\n`;
      }
      text += "\n----\n";
      summary = text + summary;
      await this.writeMissingReports(defaulters,);
    }

    for (const to of this.digestRecipients) {
      await this.sendRichTextEmail(
        to,
        sprintf(this.summarySubject, date,),
        summary,
      );
    }

    // Cobrança opcional (o app pode desligá-la zerando `reminderText`).
    if (this.reminderText !== "") {
      for (const resource of defaulters) {
        await this.sendReminder(
          resource.id,
          resource.name,
          resource.email,
        );
      }
    }
  }

  /**
   * Valida uma folha já arquivada e devolve o trecho que entra no resumo
   * (Ruby `getResourceJournal`, l.166-190).
   *
   * O Ruby chamava `tj3client check-ts` e usava o stdout; aqui a folha é
   * aplicada in-process (mesmo caminho de `checkSheet`) e o resultado é a
   * própria folha literal.
   */
  protected async getResourceJournal(sheetFile: string,): Promise<string> {
    const store = this.requireFileStore("getResourceJournal",);
    let sheet: string;
    try {
      sheet = await store.read(sheetFile,);
    } catch (error) {
      this.fatal(`Cannot summarize sheet: ${errorText(error,)}`,);
    }

    const handler = MessageHandlerInstance.instance;
    const errorCount = handler.errors;
    let applied: unknown = null;
    try {
      applied = this.applySheet(sheet,);
    } catch (error) {
      // Um `TjRuntimeError` já trouxe mensagem e resposta próprias.
      if (error instanceof TjRuntimeError) throw error;
      this.fatal(`Cannot summarize sheet: ${errorText(error,)}`,);
    }
    if (handler.errors !== errorCount) {
      // Ruby: `error("summary sheets: #{err}")`, com `err` sempre vazio.
      this.error("summary sheets: ",);
    }
    return materialTallyText(
      this.tallyMaterials(applied as TimeSheet | null,),
    ) +
      `<nowiki>${sheet}</nowiki>`;
  }

  /**
   * Agrega os status de material da folha aplicada (extensão 18.17.5):
   * quantos registros vieram, quantos trazem `status` e a contagem por nível
   * de alerta — os mesmos níveis que o `statussheet` usa.
   */
  protected tallyMaterials(sheet: TimeSheet | null,): MaterialStatusTally {
    const tally: MaterialStatusTally = {
      records: 0,
      withStatus: 0,
      alerts: {},
    };
    if (sheet === null) return tally;
    const levels =
      (this.project?.get("alertLevels",) ?? []) as AlertLevelDefinition[];
    for (const record of sheet.materialRecords) {
      tally.records++;
      const status = record.status;
      if (status === null) continue;
      tally.withStatus++;
      const id = levels[status.alertLevel]?.id ?? String(status.alertLevel,);
      tally.alerts[id] = (tally.alerts[id] ?? 0) + 1;
    }
    return tally;
  }

  /**
   * Reenvia o template ao inadimplente junto com o texto de cobrança
   * (Ruby `sendReminder`, l.150-164).
   *
   * O email é texto puro com a folha em anexo (`.smx`; template legado
   * `.tji` também é aceito — 24.2.36) — o usuário pode preencher o anexo ou
   * o corpo e devolver.
   */
  protected async sendReminder(
    id: string,
    name: string,
    email: string,
  ): Promise<void> {
    const store = this.requireFileStore("sendReminder",);
    const attachment = await this.findSheetFile(
      `${this.templateDir}/${this.date}`,
      `${id}_${this.date}`,
    ) ?? `${this.templateDir}/${this.date}/${id}_${this.date}` +
        SHEET_EXTENSION;
    let sheet: string;
    try {
      sheet = await store.read(attachment,);
    } catch {
      this.error(
        "sendReportTemplates: " +
          `time sheet ${attachment} for ${name} not found`,
      );
    }

    const message = `Hello ${name}!\n\n${this.reminderText}${sheet}`;
    await this.sendEmail(
      email,
      sprintf(this.reminderSubject, this.date ?? "",),
      message,
      attachment,
    );
  }

  /**
   * Grava `<sheetDir>/<date>/missing-reports` com um ID por linha
   * (Ruby l.116-126) — o arquivo que o `StatusSheetSender` lê em
   * `defaulterList` (18.10).
   */
  protected async writeMissingReports(
    defaulters: SheetResourceInfo[],
  ): Promise<void> {
    const store = this.requireFileStore("sendSummary",);
    const dir = `${this.sheetDir}/${this.date}`;
    const missingFile = `${dir}/missing-reports`;
    try {
      // O Ruby contava com a pasta já criada pelo receiver; aqui o `write`
      // exige o diretório-pai (ADR 037).
      await store.mkdir(dir,);
      await store.write(
        missingFile,
        defaulters.map((resource,) => `${resource.id}\n`).join("",),
      );
    } catch (error) {
      this.error(
        `Cannot write file with missing reports (${missingFile}): ` +
          errorText(error,),
      );
    }
  }
}
