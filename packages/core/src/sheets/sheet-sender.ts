/**
 * SheetSender — gera e "envia" os templates de time/status sheet.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/SheetSender.rb`, com duas
 * adaptações obrigatórias desta fase:
 *  - **ADR 036** — não há processo `tj3client`, SMTP nem SCM. A geração do
 *    relatório acontece **in-process** (`ProjectFileParser` + `Project`), e a
 *    "entrega" é uma `EmailMessage` devolvida/gravada em `outbox/`.
 *  - **ADR 037** — todo I/O passa pelo `FileStore` injetado; por isso o
 *    pipeline inteiro é `async`.
 *
 * O fluxo permanece o do Ruby: `sendTemplates` → `setWorkingDir` →
 * `createDirectories` → `genResourceList` → `genTemplates` →
 * `sendReportTemplates`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/SheetSender.rb
 * @see docs/syntaxmesh/decisoes/036-sheets-sem-smtp.md
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.6)
 */

import type { FileStore, } from "../interfaces/file-store.ts";
import { TjRuntimeError, } from "../model/errors.ts";
import type { Project, } from "../model/project.ts";
import type { Report, } from "../model/report.ts";
import { ProjectFileParser, } from "../parser/project-file-parser.ts";
import { CSVFile, } from "../reports/csv-file.ts";
// Efeito colateral: registra as fábricas de conteúdo dos relatórios
// (`resourcereport`, `timesheetreport`, `statussheetreport`, …) usadas abaixo.
import "../reports/mod.ts";
import {
  SheetHandlerBase,
  type SheetResourceInfo,
  type SheetType,
  sprintf,
} from "./sheet-handler-base.ts";
import { SHEET_EXTENSION, } from "./sheet-extensions.ts";

/** Id fixo do `resourcereport` interno (Ruby `rl_21497214`). */
export const RESOURCE_LIST_REPORT_ID = "rl_21497214";

/** Mensagem de um `catch` desconhecido (`$!` do Ruby). */
function errorText(error: unknown,): string {
  return error instanceof Error ? error.message : String(error,);
}

/** `YYYY-MM-DD` em hora **local** (Ruby `Time#strftime('%Y-%m-%d')`). */
export function localDate(date: Date,): string {
  const year = String(date.getFullYear(),).padStart(4, "0",);
  const month = String(date.getMonth() + 1,).padStart(2, "0",);
  const day = String(date.getDate(),).padStart(2, "0",);
  return `${year}-${month}-${day}`;
}

/** Número de uma célula CSV (`null`/texto → 0). */
function numberOf(value: unknown,): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const parsed = Number(value,);
  return Number.isFinite(parsed,) ? parsed : 0;
}

/**
 * Base dos senders de sheet (18.6).
 *
 * Subclasses (`TimeSheetSender`, `StatusSheetSender` — 18.8/18.10) só definem
 * `hideResource`, `templateDir`, `signatureFile`, `signatureFilter`,
 * `introText` e `mailSubject`.
 *
 * Os helpers do pipeline são `protected` (e não `private` como no Ruby) para
 * que subclasses e testes possam chamá-los sem `send`.
 */
export class SheetSender extends SheetHandlerBase {
  /** `'time'` ou `'status'` — vira o prefixo do `*sheetreport`. */
  protected readonly sheetType: SheetType;

  /**
   * Expressão lógica que esconde recursos do template (Ruby `'0'`).
   *
   * Público como o `attr_accessor :hideResource` do `StatusSheetSender`.
   */
  hideResource = "0";

  /** Arquivo de intervalos aceitos pelo receiver (`acceptable_intervals`). */
  protected signatureFile = "";

  /**
   * Diretório base dos templates. **É mutado** por `createDirectories` para
   * incluir a data (como no Ruby), por isso `templateRoot` guarda a base.
   */
  protected templateDir = "";

  /** Regenera templates já existentes e os reenvia. */
  force = false;

  /**
   * Atributos dinâmicos aplicados ao relatório do template (o `-A` do `tj3`).
   *
   * O Ruby não tinha este caminho: o template saía sempre do `reportDef`
   * fixo. O adendo 18.19.4 fala em "colunas do template", mas
   * `timesheetreport`/`statussheetreport` ignoram `columns` (o corpo da folha
   * é fixo), então o gancho é genérico, como o `-A` da CLI: serve para
   * `hideresource`, `sorttasks`, `journalattributes`, etc. O
   * `Project#generateReport` restaura os atributos ao final (18.19.3).
   */
  templateAttributes: string | null = null;

  /** Extrai a assinatura (intervalo) do cabeçalho do sheet. */
  protected signatureFilter: RegExp = /^$/u;

  /** Assunto do email (`%s` = data do período). */
  protected mailSubject = "";

  /** Texto de introdução do email. */
  protected introText = "";

  /** Data do período reportado (`YYYY-MM-DD`), congelada na construção. */
  date: string;

  /** Duração do período reportado (sintaxe de intervalo do TJP). */
  intervalDuration = "1w";

  /** Instante da construção — usado para detectar templates antigos. */
  protected timeStamp: Date;

  /**
   * Projeto já parseado/agendado. No Ruby o acesso era via `tj3client`; aqui
   * o sender recebe o `Project` e gera os relatórios in-process.
   */
  project: Project | null = null;

  /** Diretório base, imune à mutação de `templateDir` (idempotência). */
  private templateRoot: string | null = null;

  /** Instante de escrita de cada arquivo gerado (`File#mtime` não existe). */
  private readonly writtenAt = new Map<string, number>();

  constructor(appName: string, type: SheetType,) {
    super(appName,);
    this.sheetType = type;
    const now = this.clock();
    this.date = localDate(now,);
    this.timeStamp = now;
  }

  /** Injeta o projeto alvo da geração de relatórios. */
  setProject(project: Project,): void {
    this.project = project;
  }

  /**
   * Pipeline completo: prepara o diretório de trabalho, cria as pastas, monta
   * a lista de recursos, gera os templates e os envia (Ruby `sendTemplates`).
   *
   * @param resourceList IDs de recursos a considerar; vazio = todos.
   */
  async sendTemplates(resourceList: string[],): Promise<void> {
    await this.setWorkingDir();
    await this.createDirectories();

    const resources = await this.genResourceList(resourceList,);
    await this.genTemplates(resources,);
    await this.sendReportTemplates(resources,);
  }

  /**
   * Cria `<templateDir>` e `<templateDir>/<date>` (Ruby `createDirectories`).
   *
   * Divergência deliberada: a base fica em `templateRoot`, então chamar o
   * pipeline duas vezes no mesmo processo não empilha datas no caminho (o Ruby
   * mutava `@templateDir` e, na segunda vez, criava `…/<date>/<date>`).
   */
  protected async createDirectories(): Promise<void> {
    const store = this.requireFileStore("createDirectories",);
    const root = this.templateRoot ?? this.templateDir;
    this.templateRoot = root;

    if (!(await store.exists(root,))) {
      this.warning(`Creating directory ${root}`,);
      await store.mkdir(root,);
    }
    this.templateDir = `${root}/${this.date}`;
    if (!(await store.exists(this.templateDir,))) {
      await store.mkdir(this.templateDir,);
    }
  }

  /**
   * Monta a lista de recursos com email e horas, via um `resourcereport`
   * interno em CSV (Ruby `genResourceList`, l.87-147).
   *
   * O CSV é gravado em `<templateDir>/resources.json` para o receiver
   * (`getResourceList`, 18.7.22) — o Ruby usava `resources.yml`.
   */
  protected async genResourceList(
    resourceList: string[],
  ): Promise<SheetResourceInfo[]> {
    const store = this.requireFileStore("genResourceList",);
    let list: SheetResourceInfo[] = [];
    this.info("Retrieving resource list...",);

    // O Ruby usava YAML/CSV como transporte porque chamava um subprocesso; aqui
    // o relatório é gerado in-process, mas a definição continua idêntica.
    const reportDef = `resourcereport ${RESOURCE_LIST_REPORT_ID} '.' {
  formats csv
  columns id, name, email, effort, freework, efficiency
  hideresource ${this.hideResource}
  sortresources id.up
  loadunit days
  period %{${this.date} - 1w} +1w
}
`;
    const report = await this.generateReport(
      RESOURCE_LIST_REPORT_ID,
      reportDef,
    );
    // Parse do CSV em Array-de-Arrays (Ruby `CSVFile#parse`).
    const csv = new CSVFile(null, ";",).parse(report,);

    // Descarta a linha de título das colunas.
    csv.shift();

    for (const row of csv) {
      const id = String(row[0] ?? "",);
      const name = String(row[1] ?? "",);
      const email = row[2] === null || row[2] === undefined
        ? ""
        : String(row[2],);
      const effort = numberOf(row[3],);
      const freeWork = numberOf(row[4],);
      const efficiency = numberOf(row[5],);

      // `'<Error>'` é o marcador do report para atributo ausente (não é um
      // email); tratá-lo como vazio preserva a intenção do Ruby de abortar.
      if (email === "" || email === "<Error>") {
        this.error(`Resource '${id}' must have a valid email address`,);
      }

      // Recursos de férias no período inteiro não recebem template.
      if (effort === 0 && freeWork === 0 && efficiency !== 0) {
        this.info(`Resource '${id}' was on leave the whole period`,);
        continue;
      }

      list.push({ id, name, email, effort, freeWork, },);
    }

    // Guarda a lista para o receiver (Ruby gravava `resources.yml`).
    const fileName = `${this.templateDir}/resources.json`;
    try {
      await store.write(fileName, `${JSON.stringify(list, null, 2,)}\n`,);
    } catch (error) {
      this.error(`Saving of ${fileName} failed: ${errorText(error,)}`,);
    }

    if (resourceList.length > 0) {
      // Lista explícita: só os recursos pedidos (e não escondidos pelo filtro).
      list = list.filter((item,) => resourceList.includes(item.id,));
    }

    if (list.length === 0) this.error("genResourceList: list is empty",);

    this.info(`${list.length} resources found`,);
    return list;
  }

  /**
   * Gera um `.smx` por recurso e habilita a assinatura (Ruby `genTemplates`).
   *
   * Templates legados (`.tji`) continuam sendo reaproveitados quando `force`
   * não é pedido (24.2.36).
   */
  protected async genTemplates(
    resources: SheetResourceInfo[],
  ): Promise<void> {
    const store = this.requireFileStore("genTemplates",);
    let firstTemplateFile: string | null = null;

    for (const resInfo of resources) {
      const res = resInfo.id;
      this.info(`Generating template for ${res}...`,);
      const reportId = `sheet_template_${res}`;
      const templateFile = `${this.templateDir}/${res}_${this.date}`;
      const nativeFile = `${templateFile}${SHEET_EXTENSION}`;

      // Não regenera templates existentes sem `force`.
      const existing = await this.findSheetFile(
        this.templateDir,
        `${res}_${this.date}`,
      );
      const fileName = this.force || existing === null ? nativeFile : existing;
      // O primeiro template define o intervalo da folha — mesmo quando é a
      // forma legada que já estava na pasta (24.2.36).
      if (firstTemplateFile === null) firstTemplateFile = fileName;
      if (!this.force && existing !== null) {
        this.info(`Skipping already existing ${existing}.`,);
        continue;
      }

      const reportDef =
        `${this.sheetType}sheetreport ${reportId} "${templateFile}" {
  hideresource ~(plan.id = "${res}")
  period %{${this.date} - ${this.intervalDuration}} +${this.intervalDuration}
  sorttasks id.up
}
`;
      const output = await this.generateReport(
        reportId,
        reportDef,
        this.templateAttributes,
      );
      await store.write(fileName, output,);
      this.writtenAt.set(fileName, this.clock().getTime(),);
    }

    if (firstTemplateFile === null) {
      this.error(
        `No ${this.sheetType} sheet templates found in ${this.templateDir}`,
      );
    }
    await this.enableSignatureForReporting(firstTemplateFile,);
  }

  /**
   * Envia um email por recurso com o `.smx` em anexo (Ruby
   * `sendReportTemplates`, l.181-199).
   */
  protected async sendReportTemplates(
    resources: SheetResourceInfo[],
  ): Promise<void> {
    const store = this.requireFileStore("sendReportTemplates",);

    for (const resource of resources) {
      const attachment = await this.findSheetFile(
        this.templateDir,
        `${resource.id}_${this.date}`,
      ) ?? `${this.templateDir}/${resource.id}_${this.date}` +
          SHEET_EXTENSION;
      if (!(await store.exists(attachment,))) {
        this.error(
          "sendReportTemplates: " +
            `${this.sheetType} sheet ${attachment} for ${resource.name} ` +
            "not found",
        );
      }
      // Não reenvia templates antigos. `timeStamp` tem resolução maior que o
      // mtime; somamos 1s para evitar erro de truncamento (Ruby l.188-193).
      const written = this.writtenAt.get(attachment,);
      if (written === undefined || written + 1000 < this.timeStamp.getTime()) {
        this.info(`Old template ${attachment} found. Not sending it out.`,);
        continue;
      }

      const message = ` Hello ${resource.name}!\n\n${this.introText}` +
        await store.read(attachment,);
      await this.sendEmail(
        resource.email,
        sprintf(this.mailSubject, this.date,),
        message,
        attachment,
      );
    }
  }

  /**
   * Extrai a assinatura do primeiro template e a registra em
   * `signatureFile` (Ruby `enableSignatureForReporting`, l.201-249).
   *
   * O Ruby repetia a leitura 100 vezes com 300ms de espera porque o arquivo era
   * escrito por outro processo; in-process o arquivo já está no `FileStore`.
   */
  protected async enableSignatureForReporting(
    templateFile: string,
  ): Promise<void> {
    const store = this.requireFileStore("enableSignatureForReporting",);

    let signature: string | null = null;
    if (await store.exists(templateFile,)) {
      const content = await store.read(templateFile,);
      for (const line of content.split("\n",)) {
        const match = this.signatureFilter.exec(line,);
        if (match) signature = match[1] ?? null;
      }
    }
    if (signature === null) {
      this.error(
        "enableSignatureForReporting: Cannot find signature in file " +
          templateFile,
      );
    }

    let acceptedSignatures: string[] = [];
    if (await store.exists(this.signatureFile,)) {
      acceptedSignatures = (await store.read(this.signatureFile,))
        .split("\n",)
        .map((line,) => line.replace(/\r$/u, "",))
        .filter((line,) => line !== "");
    } else {
      this.info(`${this.signatureFile} does not exist yet.`,);
    }

    if (!acceptedSignatures.includes(signature,)) {
      // Acrescenta a nova assinatura e reescreve o arquivo.
      this.info(`Adding ${signature} to ${this.signatureFile}`,);
      acceptedSignatures.push(signature,);
      await this.ensureParentDirectory(this.signatureFile,);
      await store.write(
        this.signatureFile,
        acceptedSignatures.map((iv,) => `${iv}\n`).join("",),
      );
    } else {
      this.info(
        `Signature ${signature} is already listed in ${this.signatureFile}`,
      );
    }
  }

  /**
   * Aplica `reportDef` ao projeto e devolve a saída do relatório (Ruby
   * `generateReport`, l.251-271).
   *
   * O Ruby mandava a definição para um `tj3client report prj <id> = .` e lia o
   * stdout. Aqui o mesmo caminho é feito in-process: `parseReportList` (que é o
   * `reportPropertiesFile` do `ReportServer`) + `Project#generateReport`.
   *
   * A assinatura é `Promise` para manter o contrato do pipeline (18.6.20); a
   * geração em si é síncrona, mas falhas viram **rejeições** (nunca `throw`
   * síncrono), para que `await`/`assertRejects` funcionem como no Ruby.
   */
  protected generateReport(
    id: string,
    reportDef: string,
    dynamicAttributes: string | null = null,
  ): Promise<string> {
    try {
      return Promise.resolve(
        this.generateReportOutput(id, reportDef, dynamicAttributes,),
      );
    } catch (error) {
      return Promise.reject(error,);
    }
  }

  /** Corpo síncrono de {@link generateReport}. */
  private generateReportOutput(
    id: string,
    reportDef: string,
    dynamicAttributes: string | null,
  ): string {
    const project = this.project;
    if (project === null) {
      this.error(
        "generateReport: no project attached to the SheetSender " +
          "(use setProject)",
      );
    }

    let output: string | unknown[][] | null = null;
    try {
      // Uma nova definição substitui a anterior (o Ruby sempre falava com um
      // processo novo, então nunca colidia).
      const existing = project.report(id,);
      if (existing) project.reports.removeProperty(existing,);

      const parser = new ProjectFileParser();
      parser.project = project;
      parser.parseReportList(reportDef,);

      project.generateReport(id, false, undefined, dynamicAttributes,);
      output = (project.report(id,) as Report | null)?.output ?? null;
    } catch (error) {
      if (error instanceof TjRuntimeError) throw error;
      this.error(
        `generateReport: Report generation failed: ${errorText(error,)}`,
      );
    }

    if (output === null) {
      this.error(`generateReport: report ${id} produced no output`,);
    }
    // CSV sai como Array-de-Arrays (ADR 027); o resto já é texto.
    return typeof output === "string"
      ? output
      : new CSVFile(output as unknown[][], ";",).to_s();
  }

  /**
   * Resolve um diretório-pai inexistente antes de escrever (o `FileStore` não
   * cria ancestrais em `write`, como `File.open`).
   */
  private async ensureParentDirectory(fileName: string,): Promise<void> {
    const store = this.requireFileStore("ensureParentDirectory",);
    const idx = fileName.lastIndexOf("/",);
    if (idx < 0) return;
    const dir = fileName.slice(0, idx,);
    if (await store.exists(dir,)) return;
    this.warning(`Creating directory ${dir}`,);
    await store.mkdir(dir,);
  }

  /** O `FileStore` injetado ou erro fatal (ADR 037). */
  protected requireFileStore(method: string,): FileStore {
    const store = this.fileStore;
    if (store === null) {
      this.error(`${method}: no FileStore configured (see ADR 037)`,);
    }
    return store;
  }
}
