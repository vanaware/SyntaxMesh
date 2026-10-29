/**
 * RTFHandlers — fábrica dos handlers de função padrão do TaskJuggler
 * (Fase 12.17).
 *
 * `RTFHandlers.create(project, sfi)` devolve os quatro handlers usados pelo
 * `RichTextFactory`/`RichText`: `navigator`, `query`, `report`, `reportlink`.
 * Somente `RTFQuery` está implementado; os demais são stubs da Fase 14.
 *
 * Port fiel de `RichText/RTFHandlers.rb`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFHandlers.rb
 * @see ADR 025 (RichText e function handlers)
 */

import type { RichTextFunctionHandler, } from "./function-handler.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { Project, } from "../../model/project.ts";
import { RTFNavigator, } from "./rtf-navigator.ts";
import { RTFQuery, } from "./rtf-query.ts";
import { RTFReport, } from "./rtf-report.ts";
import { RTFReportLink, } from "./rtf-report-link.ts";

export class RTFHandlers {
  /** Instancia todos os handlers de função do RichText para o projeto. */
  static create(
    project: Project | null,
    sourceFileInfo: SourceFileInfo | null = null,
  ): RichTextFunctionHandler[] {
    return [
      new RTFNavigator(project, sourceFileInfo,),
      new RTFQuery(project, sourceFileInfo,),
      new RTFReport(project, sourceFileInfo,),
      new RTFReportLink(project, sourceFileInfo,),
    ];
  }
}
