import { type Project, } from "./model/project.ts";
import type { PropertyTreeNode, } from "./model/property-tree-node.ts";
import type { Resource, } from "./model/resource.ts";
import { ProjectFileParser, } from "./parser/project-file-parser.ts";
import { Query, } from "./query/query.ts";
import type { FileStore, } from "./interfaces/file-store.ts";
import { normalizeInputPath, stripExtension, } from "./execution/paths.ts";
import { FileList, } from "./utils/file-list.ts";
import type { FileTextLoader, } from "./lexer/stream-handle.ts";
import type { TimeSheet, } from "./timesheet/time-sheet.ts";
import {
  renderReports,
  type RenderReportsOptions,
  type ReportsJson,
} from "./reports/reports-json.ts";
import { execute as executeRequest, } from "./execution/execute.ts";
import type {
  ExecutionRequest,
  ExecutionResult,
  FreezeSection,
} from "./execution/types.ts";
import { Report, } from "./model/report.ts";
import { ReportType, } from "./model/report-type.ts";
import { ReportContext, } from "./reports/report-context.ts";
import { LogicalExpression, } from "./logic/logical-expression.ts";
import { LogicalOperation, } from "./logic/logical-operation.ts";
import { TjTime, } from "./time/tj-time.ts";
import { MessageHandlerInstance, } from "./message-handler.ts";

// Side effect: registers the report content factories
// (TaskListRE, ResourceListRE, …) in the model's `contentFactories`, like the
// `require` of the content classes in TaskJuggler.rb (phase 14.23).
import "./reports/mod.ts";

/**
 * Injected content provider (phase 24 — ADR 034).
 *
 * Receives a path as it appears in the project (relative to the including file,
 * or the master path) and returns the text. The core never reads the disk: the
 * CLI/PWA injects this reader. An **asynchronous** provider only works for the
 * files listed in `parse(files, …)` — those are pre-loaded; `include`s are read
 * during the parse and require a synchronous return.
 */
export type FileContentProvider = (path: string,) => string | Promise<string>;

/**
 * Result of a sheet check over **content** (phase 24, task 24.2.33).
 *
 * `report` is the compiled journal the Ruby printed with `puts`: on the data
 * path it leaves through the `results.sheet.reportText` section of the
 * envelope, and the mutable `lastSheetReport` field is kept only for the
 * step-by-step path.
 */
export interface SheetCheckResult {
  /** `true` when the sheet parsed and every total balanced. */
  valid: boolean;
  /**
   * Compiled journal to display, or `null` when `valid` is `false`.
   *
   * The engine never prints it: the caller decides where it goes.
   */
  report: string | null;
}

/** Check failure (the diagnostic already went to the `MessageHandler`). */
export const SHEET_CHECK_FAILED: SheetCheckResult = {
  valid: false,
  report: null,
};

/**
 * TaskJuggler — top-level facade for the CLI and apps.
 *
 * Phase 24 boundary (ADR 034): the core neither reads the disk nor writes to a
 * terminal. `parse`/`parseFile`/`parseContent` take the text from an injected
 * provider and `renderReports` returns the `results.reports` section in memory —
 * printing or writing is the consumer's policy. `freeze` stays anchored to
 * phase 24 because rewriting the `.tjp` master is a CLI decision. PWA storage
 * remains in phase 19 (`FileStore`/OPFS, ADR 030).
 *
 * The `stdout` DSL extension expresses only the **intent** of the report; what
 * consumes it is the CLI output policy (`output-policy.ts`, 24.5).
 *
 * @see docs/taskjuggler/lib/taskjuggler/TaskJuggler.rb
 */
export class TaskJuggler {
  /** Project built by the last successful parse, or `null` before one. */
  project: Project | null;
  /** Parser kept alive between calls, or `null` when it was discarded. */
  parser: ProjectFileParser | null;
  /** Worker budget forwarded to `Project.generateReports` (default `1`). */
  maxCpuCores: number;
  /** When `true`, scheduling reports deviations in time-sheet bookings. */
  warnTsDeltas: boolean;
  /** When `true`, scheduling records traces for the trace reports. */
  generateTraces: boolean;
  /**
   * Injected storage for reading the sheet `.tji` files (ADR 037).
   *
   * In Ruby, `checkTimeSheet`/`checkStatusSheet` called `tj3client` through a
   * subprocess, which read the file from disk. With no disk in the core, the
   * sheet text arrives through this `FileStore`.
   */
  fileStore: FileStore | null;
  /**
   * Human-readable result of the last `checkTimeSheet`/`checkStatusSheet` — the
   * compiled journal the Ruby printed with `puts`. `null` until the first
   * successful check; the CLI/app decides where to display it.
   */
  lastSheetReport: string | null;
  /** Content already read in the current call (injected provider cache). */
  private contentCache = new Map<string, string>();
  /** Current provider — reused by `parseFile`/`parseContent` (phase 24). */
  private fileProvider: FileContentProvider | null = null;

  /**
   * Initialises an empty facade: no project, no parser, one CPU core, tracing
   * and delta warnings off — and pins `TjTime` to UTC.
   */
  constructor() {
    this.project = null;
    this.parser = null;
    this.maxCpuCores = 1;
    this.warnTsDeltas = false;
    this.generateTraces = false;
    this.fileStore = null;
    this.lastSheetReport = null;
    TjTime.setTimeZone("UTC",);
  }

  /** Injects (or removes, with `null`) the `FileStore` used by the sheets. */
  setFileStore(store: FileStore | null,): void {
    this.fileStore = store;
  }

  /**
   * Reads the files in _files_ and builds the `Project` (Ruby `parse`, l.44-104).
   *
   * Phase 24: the file text arrives through the injected provider — the core
   * never touches the disk. An `include` is resolved by the provider **relative
   * to the including file**, as in Ruby. The first file is the master
   * (`:project`); the others feed the project (`:propertiesFile`).
   *
   * @returns `true` when no error is left in the `MessageHandler`.
   */
  async parse(
    files: string[],
    provider: FileContentProvider | null = null,
    keepParser = false,
  ): Promise<boolean> {
    // "Reset the MessageHandler to clear all errors" (Ruby l.45).
    MessageHandlerInstance.instance.clear();
    this.project = null;
    this.fileProvider = provider;
    this.parser = new ProjectFileParser();
    const parser = this.parser;

    if (provider !== null) {
      // Pre-loads the explicit list (the provider may be asynchronous); the
      // `include`s found during the parse use the cache/synchronous loader.
      this.contentCache.clear();
      for (const file of files) {
        try {
          this.contentCache.set(
            normalizeInputPath(file,),
            await provider(file,),
          );
        } catch (_error) {
          // Ruby: `critical('parse', msg.message)` on `open` — no exception.
          MessageHandlerInstance.instance.error(
            "open_file",
            `Cannot open file ${file}`,
          );
          return false;
        }
      }
      parser.setFileLoader(this.createLoader(provider,),);
    }

    let master = true;
    for (const file of files) {
      try {
        parser.open(file, master,);
      } catch (error) {
        this.criticalParse("parse", error,);
        return false;
      }
      // `open` records `open_file` and continues without a stream: nothing to
      // parse.
      if (parser.scannerRef?.cf === null) return false;

      if (master) {
        const parsed = parser.parse("project",);
        if (parsed === false || parsed === null || parsed === undefined) {
          return false;
        }
        this.project = parsed as Project;
        master = false;
      } else {
        parser.setGlobalMacros();
        if (parser.parse("propertiesFile",) === false) return false;
      }
      this.project?.inputFiles.push(file,);
      parser.close();
    }

    if (!keepParser) this.parser = null;
    return MessageHandlerInstance.instance.errors === 0;
  }

  /**
   * Parses a single file with an arbitrary grammar rule.
   *
   * Lower-level counterpart of {@link parse}: the caller picks the rule
   * (`"project"`, `"propertiesFile"`, …) instead of letting the first file be
   * the master. Used by consumers that feed one fragment at a time.
   *
   * @param fileName Path handed to the injected provider (or the raw text when
   *   the scanner was opened on a buffer).
   * @param rule Grammar rule to start from.
   * @returns Whatever the rule produced, or `null` when the parse failed — the
   *   diagnostics are already in the handler at that point.
   */
  parseFile(fileName: string, rule: string,): unknown {
    const project = this.project;
    const parser = this.parser ?? new ProjectFileParser();
    if (project) parser.project = project;
    if (this.fileProvider !== null) {
      parser.setFileLoader(this.createLoader(this.fileProvider,),);
    }
    try {
      parser.open(fileName, false,);
    } catch (error) {
      this.criticalParse("parse_file", error,);
      return null;
    }
    if (parser.scannerRef?.cf === null) return null;
    project?.inputFiles.push(fileName,);

    parser.setGlobalMacros();
    const res = parser.parse(rule,);
    if (res === false) return null;
    parser.close();
    return res;
  }

  /**
   * Parses project source supplied as a string (SyntaxMesh extension — the
   * Ruby CLI only ever read files).
   *
   * The `fileName` is used for diagnostics and for `Project.inputFiles`; it is
   * not read. This is the entry point of the browser and of any caller that
   * already holds the source text.
   *
   * @param content TaskJuggler source to parse.
   * @param fileName Name to report the source under.
   * @param provider Resolver for `include`s inside `content`.
   * @returns `true` when the project was built and no error was recorded.
   */
  parseContent(
    content: string,
    fileName?: string,
    provider: FileContentProvider | null = null,
  ): boolean {
    MessageHandlerInstance.instance.clear();
    this.project = null;
    this.fileProvider = provider;
    const parser = new ProjectFileParser();
    if (provider !== null) {
      this.contentCache.clear();
      parser.setFileLoader(this.createLoader(provider,),);
    }

    let project: Project | null;
    try {
      // Buffer with its own name: `inputFiles` and messages use the name, not
      // the text (SyntaxMesh extension — absent from Ruby).
      parser.open(content, true, true, fileName,);
      if (parser.scannerRef?.cf === null) return false;
      const parsed = parser.parse("project",);
      if (parsed === false || parsed === null || parsed === undefined) {
        return false;
      }
      project = parsed as Project;
      this.project = project;
    } catch (error) {
      this.criticalParse("parse", error,);
      return false;
    } finally {
      parser.close();
    }

    if (fileName !== undefined) project.inputFiles.push(fileName,);
    return MessageHandlerInstance.instance.errors === 0;
  }

  /**
   * Schedules the parsed project.
   *
   * Forwards {@link warnTsDeltas} so booking deviations are reported and
   * records traces when {@link generateTraces} is on.
   *
   * @returns `true` when scheduling completed without a fatal condition.
   * @throws If no project has been parsed yet.
   */
  schedule(): boolean {
    if (!this.project) {
      throw new Error("Project not set",);
    }
    this.project.warnTsDeltas = this.warnTsDeltas;
    const res = this.project.schedule();
    this.project.enableTraceReports(this.generateTraces,);
    return res;
  }

  /**
   * Generates **every** report of the project through the legacy direct-write
   * path.
   *
   * Kept for the UI (Phase 20); new code should prefer {@link renderReports},
   * which returns report contents as data instead of writing them.
   *
   * @param outputDir Directory stored in `Project.outputDir`; omitted when the
   *   caller wants whatever the project already configured.
   * @returns Always `true`; failures are recorded in the message handler.
   * @throws If no project has been parsed yet.
   */
  generateReports(outputDir?: string,): boolean {
    if (!this.project) {
      throw new Error("Project not set",);
    }
    this.project.checkReports();
    if (outputDir) {
      this.project.outputDir = outputDir + "/";
    }
    this.project.generateReports(this.maxCpuCores,);
    return true;
  }

  /**
   * Generates one report through the legacy direct-write path.
   *
   * @param reportId Id of the report, or a pattern when `regExpMode` is set.
   * @param regExpMode Treat `reportId` as a regular expression.
   * @param formats Output formats to force, or `null` for the report's own.
   * @param dynamicAttributes Attribute definitions injected for this run.
   * @returns Always `true`; failures are recorded in the message handler.
   * @throws If no project has been parsed yet.
   */
  generateReport(
    reportId: string,
    regExpMode: boolean,
    formats?: string[] | null,
    dynamicAttributes?: string | null,
  ): boolean {
    if (!this.project) {
      throw new Error("Project not set",);
    }
    this.project.generateReport(
      reportId,
      regExpMode,
      formats,
      dynamicAttributes,
    );
    return true;
  }

  /**
   * Lists the reports matching `reportId` in the message log.
   *
   * @param reportId Id of the report, or a pattern when `regExpMode` is set.
   * @param regExpMode Treat `reportId` as a regular expression.
   * @returns Always `true`; failures are recorded in the message handler.
   * @throws If no project has been parsed yet.
   */
  listReports(reportId: string, regExpMode: boolean,): boolean {
    if (!this.project) {
      throw new Error("Project not set",);
    }
    this.project.listReports(reportId, regExpMode,);
    return true;
  }

  /**
   * Builds the `results.reports` section of the execution envelope (phase 24).
   *
   * Returns the rendered content of each report **in memory**: nothing is
   * printed or written — the destination policy belongs to the CLI
   * (`output-policy.ts`). This method is the reusable builder of the section; the
   * public entry point remains the request's `execute`.
   *
   * `generateReports(outputDir?)` stays untouched as the legacy UI/phase 20
   * path (writes directly, without an envelope).
   *
   * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.2/§3.3
   */
  renderReports(options: RenderReportsOptions = {},): ReportsJson {
    const project = this.requireProject("renderReports",);
    return renderReports(project, options,);
  }

  /**
   * Runs an `ExecutionRequest` and returns the complete envelope (phase 24).
   *
   * Delegated to `execution/execute.ts`, which creates its own instance of this
   * facade **per call** (`MessageHandler`/`DataCache` isolation — addendum
   * §3.6): the state of this instance takes no part in the execution. The
   * consumer (CLI/PWA/server) calls this **once** and only dispatches the
   * envelope; no `exit`/IO is born here.
   *
   * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.1/§3.6
   */
  execute(request: ExecutionRequest,): Promise<ExecutionResult> {
    return executeRequest(request,);
  }

  /**
   * Generates the `--freeze` artifacts (Ruby `TaskJuggler#freeze`, l.220-290).
   *
   * Returns **data**: the header include (with the new `now`) and the export of
   * the bookings up to the cut-off date. Nothing is written — writing belongs to
   * the consumer (`io.writeText` in the CLI, 24.9.5).
   *
   * Deliberate deviations from Ruby, all because the core has no filesystem:
   *  - Ruby checks that both includes exist and only emits `info`; here the check
   *    does not exist (the consumer knows whether the files are there);
   *  - Ruby leaves the `_bookings_` report in the project and the normal
   *    `generateReports` pipeline writes the `.tji`; here the export is generated
   *    in the freeze itself and the report leaves the list afterwards, so as not
   *    to duplicate the entry in `results.reports`;
   *  - the names derive from the **request master** (not `Dir.pwd`), which is
   *    deterministic and testable.
   *
   * @returns artifacts in write order, or `null` on error (already reported).
   */
  freeze(
    freezeDate: string | null = null,
    taskBookings = false,
  ): FreezeSection | null {
    const project = this.requireProject("freeze",);
    const handler = MessageHandlerInstance.instance;

    const master = this.masterFile(project,);
    if (master === null) {
      handler.error(
        "cannot_freeze_stdin",
        "The project freeze feature can only be used when the master file " +
          "is a real file, not standard input.",
      );
      return null;
    }

    let cutOff: TjTime;
    try {
      cutOff = freezeDate === null
        ? TjTime.now().align(3600,)
        // Ruby: `TjTime.new(arg)` (string parsing). In the port the constructor
        // is private and `fromString` is the parsing entry point
        // ("YYYY-MM-DD[-HH:MM[:SS]]").
        : TjTime.fromString(freezeDate,).align(3600,);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error,);
      handler.error("tj3_ivld_freeze_date", `Invalid freeze date: ${text}`,);
      return null;
    }

    const scenarioIdx = this.trackingScenarioIdx(project, "no_tracking_scen",);
    if (scenarioIdx === null) return null;

    const base = stripExtension(master,);
    const headerFile = `${base}-header.tji`;
    const bookingsFile = `${base}-bookings.tji`;

    const report = this.buildBookingReport(
      project,
      `${base}-bookings`,
      scenarioIdx,
      cutOff,
      taskBookings,
    );

    let bookingsContents: string;
    try {
      project.reportContexts.push(new ReportContext(project, report,),);
      try {
        report.generate();
      } finally {
        project.reportContexts.pop();
      }
      bookingsContents = report.outputs.get("tjp",) ?? "";
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error,);
      handler.error(
        "freeze_failed",
        `Cannot generate the booking file: ${text}`,
      );
      return null;
    } finally {
      // The synthetic report takes no part in `results.reports`.
      project.reports.removeProperty(report,);
    }

    // Ruby: `now #{freezeDate}` — `TjTime#to_s` without a format uses
    // `%Y-%m-%d-%H:%M[-%S]-%z`. The cut-off is aligned to the hour, so seconds
    // never appear; the offset stays explicit so the `.tji` reloads identically.
    const now = cutOff.to_s("%Y-%m-%d-%H:%M-%z",);
    return {
      files: [
        { fileName: headerFile, contents: `now ${now}\n`, },
        { fileName: bookingsFile, contents: bookingsContents, },
      ],
    };
  }

  /**
   * Synthetic `_bookings_` report of the freeze (Ruby l.255-285).
   *
   * `inheritAttributes` comes **before** the `set` calls because Ruby inherits
   * the project's report defaults and only then overrides them (the order
   * matters for `formats`/`scenarios`).
   */
  private buildBookingReport(
    project: Project,
    name: string,
    scenarioIdx: number,
    cutOff: TjTime,
    taskBookings: boolean,
  ): Report {
    const report = new Report(project, "_bookings_", name, null,);
    report.typeSpec = ReportType.Export;
    report.set("formats", ["tjp",],);
    report.inheritAttributes();

    // Only the tracking scenario enters the export.
    report.set("scenarios", [scenarioIdx,],);
    // Bookings only up to the cut-off date.
    report.set("end", cutOff,);
    // Every task/resource, by decreasing `seqno` (as in Ruby).
    const showAll = new LogicalExpression(new LogicalOperation(0,),);
    report.set("hideTask", showAll,);
    report.set("sortTasks", [["seqno", true, -1,],],);
    report.set("hideResource", showAll,);
    report.set("sortResources", [["seqno", true, -1,],],);
    // Bookings only: no definitions and no other attribute.
    report.set("definitions", [],);
    if (taskBookings) {
      report.set("taskAttributes", ["booking",],);
      report.set("resourceAttributes", [],);
    } else {
      report.set("taskAttributes", [],);
      report.set("resourceAttributes", ["booking",],);
    }
    return report;
  }

  /**
   * Master file of the project (Ruby `FileList#masterFile`).
   *
   * The record of the read files is the `FileList` (16.7) — the same scan as
   * Ruby, with `.smx` added to `.tjp` (native extension, 24.2.36). With none, it
   * falls back to the first file opened: a project parsed from unnamed content
   * has no master.
   */
  private masterFile(project: Project,): string | null {
    const files = new FileList();
    for (const file of project.inputFiles) files.add(file,);
    return files.masterFileWith([".tjp", ".smx",],) ??
      project.inputFiles[0] ?? null;
  }

  /**
   * Validates a time sheet against the loaded project (Ruby `checkTimeSheet`,
   * l.295-334).
   *
   * Ruby called `tj3client check-ts` through a subprocess and printed the
   * compiled journal; here the `.tji` is read from the injected `FileStore`
   * (ADR 037), the validation runs in-process and the result stays in
   * {@link lastSheetReport} for the CLI/app to print — the core does not write to
   * stdout.
   *
   * This is the **step-by-step** path (PWA/F19). The phase 24 data path uses
   * {@link checkTimeSheetContent} and receives the sheet text from the request
   * (24.2.33).
   *
   * @returns `true` when the sheet is valid and every total balances.
   */
  async checkTimeSheet(fileName: string,): Promise<boolean> {
    // 18.12: without a project the call is a programming error and throws
    // **before** touching the `FileStore` (`readSheet` would return `null` and
    // mask the precondition as `false`).
    this.requireProject("checkTimeSheet",);
    const content = await this.readSheet(fileName, "check_time_sheet",);
    if (content === null) return false;
    return this.checkTimeSheetContent(content, fileName,).valid;
  }

  /**
   * Validates a time sheet already **in memory** (phase 24, task 24.2.33).
   *
   * Same semantics as {@link checkTimeSheet}, without a `FileStore`: it is the
   * door of `execute` (`app="check-ts"`), where the sheet text is request data.
   */
  checkTimeSheetContent(
    content: string,
    fileName = "<time sheet>",
  ): SheetCheckResult {
    const project = this.requireProject("checkTimeSheet",);
    const scenarioIdx = this.trackingScenarioIdx(project, "check_time_sheet",);
    if (scenarioIdx === null) return SHEET_CHECK_FAILED;

    // "Make sure we don't use data from old time sheets or Journal entries"
    // (Ruby l.305-307): the journal is recreated and the sheets are discarded.
    project.timeSheets.clear();
    project.journal.clear();

    const handler = MessageHandlerInstance.instance;
    const errorCount = handler.errors;

    const ts = this.parseSheet<TimeSheet>(
      project,
      fileName,
      content,
      "timeSheetFile",
    );
    if (ts === null) return SHEET_CHECK_FAILED;

    // `TimeSheets#check` records the problems through `error(...)` and returns
    // the list itself (always truthy) — Ruby's `return false unless` only fires
    // on an exception. Here the failure signal is the error delta below.
    project.checkTimeSheets();
    if (handler.errors !== errorCount) return SHEET_CHECK_FAILED;

    // Extension 18.17.1/18.17.9: a valid sheet is applied to the tracking
    // scenario — material `work`/`remaining` become `effortdone`/`effortleft`
    // and the consumed quantity becomes a `MaterialBooking`, which is what the
    // `materialreport` reads as actual cost (14C.11).
    for (const record of ts.materialRecords) {
      record.applyToScenario(scenarioIdx,);
      record.applyMaterialBooking(scenarioIdx,);
    }

    const query = new Query({
      project,
      property: ts.resource,
      scopeProperty: null,
      scenarioIdx,
      start: ts.interval.start,
      end: ts.interval.end,
      journalMode: "journal",
      journalAttributes: [
        "alert",
        "property",
        "propertyid",
        "headline",
        "flags",
        "timesheet",
        "summary",
        "details",
      ],
      sortJournalEntries: [["seqno", 1,],],
      timeFormat: "%Y-%m-%d",
      selfContained: true,
    },);
    ts.resource.query_journal(query,);
    this.lastSheetReport = inputTextOf(query.rti,);
    return { valid: true, report: this.lastSheetReport, };
  }

  /**
   * Validates a status sheet against the loaded project (Ruby
   * `checkStatusSheet`, l.339-369).
   *
   * Without the time sheet's `timeSheets.clear()` plus journal recreation:
   * status sheets coexist with the existing journal (the grammar itself removes
   * the entries of the same author/period before rewriting).
   */
  async checkStatusSheet(fileName: string,): Promise<boolean> {
    // Same precondition as the time sheet: without a project it throws before
    // the store.
    this.requireProject("checkStatusSheet",);
    const content = await this.readSheet(fileName, "check_status_sheet",);
    if (content === null) return false;
    return this.checkStatusSheetContent(content, fileName,).valid;
  }

  /**
   * Validates a status sheet already **in memory** (phase 24, task 24.2.33).
   *
   * Mirrors {@link checkStatusSheet} without a `FileStore` — the door of
   * `execute` (`app="check-ss"`).
   */
  checkStatusSheetContent(
    content: string,
    fileName = "<status sheet>",
  ): SheetCheckResult {
    const project = this.requireProject("checkStatusSheet",);
    const scenarioIdx = this.trackingScenarioIdx(
      project,
      "check_status_sheet",
    );
    if (scenarioIdx === null) return SHEET_CHECK_FAILED;

    const handler = MessageHandlerInstance.instance;
    const errorCount = handler.errors;

    const parsed = this.parseSheet<[Resource, TjTime, TjTime,]>(
      project,
      fileName,
      content,
      "statusSheetFile",
    );
    if (parsed === null) return SHEET_CHECK_FAILED;
    if (handler.errors !== errorCount) return SHEET_CHECK_FAILED;

    const [resource, start, end,] = parsed;
    const query = new Query({
      project,
      property: resource as PropertyTreeNode,
      scopeProperty: null,
      scenarioIdx,
      start,
      end,
      timeFormat: "%Y-%m-%d",
      selfContained: true,
    },);
    resource.query_dashboard(query,);
    this.lastSheetReport = inputTextOf(query.rti,);
    return { valid: true, report: this.lastSheetReport, };
  }

  /**
   * Builds the synchronous reader the scanner uses for the master and the
   * `include`s.
   *
   * The path is canonicalised before the *lookup*: the scanner assembles the
   * include name as `dirname(parent) + "/" + name`, which produces `./a/b.tji`.
   */
  private createLoader(provider: FileContentProvider,): FileTextLoader {
    return (path: string,): string => {
      const key = normalizeInputPath(path,);
      const cached = this.contentCache.get(key,);
      if (cached !== undefined) return cached;

      const value = provider(key,);
      if (typeof value !== "string") {
        throw new Error(
          `Cannot open file ${path}: asynchronous providers must pre-load ` +
            "every file passed to parse(files, provider)",
        );
      }
      this.contentCache.set(key, value,);
      return value;
    };
  }

  /** Records a parse error in the `MessageHandler` (Ruby `critical(id, msg)`). */
  private criticalParse(id: string, error: unknown,): void {
    const text = error instanceof Error ? error.message : String(error,);
    if (text) MessageHandlerInstance.instance.critical(id, text,);
  }

  /** Loaded project or error — precondition of scheduling/reporting/checking. */
  private requireProject(method: string,): Project {
    if (!this.project) {
      throw new Error(`Project not set (${method})`,);
    }
    return this.project;
  }

  /**
   * `trackingScenarioIdx` of the project, or `null` after recording Ruby's
   * `critical` (`raise TjException, 'No trackingscenario defined'`).
   */
  private trackingScenarioIdx(
    project: Project,
    id: string,
  ): number | null {
    const idx = project.get("trackingScenarioIdx",) as
      | number
      | null
      | undefined;
    if (idx === null || idx === undefined) {
      MessageHandlerInstance.instance.critical(
        id,
        "No trackingscenario defined",
      );
      return null;
    }
    return idx;
  }

  /**
   * Reads the text of a `.tji` from the injected `FileStore` (ADR 037).
   *
   * Without a store — or with a missing file — records `critical` and returns
   * `null`, like Ruby's `critical('parse_file', …)`.
   */
  private async readSheet(
    fileName: string,
    id: string,
  ): Promise<string | null> {
    const store: FileStore | null = this.fileStore;
    if (store === null) {
      MessageHandlerInstance.instance.critical(
        id,
        `Cannot read ${fileName}: no FileStore configured (ADR 037)`,
      );
      return null;
    }
    try {
      return await store.read(fileName,);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error,);
      MessageHandlerInstance.instance.critical(
        id,
        `Cannot read ${fileName}: ${text}`,
      );
      return null;
    }
  }

  /**
   * Applies a sheet to the already parsed project (Ruby's
   * `parseFile(fileName, rule)`, l.105-121).
   *
   * `parseFile` stays anchored to phase 24 (the `.tjp` master depends on the
   * CLI content provider); here the sheet text is already in memory.
   *
   * @returns the rule result, or `null` on a syntax error (TjError).
   */
  private parseSheet<T,>(
    project: Project,
    fileName: string,
    content: string,
    rule: string,
  ): T | null {
    const parser = new ProjectFileParser();
    parser.project = project;
    let result: unknown;
    try {
      parser.open(content, false, true,);
      // Ruby's `@parser.setGlobalMacros` (l.116): the date macros
      // (projectstart/now/…) must exist before the rules run.
      parser.setGlobalMacros();
      result = parser.parse(rule,);
    } catch (error) {
      // SyntaxMesh extension: the port's FSM tolerates missing tokens and even
      // runs the action with `undefined` values (in Ruby the pattern does not
      // match and the action never runs), which blows up inside with a generic
      // error. Since the text is user input, this becomes an invalid sheet
      // instead of crashing the app — with the id Ruby uses in `parseFile`
      // (l.111).
      const text = error instanceof Error ? error.message : String(error,);
      MessageHandlerInstance.instance.critical("parse_file", text,);
      return null;
    } finally {
      parser.close();
    }
    if (result === false || result === null || result === undefined) {
      return null;
    }
    // Ruby's `@project.inputFiles << fileName` (l.110) only happens on a
    // successful open.
    project.inputFiles.push(fileName,);
    return result as T;
  }

  /** Id of the parsed project, or `null` when nothing was parsed. */
  get projectId(): string | null {
    return this.project?.id ?? null;
  }

  /** Name of the parsed project, or `null` when nothing was parsed. */
  get projectName(): string | null {
    return this.project?.name ?? null;
  }

  /**
   * Number of errors recorded by the message handler so far.
   *
   * Mirrors TaskJuggler, where the facade simply reflects the handler count.
   */
  get errors(): number {
    // TaskJuggler.rb:384-386 — mirrors the MessageHandler count.
    return MessageHandlerInstance.instance.errors;
  }
}

/**
 * Original markup of an RTI (`query.richText.inputText` in Ruby).
 *
 * Mirrors the same-named private helper of `model/resource.ts`: Ruby does
 * `query_journal(query).richText.inputText` and prints it; here the text is
 * returned for {@link TaskJuggler.lastSheetReport}. Empty string when the RTI
 * shape is not the expected one (only happens with an RTI from another origin).
 */
function inputTextOf(rti: unknown,): string {
  const source = (rti as { richText?: { inputText?: unknown } } | null)
    ?.richText;
  return typeof source?.inputText === "string" ? source.inputText : "";
}
