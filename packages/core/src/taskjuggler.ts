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

// Efeito colateral: registra as fábricas de conteúdo dos relatórios
// (TaskListRE, ResourceListRE, …) no `contentFactories` do modelo, como o
// `require` das classes de conteúdo em TaskJuggler.rb (Fase 14.23).
import "./reports/mod.ts";

/**
 * Provedor de conteúdo injetado (Fase 24 — ADR 034).
 *
 * Recebe o caminho como aparece no projeto (relativo ao arquivo que inclui ou
 * o caminho do mestre) e devolve o texto. O core nunca lê disco: a CLI/PWA
 * injeta este leitor. Um provedor **assíncrono** só serve para os arquivos
 * listados em `parse(files, …)` — que são pré-carregados; `include`s são
 * lidos durante o parse e exigem retorno síncrono.
 */
export type FileContentProvider = (path: string,) => string | Promise<string>;

/**
 * Resultado de uma checagem de folha sobre **conteúdo** (Fase 24, 24.2.33).
 *
 * `report` é o journal compilado que o Ruby imprimia com `puts`: no caminho
 * de dados ele sai pela seção `results.sheet.reportText` do envelope, e o
 * campo mutável `lastSheetReport` fica só para a via passo a passo.
 */
export interface SheetCheckResult {
  valid: boolean;
  report: string | null;
}

/** Falha de checagem (o diagnóstico já foi para o `MessageHandler`). */
export const SHEET_CHECK_FAILED: SheetCheckResult = {
  valid: false,
  report: null,
};

/**
 * TaskJuggler — fachada top-level para CLI/apps.
 *
 * Fronteira da Fase 24 (ADR 034): o core não lê disco nem escreve terminal.
 * `parse`/`parseFile`/`parseContent` recebem o texto por provedor injetado e
 * `renderReports` devolve a seção `results.reports` em memória — imprimir ou
 * gravar é política do consumidor. `freeze` segue ancorado na Fase 24 porque
 * reescrever o master `.tjp` é decisão da CLI. O armazenamento da PWA continua
 * na Fase 19 (`FileStore`/OPFS, ADR 030).
 *
 * A extensão de DSL `stdout` marca apenas a **intenção** do relatório; quem a
 * consome é a política de saída da CLI (`output-policy.ts`, 24.5).
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
  /** Conteúdo já lido na chamada corrente (cache do provedor injetado). */
  private contentCache = new Map<string, string>();
  /** Provedor vigente — reusado por `parseFile`/`parseContent` (Fase 24). */
  private fileProvider: FileContentProvider | null = null;

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

  /**
   * Lê os arquivos em _files_ e monta o `Project` (Ruby `parse`, l.44-104).
   *
   * Fase 24: o texto dos arquivos chega pelo provedor injetado — o core não
   * toca em disco. Um `include` é resolvido pelo provedor **relativo ao
   * arquivo que inclui**, como no Ruby. O primeiro arquivo é o mestre
   * (`:project`); os demais alimentam o projeto (`:propertiesFile`).
   *
   * @returns `true` quando não restou nenhum erro no `MessageHandler`.
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
      // Pré-carrega a lista explícita (o provedor pode ser assíncrono); os
      // `include`s descobertos durante o parse usam o cache/loader síncrono.
      this.contentCache.clear();
      for (const file of files) {
        try {
          this.contentCache.set(
            normalizeInputPath(file,),
            await provider(file,),
          );
        } catch (_error) {
          // Ruby: `critical('parse', msg.message)` no `open` — sem exceção.
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
      // `open` registra `open_file` e segue sem stream: nada a parsear.
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
      // Buffer com nome próprio: `inputFiles` e mensagens usam o nome, não o
      // texto (extensão SyntaxMesh — não existe no Ruby).
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

  /**
   * Constrói a seção `results.reports` do envelope de execução (Fase 24).
   *
   * Devolve o conteúdo renderizado de cada relatório **em memória**: nada é
   * impresso nem gravado — a política de destino é da CLI
   * (`output-policy.ts`). Este método é o construtor reutilizável da seção; o
   * ponto de entrada público continua sendo o `execute` do request.
   *
   * `generateReports(outputDir?)` permanece intacto como caminho legado da
   * UI/Fase 20 (grava direto, sem envelope).
   *
   * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.2/§3.3
   */
  renderReports(options: RenderReportsOptions = {},): ReportsJson {
    const project = this.requireProject("renderReports",);
    return renderReports(project, options,);
  }

  /**
   * Executa um `ExecutionRequest` e devolve o envelope completo (Fase 24).
   *
   * Delegado a `execution/execute.ts`, que cria uma instância própria desta
   * fachada **por chamada** (isolamento do `MessageHandler`/`DataCache` —
   * adendo §3.6): o estado desta instância não participa da execução. O
   * consumidor (CLI/PWA/servidor) chama isto **uma vez** e só despacha o
   * envelope; nenhum `exit`/IO nasce aqui.
   *
   * @see docs/syntaxmesh/fases/fase-24-cli-adendo.md §3.1/§3.6
   */
  execute(request: ExecutionRequest,): Promise<ExecutionResult> {
    return executeRequest(request,);
  }

  /**
   * Gera os artefatos do `--freeze` (Ruby `TaskJuggler#freeze`, l.220-290).
   *
   * Devolve **dados**: o include de header (com o novo `now`) e o export dos
   * bookings até a data de corte. Nada é gravado — a escrita é do consumidor
   * (`io.writeText` na CLI, 24.9.5).
   *
   * Desvios conscientes do Ruby, todos por falta de filesystem no core:
   *  - o Ruby checa a existência dos dois includes e só emite `info`; aqui a
   *    checagem não existe (o consumidor sabe se os arquivos estão lá);
   *  - o Ruby deixa o relatório `_bookings_` no projeto e o pipeline normal de
   *    `generateReports` escreve o `.tji`; aqui o export é gerado no próprio
   *    freeze e o relatório sai da lista depois, para não duplicar a entrada em
   *    `results.reports`;
   *  - os nomes derivam do **master do request** (não de `Dir.pwd`), o que é
   *    determinístico e testável.
   *
   * @returns artefatos na ordem de escrita, ou `null` em erro (já reportado).
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
        // Ruby: `TjTime.new(arg)` (parse de string). No port o construtor é
        // privado e `fromString` é a porta de parse ("YYYY-MM-DD[-HH:MM[:SS]]").
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
      // O relatório sintético não participa de `results.reports`.
      project.reports.removeProperty(report,);
    }

    // Ruby: `now #{freezeDate}` — o `TjTime#to_s` sem formato usa
    // `%Y-%m-%d-%H:%M[-%S]-%z`. O corte é alinhado à hora, então os segundos
    // nunca aparecem; o offset fica explícito para o `.tji` recarregar igual.
    const now = cutOff.to_s("%Y-%m-%d-%H:%M-%z",);
    return {
      files: [
        { fileName: headerFile, contents: `now ${now}\n`, },
        { fileName: bookingsFile, contents: bookingsContents, },
      ],
    };
  }

  /**
   * Relatório sintético `_bookings_` do freeze (Ruby l.255-285).
   *
   * `inheritAttributes` vem **antes** dos `set` porque o Ruby herda os
   * defaults de relatório do projeto e só depois sobrescreve (a ordem importa
   * para `formats`/`scenarios`).
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

    // Só o cenário de tracking entra no export.
    report.set("scenarios", [scenarioIdx,],);
    // Bookings só até a data de corte.
    report.set("end", cutOff,);
    // Todas as tarefas/recursos, por `seqno` decrescente (como o Ruby).
    const showAll = new LogicalExpression(new LogicalOperation(0,),);
    report.set("hideTask", showAll,);
    report.set("sortTasks", [["seqno", true, -1,],],);
    report.set("hideResource", showAll,);
    report.set("sortResources", [["seqno", true, -1,],],);
    // Só bookings: nenhuma definição nem outro atributo.
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
   * Master file do projeto (Ruby `FileList#masterFile`).
   *
   * O registro dos arquivos lidos é o `FileList` (16.7) — a mesma varredura do
   * Ruby, com `.smx` somado a `.tjp` (extensão nativa, 24.2.36). Sem nenhum,
   * cai no primeiro arquivo aberto: um projeto parseado a partir de conteúdo
   * sem nome não tem master.
   */
  private masterFile(project: Project,): string | null {
    const files = new FileList();
    for (const file of project.inputFiles) files.add(file,);
    return files.masterFileWith([".tjp", ".smx",],) ??
      project.inputFiles[0] ?? null;
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
   * Esta é a via **passo a passo** (PWA/F19). O caminho de dados da Fase 24
   * usa {@link checkTimeSheetContent} e recebe o texto do request (24.2.33).
   *
   * @returns `true` quando a folha é válida e os totais fecham.
   */
  async checkTimeSheet(fileName: string,): Promise<boolean> {
    // 18.12: sem projeto a chamada é erro de programação e lança **antes** de
    // tocar no `FileStore` (o `readSheet` devolveria `null` e mascararia a
    // pré-condição como `false`).
    this.requireProject("checkTimeSheet",);
    const content = await this.readSheet(fileName, "check_time_sheet",);
    if (content === null) return false;
    return this.checkTimeSheetContent(content, fileName,).valid;
  }

  /**
   * Valida uma time sheet já em **memória** (Fase 24, 24.2.33).
   *
   * Mesma semântica de {@link checkTimeSheet}, sem `FileStore`: é a porta do
   * `execute` (`app="check-ts"`), onde o texto da folha é dado do request.
   */
  checkTimeSheetContent(
    content: string,
    fileName = "<time sheet>",
  ): SheetCheckResult {
    const project = this.requireProject("checkTimeSheet",);
    const scenarioIdx = this.trackingScenarioIdx(project, "check_time_sheet",);
    if (scenarioIdx === null) return SHEET_CHECK_FAILED;

    // "Make sure we don't use data from old time sheets or Journal entries"
    // (Ruby l.305-307): o journal é recriado e as folhas, descartadas.
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

    // `TimeSheets#check` registra os problemas via `error(...)` e devolve a
    // própria lista (sempre truthy) — o `return false unless` do Ruby só
    // dispara em exceção. Aqui o sinal de falha é o delta de erros abaixo.
    project.checkTimeSheets();
    if (handler.errors !== errorCount) return SHEET_CHECK_FAILED;

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
    return { valid: true, report: this.lastSheetReport, };
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
    // Mesma pré-condição da time sheet: sem projeto lança antes do store.
    this.requireProject("checkStatusSheet",);
    const content = await this.readSheet(fileName, "check_status_sheet",);
    if (content === null) return false;
    return this.checkStatusSheetContent(content, fileName,).valid;
  }

  /**
   * Valida uma status sheet já em **memória** (Fase 24, 24.2.33).
   *
   * Espelha {@link checkStatusSheet} sem `FileStore` — porta do `execute`
   * (`app="check-ss"`).
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
   * Constrói o leitor síncrono que o scanner usa para mestre e `include`s.
   *
   * O caminho é canonizado antes do *lookup*: o scanner monta o nome do
   * include como `dirname(pai) + "/" + nome`, o que produz `./a/b.tji`.
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

  /** Registra um erro de parse no `MessageHandler` (Ruby `critical(id, msg)`). */
  private criticalParse(id: string, error: unknown,): void {
    const text = error instanceof Error ? error.message : String(error,);
    if (text) MessageHandlerInstance.instance.critical(id, text,);
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
