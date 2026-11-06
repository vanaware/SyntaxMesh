/**
 * SheetReceiver — recebe, valida e arquiva time/status sheets.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/SheetReceiver.rb`, com as mesmas
 * duas adaptações da Fase 18:
 *  - **ADR 036** — não há mailbox nem `tj3client`: o texto RFC 822 chega como
 *    `string` (o app da 18.18 lê de arquivo/stdin) e a validação roda
 *    in-process (`ProjectFileParser` + `Project#checkTimeSheets`).
 *  - **ADR 037** — todo I/O passa pelo `FileStore` injetado; o fluxo é
 *    `async`.
 *
 * Fluxo do Ruby preservado: `processEmail` → `createDirectories` →
 * `processSheet` (anexos `.tji`, depois o corpo) → `checkSignature` →
 * `checkSheet` → `fileSheet` (arquiva + `all.tji` + email de confirmação).
 *
 * Divergências deliberadas (todas documentadas no método):
 *  - `Digest::MD5` não existe no Deno: {@link emailDigest} gera 32 caracteres
 *    hexadecimais determinísticos — é só nome de arquivo, não segurança.
 *  - `@report` do Ruby é o stdout do tj3client (folha "pretty printed"); aqui
 *    é a própria folha aceita.
 *  - `error`/`fatal` do Ruby mandam email (síncrono) antes de levantar; como
 *    `sendEmail` é `async`, a resposta é enfileirada e entregue no `finally`
 *    de `processEmail`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/SheetReceiver.rb
 * @see docs/taskjuggler/lib/taskjuggler/TimeSheetReceiver.rb
 * @see docs/syntaxmesh/decisoes/036-sheets-sem-smtp.md
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.7)
 */

import type { FileStore, } from "../interfaces/file-store.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { TjRuntimeError, } from "../model/errors.ts";
import type { Project, } from "../model/project.ts";
import { ProjectFileParser, } from "../parser/project-file-parser.ts";
import {
  baseName,
  type ParsedEmailMessage,
  parseEmailMessage,
} from "./email-message.ts";
import {
  SheetHandlerBase,
  type SheetReceiverType,
  type SheetResourceInfo,
  sprintf,
} from "./sheet-handler-base.ts";

/** Extensão que identifica um sheet anexado (Ruby `attachment.filename[-4..]`). */
export const SHEET_EXTENSION = ".tji";

/** Nome do arquivo de inclusão gerado em cada pasta de folhas. */
export const INCLUSION_FILE = "all.tji";

/** Lista de recursos gravada pelo `SheetSender` (18.6). */
export const RESOURCE_LIST_FILE = "resources.json";

/**
 * Corpo do email de falha de infraestrutura (Ruby `fatal`, l.352-357) — é o
 * mesmo texto para time e status sheets.
 */
const TEMP_SERVER_ERROR =
  `We are sorry! The ${"%s"} sheet server detected a configuration
problem and is temporarily out of service. The administrator
has been notified and will try to rectify the situation as
soon as possible. Please re-submit your ${"%s"} sheet later!
`;

/** Mensagem de um `catch` desconhecido (`$!` do Ruby). */
function errorText(error: unknown,): string {
  return error instanceof Error ? error.message : String(error,);
}

/**
 * Extrai o `From:` cru de uma mensagem que o parser não conseguiu ler — sem
 * isso não haveria como responder ao remetente (Ruby l.94-107).
 */
function firstFromHeader(raw: string,): string | null {
  const match = /^From:[ \t]*(.*)$/mu.exec(raw,);
  const value = match?.[1]?.trim() ?? "";
  return value === "" ? null : value;
}

/**
 * Identificador de 32 caracteres hexadecimais para a mensagem recebida.
 *
 * O Ruby usa `Digest::MD5.hexdigest(messageId)` (l.115). O Deno não traz MD5
 * (`crypto.subtle` não o suporta) e o valor serve **apenas** de nome de arquivo
 * em `failedMailsDir`, então quatro acumuladores FNV-1a de 32 bits dão o mesmo
 * formato de 128 bits sem depender de criptografia.
 */
export function emailDigest(text: string,): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  let h3 = 0x9e3779b9;
  let h4 = 0x85ebca6b;
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i,);
    h1 = Math.imul(h1 ^ char, 0x01000193,);
    h2 = Math.imul(h2 ^ (char + i), 0x85ebca6b,);
    h3 = Math.imul(h3 ^ (char << 3), 0xc2b2ae35,);
    h4 = Math.imul(h4 ^ (char >>> 2), 0x27d4eb2f,);
  }
  return [h1, h2, h3, h4,]
    .map((value,) => (value >>> 0).toString(16,).padStart(8, "0",))
    .join("",);
}

/**
 * Base dos receivers de sheet (18.7).
 *
 * Subclasses (`TimeSheetReceiver`, `StatusSheetReceiver` — 18.9/18.10) só
 * definem `tj3clientOption`, `sheetDir`, `templateDir`, `failedMailsDir`,
 * `failedSheetsDir`, `signatureFile`, `emailSubject`, `sheetHeader` e
 * `signatureFilter`.
 *
 * Os helpers são `protected` (e não `private` como no Ruby) para que
 * subclasses e testes possam chamá-los sem `send`.
 */
export class SheetReceiver extends SheetHandlerBase {
  /** `'time'`, `'status'` ou `'summary'` — entra nas mensagens e escolhe a regra. */
  protected readonly sheetType: SheetReceiverType;

  /**
   * Opção equivalente do `tj3client` (`check-ts`/`check-ss`).
   *
   * Puramente documental aqui: a checagem roda in-process, mas manter o campo
   * preserva o contrato das subclasses e o log de diagnóstico.
   */
  protected tj3clientOption = "";

  /** Diretório base das folhas aceitas (`TimeSheets`). */
  protected sheetDir = "";
  /** Diretório dos templates do sender (`TimeSheetTemplates`). */
  protected templateDir = "";
  /** Mensagens cruas não processadas (para reprocessar depois). */
  protected failedMailsDir = "";
  /** Cópias das folhas que falharam na checagem. */
  protected failedSheetsDir = "";
  /** Arquivo com os intervalos aceitos (`acceptable_intervals`). */
  protected signatureFile = "";
  /** Assunto do email de confirmação (`%s` = recurso, `%s` = data). */
  protected emailSubject = "";

  /** Identifica o cabeçalho de um sheet válido; grupo 1 = recurso, 2 = data. */
  protected sheetHeader: RegExp = /^$/u;
  /** Extrai a assinatura (intervalo) do cabeçalho; grupo 1 = intervalo. */
  protected signatureFilter: RegExp = /^$/u;

  /** Endereço que receberá as respostas (o do cadastro, após `processSheet`). */
  protected submitter: string | null = null;
  /** Recurso que enviou a folha. */
  protected resourceId: string | null = null;
  /**
   * Fim do período reportado (`YYYY-MM-DD`).
   *
   * Público porque o `TimeSheetSummary` (18.11) o recebe do app — no Ruby a
   * classe do resumo declara `attr_accessor :date`.
   */
  date: string | null = null;
  /** Texto da folha já recortado por `cutOut`. */
  protected sheet: string | null = null;
  /** `false` quando a folha veio no corpo do email. */
  protected sheetWasAttached = true;
  /** `Message-ID` da mensagem (ou `"unknown"`). */
  protected messageId: string | null = null;
  /** Resumo aceito da folha (Ruby: stdout do tj3client, já em RichText). */
  protected report: string | null = null;
  /** Avisos emitidos na checagem (Ruby: stderr do tj3client). */
  protected warnings: string | null = null;
  /** Nome do arquivo da mensagem em `failedMailsDir`. */
  protected idDigest = "";

  /** Projeto alvo da checagem (o `tj3client check-*` do Ruby). */
  project: Project | null = null;

  /** Cache de `resources.json` — refeito quando `date` muda. */
  private resourceList: SheetResourceInfo[] | null = null;
  /** Data a que `resourceList` se refere. */
  private resourceListDate: string | null = null;
  /** Respostas pendentes (`error`/`fatal` não podem `await`). */
  private pendingReplies: Promise<void>[] = [];
  /** Evita que uma falha ao enviar a resposta enfileire outra resposta. */
  private replyInFlight = false;

  constructor(appName: string, type: SheetReceiverType,) {
    super(appName,);
    this.sheetType = type;
  }

  /** Injeta o projeto usado para validar as folhas. */
  setProject(project: Project,): void {
    this.project = project;
  }

  /**
   * Processa uma mensagem completa (RFC 822).
   *
   * Procura primeiro anexos `.tji` e, se nenhum servir, o corpo. A mensagem
   * crua é guardada em `failedMailsDir` até ser aceita — é o que permite
   * reprocessar uma submissão recusada (Ruby l.119-122).
   *
   * @param rawMail mensagem completa (cabeçalhos + corpo).
   * @returns `true` se a folha foi aceita; erro em qualquer outro desfecho.
   */
  async processEmail(rawMail: string,): Promise<boolean> {
    try {
      await this.setWorkingDir();
      await this.createDirectories();

      let mail: ParsedEmailMessage;
      try {
        mail = parseEmailMessage(rawMail,);
      } catch (error) {
        // Sem a mensagem parseada, resta achar o `From:` na mão para ao menos
        // avisar o remetente (Ruby l.90-108).
        this.submitter = firstFromHeader(rawMail,);
        this.error(
          `Incoming mail could not be processed: ${errorText(error,)}`,
        );
      }

      this.submitter = mail.from === "" ? null : mail.from;
      this.messageId = mail.messageId ?? "unknown";
      this.idDigest = emailDigest(this.messageId,);
      this.info(
        `Processing ${this.sheetType} mail from ${this.submitter ?? ""} ` +
          `with ID ${this.messageId} (${this.idDigest})`,
      );

      const store = this.requireFileStore("processEmail",);
      const mailFile = `${this.failedMailsDir}/${this.idDigest}`;
      await store.write(mailFile, rawMail,);

      // Primeiro os anexos...
      for (const attachment of mail.attachments) {
        if (!(attachment.fileName ?? "").endsWith(SHEET_EXTENSION,)) continue;
        this.sheetWasAttached = true;
        if (await this.processSheet(attachment.content,)) return true;
      }

      // ...e só depois o corpo.
      this.sheetWasAttached = false;
      if (await this.processSheet(mail.content,)) return true;

      this.error(
        `No ${this.sheetType} sheet found in email. Please make sure the ` +
          "header syntax is\ncorrect and contained in a single line that " +
          "starts at the begining of the\nline. If you had the " +
          `${this.sheetType} sheet attached, the file name must have a\n` +
          "'.tji' extension to be found.",
      );
    } finally {
      // `error`/`fatal` enfileiram a resposta e levantam: entregar aqui é o
      // equivalente ao `sendEmail` síncrono do Ruby.
      await this.flushReplies();
    }
  }

  /**
   * Isola e valida o texto de uma folha candidata (Ruby `processSheet`).
   *
   * @returns `true` quando a folha é aceita e arquivada; `false` quando ela
   *   não tem o cabeçalho esperado (o chamador tenta a próxima origem).
   */
  protected async processSheet(sheet: string,): Promise<boolean> {
    // Com marcadores `8<`, só o trecho entre eles conta.
    this.sheet = this.cutOut(sheet,);

    const match = this.sheetHeader.exec(this.sheet,);
    if (match === null) return false;

    await this.checkSignature(this.sheet,);

    this.resourceId = match[1] ?? null;
    this.date = match[2] ?? null;
    // Respostas só vão para o endereço cadastrado (Ruby l.166-167).
    this.submitter = await this.getResourceEmail(this.resourceId,);
    this.info(
      `Found ${this.sheetWasAttached ? "attached " : ""}sheet for ` +
        `${this.resourceId} dated ${this.date}`,
    );

    if (!(await this.checkSheet(this.sheet,))) return false;

    await this.fileSheet(this.sheet,);
    await this.deleteFailedMail();
    this.info(`Accepted sheet for ${this.resourceId} dated ${this.date}`,);
    return true;
  }

  /**
   * Confere a assinatura da folha contra `acceptable_intervals`
   * (Ruby `checkSignature`, l.290-316).
   */
  protected async checkSignature(sheet: string,): Promise<void> {
    const match = this.signatureFilter.exec(sheet,);
    if (match === null) {
      this.fatal(`No ${this.sheetType}sheet header found`,);
    }
    const interval = match[1] ?? "";

    const store = this.requireFileStore("checkSignature",);
    if (!(await store.exists(this.signatureFile,))) {
      this.error(`${this.signatureFile} does not exist yet.`,);
    }
    const acceptedSignatures = (await store.read(this.signatureFile,))
      .split("\n",)
      .map((line,) => line.replace(/\r$/u, "",))
      .filter((line,) => line !== "");

    if (!acceptedSignatures.includes(interval,)) {
      this.error(
        `The reporting period ${interval}\n` +
          "was not accepted!  Either you have modified the sheet header,\n" +
          "you are submitting the sheet too late or too early.\n",
      );
    }
  }

  /**
   * Valida o conteúdo da folha (Ruby `checkSheet`, l.182-210).
   *
   * O Ruby gravava a folha em `failedSheetsDir` e chamava
   * `tj3client --silent check-ts`; aqui o mesmo `.tji` é aplicado ao projeto
   * in-process e o resultado vem do `MessageHandler` (erros que o processo
   * filho devolveria em stderr e no código de saída).
   */
  protected async checkSheet(sheet: string,): Promise<boolean> {
    const store = this.requireFileStore("checkSheet",);
    const debugFile = `${this.failedSheetsDir}/${this.resourceId}-` +
      `${this.date}${SHEET_EXTENSION}`;
    await store.write(debugFile, sheet,);

    const handler = MessageHandlerInstance.instance;
    const messageCount = handler.messages.length;
    const errorCount = handler.errors;

    try {
      this.applySheet(sheet,);
    } catch (error) {
      this.fatal(`Cannot check ${this.sheetType} sheet: ${errorText(error,)}`,);
    }

    this.warnings = handler.messages
      .slice(messageCount,)
      .filter((message,) => message.type !== "info" && message.type !== "debug")
      .map((message,) => message.to_log())
      .join("\n",);
    // Divergência: o Ruby usava o stdout do tj3client (folha reformatada).
    this.report = sheet;

    if (handler.errors === errorCount) {
      if (await store.exists(debugFile,)) await store.delete(debugFile,);
      return true;
    }

    this.error(
      this.warnings === ""
        ? `Cannot check ${this.sheetType} sheet`
        : this.warnings,
    );
  }

  /**
   * Arquiva a folha aceita em `sheetDir/<date>/<recurso>_<date>.tji`, atualiza
   * o `all.tji` da pasta e responde ao remetente (Ruby `fileSheet`, l.212-267).
   */
  protected async fileSheet(sheet: string,): Promise<void> {
    const store = this.requireFileStore("fileSheet",);
    const date = this.date;
    const resourceId = this.resourceId;
    if (date === null || resourceId === null) {
      this.fatal("fileSheet: resource ID or date not set",);
    }

    const dir = `${this.sheetDir}/${date}`;
    const fileName = `${dir}/${resourceId}_${date}${SHEET_EXTENSION}`;
    let newDir = false;
    try {
      if (!(await store.exists(dir,))) {
        await store.mkdir(dir,);
        this.addToScm("Adding new directory", dir,);
        newDir = true;
      }
      await store.write(fileName, sheet,);
    } catch (error) {
      this.fatal(
        `Cannot store ${this.sheetType} sheet ${fileName}: ` +
          errorText(error,),
      );
    }
    this.addToScm(`Adding/updating ${fileName}`, fileName,);

    await this.generateInclusionFile(dir,);

    if (newDir) {
      // O `all.tji` do topo encadeia as pastas de cada período.
      const allFile = `${this.sheetDir}/${INCLUSION_FILE}`;
      const previous = (await store.exists(allFile,))
        ? await store.read(allFile,)
        : "";
      await store.write(allFile, `${previous}\ninclude '${date}/all.tji' { }`,);
      this.addToScm("Adding new directory to all.tji", allFile,);
    }

    const resourceName = await this.getResourceName(resourceId,);
    let text = `== Report from ${resourceName} for the period ending ` +
      `${date} ==\n\n`;
    if (this.warnings !== null && this.warnings !== "") {
      text += "----\nYour report does contain some issues that you may want " +
        "to fix or address with\nyour manager or project manager:\n\n" +
        `<nowiki>${this.warnings}</nowiki>\n\n----\n`;
    }
    // Divergência: o Ruby anexava o stdout do tj3client, que já vinha em
    // RichText. A folha daqui é TJP cru — vai como texto literal para que os
    // marcadores `-8<-` e as linhas `#` não sejam interpretados como markup.
    if (this.report !== null && this.report !== "") {
      text += `<nowiki>${this.report}</nowiki>`;
    }

    await this.sendRichTextEmail(
      this.submitter ?? "",
      sprintf(this.emailSubject, resourceName, date,),
      text,
      null,
      null,
      this.messageId,
    );
  }

  /**
   * Reescreve `<dir>/all.tji` com um `include` por folha da pasta
   * (Ruby `generateInclusionFile`, l.272-288).
   */
  protected async generateInclusionFile(dir: string,): Promise<void> {
    const store = this.requireFileStore("generateInclusionFile",);
    try {
      const files = (await store.list(dir,))
        .filter((name,) =>
          name.endsWith(SHEET_EXTENSION,) && baseName(name,) !== INCLUSION_FILE
        )
        .sort();
      const content = files
        .map((name,) => `include '${baseName(name,)}' { }\n`)
        .join("",);
      await store.write(`${dir}/${INCLUSION_FILE}`, content,);
    } catch (error) {
      this.error(`Can't create inclusion file: ${errorText(error,)}`,);
    }
    this.addToScm(
      "Adding/updating summary include file.",
      `${dir}/${INCLUSION_FILE}`,
    );
  }

  /** Cria `sheetDir`, `failedMailsDir` e `failedSheetsDir` (Ruby l.318-325). */
  protected async createDirectories(): Promise<void> {
    const store = this.requireFileStore("createDirectories",);
    for (
      const dir of [
        this.sheetDir,
        this.failedMailsDir,
        this.failedSheetsDir,
      ]
    ) {
      if (dir === "") continue;
      if (await store.exists(dir,)) continue;
      this.info(`Creating directory ${dir}`,);
      await store.mkdir(dir,);
    }
  }

  /**
   * Lê `<templateDir>/<date>/resources.json` (Ruby `getResourceList`).
   *
   * O Ruby usava YAML; o sender desta fase grava JSON (18.6).
   */
  protected async getResourceList(): Promise<SheetResourceInfo[]> {
    if (this.date === null) this.fatal("@date not set",);
    if (
      this.resourceList !== null && this.resourceListDate === this.date
    ) {
      return this.resourceList;
    }

    const store = this.requireFileStore("getResourceList",);
    const fileName = `${this.templateDir}/${this.date}/` +
      RESOURCE_LIST_FILE;
    let list: SheetResourceInfo[];
    try {
      list = JSON.parse(await store.read(fileName,),) as SheetResourceInfo[];
    } catch (error) {
      this.error(
        `Cannot read resource file ${fileName}: ${errorText(error,)}`,
      );
    }
    this.resourceList = list;
    this.resourceListDate = this.date;
    this.info(`${list.length} resources loaded`,);
    return list;
  }

  /** Email cadastrado do recurso (Ruby `getResourceEmail`, l.379-386). */
  protected async getResourceEmail(
    id: string | null = this.resourceId,
  ): Promise<string> {
    const list = await this.getResourceList();
    const resource = list.find((item,) => item.id === id);
    if (resource === undefined) {
      this.error(`Resource ID '${id}' not found in list`,);
    }
    return resource.email;
  }

  /** Nome do recurso (Ruby `getResourceName`, l.388-395). */
  protected async getResourceName(
    id: string | null = this.resourceId,
  ): Promise<string> {
    const list = await this.getResourceList();
    const resource = list.find((item,) => item.id === id);
    if (resource === undefined) {
      this.error(`Resource ID '${id}' not found in list`,);
    }
    return resource.name;
  }

  /**
   * Erro de submissão (Ruby `SheetReceiver#error`, l.327-344).
   *
   * Enfileira o "Your <tipo> sheet submission failed!" (anexando a folha
   * quando ela veio no corpo, para o usuário poder reenviá-la), depois delega
   * ao `error` da base — que loga e levanta `TjRuntimeError`.
   */
  override error(message: string,): never {
    let text = message;
    if (this.sheet !== null && !this.sheetWasAttached) {
      text += `\n${this.sheet}`;
    }
    this.queueReply(
      `Your ${this.sheetType} sheet submission failed!`,
      text,
    );
    return super.error(message,);
  }

  /**
   * Falha de configuração (Ruby `SheetReceiver#fatal`, l.346-360).
   *
   * Só o texto fixo vai no email; a mensagem real (com a folha, se houver) vai
   * para o log.
   */
  protected fatal(message: string,): never {
    this.log("FATAL", message,);
    this.queueReply(
      "Temporary server error",
      sprintf(TEMP_SERVER_ERROR, this.sheetType, this.sheetType,),
    );
    throw new TjRuntimeError(message,);
  }

  /**
   * Aplica o `.tji` ao projeto já parseado, como o `tj3client check-*` fazia
   * com um processo novo.
   *
   * O resumo (18.11) usa o mesmo caminho: só o `status` diverge da gramática
   * do time sheet.
   */
  protected applySheet(sheet: string,): unknown {
    const project = this.project;
    if (project === null) {
      this.fatal(
        "checkSheet: no project attached to the SheetReceiver " +
          "(use setProject)",
      );
    }

    const parser = new ProjectFileParser();
    parser.project = project;
    parser.open(sheet, false, true,);
    const parsed = parser.parse(
      this.sheetType === "status" ? "statusSheetFile" : "timeSheetFile",
    );

    // O `check-ts` também valida os totais da folha (Ruby `TimeSheets#check`).
    if (this.sheetType !== "status") project.checkTimeSheets();
    // O `TimeSheet`/`StatusSheet` parseado fica disponível ao chamador — o
    // resumo (18.11/18.17.5) agrega os status de material por esta folha.
    return parsed;
  }

  /** Remove a cópia da mensagem em `failedMailsDir` (Ruby l.175). */
  private async deleteFailedMail(): Promise<void> {
    const store = this.fileStore;
    if (store === null || this.idDigest === "") return;
    const fileName = `${this.failedMailsDir}/${this.idDigest}`;
    if (await store.exists(fileName,)) await store.delete(fileName,);
  }

  /** Enfileira a resposta ao remetente — `error`/`fatal` não podem `await`. */
  private queueReply(subject: string, text: string,): void {
    // Enquanto uma resposta está em voo, não encadeia outra: uma falha do
    // próprio `sendEmail` chamaria `error` de novo, recursivamente.
    if (this.replyInFlight) return;
    const to = this.submitter;
    if (to === null || to === "") {
      this.warning("no submitter address found, cannot send a reply",);
      return;
    }
    this.replyInFlight = true;
    this.pendingReplies.push(
      this.sendEmail(to, subject, text,)
        .then(
          () => undefined,
          (error: unknown,) => {
            this.emailFailure = true;
            this.warning(`Cannot send the reply: ${errorText(error,)}`,);
          },
        )
        .finally(() => {
          this.replyInFlight = false;
        },),
    );
  }

  /** Entrega as respostas enfileiradas por `error`/`fatal`. */
  private async flushReplies(): Promise<void> {
    while (this.pendingReplies.length > 0) {
      const replies = this.pendingReplies.splice(
        0,
        this.pendingReplies.length,
      );
      for (const reply of replies) await reply;
    }
  }

  /** O `FileStore` injetado ou erro fatal (ADR 037). */
  protected requireFileStore(method: string,): FileStore {
    const store = this.fileStore;
    if (store === null) {
      this.fatal(`${method}: no FileStore configured (see ADR 037)`,);
    }
    return store;
  }
}
