/**
 * SheetHandlerBase — base comum de senders e receivers de time/status sheets.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/SheetHandlerBase.rb`, adaptado ao
 * browser por dois ADRs desta fase:
 *  - **ADR 036** — não há SMTP nem mailbox: `sendEmail` **devolve** a mensagem
 *    (`EmailMessage`) e `log` vive em memória; `addToScm` é no-op (subprocesso
 *    não existe no browser).
 *  - **ADR 037** — todo acesso a arquivo passa pelo `FileStore` injetado; os
 *    métodos que o tocam são assíncronos.
 *
 * O que permanece fiel: `cutOut` (extração de seção marcada, com remoção de
 * quotes de email), as validações de configuração de `setWorkingDir` e a
 * composição do corpo HTML do email.
 *
 * @see docs/taskjuggler/lib/taskjuggler/SheetHandlerBase.rb
 * @see docs/syntaxmesh/decisoes/036-sheets-sem-smtp.md
 * @see docs/syntaxmesh/decisoes/037-filestore-injection.md
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.5)
 */

import { AppConfig, } from "../app-config.ts";
import { HTMLDocument, } from "../html/html-document.ts";
import type { FileStore, } from "../interfaces/file-store.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { TjRuntimeError, } from "../model/errors.ts";
import { RichText, } from "../richtext/rich-text.ts";
import { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import { XMLBlob, XMLElement, } from "../xml/xml-element.ts";
import {
  baseName,
  type EmailAttachment,
  type EmailAttachmentInput,
  type EmailMessage,
  formatEmailMessage,
  isoDate,
  rfc2822Date,
  toBase64,
} from "./email-message.ts";

/** Como o email sairia do processo (inerte no browser — ADR 036). */
export type EmailDeliveryMethod = "smtp" | "sendmail";

/** Tipo de sheet: define o substantivo dos `*sheetreport`/`*sheetreceiver`. */
export type SheetType = "time" | "status";

/**
 * Tipo aceito por um `SheetReceiver`: os dois sheets de entrada mais o
 * `summary` do `TimeSheetSummary` (18.11), que só lê folhas já arquivadas.
 */
export type SheetReceiverType = SheetType | "summary";

/**
 * Linha da lista de recursos — contrato entre `SheetSender` (18.6) e
 * `SheetReceiver` (18.7), persistido em `<templateDir>/<date>/resources.json`.
 */
export type SheetResourceInfo = {
  id: string;
  name: string;
  email: string;
  /** Horas de trabalho no período (`effort`). */
  effort: number;
  /** Horas livres no período (`freework`). */
  freeWork: number;
};

/**
 * `sprintf(format, a, b, …)` — verbos `%s` e `%d`, consumidos em ordem.
 *
 * Valores sobrando são ignorados; um verbo sem valor vira `""`, como no Ruby.
 */
export function sprintf(
  format: string,
  ...values: (string | number)[]
): string {
  let index = 0;
  return format.replace(/%[sd]/gu, () => String(values[index++] ?? "",),);
}

/** Diretório onde as mensagens são depositadas para o usuário baixar. */
export const OUTBOX_DIR = "outbox";

/** Entrada do log em memória (o Ruby escrevia em `@logFile`). */
export interface SheetLogEntry {
  /** ISO 8601 do momento do registro. */
  timestamp: string;
  /** `INFO` | `WARN` | `ERROR` (mesmos rótulos do Ruby). */
  type: string;
  message: string;
}

/** Folha de estilo embutida nos emails HTML (o bundle não traz `tjreport.css`). */
const MAIL_CSS =
  `body { font-family: Helvetica, Arial, sans-serif; font-size: 12px;
       color: #1a1a1a; margin: 1em 2em; }
h1, h2, h3 { font-family: Helvetica, Arial, sans-serif; color: #263238; }
h1 { font-size: 18px; } h2 { font-size: 15px; } h3 { font-size: 13px; }
table { border-collapse: collapse; }
th, td { border: 1px solid #b0bec5; padding: 2px 6px; text-align: left; }
th { background-color: #eceff1; }
pre, tt { font-family: "Courier New", monospace; font-size: 12px; }
.err { color: #9f0000; }
`;

/** Divide o texto em linhas **preservando** o `\n` final (≈ `String#each_line`). */
function eachLine(text: string,): string[] {
  return text.split(/(?<=\n)/u,).filter((line,) => line.length > 0);
}

/** Mensagem de um `catch` desconhecido (`$!` do Ruby). */
function errorText(error: unknown,): string {
  return error instanceof Error ? error.message : String(error,);
}

/**
 * Base de `SheetSender`/`SheetReceiver` (18.6/18.7).
 *
 * Não é abstrata de propósito: o próprio plano a instancia nos testes
 * (`new SheetHandlerBase("test")`), e ela já é funcional sozinha.
 */
export class SheetHandlerBase {
  /** Nome do app que assina o email (`X-TaskJuggler`) e o log. */
  readonly appName: string;

  // --- Configuração do usuário (compatibilidade com o `tj3Config`) ---------
  emailDeliveryMethod: EmailDeliveryMethod = "smtp";
  smtpServer: string | null = null;
  senderEmail: string | null = null;
  workingDir: string | null = null;
  scmCommand: string | null = null;
  /** Id do projeto usado pelos apps de linha de comando. */
  projectId = "prj";

  // --- Verbosidade ---------------------------------------------------------
  /** 0 (nada) … 3 (tudo) para a saída de terminal. */
  outputLevel = 2;
  /** 0 (nada) … 3 (tudo) para o log. */
  logLevel = 3;
  /** Não grava `outbox/`: só devolve a mensagem (e a loga). */
  dryRun = false;
  /** Nome do log no Ruby; aqui é só rótulo (não há arquivo — ADR 036). */
  logFile = "timesheets.log";
  /** true após a primeira falha de processamento/entrega de email. */
  emailFailure = false;

  /** Relógio injetável: mantém `Date` e o nome do `.eml` determinísticos. */
  clock: () => Date = () => new Date();

  /** Log em memória — o Ruby escrevia em `@logFile` (ADR 036 §4.7). */
  readonly logEntries: SheetLogEntry[] = [];

  /**
   * Toda mensagem passada a {@link sendEmail}, na ordem de emissão.
   *
   * O Ruby entregava por SMTP e não guardava cópia; sem transporte (ADR 036)
   * a mensagem é **dado**, e os apps da 18.18 a devolvem por aqui.
   */
  readonly sentMessages: EmailMessage[] = [];

  /** Sistema de arquivos injetado (ADR 037); `null` até `setFileStore`. */
  protected fileStore: FileStore | null = null;

  /** Evita repetir o aviso `no_filestore` a cada mensagem. */
  private warnedNoFileStore = false;

  constructor(appName: string,) {
    this.appName = appName;
  }

  /** Injeta o `FileStore` (ADR 037) — encadeável não é necessário aqui. */
  setFileStore(fileStore: FileStore,): void {
    this.fileStore = fileStore;
  }

  /** O `FileStore` injetado, ou `null`. */
  getFileStore(): FileStore | null {
    return this.fileStore;
  }

  /**
   * Extrai o texto entre os marcadores `# --------8<--------` e remove os
   * prefixos de quote (`> `) de cada linha (Ruby `cutOut`, l.63-98).
   *
   * Sem marcadores devolve o texto original — o email pode ter sido enviado
   * com o sheet inteiro no corpo, sem delimitadores.
   */
  cutOut(text: string,): string {
    const mark1 = /(.*)# --------8<--------8<--------/u;
    const mark2 = /# -------->8-------->8--------/u;
    let cutOutText: string | null = null;
    let quoteLen = 0;
    let quoteMarks = "";
    let emptyLine = "";

    for (const line of eachLine(text,)) {
      if (cutOutText === null) {
        const match = mark1.exec(line,);
        if (!match) continue;
        quoteMarks = match[1] ?? "";
        quoteLen = quoteMarks.length;
        // Caso especial das linhas vazias citadas sem espaço à direita.
        emptyLine = quoteMarks.replace(/\n$/u, "",).replace(/ $/u, "",) + "\n";
        cutOutText = line.slice(quoteLen,);
        continue;
      }

      let current = line;
      if (current.slice(0, quoteLen,) === quoteMarks) {
        current = current.slice(quoteLen,);
      }
      if (current === emptyLine) current = "\n";
      cutOutText += current;
      if (mark2.test(current,)) return cutOutText;
    }

    return cutOutText ?? text;
  }

  /**
   * Valida a configuração de email e prepara o diretório de trabalho.
   *
   * Divergência deliberada do Ruby (ADR 036): `smtp` sem `smtpServer` **avisa**
   * em vez de abortar — o transporte de email não existe no browser, então a
   * configuração é inerte; `senderEmail` continua obrigatório porque compõe o
   * cabeçalho `From`.
   */
  async setWorkingDir(): Promise<void> {
    if (this.emailDeliveryMethod === "smtp") {
      if (!this.smtpServer) this.warning("'smtpServer' not configured",);
    } else if (this.emailDeliveryMethod !== "sendmail") {
      this.error(
        `Unknown emailDeliveryMethod ${String(this.emailDeliveryMethod,)}`,
      );
    }
    if (!this.senderEmail) this.error("'senderEmail' not configured",);

    if (!this.workingDir) return;
    const store = this.fileStore;
    if (!store) {
      this.warnNoFileStore();
      return;
    }
    try {
      await store.mkdir(this.workingDir,);
    } catch {
      this.error(`Working directory ${this.workingDir} not found`,);
    }
  }

  /**
   * Ruby `addToScm` (l.100-122) — rodava `@scmCommand` com `%m`/`%f`
   * substituídos. Subprocesso não existe no browser (ADR 036): sem comando é
   * no-op; com comando definido, avisa e **não executa nada**.
   */
  addToScm(message: string, fileName: string,): void {
    if (this.scmCommand === null) return;
    this.warning(
      "scm_not_supported_in_browser: " +
        `cannot run '${this.scmCommand}' for ${fileName} (${message})`,
    );
  }

  /** Mensagem informativa (Ruby `info`, l.124-127). */
  info(message: string,): void {
    if (this.outputLevel >= 3) {
      MessageHandlerInstance.instance.info("sheet_info", message,);
    }
    if (this.logLevel >= 3) this.log("INFO", message,);
  }

  /** Aviso (Ruby `warning`, l.129-132). */
  warning(message: string,): void {
    if (this.outputLevel >= 2) {
      MessageHandlerInstance.instance.warning("sheet_warning", message,);
    }
    if (this.logLevel >= 2) this.log("WARN", message,);
  }

  /**
   * Erro fatal (Ruby `error`, l.134-138): registra, loga e **levanta**
   * `TjRuntimeError` — o Ruby fazia o mesmo, sem tolerância a erro.
   */
  error(message: string,): never {
    if (this.outputLevel >= 1) {
      MessageHandlerInstance.instance.error("sheet_error", message,);
    }
    if (this.logLevel >= 1) this.log("ERROR", message,);
    throw new TjRuntimeError(message,);
  }

  /**
   * Registra no log em memória (Ruby `log`, l.140-146, escrevia em `@logFile`).
   *
   * Sem disco, sem `console.log`: a UI/CLI lê `logEntries` quando quiser.
   */
  log(type: string, message: string,): void {
    this.logEntries.push({
      timestamp: this.clock().toISOString(),
      type,
      message,
    },);
  }

  /**
   * Igual a {@link sendEmail}, mas interpreta `message` como markup RichText e
   * gera também a parte `text/html` (Ruby `sendRichTextEmail`, l.148-166).
   */
  async sendRichTextEmail(
    to: string,
    subject: string,
    message: string,
    attachment: EmailAttachmentInput = null,
    from: string | null = null,
    inReplyTo: string | null = null,
  ): Promise<EmailMessage> {
    const richText = new RichText(message,).generateIntermediateFormat();
    if (!richText) {
      this.error(`Cannot parse email body as RichText: ${message}`,);
    }
    richText.lineWidth = 72;
    richText.indent = 2;
    richText.titleIndent = 0;
    richText.listIndent = 2;
    richText.parIndent = 2;
    richText.preIndent = 4;
    richText.sectionNumbers = false;

    return await this.sendEmail(
      to,
      subject,
      richText,
      attachment,
      from,
      inReplyTo,
    );
  }

  /**
   * Monta a mensagem e a entrega ao usuário (Ruby `sendEmail`, l.168-241).
   *
   * `dryRun` não grava nada; fora dele, com `FileStore`, a mensagem é
   * depositada em `outbox/<to>_<YYYY-MM-DD>.eml` para download (ADR 036).
   * Sem `FileStore`, avisa uma única vez e devolve a mensagem em memória.
   */
  async sendEmail(
    to: string,
    subject: string,
    message: string | RichTextIntermediate,
    attachment: EmailAttachmentInput = null,
    from: string | null = null,
    inReplyTo: string | null = null,
  ): Promise<EmailMessage> {
    if (!this.dryRun && !this.fileStore) this.warnNoFileStore();

    const isRich = message instanceof RichTextIntermediate;
    const attached = await this.resolveAttachment(attachment,);
    const partial: Omit<EmailMessage, "raw"> = {
      to,
      from: from ?? this.senderEmail ?? "",
      subject,
      date: rfc2822Date(this.clock(),),
      text: isRich ? message.to_s() : message,
      html: isRich ? this.htmlMailBody(message,) : null,
      attachmentName: attached ? attached.name : null,
      attachment: attached ? attached.content : null,
      attachmentBase64: attached ? toBase64(attached.content,) : null,
      inReplyTo,
      appName: this.appName,
    };
    const email: EmailMessage = {
      ...partial,
      raw: formatEmailMessage(partial,),
    };
    // A cópia fica retida mesmo em `dryRun`: é o que o app devolve ao chamador.
    this.sentMessages.push(email,);

    if (this.dryRun) {
      this.log("INFO", `Show email '${subject}' to ${to}`,);
      return email;
    }

    const store = this.fileStore;
    if (!store) return email;

    const fileName = `${OUTBOX_DIR}/${
      to.replace(/[^A-Za-z0-9._@+-]/gu, "_",)
    }_${isoDate(this.clock(),)}.eml`;
    try {
      await store.mkdir(OUTBOX_DIR,);
      await store.write(fileName, email.raw,);
    } catch (error) {
      this.emailFailure = true;
      this.error(`Email processing failed: ${errorText(error,)}`,);
    }
    this.log("INFO", `Wrote email '${subject}' to ${fileName}`,);
    return email;
  }

  /**
   * Corpo HTML do email: documento completo com a folha de estilo embutida
   * (Ruby `htmlMailBody`, l.243-268 — lá a CSS vinha de `data/css/tjreport.css`).
   */
  htmlMailBody(message: RichTextIntermediate,): string {
    const doc = new HTMLDocument();
    // O Ruby interpola `@name`, que nunca é definido nesta classe (saída
    // "TaskJuggler Report - "); aqui usamos o `appName`, que é o que se espera.
    const html = doc.generateHead(
      `${AppConfig.softwareName} Report - ${this.appName}`,
      {
        description: "TaskJuggler Report",
        keywords: "taskjuggler, project, management",
      },
    );
    html.append(
      new XMLElement("meta", {
        "http-equiv": "Content-Style-Type",
        content: "text/css; charset=utf-8",
      },),
    );
    const style = new XMLElement("style", { type: "text/css", },);
    style.append(new XMLBlob(`\n${MAIL_CSS}`,),);
    html.append(style,);

    const body = new XMLElement("body", {},);
    html.append(body,);
    const tree = message.to_html();
    if (tree !== null) body.append(tree as XMLElement,);

    return doc.to_s();
  }

  /** Aviso de `FileStore` ausente, emitido uma vez por handler. */
  private warnNoFileStore(): void {
    if (this.warnedNoFileStore) return;
    this.warnedNoFileStore = true;
    this.warning(
      "no_filestore: cannot persist the email (injected FileStore is null)",
    );
  }

  /**
   * Materializa o anexo: caminho (`string`, lido do `FileStore` — fidelidade ao
   * Ruby) ou conteúdo já em memória.
   */
  private async resolveAttachment(
    attachment: EmailAttachmentInput,
  ): Promise<EmailAttachment | null> {
    if (attachment === null) return null;
    if (typeof attachment !== "string") return attachment;

    const store = this.fileStore;
    if (!store) {
      this.warning(`Cannot attach '${attachment}': no FileStore`,);
      return null;
    }
    try {
      return {
        name: baseName(attachment,),
        content: await store.read(attachment,),
      };
    } catch {
      this.warning(`Attachment '${attachment}' not found`,);
      return null;
    }
  }
}
