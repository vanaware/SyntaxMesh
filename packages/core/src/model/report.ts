import { type ProjectLike, } from "./project-like.ts";
import { type Project, } from "./project.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { ReportScenario, } from "./report-scenario.ts";
import { ReportType, } from "./report-type.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { contentFactories, type ReportContent, } from "./report-content.ts";
import { NotYetImplementedError, } from "./errors.ts";
import { TjTime, } from "../time/tj-time.ts";
import { HTMLDocument, } from "../html/html-document.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { EntryFormat, } from "./journal.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { CSVFile, } from "../reports/csv-file.ts";

/**
 * A report definition — the model node created by `taskreport`, `htmlreport`,
 * `export`, and the other `*report` directives.
 *
 * The node stores only the declarative attributes. The actual rendering is
 * delegated to a {@link ReportContent} implementation picked by `typeSpec` and
 * instantiated by a factory registered in `report-content.ts`.
 */
export class Report extends PropertyTreeNode {
  /** Report type requested by the directive (the `typeSpec` of Ruby). */
  typeSpec: ReportType | null;
  /** Content generator created for `typeSpec`, or `null` before generation. */
  content: ReportContent | null;

  /**
   * Creates a report and registers it in the project.
   *
   * The file name is validated first, exactly like Ruby's
   * `Report#initialize` (l.48-52), which calls `checkFileName` before
   * `addReport`.
   *
   * @param project Project that owns the report.
   * @param id Explicit id, or `null` to derive one from the parent path.
   * @param name Output file name (`.` means stdout).
   * @param parent Parent report, or `null` at the root of the hierarchy.
   */
  constructor(
    project: ProjectLike,
    id: string | null,
    name: string,
    parent: Report | null,
  ) {
    super(project.reports, id, name, parent,);
    // Ruby Report#initialize (l.48-52): checkFileName before addReport.
    this.checkFileName(name,);
    project.addReport(this,);
    this.typeSpec = null;
    this.content = null;
    for (let i = 0; i < project.scenarioCount; i++) {
      this.data[i] = new ReportScenario(
        this,
        i,
        this.getScenarioAttributes(i,),
      );
    }
  }

  /**
   * Typed access to the scenario data of this report.
   *
   * @param scIdx Scenario index.
   * @returns The `ReportScenario` of that scenario.
   */
  override scenarioData(scIdx: number,): ReportScenario {
    return this.data[scIdx]! as ReportScenario;
  }

  /**
   * Dialect of the RichText attributes of this report (`format`, 14C.5.1).
   *
   * The default is `richtext` so existing `.tjp` files keep working; `markdown`
   * is an explicit opt-in (ADR 026). The value is inherited from parent
   * reports.
   */
  richTextFormat(): EntryFormat {
    return (this.get("format",) as EntryFormat | null) ?? "richtext";
  }

  /**
   * Raw sources of the RichText attributes already read by the parser
   * (14C.5.1).
   *
   * Because the dialect may be declared after the text, the source is kept so
   * the `RichTextIntermediate` can be rebuilt — in TJP the order of attributes
   * must not matter.
   */
  readonly richTextSources = new Map<
    string,
    { text: string; sfi: SourceFileInfo | null }
  >();

  /**
   * Rejects file names containing invalid characters.
   *
   * @param name File name to validate.
   * @see docs/taskjuggler/lib/taskjuggler/Report.rb:checkFileName
   */
  checkFileName(name: string,): void {
    // Ruby (Report.rb l.455-466): on Linux the regex is /[\\?%*:|"<>]/.
    const illegal = /[\\?%*:|"<>]/;
    if (illegal.test(name,)) {
      // `sourceFileInfo` is still nil in the constructor → null line in golden.
      MessageHandlerInstance.instance.error(
        "invalid_file_name",
        "File names may not contain any of the following characters: " +
          '\\?%*:|"<>',
        null,
        null,
        null,
        null,
      );
    }
  }

  /**
   * Returns the absolute path, prepending `outputDir` when the name is
   * relative.
   *
   * @param name File name to resolve.
   * @see docs/taskjuggler/lib/taskjuggler/Report.rb:absoluteFileName
   */
  absoluteFileName(name: string,): string {
    if (name.startsWith("/",)) {
      return name;
    }
    const outputDir = this.project.get("outputDir",);
    const dir = (outputDir as string) || "";
    return dir + "/" + name;
  }

  /**
   * Whether the name is already absolute.
   *
   * @param name File name to test.
   * @see docs/taskjuggler/lib/taskjuggler/Report.rb:absoluteFileName?
   */
  absoluteFileNameExists(name: string,): boolean {
    return name.startsWith("/",);
  }

  /**
   * Entry point of generation (phase 14.11): pins the report time zone,
   * produces the intermediate format and dispatches every requested format.
   *
   * In the browser (ADR 027) nothing is written to disk: `generate` produces the
   * content and records the logical file name in `outputFileName`.
   *
   * @param requestedFormats Formats to render; defaults to the `formats`
   *   attribute of the report.
   * @returns `0` on success.
   * @throws {Error} When a requested format is unknown.
   * @see docs/taskjuggler/lib/taskjuggler/reports/Report.rb:generate
   */
  generate(requestedFormats?: string[],): number {
    const tz = this.get("timezone",) as string | null;
    const oldTimeZone = tz ? TjTime.setTimeZone(tz,) : null;

    this.outputs.clear();
    this.generateIntermediateFormat();

    // Either the requested formats or the ones from the report definition.
    for (
      const format of requestedFormats ??
        (this.get("formats",) as string[] | null) ?? []
    ) {
      if (this.name === "") {
        MessageHandlerInstance.instance.error(
          "empty_report_file_name",
          `Report ${this.id} has output formats requested, but the ` +
            "file name is empty.",
          this.sourceFileInfo,
          null,
          null,
          null,
        );
      }

      switch (format) {
        case "iCal":
          this.generateICal();
          break;
        case "html":
          this.generateHTML();
          this.copyAuxiliaryFiles();
          break;
        case "csv":
          this.generateCSV();
          break;
        // SyntaxMesh extension (14C.0.1): first-class JSON.
        case "json":
          this.generateJSON();
          break;
        // SyntaxMesh extension (addendum §10 / 14C.8): Markdown output (`.md`).
        case "markdown":
          this.generateMarkdown();
          break;
        case "ctags":
          this.generateCTags();
          break;
        case "niku":
          this.generateNiku();
          break;
        case "tjp":
          this.generateTJP();
          break;
        case "mspxml":
          this.generateMspXml();
          break;
        default:
          throw new Error(`Unknown report output format ${format}.`,);
      }

      // Single collection point per format (phase 24): each `generate*` leaves
      // the result in `output`; here it becomes text in the section map.
      this.outputs.set(format, this.outputAsText(),);
    }

    if (oldTimeZone) TjTime.setTimeZone(oldTimeZone,);
    return 0;
  }

  /**
   * Normalizes the `output` of the last generation to text.
   *
   * CSV (array of arrays) goes through `CSVFile` with the default `';'`
   * separator; `null` (unsupported format) becomes an empty string.
   */
  private outputAsText(): string {
    if (this.output === null || this.output === undefined) return "";
    if (Array.isArray(this.output,)) {
      const csv = new CSVFile(this.output as unknown[][],);
      return csv.to_s();
    }
    return String(this.output,);
  }

  /**
   * Produces the output-agnostic intermediate format by instantiating the
   * content registered for `typeSpec` (see `report-content.ts`).
   *
   * @throws {Error} When the report type is unknown.
   * @throws {NotYetImplementedError} When the type is known but its content is
   *   not ported yet.
   * @see docs/taskjuggler/lib/taskjuggler/reports/Report.rb:generateIntermediateFormat
   */
  generateIntermediateFormat(): void {
    const scenarios = this.get("scenarios",) as number[] | null;
    if (!scenarios || scenarios.length === 0) {
      MessageHandlerInstance.instance.warning(
        "all_scenarios_disabled",
        `The report ${this.fullId} has only disabled scenarios. The ` +
          "report will possibly be empty.",
        this.sourceFileInfo,
        null,
        null,
        null,
      );
    }

    this.content = null;
    // Normalized key: the parser uses the bare keywords (`iCal`, `statusSheet`)
    // and the enum has other casing; Ruby's dispatch matches both forms.
    const type = this.typeSpec === null ? null : String(this.typeSpec,);
    const key = type === null ? null : type.toLowerCase();
    const factory = key === null ? undefined : contentFactories.get(key,);
    if (key === null || (!factory && !KNOWN_TYPE_SPECS.has(key,))) {
      throw new Error("Unknown report type",);
    }
    if (!factory) {
      // The phase 14 contents are registered (reports/mod.ts); the known types
      // without a remaining factory are the sheets.
      // The phase 14 Complemento extensions have their own anchor (C1/C2/C3).
      const block = EXTENSION_TYPE_BLOCKS.get(key!,);
      if (block) {
        // Ancorado: Fase 14C — complement content not registered yet.
        throw new NotYetImplementedError(block.id, `Report content '${type}'`,);
      }
      // Ancorado: Fase 18 — timesheet/statussheet contents not ported.
      throw new NotYetImplementedError("18", `Report content '${type}'`,);
    }
    this.content = factory(this,);

    // Most outputs are generated from the intermediate format.
    this.content?.generateIntermediateFormat();
  }

  /** Report content as HTML (without the document frame). */
  to_html(): XMLElementLike[] | XMLElementLike | string | null {
    return this.content?.to_html ? this.content.to_html() : null;
  }

  /**
   * Whether the report should be rendered in interactive mode. The top-level
   * report defines both the output format and the interactive setting.
   */
  "interactive?"(): boolean {
    const contexts = (this.project as Project).reportContexts;
    return contexts.length > 0 &&
      contexts[0]!.report.get("interactive",) === true;
  }

  /** Logical file name of the last generated output (`.` = stdout). */
  outputFileName = "";

  /**
   * Content produced by the last `generate*` (a string, or an array of arrays
   * for CSV). In the browser (ADR 027) nothing is written to disk — callers of
   * `generate()` read the result from here.
   */
  output: string | unknown[][] | null = null;

  /**
   * Rendered content of **every** format in the last `generate()` (phase 24 —
   * source of the `results.reports` section of the envelope).
   *
   * The key is the declared format id and the value is already text (CSV
   * normalized by `CSVFile`, and `null` from an unsupported format turned into
   * `""`). The legacy `output`/`outputFileName` stay untouched for the UI.
   *
   * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.2/§3.3
   */
  readonly outputs: Map<string, string> = new Map();

  /**
   * Full HTML of the report as a string (ADR 026/027: no disk writes).
   */
  private generateHTML(): string | null {
    if (!this.content) return null;
    if (!this.content.to_html) {
      this.warnUnsupported("html",);
      return null;
    }

    const title = `${this.project.get("name",)} - ${
      (this.get("title",) as string | null) ?? this.name
    }`;
    const doc = new HTMLDocument();
    // `generateHead` returns `doc.html` (Ruby Report.rb:181-207): the
    // stylesheet `link` is a sibling of `<head>`, not its child.
    const head = doc.generateHead(title,);

    const auxDir = (this.get("auxdir",) as string | null) ?? "";
    head.append(
      new XMLElement("link", {
        rel: "stylesheet",
        type: "text/css",
        href: `${auxDir}css/tjreport.css`,
      },),
    );

    const body = new XMLElement("body",);
    doc.html.append(body,);
    if (!this.get("selfcontained",)) {
      body.append(
        new XMLElement("script", {
          type: "text/javascript",
          src: `${auxDir}scripts/wz_tooltip.js`,
        },),
      );
      const noscript = new XMLElement("noscript",);
      const nsdiv = new XMLElement("div", {
        style: "text-align:center; color:#FF0000",
      },);
      nsdiv.append(
        "This page requires Javascript for full functionality. Please " +
          "enable it in your browser settings!",
      );
      noscript.append(nsdiv,);
      body.append(noscript,);
    }

    // Frame with margins around the report.
    const frame = new XMLElement("div", { class: "tj_page", },);
    const contentHtml = this.content.to_html();
    for (
      const child of Array.isArray(contentHtml,) ? contentHtml : [contentHtml,]
    ) {
      frame.append(child,);
    }
    frame.append(this.copyrightDiv(),);
    body.append(frame,);

    this.outputFileName = this.get("interactive",) || this.name === "."
      ? "."
      : this.absoluteFileName(this.name,) + ".html";
    const html = doc.write(".",) ?? "";
    this.output = html;
    return html;
  }

  /** Administrative footer (copyright, project, version, date). */
  private copyrightDiv(): XMLElement {
    const div = new XMLElement("div", { class: "copyright", },);
    const copyright = this.project.get("copyright",) as string | null;
    if (copyright) div.append(`${copyright} - `,);
    div.append(
      `Project: ${this.project.get("name",)} ` +
        `Version: ${this.project.get("version",) ?? ""} - Created on ` +
        `${TjTime.now().to_s("%Y-%m-%d %H:%M:%S",)} with SyntaxMesh`,
    );
    return div;
  }

  /**
   * Markdown document of the report (SyntaxMesh extension — addendum §10).
   *
   * The heading follows the same format as the HTML one
   * (`<project> - <title|name>`) and the body comes from `content.to_markdown()`.
   * The logical file name ends in `.md`. As with CSV/JSON, the content lands in
   * `output` (ADR 027).
   */
  private generateMarkdown(): string | null {
    if (!this.content?.to_markdown) {
      this.warnUnsupported("markdown",);
      return null;
    }
    const body = this.content.to_markdown();
    if (body === null) return null;
    // The project name lives in the `Project` field, not in the attribute
    // dictionary (there is no `get("name")`); the title follows the same
    // format as HTML.
    const projectName = (this.project as unknown as { name?: string }).name ??
      String(this.project.get("name",) ?? "",);
    const heading = `# ${projectName} - ${
      (this.get("title",) as string | null) ?? this.name
    }`;
    const text = body.replace(/\s+$/u, "",);
    const md = text === "" ? `${heading}\n` : `${heading}\n\n${text}\n`;
    // The report name is the file name (as in HTML), so `plan.md` does not
    // become `plan.md.md`; without the suffix, it is appended.
    const fileName = this.name.endsWith(".md",) ? this.name : this.name + ".md";
    this.outputFileName = this.name === "."
      ? "."
      : this.absoluteFileName(fileName,);
    this.output = md;
    return md;
  }

  /** CSV of the report as an array of arrays (equivalent to `CSVFile ';'`). */
  private generateCSV(): unknown[][] | null {
    // CSV can only handle the first element of the report.
    if (!this.content) return null;
    if (!this.content.to_csv) {
      this.warnUnsupported("csv",);
      return null;
    }
    const csv = this.content.to_csv();
    if (!csv) return null;
    this.outputFileName = this.name === "." ?
      "."
      : this.absoluteFileName(this.name,) + ".csv";
    this.output = csv;
    return csv;
  }

  /** JSON of the report as a string (SyntaxMesh extension — 14C.0.1). */
  private generateJSON(): string | null {
    if (!this.content?.toJSON) {
      this.warnUnsupported("json",);
      return null;
    }
    const json = this.content.toJSON();
    this.outputFileName = this.name === "." ?
      "."
      : this.absoluteFileName(this.name,) + ".json";
    this.output = json;
    return json;
  }

  /**
   * Report in TJP format (`.tjp` when it exports the project, `.tji`
   * otherwise).
   */
  private generateTJP(): string | null {
    if (!this.content?.to_tjp) {
      this.warnUnsupported("tjp",);
      return null;
    }
    const tjp = this.content.to_tjp();
    const definitions = (this.get("definitions",) as string[] | null) ?? [];
    this.outputFileName = this.name === "." ? "." : this.name +
      (definitions.includes("project",) ? ".tjp" : ".tji");
    this.output = tjp;
    return tjp;
  }

  /** Report in Microsoft Project XML format. */
  private generateMspXml(): string | null {
    if (!this.content?.to_mspxml) {
      this.warnUnsupported("mspxml",);
      return null;
    }
    const xml = this.content.to_mspxml();
    this.outputFileName = this.name === "." ?
      "."
      : this.absoluteFileName(this.name,) + ".xml";
    this.output = xml;
    return xml;
  }

  /** Report in Niku (Clarity) XML format. */
  private generateNiku(): string | null {
    if (!this.content?.to_niku) {
      this.warnUnsupported("niku",);
      return null;
    }
    const niku = this.content.to_niku();
    this.outputFileName = this.name === "." ?
      "."
      : this.absoluteFileName(this.name,) + ".xml";
    this.output = niku + "\n"; // Ruby `f.puts` acrescenta quebra de linha.
    return this.output;
  }

  /** Report in iCalendar format. */
  private generateICal(): string | null {
    if (!this.content?.to_iCal) {
      this.warnUnsupported("ical",);
      return null;
    }
    const ical = this.content.to_iCal();
    this.outputFileName = this.name === "." ?
      "."
      : this.absoluteFileName(this.name,) + ".ics";
    this.output = ical + "\n"; // Ruby `f.puts` acrescenta quebra de linha.
    return this.output;
  }

  /** ctags tag file. */
  private generateCTags(): string | null {
    if (!this.content?.to_ctags) {
      this.warnUnsupported("ctags",);
      return null;
    }
    const tags = this.content.to_ctags();
    this.outputFileName = this.name === "." ?
      "."
      : this.absoluteFileName(this.name,);
    this.output = tags + "\n"; // Ruby `f.puts` acrescenta quebra de linha.
    return this.output;
  }

  /**
   * No auxiliary files (css/icons/scripts) are copied in the browser.
   */
  private copyAuxiliaryFiles(): void {
    // No-op por design (ADR 027).
  }

  /**
   * Warns that an output format is not supported by the report type.
   *
   * @param format Format that the report type cannot render.
   */
  private warnUnsupported(format: string,): void {
    MessageHandlerInstance.instance.warning(
      `${format}_not_supported`,
      `${format.toUpperCase()} format is not supported for report ` +
        `${this.id} of type ${this.typeSpec}.`,
      this.sourceFileInfo,
      null,
      null,
      null,
    );
  }
}

/**
 * Every `typeSpec` accepted by `generateIntermediateFormat`, mirroring Ruby's
 * `case`. Types without a registered factory raise `NotYetImplementedError`.
 */
const KNOWN_TYPE_SPECS = new Set<string>([
  ReportType.AccountReport,
  ReportType.BreakdownReport,
  ReportType.Export,
  ReportType.ICal,
  ReportType.MaterialReport,
  ReportType.Niku,
  ReportType.RdoReport,
  ReportType.ResourceReport,
  ReportType.TagFile,
  ReportType.TextReport,
  ReportType.TaskReport,
  ReportType.TraceReport,
  ReportType.StatusSheet,
  ReportType.TimeSheet,
].map((t,) => String(t,).toLowerCase()),);

/**
 * Types from the phase 14 complement that still have no registered factory: the
 * anchor is the task block that delivers them (14C.1/14C.2/14C.3), not the
 * generic `Unknown report type`. Removed once the factories are registered
 * (14C.7.4).
 *
 * Empty since 14C.3.1 (`materialreport` = 14C.1.4, `breakdownreport` =
 * 14C.2.1, `rdoreport` = 14C.3.1): the mechanism is kept for the following
 * extensions.
 */
const EXTENSION_TYPE_BLOCKS = new Map<string, { id: string }>([],);
