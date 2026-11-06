import { type Project, } from "./model/project.ts";
import type { PropertyTreeNode, } from "./model/property-tree-node.ts";
import type { Resource, } from "./model/resource.ts";
import { ProjectFileParser, } from "./parser/project-file-parser.ts";
import { Query, } from "./query/query.ts";
import type { FileStore, } from "./interfaces/file-store.ts";
import type { TimeSheet, } from "./timesheet/time-sheet.ts";
import { TjTime, } from "./time/tj-time.ts";
import { NotYetImplementedError, } from "./model/errors.ts";
import { MessageHandlerInstance, } from "./message-handler.ts";

// Efeito colateral: registra as fábricas de conteúdo dos relatórios
// (TaskListRE, ResourceListRE, …) no `contentFactories` do modelo, como o
// `require` das classes de conteúdo em TaskJuggler.rb (Fase 14.23).
import "./reports/mod.ts";

/**
 * TaskJuggler — fachada top-level para CLI/apps.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TaskJuggler.rb
 */
export class TaskJuggler {
  project: Project | null;
  parser: ProjectFileParser | null;
  maxCpuCores: number;
  warnTsDeltas: boolean;
  generateTraces: boolean;
  /**
   * Armazenamento injetado para leitura dos `.tji` de sheet (ADR 037).
   *
   * No Ruby, `checkTimeSheet`/`checkStatusSheet` chamavam `tj3client` por
   * subprocesso, que lia o arquivo do disco. Sem disco no core, o texto do
   * sheet chega por este `FileStore`.
   */
  fileStore: FileStore | null;
  /**
   * Resultado legível do último `checkTimeSheet`/`checkStatusSheet` — o
   * journal compilado que o Ruby imprimia com `puts`. `null` até a primeira
   * checagem bem-sucedida; a CLI/app decide onde exibir.
   */
  lastSheetReport: string | null;

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

  /** Injeta (ou remove, com `null`) o `FileStore` usado pelos sheets. */
  setFileStore(store: FileStore | null,): void {
    this.fileStore = store;
  }

  parse(files: string[], keepParser = false,): boolean {
    // Ancorado: Fase 24 — leitura de arquivos .tjp via provedor de conteúdo
    // injetado (`io.readText`) fornecido pela CLI; o core não toca em disco.
    // (Reancorado em 2026-11-03 — antes apontava Fase 19; xray §4.)
    throw new NotYetImplementedError("24", "parse",);
  }

  parseFile(fileName: string, rule: unknown,): unknown {
    // Ancorado: Fase 24 — variante de um único arquivo, também dependente do
    // provedor de conteúdo da CLI. (Antes era um stub silencioso `return null`,
    // sem âncora — reancorado em 2026-11-03; xray §4/§5.2.)
    throw new NotYetImplementedError("24", "parseFile",);
  }

  parseContent(content: string,): boolean {
    // Ancorado: Fase 24 — recebe conteúdo já carregado; a injeção do provedor é
    // da CLI, e a UI/PWA (Fase 20) reusa o mesmo provedor.
    // (Reancorado em 2026-11-03 — antes apontava Fase 19; xray §4.)
    throw new NotYetImplementedError("24", "parseContent",);
  }

  schedule(): boolean {
    if (!this.project) {
      throw new Error("Project not set",);
    }
    this.project.warnTsDeltas = this.warnTsDeltas;
    const res = this.project.schedule();
    this.project.enableTraceReports(this.generateTraces,);
    return res;
  }

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

  listReports(reportId: string, regExpMode: boolean,): boolean {
    if (!this.project) {
      throw new Error("Project not set",);
    }
    this.project.listReports(reportId, regExpMode,);
    return true;
  }

  freeze(freezeDate: unknown, taskBookings: boolean,): boolean {
    // Ancorado: Fase 24 — freeze reescreve o master file .tjp (`io.writeText`);
    // sem sentido no pipeline browser (ADR 027) e sem consumidor até a CLI.
    // (Reancorado em 2026-11-03 — antes apontava Fase 19; xray §4.)
    throw new NotYetImplementedError("24", "freeze",);
  }

  /**
   * Valida uma time sheet contra o projeto carregado (Ruby `checkTimeSheet`,
   * l.295-334).
   *
   * O Ruby chamava `tj3client check-ts` por subprocesso e imprimia o journal
   * compilado; aqui o `.tji` é lido do `FileStore` injetado (ADR 037), a
   * validação roda in-process e o resultado fica em {@link lastSheetReport}
   * para a CLI/app imprimir — o core não escreve em stdout.
   *
   * @returns `true` quando a folha é válida e os totais fecham.
   */
  async checkTimeSheet(fileName: string,): Promise<boolean> {
    const project = this.requireProject("checkTimeSheet",);
    const scenarioIdx = this.trackingScenarioIdx(project, "check_time_sheet",);
    if (scenarioIdx === null) return false;

    // "Make sure we don't use data from old time sheets or Journal entries"
    // (Ruby l.305-307): o journal é recriado e as folhas, descartadas.
    project.timeSheets.clear();
    project.journal.clear();

    const handler = MessageHandlerInstance.instance;
    const errorCount = handler.errors;

    const content = await this.readSheet(fileName, "check_time_sheet",);
    if (content === null) return false;

    const ts = this.parseSheet<TimeSheet>(
      project,
      fileName,
      content,
      "timeSheetFile",
    );
    if (ts === null) return false;

    // `TimeSheets#check` registra os problemas via `error(...)` e devolve a
    // própria lista (sempre truthy) — o `return false unless` do Ruby só
    // dispara em exceção. Aqui o sinal de falha é o delta de erros abaixo.
    project.checkTimeSheets();
    if (handler.errors !== errorCount) return false;

    // Extensão 18.17.1/18.17.9: uma folha válida é aplicada ao cenário de
    // tracking — `work`/`remaining` de material viram `effortdone`/
    // `effortleft` e a quantidade consumida vira `MaterialBooking`, que é o
    // que o `materialreport` lê como custo realizado (14C.11).
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
    return true;
  }

  /**
   * Valida uma status sheet contra o projeto carregado (Ruby
   * `checkStatusSheet`, l.339-369).
   *
   * Sem o `timeSheets.clear()` + recriação do journal do time sheet: status
   * sheets convivem com o journal já existente (a própria gramática remove as
   * entradas do mesmo autor/período antes de reescrever).
   */
  async checkStatusSheet(fileName: string,): Promise<boolean> {
    const project = this.requireProject("checkStatusSheet",);
    const scenarioIdx = this.trackingScenarioIdx(
      project,
      "check_status_sheet",
    );
    if (scenarioIdx === null) return false;

    const handler = MessageHandlerInstance.instance;
    const errorCount = handler.errors;

    const content = await this.readSheet(fileName, "check_status_sheet",);
    if (content === null) return false;

    const parsed = this.parseSheet<[Resource, TjTime, TjTime,]>(
      project,
      fileName,
      content,
      "statusSheetFile",
    );
    if (parsed === null) return false;
    if (handler.errors !== errorCount) return false;

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
    return true;
  }

  /** Projeto carregado ou erro — pré-condição de agendar/relatar/checar. */
  private requireProject(method: string,): Project {
    if (!this.project) {
      throw new Error(`Project not set (${method})`,);
    }
    return this.project;
  }

  /**
   * `trackingScenarioIdx` do projeto, ou `null` após registrar o `critical`
   * do Ruby (`raise TjException, 'No trackingscenario defined'`).
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
   * Lê o texto de um `.tji` do `FileStore` injetado (ADR 037).
   *
   * Sem store — ou com arquivo ausente — registra `critical` e devolve
   * `null`, como o `critical('parse_file', …)` do Ruby.
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
   * Aplica um sheet ao projeto já parseado (o `parseFile(fileName, rule)` do
   * Ruby, l.105-121).
   *
   * `parseFile` segue ancorado à Fase 24 (o `.tjp` mestre depende do provedor
   * de conteúdo da CLI); aqui o texto do sheet já está em memória.
   *
   * @returns o resultado da regra, ou `null` em erro de sintaxe (TjError).
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
      // `@parser.setGlobalMacros` do Ruby (l.116): as macros de data
      // (projectstart/now/…) precisam existir antes das regras rodarem.
      parser.setGlobalMacros();
      result = parser.parse(rule,);
    } catch (error) {
      // Extensão SyntaxMesh: o FSM do port tolera tokens faltantes e chega a
      // executar a action com valores `undefined` (no Ruby o padrão não casa e
      // a action nem roda), o que estoura lá dentro com erro genérico. Como o
      // texto é entrada do usuário, isto vira folha inválida em vez de derrubar
      // a app — com o id que o Ruby usa no `parseFile` (l.111).
      const text = error instanceof Error ? error.message : String(error,);
      MessageHandlerInstance.instance.critical("parse_file", text,);
      return null;
    } finally {
      parser.close();
    }
    if (result === false || result === null || result === undefined) {
      return null;
    }
    // `@project.inputFiles << fileName` do Ruby (l.110) só acontece na
    // abertura bem-sucedida.
    project.inputFiles.push(fileName,);
    return result as T;
  }

  get projectId(): string | null {
    return this.project?.id ?? null;
  }

  get projectName(): string | null {
    return this.project?.name ?? null;
  }

  get errors(): number {
    // TaskJuggler.rb:384-386 — reflete a contagem do MessageHandler.
    return MessageHandlerInstance.instance.errors;
  }
}

/**
 * Markup original de um RTI (`query.richText.inputText` no Ruby).
 *
 * Espelha o helper homônimo privado de `model/resource.ts`: o Ruby faz
 * `query_journal(query).richText.inputText` e imprime; aqui o texto é
 * devolvido para {@link TaskJuggler.lastSheetReport}. String vazia quando a
 * forma do RTI não é a esperada (só acontece com RTI de outra origem).
 */
function inputTextOf(rti: unknown,): string {
  const source = (rti as { richText?: { inputText?: unknown } } | null)
    ?.richText;
  return typeof source?.inputText === "string" ? source.inputText : "";
}
