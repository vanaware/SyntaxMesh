import { type ProjectLike, } from "./project-like.ts";
import { type Project, } from "./project.ts";
import { PropertyTreeNode, } from "./property-tree-node.ts";
import { ReportScenario, } from "./report-scenario.ts";
import { ReportType, } from "./report-type.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { contentFactories, type ReportContent, } from "./report-content.ts";
import { NotYetImplementedError, } from "./errors.ts";
import { TjTime, } from "../time/tj-time.ts";
import { createHtmlShell, type HtmlShell, } from "../richtext/html-shell.ts";
import {
  SimpleXMLElement,
  type XMLElementLike,
} from "../richtext/xml-like.ts";

export class Report extends PropertyTreeNode {
  typeSpec: ReportType | null;
  content: ReportContent | null;

  constructor(
    project: ProjectLike,
    id: string | null,
    name: string,
    parent: Report | null,
  ) {
    super(project.reports, id, name, parent,);
    // Ruby Report#initialize (l.48-52): checkFileName antes de addReport.
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

  override scenarioData(scIdx: number,): ReportScenario {
    return this.data[scIdx]! as ReportScenario;
  }

  /**
   * Rejeita nomes de arquivo com caracteres inválidos.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Report.rb:checkFileName
   */
  checkFileName(name: string,): void {
    // Ruby (Report.rb l.455-466): no Linux a regex é /[\\?%*:|"<>]/.
    const illegal = /[\\?%*:|"<>]/;
    if (illegal.test(name,)) {
      // `sourceFileInfo` ainda é nil no construtor → linha null no golden.
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
   * Retorna o caminho absoluto, prependindo outputDir se relativo.
   *
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
   * Retorna true se o nome já é absoluto.
   *
   * @see docs/taskjuggler/lib/taskjuggler/Report.rb:absoluteFileName?
   */
  absoluteFileNameExists(name: string,): boolean {
    return name.startsWith("/",);
  }

  /**
   * Ponto de entrada da geração (Fase 14.11). Fixa o fuso do relatório,
   * gera o formato intermediário e despacha cada formato pedido. No browser
   * (ADR 027) nenhuma escrita a disco acontece: `generate` produz o conteúdo e
   * registra o nome de arquivo lógico em `outputFileName`.
   *
   * @see docs/taskjuggler/lib/taskjuggler/reports/Report.rb:generate
   */
  generate(requestedFormats?: string[],): number {
    const tz = this.get("timezone",) as string | null;
    const oldTimeZone = tz ? TjTime.setTimeZone(tz,) : null;

    this.generateIntermediateFormat();

    // Ou os formatos pedidos, ou os da definição do relatório.
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
        // Extensão SyntaxMesh (14C.0.1): JSON de primeira classe.
        case "json":
          this.generateJSON();
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
    }

    if (oldTimeZone) TjTime.setTimeZone(oldTimeZone,);
    return 0;
  }

  /**
   * Gera o formato intermediário agnóstico de saída, instanciando o conteúdo
   * registrado para `typeSpec` (ver `report-content.ts`).
   *
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
    // Chave normalizada: o parser usa as keywords nuas (`iCal`, `statusSheet`)
    // e o enum tem outros casing; o dispatch de Ruby casa os dois formatos.
    const type = this.typeSpec === null ? null : String(this.typeSpec,);
    const key = type === null ? null : type.toLowerCase();
    const factory = key === null ? undefined : contentFactories.get(key,);
    if (key === null || (!factory && !KNOWN_TYPE_SPECS.has(key,))) {
      throw new Error("Unknown report type",);
    }
    if (!factory) {
      // Todos os conteúdos da Fase 14 estão registrados (reports/mod.ts);
      // os tipos conhecidos sem fábrica restante são as sheets.
      // As extensões do Fase 14 Complemento têm âncora própria (C1/C2/C3).
      const block = EXTENSION_TYPE_BLOCKS.get(key!,);
      if (block) {
        // Ancorado: Fase 14C — conteúdo do complemento ainda não registrado.
        throw new NotYetImplementedError(block.id, `Report content '${type}'`,);
      }
      // Ancorado: Fase 18 — conteúdos timesheet/statussheet não portados.
      throw new NotYetImplementedError("18", `Report content '${type}'`,);
    }
    this.content = factory(this,);

    // A maioria das saídas é gerada a partir do formato intermediário.
    this.content?.generateIntermediateFormat();
  }

  /** Conteúdo do relatório como HTML (sem a moldura do documento). */
  to_html(): XMLElementLike[] | XMLElementLike | string | null {
    return this.content?.to_html ? this.content.to_html() : null;
  }

  /**
   * O relatório deve ser renderizado na versão interativa? O relatório de
   * topo define o formato de saída e a configuração interativa.
   */
  "interactive?"(): boolean {
    const contexts = (this.project as Project).reportContexts;
    return contexts.length > 0 &&
      contexts[0]!.report.get("interactive",) === true;
  }

  /** Nome de arquivo lógico da última saída gerada (`.` = stdout). */
  outputFileName = "";

  /**
   * Último conteúdo gerado por um dos `generate*` (string, ou Array-de-Arrays
   * para CSV). No browser (ADR 027) não há escrita a disco — quem chama
   * `generate()` lê o resultado daqui.
   */
  output: string | unknown[][] | null = null;

  /**
   * HTML completo do relatório como string (ADR 026/027: sem escrita a disco).
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
    const shell: HtmlShell = createHtmlShell();
    shell.generateHead(title,);

    const auxDir = (this.get("auxdir",) as string | null) ?? "";
    shell.head.append(
      new SimpleXMLElement("link", {
        rel: "stylesheet",
        type: "text/css",
        href: `${auxDir}css/tjreport.css`,
      },),
    );

    if (!this.get("selfcontained",)) {
      shell.body.append(
        new SimpleXMLElement("script", {
          type: "text/javascript",
          src: `${auxDir}scripts/wz_tooltip.js`,
        },),
      );
      const noscript = new SimpleXMLElement("noscript",);
      const nsdiv = new SimpleXMLElement("div", {
        style: "text-align:center; color:#FF0000",
      },);
      nsdiv.append(
        "This page requires Javascript for full functionality. Please " +
          "enable it in your browser settings!",
      );
      noscript.append(nsdiv,);
      shell.body.append(noscript,);
    }

    // Moldura com margens ao redor do relatório.
    const frame = new SimpleXMLElement("div", { class: "tj_page", },);
    const contentHtml = this.content.to_html();
    for (
      const child of Array.isArray(contentHtml,) ? contentHtml : [contentHtml,]
    ) {
      frame.append(child,);
    }
    frame.append(this.copyrightDiv(),);
    shell.body.append(frame,);

    this.outputFileName = this.get("interactive",) || this.name === "."
      ? "."
      : this.absoluteFileName(this.name,) + ".html";
    const html = shell.toHTML();
    this.output = html;
    return html;
  }

  /** Rodapé administrativo (copyright, projeto, versão, data). */
  private copyrightDiv(): SimpleXMLElement {
    const div = new SimpleXMLElement("div", { class: "copyright", },);
    const copyright = this.project.get("copyright",) as string | null;
    if (copyright) div.append(`${copyright} - `,);
    div.append(
      `Project: ${this.project.get("name",)} ` +
        `Version: ${this.project.get("version",) ?? ""} - Created on ` +
        `${TjTime.now().to_s("%Y-%m-%d %H:%M:%S",)} with SyntaxMesh`,
    );
    return div;
  }

  /** CSV do relatório como Array-de-Arrays (equivalente a CSVFile ';'). */
  private generateCSV(): unknown[][] | null {
    // O CSV só sabe tratar do primeiro elemento do relatório.
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

  /** JSON do relatório como string (extensão SyntaxMesh — 14C.0.1). */
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

  /** Relatório em formato TJP (.tjp se exporta projeto, .tji caso contrário). */
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

  /** Relatório em Microsoft Project XML. */
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

  /** Relatório em formato Niku (Clarity) XML. */
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

  /** Relatório em formato iCalendar. */
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

  /** Arquivo de tags ctags. */
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

  /** No browser não há cópia de arquivos auxiliares (css/icons/scripts). */
  private copyAuxiliaryFiles(): void {
    // No-op por design (ADR 027).
  }

  /** Avisa que um formato de saída não é suportado pelo tipo do relatório. */
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
 * Todos os `typeSpec` aceitos por `generateIntermediateFormat`, espelhando o
 * `case` de Ruby. Tipos sem fábrica registrada são `NotYetImplementedError`.
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
 * Tipos do Fase 14 Complemento sem fábrica registrada ainda: a âncora é o
 * bloco de tarefas que os entrega (14C.1/14C.2/14C.3), não o `Unknown report
 * type` genérico. Removidas quando as fábricas forem registradas (14C.7.4).
 *
 * Vazio desde 14C.3.1 (`materialreport` = 14C.1.4, `breakdownreport` = 14C.2.1,
 * `rdoreport` = 14C.3.1): o mecanismo permanece para as extensões seguintes.
 */
const EXTENSION_TYPE_BLOCKS = new Map<string, { id: string }>([],);
