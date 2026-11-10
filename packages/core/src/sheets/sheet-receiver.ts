/**
 * SheetReceiver — receives, validates and archives time/status sheets.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/SheetReceiver.rb`, with the same two
 * adaptations as Phase 18:
 *  - **ADR 036** — there is no mailbox and no `tj3client`: the RFC 822 text
 *    arrives as a `string` (the 18.18 app reads it from a file/stdin) and
 *    validation runs in-process (`ProjectFileParser` +
 *    `Project#checkTimeSheets`).
 *  - **ADR 037** — all I/O goes through the injected `FileStore`; the flow is
 *    `async`.
 *
 * Ruby flow preserved: `processEmail` → `createDirectories` → `processSheet`
 * (sheet attachments — `.smx` or the legacy `.tji` — then the body) →
 * `checkSignature` → `checkSheet` → `fileSheet` (archive + `all.smx` +
 * confirmation email).
 *
 * Deliberate divergences (all documented on the method):
 *  - `Digest::MD5` does not exist in Deno: {@link emailDigest} produces 32
 *    deterministic hexadecimal characters — it is only a file name, not
 *    security.
 *  - Ruby's `@report` is the stdout of tj3client (the "pretty printed" sheet);
 *    here it is the accepted sheet itself.
 *  - Ruby's `error`/`fatal` send an email (synchronously) before raising; since
 *    `sendEmail` is `async`, the reply is queued and delivered in the `finally`
 *    of `processEmail`.
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

/**
 * The sheet extensions (native `.smx`, legacy `.tji`) live in
 * `sheet-extensions.ts` — single source shared with the sender and the summary
 * (decision 2026-11-07, plan §1.6; task 24.2.36). Re-exported here to keep the
 * module's historical API.
 */
export * from "./sheet-extensions.ts";
import {
  INCLUSION_FILE,
  isInclusionFileName,
  isSheetFileName,
  LEGACY_INCLUSION_FILE,
  SHEET_EXTENSION,
} from "./sheet-extensions.ts";

/** Resource list written by `SheetSender` (18.6). */
export const RESOURCE_LIST_FILE = "resources.json";

/**
 * Body of the infrastructure failure email (Ruby `fatal`, l.352-357) — the same
 * text for time and status sheets.
 */
const TEMP_SERVER_ERROR =
  `We are sorry! The ${"%s"} sheet server detected a configuration
problem and is temporarily out of service. The administrator
has been notified and will try to rectify the situation as
soon as possible. Please re-submit your ${"%s"} sheet later!
`;

/** Message of an unknown `catch` (Ruby's `$!`). */
function errorText(error: unknown,): string {
  return error instanceof Error ? error.message : String(error,);
}

/**
 * Extracts the raw `From:` of a message the parser could not read — without it
 * there would be no way to reply to the sender (Ruby l.94-107).
 */
function firstFromHeader(raw: string,): string | null {
  const match = /^From:[ \t]*(.*)$/mu.exec(raw,);
  const value = match?.[1]?.trim() ?? "";
  return value === "" ? null : value;
}

/**
 * 32-character hexadecimal identifier for the received message.
 *
 * Ruby uses `Digest::MD5.hexdigest(messageId)` (l.115). Deno has no MD5
 * (`crypto.subtle` does not support it) and the value serves **only** as a file
 * name in `failedMailsDir`, so four 32-bit FNV-1a accumulators yield the same
 * 128-bit format without depending on cryptography.
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
 * Base of the sheet receivers (18.7).
 *
 * Subclasses (`TimeSheetReceiver`, `StatusSheetReceiver` — 18.9/18.10) only
 * define `tj3clientOption`, `sheetDir`, `templateDir`, `failedMailsDir`,
 * `failedSheetsDir`, `signatureFile`, `emailSubject`, `sheetHeader` and
 * `signatureFilter`.
 *
 * The helpers are `protected` (rather than `private` as in Ruby) so that
 * subclasses and tests can call them without going through `send`.
 */
export class SheetReceiver extends SheetHandlerBase {
  /**
   * `'time'`, `'status'` or `'summary'` — used in the messages and selects the
   * rule.
   */
  protected readonly sheetType: SheetReceiverType;

  /**
   * Equivalent `tj3client` option (`check-ts`/`check-ss`).
   *
   * Purely documentary here: the check runs in-process, but keeping the field
   * preserves the subclass contract and the diagnostic log.
   */
  protected tj3clientOption: string = "";

  /** Base directory of the accepted sheets (`TimeSheets`). */
  protected sheetDir: string = "";
  /** Directory of the sender templates (`TimeSheetTemplates`). */
  protected templateDir: string = "";
  /** Raw messages that were not processed (to be reprocessed later). */
  protected failedMailsDir: string = "";
  /** Copies of the sheets that failed the check. */
  protected failedSheetsDir: string = "";
  /** File with the accepted intervals (`acceptable_intervals`). */
  protected signatureFile: string = "";
  /** Subject of the confirmation email (`%s` = resource, `%s` = date). */
  protected emailSubject: string = "";

  /** Matches the header of a valid sheet; group 1 = resource, 2 = date. */
  protected sheetHeader: RegExp = /^$/u;
  /** Extracts the signature (interval) from the header; group 1 = interval. */
  protected signatureFilter: RegExp = /^$/u;

  /** Address that receives replies (the registered one, after `processSheet`). */
  protected submitter: string | null = null;
  /** Resource that submitted the sheet. */
  protected resourceId: string | null = null;
  /**
   * End of the reported period (`YYYY-MM-DD`).
   *
   * Public because `TimeSheetSummary` (18.11) receives it from the app — in
   * Ruby the summary class declares `attr_accessor :date`.
   */
  date: string | null = null;
  /** Sheet text already trimmed by `cutOut`. */
  protected sheet: string | null = null;
  /** `false` when the sheet came in the email body. */
  protected sheetWasAttached: boolean = true;
  /** `Message-ID` of the message (or `"unknown"`). */
  protected messageId: string | null = null;
  /** Accepted summary of the sheet (Ruby: tj3client stdout, already RichText). */
  protected report: string | null = null;
  /** Warnings emitted during the check (Ruby: tj3client stderr). */
  protected warnings: string | null = null;
  /** Name of the message file in `failedMailsDir`. */
  protected idDigest: string = "";

  /** Target project of the check (Ruby's `tj3client check-*`). */
  project: Project | null = null;

  /** Cache of `resources.json` — rebuilt when `date` changes. */
  private resourceList: SheetResourceInfo[] | null = null;
  /** Date that `resourceList` refers to. */
  private resourceListDate: string | null = null;
  /** Pending replies (`error`/`fatal` cannot `await`). */
  private pendingReplies: Promise<void>[] = [];
  /** Prevents a failure while replying from queueing another reply. */
  private replyInFlight: boolean = false;

  /**
   * Creates the receiver.
   *
   * @param appName Application name used in logs and in the CLI.
   * @param type Sheet kind, which selects the validation rule.
   */
  constructor(appName: string, type: SheetReceiverType,) {
    super(appName,);
    this.sheetType = type;
  }

  /** Injects the project used to validate the sheets. */
  setProject(project: Project,): void {
    this.project = project;
  }

  /**
   * Processes a complete (RFC 822) message.
   *
   * It looks for sheet attachments first (`.smx` or legacy `.tji`) and, if none
   * works, the body. The raw message is kept in `failedMailsDir` until it is
   * accepted — that is what allows a rejected submission to be reprocessed
   * (Ruby l.119-122).
   *
   * @param rawMail complete message (headers + body).
   * @returns `true` if the sheet was accepted; an error on any other outcome.
   */
  async processEmail(rawMail: string,): Promise<boolean> {
    try {
      await this.setWorkingDir();
      await this.createDirectories();

      let mail: ParsedEmailMessage;
      try {
        mail = parseEmailMessage(rawMail,);
      } catch (error) {
        // Without the parsed message, all that is left is finding the `From:`
        // by hand so the sender can at least be warned (Ruby l.90-108).
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

      // Attachments first...
      for (const attachment of mail.attachments) {
        if (!isSheetFileName(attachment.fileName ?? "",)) continue;
        this.sheetWasAttached = true;
        if (await this.processSheet(attachment.content,)) return true;
      }

      // ...and only then the body.
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
      // `error`/`fatal` queue the reply and raise: delivering it here is the
      // equivalent of Ruby's synchronous `sendEmail`.
      await this.flushReplies();
    }
  }

  /**
   * Isolates and validates the text of a candidate sheet (Ruby `processSheet`).
   *
   * @returns `true` when the sheet is accepted and archived; `false` when it
   *   lacks the expected header (the caller tries the next source).
   */
  protected async processSheet(sheet: string,): Promise<boolean> {
    // With `8<` markers, only the excerpt between them counts.
    this.sheet = this.cutOut(sheet,);

    const match = this.sheetHeader.exec(this.sheet,);
    if (match === null) return false;

    await this.checkSignature(this.sheet,);

    this.resourceId = match[1] ?? null;
    this.date = match[2] ?? null;
    // Replies only go to the registered address (Ruby l.166-167).
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
   * Checks the sheet signature against `acceptable_intervals` (Ruby
   * `checkSignature`, l.290-316).
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
   * Validates the sheet content (Ruby `checkSheet`, l.182-210).
   *
   * Ruby wrote the sheet to `failedSheetsDir` and called
   * `tj3client --silent check-ts`; here the same content is applied to the
   * project in-process and the result comes from the `MessageHandler` (errors
   * the child process would return on stderr and in the exit code).
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
    // Divergence: Ruby used the tj3client stdout (reformatted sheet).
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
   * Archives the accepted sheet in `sheetDir/<date>/<resource>_<date>.smx`,
   * updates the folder's `all.smx` and replies to the sender (Ruby `fileSheet`,
   * l.212-267).
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
      // The top-level `all.smx` chains the folders of each period. A folder
      // created by an older version may only have `all.tji`: the previous
      // chain is preserved when reading (transition compatibility).
      const allFile = `${this.sheetDir}/${INCLUSION_FILE}`;
      const previous = await this.readInclusionFile(allFile,) ??
        await this.readInclusionFile(
          `${this.sheetDir}/${LEGACY_INCLUSION_FILE}`,
        ) ??
        "";
      await store.write(
        allFile,
        `${previous}\ninclude '${date}/${INCLUSION_FILE}' { }`,
      );
      this.addToScm("Adding new directory to all.smx", allFile,);
    }

    const resourceName = await this.getResourceName(resourceId,);
    let text = `== Report from ${resourceName} for the period ending ` +
      `${date} ==\n\n`;
    if (this.warnings !== null && this.warnings !== "") {
      text += "----\nYour report does contain some issues that you may want " +
        "to fix or address with\nyour manager or project manager:\n\n" +
        `<nowiki>${this.warnings}</nowiki>\n\n----\n`;
    }
    // Divergence: Ruby appended the tj3client stdout, which already came as
    // RichText. The sheet here is raw TJP — it goes in as literal text so that
    // the `-8<-` markers and the `#` lines are not parsed as markup.
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
   * Rewrites `<dir>/all.smx` with one `include` per sheet in the folder (Ruby
   * `generateInclusionFile`, l.272-288).
   *
   * Legacy sheets (`.tji`) and an old `all.tji` are still recognized on read,
   * but the generated file is always the native one (24.2.36).
   */
  protected async generateInclusionFile(dir: string,): Promise<void> {
    const store = this.requireFileStore("generateInclusionFile",);
    try {
      const files = (await store.list(dir,))
        .filter((name,) =>
          isSheetFileName(name,) && !isInclusionFileName(name,)
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

  /** Creates `sheetDir`, `failedMailsDir` and `failedSheetsDir` (Ruby l.318-325). */
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
   * Reads `<templateDir>/<date>/resources.json` (Ruby `getResourceList`).
   *
   * Ruby used YAML; the sender of this phase writes JSON (18.6).
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

  /** Registered email of the resource (Ruby `getResourceEmail`, l.379-386). */
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

  /** Name of the resource (Ruby `getResourceName`, l.388-395). */
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
   * Submission error (Ruby `SheetReceiver#error`, l.327-344).
   *
   * Queues "Your <type> sheet submission failed!" (attaching the sheet when it
   * came in the body, so the user can resubmit it) and then delegates to the
   * base `error` — which logs and raises `TjRuntimeError`.
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
   * Configuration failure (Ruby `SheetReceiver#fatal`, l.346-360).
   *
   * Only the fixed text goes in the email; the real message (with the sheet, if
   * any) goes to the log.
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
   * Applies the sheet to the already parsed project, as `tj3client check-*`
   * did with a fresh process.
   *
   * The summary (18.11) uses the same path: only `status` differs from the time
   * sheet grammar.
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

    // `check-ts` also validates the sheet totals (Ruby `TimeSheets#check`).
    if (this.sheetType !== "status") project.checkTimeSheets();
    // The parsed `TimeSheet`/`StatusSheet` is made available to the caller —
    // the summary (18.11/18.17.5) aggregates the material statuses from it.
    return parsed;
  }

  /** Removes the copy of the message in `failedMailsDir` (Ruby l.175). */
  private async deleteFailedMail(): Promise<void> {
    const store = this.fileStore;
    if (store === null || this.idDigest === "") return;
    const fileName = `${this.failedMailsDir}/${this.idDigest}`;
    if (await store.exists(fileName,)) await store.delete(fileName,);
  }

  /** Queues the reply to the sender — `error`/`fatal` cannot `await`. */
  private queueReply(subject: string, text: string,): void {
    // While a reply is in flight, do not chain another: a failure of
    // `sendEmail` itself would call `error` again, recursively.
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

  /** Delivers the replies queued by `error`/`fatal`. */
  private async flushReplies(): Promise<void> {
    while (this.pendingReplies.length > 0) {
      const replies = this.pendingReplies.splice(
        0,
        this.pendingReplies.length,
      );
      for (const reply of replies) await reply;
    }
  }

  /**
   * Content of an inclusion file, or `null` when it does not exist.
   *
   * Used to inherit the folder chain of older versions (`all.tji`), without
   * turning the absence into an error (24.2.36).
   */
  private async readInclusionFile(fileName: string,): Promise<string | null> {
    const store = this.requireFileStore("readInclusionFile",);
    try {
      if (!(await store.exists(fileName,))) return null;
      return await store.read(fileName,);
    } catch {
      return null;
    }
  }

  /** The injected `FileStore`, or a fatal error (ADR 037). */
  protected requireFileStore(method: string,): FileStore {
    const store = this.fileStore;
    if (store === null) {
      this.fatal(`${method}: no FileStore configured (see ADR 037)`,);
    }
    return store;
  }
}
