import { type Project, } from "./model/project.ts";
import { type ProjectFileParser, } from "./parser/project-file-parser.ts";
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

  constructor() {
    this.project = null;
    this.parser = null;
    this.maxCpuCores = 1;
    this.warnTsDeltas = false;
    this.generateTraces = false;
    TjTime.setTimeZone("UTC",);
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

  checkTimeSheet(fileName: string,): boolean {
    // Ancorado: Fase 18 — checkTimeSheet depende das time sheets (Fase 18).
    throw new NotYetImplementedError("18", "checkTimeSheet",);
  }

  checkStatusSheet(fileName: string,): boolean {
    // Ancorado: Fase 18 — checkStatusSheet depende das status sheets (Fase 18).
    throw new NotYetImplementedError("18", "checkStatusSheet",);
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
