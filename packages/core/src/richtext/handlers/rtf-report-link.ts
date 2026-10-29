/**
 * RTFReportLink — handler da função `[[reportlink:…]]` (Fase 12.16, STUB).
 *
 * Gera um link para outro relatório. Depende de `Report`/`ReportContext`
 * (**Fase 14**); aqui só a estrutura é portada e `to_html` é stub ancorado.
 *
 * Port de `RichText/RTFReportLink.rb` (estrutura; corpo adiado).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFReportLink.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RTFWithQuerySupport, } from "./rtf-with-query-support.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import type { XMLElementLike, } from "../xml-like.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { Project, } from "../../model/project.ts";
import { NotYetImplementedError, } from "../../model/errors.ts";

export class RTFReportLink extends RTFWithQuerySupport {
  private readonly project: Project | null;

  constructor(
    project: Project | null,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    super("reportlink", sourceFileInfo,);
    this.project = project;
    this.blockFunction = false;
  }

  /** Não suportado para esta função. */
  override to_s(_args: RichTextFunctionArgs,): string {
    return "";
  }

  /** Não suportado para esta função. */
  override to_tagged(_args: RichTextFunctionArgs,): string | null {
    return null;
  }

  override to_html(_args: RichTextFunctionArgs,): XMLElementLike | null {
    // Ancorado: Fase 14 — RTFReportLink depende de Report/ReportContext.
    throw new NotYetImplementedError("14", "RTFReportLink",);
  }
}
