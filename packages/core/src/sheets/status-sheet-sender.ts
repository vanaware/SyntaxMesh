/**
 * StatusSheetSender — sender concreto de templates de status sheet (18.10).
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/StatusSheetSender.rb`.
 *
 * Além da configuração, o Ruby monta no construtor a lista de **inadimplentes**
 * (`defaulterList`): recursos que não entregaram o time sheet do período
 * anterior. Como `FileStore` é assíncrono (ADR 037), o construtor não pode
 * ler o disco; a lista entra em `introText` no início de `sendTemplates`, o que
 * mantém o efeito do Ruby sem bloquear a construção.
 *
 * @see docs/taskjuggler/lib/taskjuggler/StatusSheetSender.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.10)
 */

import { baseName, } from "./email-message.ts";
import { SheetSender, } from "./sheet-sender.ts";

/** Texto de introdução do email (Ruby `@introText`). */
export const STATUS_SHEET_INTRO_TEXT =
  `Please find enclosed your weekly status report template. Please fill out the
form and send it back to the sender of this email. You can either use the
attached file or the body of the email. In case you send it in the body of the
email, make sure it only contains the 'statussheet' syntax. It must be plain
text, UTF-8 encoded and the status sheet header from 'statussheet' to the period
end date must be in a single line that starts at the beginning of the line.

`;

/** Aviso anexado ao `introText` quando há inadimplentes (Ruby l.75-83). */
export const DEFAULTERS_WARNING_HEADER =
  `=============================== W A R N I N G ==============================

The following people have not submitted their report yet. The status reports
for the work they have done is not included in this template! You can either
manually add their status to the tasks or asked them to send their time sheet
immediately and re-request this template.

`;

/** `YYYY-MM-DD` → `Date` local à meia-noite (Ruby `Time.local(*split('-'))`). */
function parseLocalDate(text: string,): Date | null {
  const parts = text.split("-",);
  if (parts.length !== 3) return null;
  const year = Number(parts[0],);
  const month = Number(parts[1],);
  const day = Number(parts[2],);
  if (![year, month, day,].every((value,) => Number.isFinite(value,))) {
    return null;
  }
  return new Date(year, month - 1, day,);
}

export class StatusSheetSender extends SheetSender {
  /** Base dos time sheets já recebidos (Ruby `@timeSheetDir`). */
  timeSheetDir = "TimeSheets";

  constructor(appName: string,) {
    super(appName, "status",);

    this.hideResource = "0";
    this.templateDir = "StatusSheetTemplates";
    this.signatureFile = `${this.templateDir}/acceptable_intervals`;
    this.logFile = "statussheets.log";

    this.signatureFilter =
      /^[ ]*statussheet\s[a-zA-Z_][a-zA-Z0-9_]*\s([0-9:\-+]*\s-\s[0-9:\-+]*)/u;
    this.introText = STATUS_SHEET_INTRO_TEXT;
    this.mailSubject = "Your weekly status report template for %s";
  }

  /** Acrescenta o aviso de inadimplentes antes de gerar/enviar os templates. */
  override async sendTemplates(resourceList: string[],): Promise<void> {
    await this.addDefaulterWarning();
    await super.sendTemplates(resourceList,);
  }

  /**
   * Recursos que **não** entregaram o time sheet do período anterior
   * (Ruby `defaulterList`, l.97-141).
   *
   * Os intervalos do status sheet e do time sheet não são idênticos: o do
   * status sheet é menor e um pouco posterior, mas sempre contém a data final
   * do período do time sheet. Por isso a pasta de time sheets escolhida é a
   * última com data **anterior** ao fim do período do status sheet.
   *
   * @returns IDs (na ordem do arquivo `missing-reports`); vazio quando não há
   *   pasta correspondente, nem `missing-reports`, ou quando todos já enviaram.
   */
  async defaulterList(): Promise<string[]> {
    const store = this.requireFileStore("defaulterList",);

    let names: string[];
    try {
      names = await store.list(this.timeSheetDir,);
    } catch {
      // Sem o diretório de time sheets não há como saber quem deve.
      return [];
    }

    const reportDate = parseLocalDate(this.date,);
    if (reportDate === null) return [];

    const dirs: { name: string; date: Date }[] = [];
    for (const name of names) {
      const base = baseName(name,);
      const date = parseLocalDate(base,);
      if (date !== null) dirs.push({ name: base, date, },);
    }
    dirs.sort((a, b,) => a.date.getTime() - b.date.getTime());

    let timeSheetDir: string | null = null;
    for (const dir of dirs) {
      if (dir.date.getTime() < reportDate.getTime()) {
        timeSheetDir = dir.name;
      } else {
        break;
      }
    }
    if (timeSheetDir === null) return [];

    const missingFile = `${this.timeSheetDir}/${timeSheetDir}/missing-reports`;
    if (!(await store.exists(missingFile,))) return [];

    const ids = (await store.read(missingFile,))
      .split("\n",)
      .map((line,) => line.trim().replace(/\r$/u, "",))
      .filter((line,) => line !== "");

    // A folha pode ter sido entregue depois do `tj3ts_summary` (18.11).
    const pending: string[] = [];
    for (const id of ids) {
      const sheet = `${this.timeSheetDir}/${timeSheetDir}/${id}_` +
        `${timeSheetDir}.tji`;
      if (!(await store.exists(sheet,))) pending.push(id,);
    }
    return pending;
  }

  /**
   * Anexa o aviso de inadimplentes ao `introText` (Ruby fazia isso no
   * construtor). Sem inadimplentes, o texto fica inalterado.
   */
  protected async addDefaulterWarning(): Promise<void> {
    const defaulters = await this.defaulterList();
    if (defaulters.length === 0) return;
    this.introText += DEFAULTERS_WARNING_HEADER +
      defaulters.map((id,) => `${id}\n`).join("",);
  }
}
