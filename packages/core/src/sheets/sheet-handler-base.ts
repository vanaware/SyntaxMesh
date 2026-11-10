/**
 * SheetHandlerBase — shared base of the time/status sheet senders and
 * receivers.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/SheetHandlerBase.rb`, adapted to the
 * browser by two ADRs of this phase:
 *  - **ADR 036** — there is no SMTP or mailbox: `sendEmail` **returns** the
 *    message (`EmailMessage`) and `log` lives in memory; `addToScm` is a no-op
 *    (subprocesses do not exist in the browser).
 *  - **ADR 037** — every file access goes through the injected `FileStore`; the
 *    methods that touch it are asynchronous.
 *
 * What stays faithful: `cutOut` (extraction of the marked section, removing the
 * email quote prefixes), the config validations of `setWorkingDir` and the
 * composition of the HTML email body.
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
import { SHEET_EXTENSIONS, } from "./sheet-extensions.ts";

/** How the email would leave the process (inert in the browser — ADR 036). */
export type EmailDeliveryMethod = "smtp" | "sendmail";

/** Sheet kind: defines the noun of the `*sheetreport`/`*sheetreceiver`. */
export type SheetType = "time" | "status";

/**
 * Kind accepted by a `SheetReceiver`: the two inbound sheets plus the `summary`
 * of `TimeSheetSummary` (18.11), which only reads already archived sheets.
 */
export type SheetReceiverType = SheetType | "summary";

/**
 * Row of the resource list — the contract between `SheetSender` (18.6) and
 * `SheetReceiver` (18.7), persisted in `<templateDir>/<date>/resources.json`.
 */
export type SheetResourceInfo = {
  id: string;
  name: string;
  email: string;
  /** Working hours in the period (`effort`). */
  effort: number;
  /** Free hours in the period (`freework`). */
  freeWork: number;
};

/**
 * `sprintf(format, a, b, ...)` — `%s` and `%d` verbs, consumed in order.
 *
 * Extra values are ignored; a verb without a value becomes `""`, as in Ruby.
 */
export function sprintf(
  format: string,
  ...values: (string | number)[]
): string {
  let index = 0;
  return format.replace(/%[sd]/gu, () => String(values[index++] ?? "",),);
}

/** Directory where messages are dropped for the user to download. */
export const OUTBOX_DIR = "outbox";

/** In-memory log entry (Ruby wrote to `@logFile`). */
export interface SheetLogEntry {
  /** ISO 8601 of the moment of the record. */
  timestamp: string;
  /** `INFO` | `WARN` | `ERROR` (the same labels as Ruby). */
  type: string;
  /** Text of the record. */
  message: string;
}

/** Stylesheet embedded in the HTML emails (the bundle has no `tjreport.css`). */
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

/** Splits the text into lines **preserving** the trailing `\n` (≈ `String#each_line`). */
function eachLine(text: string,): string[] {
  return text.split(/(?<=\n)/u,).filter((line,) => line.length > 0);
}

/** Message of an unknown `catch` (Ruby's `$!`). */
function errorText(error: unknown,): string {
  return error instanceof Error ? error.message : String(error,);
}

/**
 * Base of `SheetSender`/`SheetReceiver` (18.6/18.7).
 *
 * Deliberately not abstract: the plan itself instantiates it in the tests
 * (`new SheetHandlerBase("test")`) and it is already functional on its own.
 */
export class SheetHandlerBase {
  /** Name of the app that signs the email (`X-TaskJuggler`) and the log. */
  readonly appName: string;

  // --- User configuration (compatible with `tj3Config`) --------------------
  /** How the email would be delivered (inert in the browser — ADR 036). */
  emailDeliveryMethod: EmailDeliveryMethod = "smtp";
  /** SMTP server host; unused without a transport (ADR 036). */
  smtpServer: string | null = null;
  /** Address used in the `From` header of every email. */
  senderEmail: string | null = null;
  /** Working directory of the app (`-d/--directory`). */
  workingDir: string | null = null;
  /** SCM command of the Ruby version; inert in the browser (ADR 036). */
  scmCommand: string | null = null;
  /** Project id used by the command-line apps. */
  projectId = "prj";

  // --- Verbosity -----------------------------------------------------------
  /** 0 (nothing) ... 3 (everything) for the terminal output. */
  outputLevel = 2;
  /** 0 (nothing) ... 3 (everything) for the log. */
  logLevel = 3;
  /** Writes no `outbox/`: only returns the message (and logs it). */
  dryRun = false;
  /** Log name in Ruby; here it is just a label (there is no file — ADR 036). */
  logFile = "timesheets.log";
  /** `true` after the first email processing/delivery failure. */
  emailFailure = false;

  /** Injectable clock: keeps `Date` and the `.eml` file name deterministic. */
  clock: () => Date = () => new Date();

  /** In-memory log — Ruby wrote to `@logFile` (ADR 036 §4.7). */
  readonly logEntries: SheetLogEntry[] = [];

  /**
   * Every message passed to {@link sendEmail}, in emission order.
   *
   * Ruby delivered over SMTP and kept no copy; without a transport (ADR 036)
   * the message is **data**, and the Phase 18.18 apps return it from here.
   */
  readonly sentMessages: EmailMessage[] = [];

  /** Injected file system (ADR 037); `null` until `setFileStore`. */
  protected fileStore: FileStore | null = null;

  /** Avoids repeating the `no_filestore` warning for every message. */
  private warnedNoFileStore = false;

  /**
   * Creates the handler.
   *
   * @param appName Name that signs the email (`X-TaskJuggler`) and the log.
   */
  constructor(appName: string,) {
    this.appName = appName;
  }

  /**
   * Injects the `FileStore` (ADR 037).
   *
   * @param fileStore File system used by the handler.
   */
  setFileStore(fileStore: FileStore,): void {
    this.fileStore = fileStore;
  }

  /**
   * Returns the injected `FileStore`.
   *
   * @returns The file system, or `null` when none was injected.
   */
  getFileStore(): FileStore | null {
    return this.fileStore;
  }

  /**
   * First existing sheet file for `dir`/`base`, native before legacy (`.smx`,
   * then `.tji`).
   *
   * Decision 2026-11-07 (24.2.36): SyntaxMesh writes `.smx`, but folders and
   * templates generated by TaskJuggler remain valid — reading accepts both
   * forms and returns the name that exists (or `null`).
   *
   * @param dir Directory that holds the sheet.
   * @param base Base file name, without extension.
   * @returns The existing file name, or `null` when none exists.
   */
  protected async findSheetFile(
    dir: string,
    base: string,
  ): Promise<string | null> {
    const store = this.fileStore;
    if (!store) return null;
    for (const ext of SHEET_EXTENSIONS) {
      const candidate = `${dir}/${base}${ext}`;
      if (await store.exists(candidate,)) return candidate;
    }
    return null;
  }

  /**
   * Extracts the text between the `# --------8<--------` markers and removes the
   * quote prefixes (`> `) from every line (Ruby `cutOut`, l.63-98).
   *
   * Without markers the original text is returned — the email may have been sent
   * with the whole sheet in the body, without delimiters.
   *
   * @param text Email body to scan.
   * @returns The section between the markers, dedented.
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
        // Special case of quoted empty lines without a trailing space.
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
   * Validates the email configuration and prepares the working directory.
   *
   * Deliberate divergence from Ruby (ADR 036): `smtp` without `smtpServer`
   * **warns** instead of aborting — the email transport does not exist in the
   * browser, so the setting is inert; `senderEmail` stays mandatory because it
   * composes the `From` header.
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
   * Ruby `addToScm` (l.100-122) — it ran `@scmCommand` with `%m`/`%f`
   * substituted. Subprocesses do not exist in the browser (ADR 036): without a
   * command it is a no-op; with a command set it warns and **runs nothing**.
   *
   * @param message Commit message that would be used.
   * @param fileName File that would be committed.
   */
  addToScm(message: string, fileName: string,): void {
    if (this.scmCommand === null) return;
    this.warning(
      "scm_not_supported_in_browser: " +
        `cannot run '${this.scmCommand}' for ${fileName} (${message})`,
    );
  }

  /**
   * Informational message (Ruby `info`, l.124-127).
   *
   * @param message Text to report.
   */
  info(message: string,): void {
    if (this.outputLevel >= 3) {
      MessageHandlerInstance.instance.info("sheet_info", message,);
    }
    if (this.logLevel >= 3) this.log("INFO", message,);
  }

  /**
   * Warning (Ruby `warning`, l.129-132).
   *
   * @param message Text to report.
   */
  warning(message: string,): void {
    if (this.outputLevel >= 2) {
      MessageHandlerInstance.instance.warning("sheet_warning", message,);
    }
    if (this.logLevel >= 2) this.log("WARN", message,);
  }

  /**
   * Fatal error (Ruby `error`, l.134-138): records, logs and **throws**
   * `TjRuntimeError` — Ruby did the same, with no tolerance for errors.
   *
   * @param message Text to report.
   * @throws TjRuntimeError Always.
   */
  error(message: string,): never {
    if (this.outputLevel >= 1) {
      MessageHandlerInstance.instance.error("sheet_error", message,);
    }
    if (this.logLevel >= 1) this.log("ERROR", message,);
    throw new TjRuntimeError(message,);
  }

  /**
   * Appends to the in-memory log (Ruby `log`, l.140-146, wrote to `@logFile`).
   *
   * No disk, no `console.log`: the UI/CLI reads `logEntries` when it wants to.
   *
   * @param type Level label (`INFO`, `WARN`, `ERROR`).
   * @param message Text to record.
   */
  log(type: string, message: string,): void {
    this.logEntries.push({
      timestamp: this.clock().toISOString(),
      type,
      message,
    },);
  }

  /**
   * Same as {@link sendEmail}, but interprets `message` as RichText markup and
   * also generates the `text/html` part (Ruby `sendRichTextEmail`, l.148-166).
   *
   * @param to Recipient address.
   * @param subject Subject of the email.
   * @param message RichText markup of the body.
   * @param attachment Optional attachment, as a path or in-memory content.
   * @param from Sender address, defaulting to `senderEmail`.
   * @param inReplyTo `Message-ID` this email replies to, when any.
   * @returns The generated message.
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
   * Builds the message and delivers it to the user (Ruby `sendEmail`,
   * l.168-241).
   *
   * `dryRun` writes nothing; outside it, with a `FileStore`, the message is
   * dropped into `outbox/<to>_<YYYY-MM-DD>.eml` for download (ADR 036). Without
   * a `FileStore` it warns once and returns the message in memory.
   *
   * @param to Recipient address.
   * @param subject Subject of the email.
   * @param message Plain text or intermediate RichText of the body.
   * @param attachment Optional attachment, as a path or in-memory content.
   * @param from Sender address, defaulting to `senderEmail`.
   * @param inReplyTo `Message-ID` this email replies to, when any.
   * @returns The generated message.
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
    // The copy is kept even under `dryRun`: it is what the app returns to the
    // caller.
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
   * HTML body of the email: a complete document with the embedded stylesheet
   * (Ruby `htmlMailBody`, l.243-268 — there the CSS came from
   * `data/css/tjreport.css`).
   *
   * @param message Intermediate RichText to render.
   * @returns The full HTML document as a string.
   */
  htmlMailBody(message: RichTextIntermediate,): string {
    const doc = new HTMLDocument();
    // Ruby interpolates `@name`, which is never set in this class (output
    // "TaskJuggler Report - "); here `appName` is used, which is what is
    // expected.
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

  /**
   * Warning for a missing `FileStore`, emitted once per handler.
   */
  private warnNoFileStore(): void {
    if (this.warnedNoFileStore) return;
    this.warnedNoFileStore = true;
    this.warning(
      "no_filestore: cannot persist the email (injected FileStore is null)",
    );
  }

  /**
   * Materialises the attachment: a path (`string`, read from the `FileStore` —
   * faithful to Ruby) or content already in memory.
   *
   * @param attachment Path or content of the attachment.
   * @returns The resolved attachment, or `null` when it cannot be read.
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
