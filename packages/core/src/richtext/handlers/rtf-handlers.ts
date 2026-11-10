/**
 * RTFHandlers — factory for the default TaskJuggler function handlers
 * (phase 12.17).
 *
 * `RTFHandlers.create(project, sfi)` returns the four handlers used by
 * `RichTextFactory`/`RichText`: `navigator`, `query`, `report`, `reportlink`.
 * Only `RTFQuery` is implemented; the others are phase 14 stubs.
 *
 * Faithful port of `RichText/RTFHandlers.rb`.
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
  /** Instantiates all RichText function handlers for the project. */
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
