/**
 * SheetSender — generates and "sends" the time/status sheet templates.
 *
 * Port of `docs/taskjuggler/lib/taskjuggler/SheetSender.rb`, with two mandatory
 * adaptations of this phase:
 *  - **ADR 036** — there is no `tj3client` process, no SMTP and no SCM. Report
 *    generation happens **in-process** (`ProjectFileParser` + `Project`), and
 *    "delivery" is an `EmailMessage` returned/saved under `outbox/`.
 *  - **ADR 037** — all I/O goes through the injected `FileStore`, which is why
 *    the whole pipeline is `async`.
 *
 * The flow remains Ruby's: `sendTemplates` → `setWorkingDir` →
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
// Side effect: registers the report content factories
// (`resourcereport`, `timesheetreport`, `statussheetreport`, ...) used below.
import "../reports/mod.ts";
import {
  SheetHandlerBase,
  type SheetResourceInfo,
  type SheetType,
  sprintf,
} from "./sheet-handler-base.ts";
import { SHEET_EXTENSION, } from "./sheet-extensions.ts";

/** Fixed ID of the internal `resourcereport` (Ruby `rl_21497214`). */
export const RESOURCE_LIST_REPORT_ID = "rl_21497214";

/** Message of an unknown `catch` (Ruby's `$!`). */
function errorText(error: unknown,): string {
  return error instanceof Error ? error.message : String(error,);
}

/** `YYYY-MM-DD` in **local** time (Ruby `Time#strftime('%Y-%m-%d')`). */
export function localDate(date: Date,): string {
  const year = String(date.getFullYear(),).padStart(4, "0",);
  const month = String(date.getMonth() + 1,).padStart(2, "0",);
  const day = String(date.getDate(),).padStart(2, "0",);
  return `${year}-${month}-${day}`;
}

/** Number of a CSV cell (`null`/text → 0). */
function numberOf(value: unknown,): number {
  if (typeof value === "number") return value;
  if (value === null || value === undefined) return 0;
  const parsed = Number(value,);
  return Number.isFinite(parsed,) ? parsed : 0;
}

/**
 * Base of the sheet senders (18.6).
 *
 * Subclasses (`TimeSheetSender`, `StatusSheetSender` — 18.8/18.10) only define
 * `hideResource`, `templateDir`, `signatureFile`, `signatureFilter`, `introText`
 * and `mailSubject`.
 *
 * The pipeline helpers are `protected` (rather than `private` as in Ruby) so
 * that subclasses and tests can call them without going through `send`.
 */
export class SheetSender extends SheetHandlerBase {
  /** `'time'` or `'status'` — becomes the prefix of the `*sheetreport`. */
  protected readonly sheetType: SheetType;

  /**
   * Logical expression that hides resources from the template (Ruby `'0'`).
   *
   * Public, mirroring the `attr_accessor :hideResource` of `StatusSheetSender`.
   */
  hideResource: string = "0";

  /** File of intervals accepted by the receiver (`acceptable_intervals`). */
  protected signatureFile: string = "";

  /**
   * Base directory of the templates. **Mutated** by `createDirectories` to
   * include the date (as in Ruby), which is why `templateRoot` keeps the base.
   */
  protected templateDir = "";

  /** Regenerates existing templates and resends them. */
  force: boolean = false;

  /**
   * Dynamic attributes applied to the template report (`-A` of `tj3`).
   *
   * Ruby had no such path: the template always came from the fixed `reportDef`.
   * Addendum 18.19.4 mentions "template columns", but
   * `timesheetreport`/`statussheetreport` ignore `columns` (the sheet body is
   * fixed), so the hook is generic, like the CLI's `-A`: it serves
   * `hideresource`, `sorttasks`, `journalattributes`, etc. `Project#generateReport`
   * restores the attributes at the end (18.19.3).
   */
  templateAttributes: string | null = null;

  /** Extracts the signature (interval) from the sheet header. */
  protected signatureFilter: RegExp = /^$/u;

  /** Email subject (`%s` = period date). */
  protected mailSubject: string = "";

  /** Introductory text of the email. */
  protected introText: string = "";

  /** Date of the reported period (`YYYY-MM-DD`), frozen at construction. */
  date: string;

  /** Duration of the reported period (TJP interval syntax). */
  intervalDuration: string = "1w";

  /** Construction instant — used to detect old templates. */
  protected timeStamp: Date;

  /**
   * Project already parsed/scheduled. In Ruby access went through `tj3client`;
   * here the sender receives the `Project` and generates the reports
   * in-process.
   */
  project: Project | null = null;

  /** Base directory, immune to the mutation of `templateDir` (idempotency). */
  private templateRoot: string | null = null;

  /** Write instant of each generated file (`File#mtime` does not exist). */
  private readonly writtenAt: Map<string, number> = new Map<string, number>();

  /**
   * Creates the sender.
   *
   * @param appName Application name used in logs and in the CLI.
   * @param type Sheet kind, which selects the `*sheetreport` used.
   */
  constructor(appName: string, type: SheetType,) {
    super(appName,);
    this.sheetType = type;
    const now = this.clock();
    this.date = localDate(now,);
    this.timeStamp = now;
  }

  /** Injects the project targeted by report generation. */
  setProject(project: Project,): void {
    this.project = project;
  }

  /**
   * Full pipeline: prepares the working directory, creates the folders, builds
   * the resource list, generates the templates and sends them (Ruby
   * `sendTemplates`).
   *
   * @param resourceList IDs of the resources to consider; empty = all.
   */
  async sendTemplates(resourceList: string[],): Promise<void> {
    await this.setWorkingDir();
    await this.createDirectories();

    const resources = await this.genResourceList(resourceList,);
    await this.genTemplates(resources,);
    await this.sendReportTemplates(resources,);
  }

  /**
   * Creates `<templateDir>` and `<templateDir>/<date>` (Ruby
   * `createDirectories`).
   *
   * Deliberate divergence: the base lives in `templateRoot`, so calling the
   * pipeline twice in the same process does not stack dates in the path (Ruby
   * mutated `@templateDir` and, on the second run, created `…/<date>/<date>`).
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
   * Builds the resource list with email and hours through an internal CSV
   * `resourcereport` (Ruby `genResourceList`, l.87-147).
   *
   * The CSV is written to `<templateDir>/resources.json` for the receiver
   * (`getResourceList`, 18.7.22) — Ruby used `resources.yml`.
   */
  protected async genResourceList(
    resourceList: string[],
  ): Promise<SheetResourceInfo[]> {
    const store = this.requireFileStore("genResourceList",);
    let list: SheetResourceInfo[] = [];
    this.info("Retrieving resource list...",);

    // Ruby used YAML/CSV as transport because it spawned a subprocess; here the
    // report is generated in-process, but the definition stays identical.
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
    // Parse the CSV into an array of arrays (Ruby `CSVFile#parse`).
    const csv = new CSVFile(null, ";",).parse(report,);

    // Drop the column title row.
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

      // `<Error>` is the report marker for a missing attribute (not an email);
      // treating it as empty preserves Ruby's intent to abort.
      if (email === "" || email === "<Error>") {
        this.error(`Resource '${id}' must have a valid email address`,);
      }

      // Resources on leave for the whole period do not get a template.
      if (effort === 0 && freeWork === 0 && efficiency !== 0) {
        this.info(`Resource '${id}' was on leave the whole period`,);
        continue;
      }

      list.push({ id, name, email, effort, freeWork, },);
    }

    // Store the list for the receiver (Ruby wrote `resources.yml`).
    const fileName = `${this.templateDir}/resources.json`;
    try {
      await store.write(fileName, `${JSON.stringify(list, null, 2,)}\n`,);
    } catch (error) {
      this.error(`Saving of ${fileName} failed: ${errorText(error,)}`,);
    }

    if (resourceList.length > 0) {
      // Explicit list: only the requested resources (and not hidden by the
      // filter).
      list = list.filter((item,) => resourceList.includes(item.id,));
    }

    if (list.length === 0) this.error("genResourceList: list is empty",);

    this.info(`${list.length} resources found`,);
    return list;
  }

  /**
   * Generates one `.smx` per resource and enables the signature (Ruby
   * `genTemplates`).
   *
   * Legacy templates (`.tji`) are still reused when `force` is not requested
   * (24.2.36).
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

      // Does not regenerate existing templates without `force`.
      const existing = await this.findSheetFile(
        this.templateDir,
        `${res}_${this.date}`,
      );
      const fileName = this.force || existing === null ? nativeFile : existing;
      // The first template defines the sheet interval — even when it is the
      // legacy form already present in the folder (24.2.36).
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
   * Sends one email per resource with the `.smx` attached (Ruby
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
      // Does not resend old templates. `timeStamp` has coarser resolution than
      // mtime; we add 1s to avoid truncation error (Ruby l.188-193).
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
   * Extracts the signature from the first template and records it in
   * `signatureFile` (Ruby `enableSignatureForReporting`, l.201-249).
   *
   * Ruby retried the read 100 times with a 300ms wait because the file was
   * written by another process; in-process the file is already in the
   * `FileStore`.
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
      // Append the new signature and rewrite the file.
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
   * Applies `reportDef` to the project and returns the report output (Ruby
   * `generateReport`, l.251-271).
   *
   * Ruby sent the definition to a `tj3client report prj <id> = .` and read
   * stdout. Here the same path runs in-process: `parseReportList` (which is the
   * `ReportServer`'s `reportPropertiesFile`) + `Project#generateReport`.
   *
   * The signature is `Promise` to keep the pipeline contract (18.6.20); the
   * generation itself is synchronous, but failures become **rejections** (never
   * a synchronous `throw`), so `await`/`assertRejects` work as they did in
   * Ruby.
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

  /** Synchronous body of {@link generateReport}. */
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
      // A new definition replaces the previous one (Ruby always talked to a new
      // process, so it never collided).
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
    // CSV comes out as an array of arrays (ADR 027); the rest is already text.
    return typeof output === "string"
      ? output
      : new CSVFile(output as unknown[][], ";",).to_s();
  }

  /**
   * Resolves a missing parent directory before writing (`FileStore` does not
   * create ancestors in `write`, unlike `File.open`).
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

  /** The injected `FileStore`, or a fatal error (ADR 037). */
  protected requireFileStore(method: string,): FileStore {
    const store = this.fileStore;
    if (store === null) {
      this.error(`${method}: no FileStore configured (see ADR 037)`,);
    }
    return store;
  }
}
