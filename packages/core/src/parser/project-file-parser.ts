/**
 * ProjectFileParser — specialisation of the `TextParser` for TJP files.
 *
 * Port of `ProjectFileParser.rb` (whole file). Provides the state fields,
 * `open`/`close`, token delegation, the global macros and the convention
 * helpers used by the syntax rules (`TjpSyntaxRules`, sub-phases 10.11–10.14).
 *
 * SyntaxMesh extension (ADR 023, sub-phase 10.17): `open` detects the
 * `language "xx"` directive in the master file and creates the
 * `ProjectFileScanner` in the matching language; the parser itself stays
 * language-agnostic (canonical keywords).
 *
 * @see docs/taskjuggler/lib/taskjuggler/ProjectFileParser.rb
 */
import { AttributeBase, } from "../attributes/attribute-base.ts";
import { AttributeDefinition, } from "../attributes/attribute-definition.ts";
import { AttributeOverwrite, } from "../model/errors.ts";
import { AttributeType, } from "../attributes/attribute-type.ts";
import { globalRegistry, LanguageRegistry, } from "../i18n/mod.ts";
import {
  type FileTextLoader,
  loadFileText,
  type LogLike,
} from "../lexer/stream-handle.ts";
import { Macro, Template, } from "../lexer/macro-table.ts";
import type { AddTemplateResult, } from "../lexer/macro-table.ts";
import { ProjectFileScanner, } from "../lexer/project-file-scanner.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { Limits, } from "../scheduling/limits.ts";
import type { ScoreboardInterval, } from "../time/scoreboard-interval.ts";
import { SourceFileInfo, } from "../source-file-info.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { TjTime, } from "../time/tj-time.ts";
import { PropertySet, } from "../model/property-set.ts";
import { TableReport, } from "../reports/table-report.ts";
import { PropertyTreeNode, } from "../model/property-tree-node.ts";
import { Project, } from "../model/project.ts";
import { Report, } from "../model/report.ts";
import { Resource, } from "../model/resource.ts";
import { Task, } from "../model/task.ts";
import {
  type RichTextFactory,
  RichTextFactoryImpl,
} from "../richtext/factory.ts";
import { MarkdownFactory, } from "../markdown/factory.ts";
import type { EntryFormat, } from "../model/journal.ts";
import type { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import type { Rule, } from "./rule.ts";
import { TokenDoc, } from "../lexer/token-doc.ts";
import { type ParserToken, TextParser, } from "./text-parser.ts";
import { registerTjpRules, } from "./rules/mod.ts";
import {
  formatExtensionList,
  isProjectFileName,
  PROJECT_FILE_EXTENSIONS,
} from "./file-extensions.ts";

/** No-op LogLike — the core does not depend on the concrete Log of the app. */
const NULL_LOG: LogLike = {
  msg: () => {},
  activity: () => {},
  startProgressMeter: () => {},
  stopProgressMeter: () => {},
};

/**
 * `language "pt-BR"` directive (sub-phase 10.17). Returns the language code,
 * or null when the directive is absent.
 *
 * @param content Text of the project file.
 * @returns The declared language code, or `null`.
 */
export function detectLanguage(content: string,): string | null {
  const m = content.match(/^\s*language\s+"([^"]+)"/m,);
  return m ? m[1]! : null;
}

/**
 * Extensions accepted for the **master** file of a project.
 *
 * Re-exported from `file-extensions.ts` (single source shared with the grammar
 * rules) — see 24.2.36.
 */
export {
  formatExtensionList,
  isProjectFileName,
  PROJECT_FILE_EXTENSIONS,
} from "./file-extensions.ts";

/**
 * Parser of TJP project files: owns the grammar state while the FSM reduces the
 * syntax rules, and creates the entities of the project being read.
 */
export class ProjectFileParser extends TextParser {
  /** Project being processed (Ruby @project). */
  project: Project | null = null;
  /**
   * Injected RichText factory (phase 12.18). When absent, `newRichText` creates
   * a {@link RichTextFactoryImpl} on demand with the current project.
   */
  richTextFactory: RichTextFactory | null = null;
  /**
   * Injected Markdown factory (14C.5.1). When absent, `newRichText` creates a
   * {@link MarkdownFactory} on demand for scopes with `format markdown`.
   */
  markdownFactory: RichTextFactory | null = null;
  /** Target property of the attributes being processed (Ruby @property). */
  property: PropertyTreeNode | null = null;
  /** Index of the current scenario (Ruby @scenarioIdx). */
  scenarioIdx = 0;
  /** Property stack for nested 'supplement' (Ruby @idStack). */
  idStack: Array<PropertyTreeNode | null> = [];

  /** Variables with file scope (Ruby @fileStackVariables). */
  fileStackVariables: string[] = [];
  /** File-scope stack (Ruby @fileStack). */
  fileStack: Array<Record<string, string>> = [];

  /** ID prefix inherited from the included files (Ruby @taskprefix etc.). */
  taskprefix = "";
  /** ID prefix of the reports. */
  reportprefix = "";
  /** ID prefix of the resources. */
  resourceprefix = "";
  /** ID prefix of the accounts. */
  accountprefix = "";

  /** Allocation being processed (used by rules 10.11+). */
  allocate: unknown = null;
  /** Booking being processed. */
  booking: unknown = null;
  /** Journal entry being processed. */
  journalEntry: unknown = null;
  /** Picture being processed (phase 10 completion C3.3). */
  picture: unknown = null;
  /** Task dependency being processed. */
  taskDependency: unknown = null;
  /** Navigator being processed. */
  navigator: unknown = null;
  /**
   * Identifier (`<id>` or `"<name>"`) read right after the `material` keyword,
   * in the funnel rule `material` (Extra Addendum §12.2, 14C.14.3). It serves
   * both as the material ID in a declaration and as the component reference in a
   * composition — the FSM consumes the single token and only branches on the
   * next one.
   */
  pendingMaterialRef: string | null = null;
  /** Defined navigators (Ruby `@project['navigators']`). */
  readonly navigators = new Map<string, unknown>();
  /** Limits block being processed. */
  limits: Limits | null = null;
  /** Interval of the limits block being processed. */
  limitInterval: ScoreboardInterval | null = null;
  /** Resources listed by the limits block being processed. */
  limitResources: Resource[] = [];
  /** Shift assignments being processed. */
  shiftAssignments: unknown = null;

  /** Column of a report being processed. */
  column: unknown = null;
  /** Time sheet being processed. */
  timeSheet: unknown = null;
  /** Time sheet record being processed. */
  timeSheetRecord: unknown = null;
  /** Author of the time sheet being processed. */
  sheetAuthor: unknown = null;
  /** Start of the time sheet being processed. */
  sheetStart: unknown = null;
  /** End of the time sheet being processed. */
  sheetEnd: unknown = null;
  /** Moderator of the time sheet being processed. */
  sheetModerator: unknown = null;
  /** Property stack for nested statusSheetTask (Ruby @propertyStack). */
  propertyStack: unknown[] = [];
  /**
   * Stack of `timeSheetRecord` for `material` blocks inside a `task` of a sheet
   * (extension 18.17.10): when the material closes, the record of the owning
   * task becomes current again.
   */
  sheetRecordStack: unknown[] = [];
  /** Counter of the reports already created. */
  reportCounter = 0;
  /**
   * `true` when the `stdout` modifier (phase 24 — SyntaxMesh extension) was read
   * in the header of the current report. Consumed and cleared by `newReport`,
   * which writes the property into the freshly created report (addendum §2.2).
   */
  stdoutRequested = false;
  /** ID of the project being read. */
  projectId = "";

  /** Sort criteria of the report being processed. */
  sortProperty: string[] | null = null;
  /** Rule to extend without a scenario. */
  ruleToExtend: Rule | null = null;
  /** Rule to extend with a scenario. */
  ruleToExtendWithScenario: Rule | null = null;
  /** Property set that receives the attributes being processed. */
  propertySet: PropertySet | null = null;

  /** Language of the file (SyntaxMesh extension — ADR 023). */
  language: string;
  /** Language registry used by the scanner. */
  registry: LanguageRegistry;
  /**
   * Injected content reader (phase 24 — ADR 034).
   *
   * `null` = legacy behaviour (static hook/`Deno`). When set, every file opened
   * — master and `include`s — and the language detection read through it, with
   * no filesystem access.
   */
  fileLoader: FileTextLoader | null = null;

  /** Current TJP scanner (narrowing of the `scanner` of the base class). */
  protected tjpScanner: ProjectFileScanner | null = null;

  /** Access to the scanner for tests and macro inspection. */
  get scannerRef(): ProjectFileScanner | null {
    return this.tjpScanner;
  }

  /**
   * Creates the parser and compiles the TJP grammar.
   *
   * @param language Default language of the project files.
   * @param registry Registry used to canonicalize keywords and units.
   */
  constructor(
    language = "en",
    registry: LanguageRegistry = globalRegistry,
  ) {
    super();
    // Token types the ProjectFileScanner may return for variables.
    this.variables = [
      "INTEGER",
      "FLOAT",
      "DATE",
      "TIME",
      "STRING",
      "LITERAL",
      "ID",
      "ID_WITH_COLON",
      "ABSOLUTE_ID",
      "MACRO",
      "TEMPLATE",
      "KEYWORD",
    ];
    this.language = language;
    this.registry = registry;
    this.project = null;
    // Nothing of the parser must be flagged as 'inherited' during the parse.
    AttributeBase.setMode(0,);
    this.initRules();
    this.updateParserTables();
  }

  /**
   * Registration of the TJP rules. Replaces the Ruby `rule_*` reflection:
   * `TjpSyntaxRules` is ported as function modules (10.11–10.14).
   */
  override initRules(): void {
    registerTjpRules(this,);
  }

  /**
   * Opens a file (or buffer) for processing. `master` marks the root file of the
   * include hierarchy. In buffer mode, `bufferName` names the text (it enters
   * `inputFiles`/messages); without it the text itself plays the role of name
   * (legacy behaviour).
   *
   * @param file Path of the file, or the text itself in buffer mode.
   * @param master Whether this is the root file of the include hierarchy.
   * @param fileNameIsBuffer Whether `file` holds the text instead of a path.
   * @param bufferName Optional buffer name used in messages.
   */
  open(
    file: string,
    master: boolean,
    fileNameIsBuffer = false,
    bufferName?: string,
  ): void {
    let language = this.language;
    if (master) {
      // 10.17: pre-scan of the `language "..."` directive (master only).
      const detected = this.detectLanguageOfFile(file, fileNameIsBuffer,);
      if (detected !== null) {
        language = detected;
      }
    }
    const scanner = new ProjectFileScanner(
      bufferName ?? file,
      NULL_LOG,
      language,
      this.registry,
    );
    scanner.setFileLoader(this.fileLoader,);
    this.tjpScanner = scanner;
    // The base uses `this.scanner` to delegate error/warning/sourceFileInfo.
    this.scanner = scanner;
    this.language = language;

    // Template context (phase 23, 23.6): `project` and `ids()` are read
    // **lazily** — the `${NAME …}` calls happen after the header.
    scanner.setProjectContextProvider(() => this.templateProjectContext());
    scanner.setTemplateIdResolver((id: string,) => this.templateResolveId(id,));

    // We need the ProjectFileScanner object for error reporting.
    if (
      master && !fileNameIsBuffer && file !== "." && !isProjectFileName(file,)
    ) {
      this.error(
        "illegal_extension",
        "Project file name must end with " +
          `${formatExtensionList(PROJECT_FILE_EXTENSIONS,)} extension`,
      );
    }
    scanner.open(
      fileNameIsBuffer,
      fileNameIsBuffer ? file : undefined,
      bufferName,
    );

    this.property = null;
    this.scenarioIdx = 0;
    this.initFileStack();
    // Stack for property IDs. Needed to handle nested 'supplement'
    // statements.
    this.idStack = [];

    // Global macros only make sense when a project already exists (reopening
    // the master after 'project'); on the first calls @project is null.
    if (master && this.project) {
      this.setGlobalMacros();
    }
  }

  /**
   * **Read-only** view of `project` for the template context (§4.7).
   *
   * Frozen at runtime (`Object.freeze`) and without setters: a template body may
   * read `project.name`, `project.start` etc., but cannot change the project.
   * Returns `null` before the header — the scanner then uses an empty view.
   */
  private templateProjectContext(): Readonly<Record<string, unknown>> | null {
    const project = this.project;
    if (!project) return null;
    return Object.freeze({
      id: project.id,
      name: project.name,
      version: project.version,
      start: project.get("start",),
      end: project.get("end",),
      now: project.get("now",),
      currency: project.get("currency",),
    },);
  }

  /**
   * Resolves a property ID to its `fullId` (`ids()` of §4.7).
   * An unknown ID comes back unchanged: the template decides what to do, and the
   * reference error itself is the responsibility of the TJP interpreter.
   */
  private templateResolveId(id: string,): string {
    const project = this.project;
    if (!project) return id;
    const candidates = [
      project.tasks,
      project.resources,
      project.accounts,
      project.materials,
      project.reports,
      project.shifts,
    ];
    for (const set of candidates) {
      const node = set.get(id,);
      if (node) return node.fullId;
    }
    return id;
  }

  /** Sets (or clears) the injected content reader of this parser. */
  setFileLoader(loader: FileTextLoader | null,): void {
    this.fileLoader = loader;
  }

  /** Closes the scanner and clears the structures. */
  close(): void {
    if (this.tjpScanner) {
      this.tjpScanner.close();
    }
    this.scanner = null;
    this.tjpScanner = null;
  }

  /** Hands the next token of the scanner to the FSM. */
  protected override nextToken(): ParserToken {
    if (!this.tjpScanner) {
      return ["endOfText", "", null,];
    }
    return this.tjpScanner.nextToken() as ParserToken;
  }

  /** Hands the token back to the scanner (LIFO push-back). */
  protected override returnToken(token: ParserToken | null,): void {
    if (this.tjpScanner && token) {
      this.tjpScanner.returnToken(token,);
    }
  }

  /**
   * Reads the text of the file only to detect the language (10.17).
   * Silent on error — the later open will report the real problem.
   */
  private detectLanguageOfFile(
    file: string,
    fileNameIsBuffer: boolean,
  ): string | null {
    try {
      const content = fileNameIsBuffer
        ? file
        : (this.fileLoader ?? loadFileText)(file,);
      const lang = detectLanguage(content,);
      if (lang === null) return null;
      if (lang !== "en" && this.registry.get(lang,) === null) {
        this.warning(
          "language_unknown",
          `Language '${lang}' is not supported. Falling back to 'en'.`,
        );
        return "en";
      }
      return lang;
    } catch {
      return null;
    }
  }

  /**
   * Default macros present in every file after the project header has been read
   * (Ruby setGlobalMacros).
   */
  setGlobalMacros(): void {
    if (!this.project || !this.tjpScanner) return;
    const sfi = this.tjpScanner.sourceFileInfo();
    const start = this.project.get("start",) as TjTime | undefined;
    const end = this.project.get("end",) as TjTime | undefined;
    const now = this.project.get("now",) as TjTime | undefined;
    const timeFormat = (this.project.get("timeFormat",) as string) ??
      undefined;
    this.tjpScanner.addMacro(
      new Macro("projectstart", start ? start.to_s() : "", sfi,),
    );
    this.tjpScanner.addMacro(
      new Macro("projectend", end ? end.to_s() : "", sfi,),
    );
    this.tjpScanner.addMacro(
      new Macro("now", now ? now.to_s() : "", sfi,),
    );
    this.tjpScanner.addMacro(
      new Macro(
        "today",
        now ? now.to_s(timeFormat ?? "%Y-%m-%d",) : "",
        sfi,
      ),
    );
  }

  /** Parses the dynamic attributes of a report (Ruby l.105-110). */
  parseReportAttributes(report: Report, attributes: string,): void {
    this.open(attributes, false, true,);
    this.property = report;
    this.project = report.project as unknown as Project;
    this.parse("dynamicAttributes",);
  }

  /**
   * Applies to an **already parsed** project a fragment that contains only
   * report declarations (`resourcereport`, `timesheetreport`, …).
   *
   * Equivalent to the `addFile` of the Ruby `ReportServer`:
   * `@tj.parseFile(file, :reportPropertiesFile)`
   * (docs/taskjuggler/lib/taskjuggler/daemon/ReportServer.rb l.109), called by
   * `Tj3Client report prj <id> = <file>`. The `SheetSender` (phase 18) assembles
   * the definition as text and needs it inside the project, in-process.
   *
   * Use `reportPropertiesFile` and not `reports`: the second one is only the
   * list of **table** reports (`resourcereport`, `taskreport`, …) and does not
   * accept `timesheetreport`/`statussheetreport` — the first one includes
   * `statusSheetReport`/`timeSheetReport` and ends with the `.` token (end of
   * file), which closes the fragment cleanly.
   */
  parseReportList(fragment: string,): void {
    if (!this.project) return;
    this.open(fragment, false, true,);
    this.parse("reportPropertiesFile",);
  }

  // ---------------------------------------------------------------------
  // Helpers used by the rule actions (`TjpSyntaxRules`).
  // ---------------------------------------------------------------------

  /**
   * Converts the name of a weekday (val[0]) into the index 0=Sun, 1=Mon...
   * Port of weekDay. Days in other languages were already normalized by the
   * scanner to the canonical English forms (ADR 023).
   *
   * @param name Weekday name; defaults to the first pattern value.
   * @returns The weekday index, or -1 when the name is unknown.
   */
  weekDay(name?: unknown,): number {
    const names = ["sun", "mon", "tue", "wed", "thu", "fri", "sat",];
    const day = names.indexOf(String(name ?? this.val[0],),);
    if (day < 0) {
      this.error(
        "weekday",
        `Weekday name expected (${names.join(", ",)})`,
      );
    }
    return day;
  }

  /** Rejects attributes after sub-properties (Ruby checkContainer). */
  checkContainer(attribute: string,): void {
    if (this.property && this.property.container()) {
      this.error(
        "container_attribute",
        `The attribute ${attribute} may not be used for this property ` +
          "after sub properties have been added.",
        this.sourceFileInfo[0] ?? null,
        this.property,
      );
    }
  }

  /** The TimeInterval must fit entirely inside the project time frame. */
  checkInterval(iv: TimeInterval,): void {
    const start = this.project?.get("start",) as TjTime | undefined;
    const end = this.project?.get("end",) as TjTime | undefined;
    if (!start || !end) return;
    if (
      iv.start.toSeconds() < start.toSeconds() ||
      iv.start.toSeconds() >= end.toSeconds()
    ) {
      this.error(
        "interval_start_in_range",
        `Start date ${iv.start.to_s()} must be within the project time ` +
          `frame (${start.to_s()} - ${end.to_s()})`,
      );
    }
    if (
      iv.end.toSeconds() <= start.toSeconds() ||
      iv.end.toSeconds() > end.toSeconds()
    ) {
      this.error(
        "interval_end_in_range",
        `End date ${iv.end.to_s()} must be within the project time ` +
          `frame (${start.to_s()} - ${end.to_s()})`,
      );
    }
  }

  /**
   * Validates the integrity of a 'booking' statement. `sfi` is the origin of the
   * error line — the token of the id (task/resource). With the optional `effort`
   * placed first in the grammar (14C.15.1-2), `sourceFileInfo[0]` is no longer
   * the id, so the caller passes the right index explicitly.
   */
  checkBooking(
    task: Task,
    resource: Resource,
    sfi: SourceFileInfo | null = this.sourceFileInfo[0] ?? null,
  ): void {
    if (!task.leaf()) {
      this.error(
        "booking_no_leaf",
        `${task.fullId} is not a leaf task`,
        sfi,
        task,
      );
    }
    if (task.getForScenario("milestone", this.scenarioIdx,)) {
      this.error(
        "booking_milestone",
        "You cannot add bookings to a milestone",
        sfi,
        task,
      );
    }
    if (!resource.leaf()) {
      this.error(
        "booking_group",
        "You cannot book a group resource",
        sfi,
        resource,
      );
    }
  }

  /**
   * Extends the current PropertySet with a user-defined attribute (the
   * 'extend' directive). Returns whether the attribute is scenario-specific.
   *
   * @param type Type of the new attribute.
   * @param defaultValue Default value of the new attribute.
   * @returns Whether the attribute is scenario-specific.
   */
  extendPropertySetDefinition(
    type: AttributeType,
    defaultValue: unknown,
  ): boolean {
    if (!this.propertySet) {
      return false;
    }
    const attrId = String(this.val[1],);
    const attrName = String(this.val[2],);
    if (this.propertySet.knownAttribute(attrId,)) {
      this.error(
        "extend_redefinition",
        `The extended attribute ${attrId} has already been defined.`,
      );
    }

    // Determine the values for scenarioSpecific and inheritable.
    let inherit = false;
    let scenarioSpecific = false;
    const options = this.val[3] as string[] | null | undefined;
    if (options) {
      for (const option of options) {
        if (option === "inherit") {
          inherit = true;
        } else if (option === "scenariospecific") {
          scenarioSpecific = true;
        }
      }
    }
    this.propertySet.addAttributeType(
      new AttributeDefinition(
        attrId,
        attrName,
        type,
        defaultValue,
        true, // userDefined / user-extendable
        false, // isList
        false, // isSingleton
        scenarioSpecific,
        inherit, // inheritedFromParent
      ),
    );

    // Add the new user-defined attribute as reportable attribute.
    const oldCurrentRule = this.cr;
    const reportable = this.rules.get("reportableAttributes",) ?? null;
    if (reportable) {
      this.cr = reportable;
      if (!reportable.includes(attrId,)) {
        this.singlePattern("_" + attrId,);
        this.descr(attrName,);
      }
    }
    this.cr = oldCurrentRule;

    return scenarioSpecific;
  }

  /**
   * Injects the RichText factory used by {@link newRichText} (phase 12.18.3).
   * The phase 10 parser called an anchored stub; with the real factory plugged
   * in, `note`/`details`/etc. really produce a `RichTextIntermediate`.
   *
   * @param factory Factory that creates the rich-text trees.
   */
  setRichTextFactory(factory: RichTextFactory,): void {
    this.richTextFactory = factory;
  }

  /** Injects the Markdown factory used by `newRichText(..., "markdown")`. */
  setMarkdownFactory(factory: RichTextFactory,): void {
    this.markdownFactory = factory;
  }

  /**
   * RichText wrapper (ProjectFileParser.rb:221-233). Creates the
   * `RichTextIntermediate` through the factory of the requested dialect, setting
   * the SourceFileInfo baseline so that messages from the RichText parser point
   * to the source file.
   *
   * `format` (extension 14C.5.1) chooses the pipeline: `richtext` — the default,
   * the dialect of `.tjp` — uses {@link RichTextFactoryImpl}; `markdown` uses
   * {@link MarkdownFactory} (phase 13). Both produce the same
   * `RichTextIntermediate`, so `to_s()`/`to_html()` of the reports do not need to
   * know which one was used.
   *
   * @param text Markup source of the rich text.
   * @param sfi Location of the markup, used as the message baseline.
   * @param tokenSet Tokens allowed by the inner parser, or `null` for all.
   * @param format Pipeline that parses the markup.
   * @returns The parsed rich text.
   */
  newRichText(
    text: string,
    sfi: SourceFileInfo | null,
    tokenSet: string[] | null = null,
    format: EntryFormat = "richtext",
  ): RichTextIntermediate {
    const factory = format === "markdown"
      ? (this.markdownFactory ?? new MarkdownFactory(this.project, sfi,))
      : (this.richTextFactory ?? new RichTextFactoryImpl(this.project, sfi,));
    const mh = MessageHandlerInstance.instance;
    mh.baselineSFI = sfi;
    try {
      const rti = factory.create(text, tokenSet,);
      rti.sectionNumbers = false;
      return rti;
    } finally {
      mh.baselineSFI = null;
    }
  }

  /**
   * Creates a unique Report with id/duplicate checks.
   * Port of newReport (Ruby l.240-280).
   *
   * @param id ID of the report, or `null` to generate one.
   * @param name Name of the report.
   * @param type Type spec of the report (`taskreport`, …).
   * @param sourceFileInfo Location of the declaration.
   * @param defaultAttrs Hook that sets the default attributes of the type.
   * @returns The new report, or `null` when there is no project.
   */
  newReport(
    id: string | null,
    name: string,
    type: string,
    sourceFileInfo: SourceFileInfo | null,
    defaultAttrs?: (this: ProjectFileParser,) => void,
  ): Report | null {
    if (!this.project) return null;
    // `stdout` intent read by the header's `reportStdoutFlag` (phase 24).
    const stdoutRequested = this.stdoutRequested;
    this.stdoutRequested = false;
    // If there is no parent property and the report prefix is not empty,
    // the reportprefix defines the parent property.
    if (this.property === null && this.reportprefix !== "") {
      this.property = this.project.report(this.reportprefix,);
    }

    let reportId = id;
    if (reportId) {
      // Report IDs must be unique; prepend the scope property ID.
      reportId = (this.property ? this.property.fullId + "." : "") + reportId;
      if (this.project.report(reportId,)) {
        this.error(
          "report_exists",
          `report ${reportId} has already been defined.`,
          sourceFileInfo,
          this.property,
        );
      }
    }

    this.reportCounter += 1;
    if (name !== "." && name !== "") {
      if (this.project.reportByName(name,)) {
        this.error(
          "report_redefinition",
          `A report with the name ${name} has already been defined.`,
          sourceFileInfo,
        );
      }
    }
    const report = new Report(
      this.project,
      reportId || `report${this.reportCounter}`,
      name,
      this.property ? (this.property as Report) : null,
    );
    report.typeSpec = type as never;
    report.sourceFileInfo = sourceFileInfo;
    report.inheritAttributes();
    if (stdoutRequested) report.set("stdout", true,);

    // Ruby sets @property = report BEFORE the defaults block, so that
    // defaultAttrs references the report itself (columns/hideTask/...).
    this.property = report;
    if (defaultAttrs) {
      // The default attribute values for this report type have to be set in
      // 'inherited' mode since they are not user provided.
      AttributeBase.setMode(1,);
      defaultAttrs.call(this,);
      AttributeBase.setMode(0,);
    }
    return report;
  }

  /** Creates Limits per resource when there is a resource list (Ruby l.284). */
  setLimit(
    name: string,
    value: number,
    interval?: ScoreboardInterval,
  ): void {
    if (!this.limits) return;
    if (this.limitResources.length === 0) {
      this.limits.setLimit(name, value, interval,);
    } else {
      for (const resource of this.limitResources) {
        this.limits.setLimit(name, value, interval, resource,);
      }
    }
  }

  /**
   * Marks the duration criterion of the task, resetting the others
   * (duration/length/effort/milestone are mutually exclusive).
   *
   * @param attribute Name of the duration attribute being provided.
   * @param value Value of the attribute (default `true` for milestones).
   */
  setDurationAttribute(
    attribute: string,
    value: unknown = true,
  ): void {
    this.checkContainer(attribute,);
    if (!this.property) return;
    const others: Record<string, unknown> = {
      milestone: false,
      duration: 0,
      length: 0,
      effort: 0,
    };
    for (const [attr, val,] of Object.entries(others,)) {
      if (attribute === attr) {
        this.property.setForScenario(attr, value, this.scenarioIdx,);
      } else {
        if (this.property.getAttribute(attr, this.scenarioIdx,).provided) {
          this.error(
            "multiple_durations",
            "This duration criteria is overwriting a previously provided " +
              "criteria (duration, effort, length or milestone).",
          );
        }
        this.property.setForScenario(attr, val, this.scenarioIdx,);
      }
    }
  }

  // ---------------------------------------------------------------------
  // Convenience helpers for defining the syntax tree (Ruby l.312-440).
  // ---------------------------------------------------------------------

  /**
   * Rule for a keyword list that also accepts the shortcuts `*` (every item)
   * and `-` (no item).
   *
   * @param name Name of the rule to create.
   * @param items Accepted keywords, or a map of keyword to its description.
   */
  allOrNothingListRule(
    name: string,
    items: string[] | Record<string, string | null>,
  ): void {
    this.newRule(name, () => {
      // A '*' means all possible items should be in the list.
      this.pattern(["_*",], function (this: ProjectFileParser,): unknown {
        return ["*",];
      },);
      this.descr("A shortcut for all items",);
      // A '-' means the list should be empty.
      this.pattern(["_-",], function (): unknown {
        return [];
      },);
      this.descr("No items",);
      // Or the list consists of one or more comma separated keywords.
      this.pattern(
        [`!${name}_AoN_ruleItems`,],
        function (this: ProjectFileParser,): unknown {
          return this.val[0];
        },
      );
    },);
    // Create the rule for the comma separated list.
    this.newRule(`${name}_AoN_ruleItems`, () => {
      this.listRule(`more${name}_AoN_ruleItems`, `!${name}_AoN_ruleItem`,);
    },);
    // Create the rule for the keywords with their description.
    this.newRule(`${name}_AoN_ruleItem`, () => {
      if (Array.isArray(items,)) {
        for (const keyword of items) {
          this.singlePattern("_" + keyword,);
        }
      } else {
        for (const [keyword, description,] of Object.entries(items,)) {
          this.singlePattern("_" + keyword,);
          if (description) {
            this.descr(description,);
          }
        }
      }
    },);
  }

  /**
   * Rule for a comma-separated list of _listItem_, reporting duplicates.
   *
   * @param name Name of the rule that holds the repeating tail.
   * @param listItem Rule (or literal) of a single list item.
   */
  listRule(name: string, listItem: string,): void {
    this.pattern(
      [listItem, `!${name}`,],
      function (this: ProjectFileParser,): unknown {
        const rest = this.val[1] as unknown[] | null;
        if (rest && rest.includes(this.val[0],)) {
          this.error("duplicate_in_list", "Duplicate items in list.",);
        }
        return [this.val[0],].concat(rest ?? [],);
      },
    );
    this.newRule(name, () => {
      this.commaListRule(listItem,);
    },);
  }

  /**
   * Repeating tail `_, item` of a `listRule` — optional and repeatable.
   *
   * @param listItem Rule (or literal) of a single list item.
   */
  commaListRule(listItem: string,): void {
    this.optional();
    this.repeatable();
    this.pattern(
      ["_,", listItem,],
      function (this: ProjectFileParser,): unknown {
        return this.val[1];
      },
    );
  }

  /**
   * Optional `{ ... }` block of attributes.
   *
   * @param attributes Rule that parses the attribute body.
   */
  optionsRule(attributes: string,): void {
    this.optional();
    this.pattern(
      ["_{", `!${attributes}`, "_}",],
      function (this: ProjectFileParser,): unknown {
        return this.val[1];
      },
    );
  }

  /**
   * Adds a single-item pattern that reduces to the item value itself.
   *
   * @param item Token of the pattern (a literal or a `!rule`/`$var` reference).
   */
  singlePattern(item: string,): void {
    this.pattern([item,], function (this: ProjectFileParser,): unknown {
      return this.val[0];
    },);
  }

  /**
   * Attaches generic documentation to the current pattern.
   *
   * @param keyword Short syntax being documented.
   * @param text Description shown in the generated manual.
   */
  doc(keyword: string, text: string,): void {
    this.cr?.setDoc(keyword, text,);
  }

  /**
   * Documents a pattern made of a single terminal token.
   *
   * @param text Description shown in the generated manual.
   */
  descr(text: string,): void {
    const cr = this.cr;
    if (!cr) return;
    const last = cr.patterns[cr.patterns.length - 1];
    if (
      !last || last.tokens.length !== 1 ||
      (last.tokens[0]![0] !== "literal" && last.tokens[0]![0] !== "variable")
    ) {
      throw new Error(
        "descr() may only be used for patterns with terminal tokens.",
      );
    }
    this.arg(0, null, text,);
  }

  /**
   * Documents the argument at position _idx_ of the current pattern.
   *
   * @param idx Position of the argument in the pattern.
   * @param name Argument name, or `null` for an unnamed argument.
   * @param text Description of the argument.
   */
  arg(
    idx: number,
    name: string | null,
    text: string,
  ): void {
    this.cr?.setArg(idx, new TokenDoc(name, text,),);
  }

  /**
   * Limits the documented syntax to the first _idx_ tokens of the pattern.
   *
   * @param idx Number of tokens shown in the syntax summary.
   */
  lastSyntaxToken(idx: number,): void {
    this.cr?.setLastSyntaxToken(idx,);
  }

  /**
   * Sets the support level of the current pattern.
   *
   * @param level `'current'`, `'deprecated'` or `'removed'`.
   */
  level(level: string,): void {
    this.cr?.setSupportLevel(level,);
  }

  /**
   * Adds cross references ('see also') to the current pattern documentation.
   *
   * @param seeAlso One reference, or a list of references.
   */
  also(seeAlso: string | string[],): void {
    const list = Array.isArray(seeAlso,) ? seeAlso : [seeAlso,];
    this.cr?.setSeeAlso(list,);
  }

  /**
   * Attaches a TJP example excerpt to the current pattern documentation.
   *
   * @param file Name of the example file.
   * @param tag Tag that delimits the excerpt inside the file.
   */
  example(file: string, tag: string | null = null,): void {
    this.cr?.setExample(file, tag,);
  }

  /**
   * Title of the column _colId_ in report tables.
   *
   * @param colId Column identifier.
   * @returns The column title, or `undefined` when it cannot be resolved.
   */
  columnTitle(colId: string,): string | undefined {
    if (
      this.property instanceof Report &&
      String(this.property.typeSpec,) === "tracereport"
    ) {
      return `<-id->:<-scenario->.${colId}`;
    }
    return TableReport.defaultColumnTitle(colId,) ??
      this.project?.attributeName(colId,);
  }

  // ---------------------------------------------------------------------
  // File stack — file-scope variables (Ruby l.453-505).
  // ---------------------------------------------------------------------

  /** Creates (or resets) the file-scope stack with the ID prefixes. */
  initFileStack(): void {
    this.fileStackVariables = [
      "taskprefix",
      "reportprefix",
      "resourceprefix",
      "accountprefix",
    ];
    const stackEntry: Record<string, string> = {};
    for (const variable of this.fileStackVariables) {
      stackEntry[variable] = "";
      (this as unknown as Record<string, string>)[variable] = "";
    }
    this.fileStack = [stackEntry,];
  }

  /** Pushes the current set of file-scope variables onto the stack. */
  pushFileStack(): void {
    const stackEntry: Record<string, string> = {};
    for (const variable of this.fileStackVariables) {
      stackEntry[variable] =
        (this as unknown as Record<string, string>)[variable]!;
    }
    this.fileStack.push(stackEntry,);
  }

  /**
   * Pops the stack and restores the previous file-scope variables.
   * `property` always returns to `null`, since nested includes are not allowed
   * inside an attribute block.
   */
  popFileStack(): void {
    const stackEntry = this.fileStack.pop();
    if (stackEntry) {
      for (const variable of this.fileStackVariables) {
        (this as unknown as Record<string, string>)[variable] =
          stackEntry[variable]!;
      }
    }
    // Include files can only occur at global level or in the project
    // header. In both cases the @property must be nil after the include.
    this.property = null;
  }

  /**
   * Safe append for scenario-specific lists: `<<` does not mark the attribute
   * as 'provided', so a self-set is forced afterwards (Ruby l.494-505).
   *
   * @param attrId Identifier of the list attribute.
   * @param list Values to append.
   */
  appendScListAttribute(
    attrId: string,
    list: unknown[],
  ): void {
    if (!this.property) return;
    for (const v of list) {
      (this.property.getForScenario(attrId, this.scenarioIdx,) as unknown[])
        .push(v,);
    }
    try {
      this.property.setForScenario(
        attrId,
        this.property.getForScenario(attrId, this.scenarioIdx,),
        this.scenarioIdx,
      );
    } catch (e) {
      // Overwrites are ok here.
      if (!(e instanceof AttributeOverwrite)) {
        throw e;
      }
    }
  }

  /**
   * Whether the macro _name_ is already defined in the scanner
   * (Ruby `macroDefined?`).
   *
   * @param name Name of the macro.
   * @returns `true` when the macro exists.
   */
  scannerHasMacro(name: string,): boolean {
    return this.tjpScanner ? this.tjpScanner.macroDefined(name,) : false;
  }

  /**
   * Registers a macro in the current scanner.
   *
   * @param macro Macro to register.
   */
  addScannerMacro(macro: Macro,): void {
    this.tjpScanner?.addMacro(macro,);
  }

  /**
   * Whether the template _name_ is already defined in the scanner (phase 23).
   *
   * @param name Name of the template.
   * @returns `true` when the template exists.
   */
  scannerHasTemplate(name: string,): boolean {
    return this.tjpScanner ? this.tjpScanner.templateDefined(name,) : false;
  }

  /**
   * Registers a template in the current scanner (phase 23).
   *
   * @param template Template to register.
   * @returns The result of the registration.
   */
  addScannerTemplate(template: Template,): AddTemplateResult {
    return this.tjpScanner
      ? this.tjpScanner.addTemplate(template,)
      : { ok: true, };
  }

  /**
   * Takes the parameters of the last template definition read by the scanner.
   *
   * @returns The declared parameter names, or an empty list.
   */
  takeScannerTemplateParams(): string[] {
    return this.tjpScanner ? this.tjpScanner.takeTemplateParams() : [];
  }

  /** Access to the MessageHandler — rules check the error count. */
  get messageHandler(): MessageHandlerInstance {
    return MessageHandlerInstance.instance;
  }
}
