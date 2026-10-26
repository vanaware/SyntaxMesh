import { type Project, } from "./model/project.ts";
import { type ProjectFileParser, } from "./parser/project-file-parser.ts";
import { TjTime, } from "./time/tj-time.ts";
import { NotYetImplementedError, } from "./model/errors.ts";

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
    throw new NotYetImplementedError("10", "parse",);
  }

  parseFile(fileName: string, rule: unknown,): unknown {
    // Stub — Fase 10
    return null;
  }

  parseContent(content: string,): boolean {
    // Stub — Fase 19 (variante para aceitar conteúdo direto)
    throw new NotYetImplementedError("19", "parseContent",);
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
    throw new NotYetImplementedError("14", "freeze",);
  }

  checkTimeSheet(fileName: string,): boolean {
    throw new NotYetImplementedError("18", "checkTimeSheet",);
  }

  checkStatusSheet(fileName: string,): boolean {
    throw new NotYetImplementedError("18", "checkStatusSheet",);
  }

  get projectId(): string | null {
    return this.project?.id ?? null;
  }

  get projectName(): string | null {
    return this.project?.name ?? null;
  }

  get errors(): number {
    return 0; // TODO: integrate with MessageHandlerInstance
  }
}
