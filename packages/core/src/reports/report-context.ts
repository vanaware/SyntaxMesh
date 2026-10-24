/**
 * ReportContext — contexto de geração de relatórios.
 *
 * Stub para Fase 9. O `Project` empilha um `ReportContext` por relatório em
 * geração; a implementação completa vem na Fase 14.
 */
import { type Project, } from "../model/project.ts";
import { type Report, } from "../model/report.ts";

export class ReportContext {
  readonly project: Project;
  readonly report: Report;
  readonly reportId: string;
  readonly scIdx: number;
  attributeBackup: unknown;

  constructor(project: Project, report: Report,) {
    this.project = project;
    this.report = report;
    this.reportId = report.fullId;
    this.scIdx = 0;
    this.attributeBackup = null;
  }
}
