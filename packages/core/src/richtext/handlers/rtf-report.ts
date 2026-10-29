/**
 * RTFReport — handler da função `[[report:…]]` (Fase 12.15, STUB).
 *
 * Inclui um relatório no output de RichText. A geração de relatórios vive na
 * **Fase 14**; aqui só a estrutura do handler é portada. `to_html` é um stub
 * ancorado.
 *
 * Port de `RichText/RTFReport.rb` (estrutura; corpo adiado).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFReport.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichTextFunctionHandler, } from "./function-handler.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import type { XMLElementLike, } from "../xml-like.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { Project, } from "../../model/project.ts";
import { NotYetImplementedError, } from "../../model/errors.ts";

export class RTFReport extends RichTextFunctionHandler {
  private readonly project: Project | null;

  constructor(
    project: Project | null,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    super("report", sourceFileInfo,);
    this.project = project;
    this.blockFunction = true;
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
    // Ancorado: Fase 14 — geração de relatórios (ReportContext) ainda não existe.
    throw new NotYetImplementedError("14", "RTFReport",);
  }
}
