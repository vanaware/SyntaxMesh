/**
 * RTFNavigator — handler da função `[[navigator:…]]` (Fase 12.17, STUB).
 *
 * Gera uma barra de navegação para os relatórios que casam com uma
 * `LogicalExpression`. Depende de `Navigator` (**Fase 14**); aqui só a
 * estrutura e a validação do argumento `id` são portadas e `to_html` é stub.
 *
 * Port de `RichText/RTFNavigator.rb` (estrutura; corpo adiado).
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFNavigator.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichTextFunctionHandler, } from "./function-handler.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import type { XMLElementLike, } from "../xml-like.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { Project, } from "../../model/project.ts";
import { NotYetImplementedError, } from "../../model/errors.ts";

export class RTFNavigator extends RichTextFunctionHandler {
  private readonly project: Project | null;

  constructor(
    project: Project | null,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    super("navigator", sourceFileInfo,);
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

  override to_html(args: RichTextFunctionArgs,): XMLElementLike | null {
    // Validação do argumento obrigatório, fiel ao Ruby, antes do stub.
    if (args === null || args["id"] === undefined || args["id"] === null) {
      this.error(
        "rtf_nav_id_missing",
        "Argument 'id' missing to specify the navigator to be used.",
      );
    }
    // Ancorado: Fase 14 — Navigator (barra de navegação de relatórios).
    throw new NotYetImplementedError("14", "RTFNavigator",);
  }
}
