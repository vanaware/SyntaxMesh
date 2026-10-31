/**
 * RTFNavigator — handler da função `[[navigator:…]]` (Fase 12.17/14.21).
 *
 * Gera uma barra de navegação para os relatórios que casam com a
 * `LogicalExpression` do `Navigator` referido pelo argumento `id`. A
 * construção efetiva da árvore HTML está em `Navigator.to_html()` (Fase 14.21);
 * este handler só resolve o id no mapa `project.navigators` e delega.
 *
 * Port de `RichText/RTFNavigator.rb`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFNavigator.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichTextFunctionHandler, } from "./function-handler.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import type { XMLElementLike, } from "../xml-like.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { Project, } from "../../model/project.ts";
import type { Navigator, } from "../../reports/navigator.ts";

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
    // Ruby: `if args.nil? || (id = args['id']).nil? → error`.
    if (
      args === null || args === undefined || args["id"] === undefined ||
      args["id"] === null
    ) {
      this.error(
        "rtf_nav_id_missing",
        "Argument 'id' missing to specify the navigator to be used.",
      );
      return null;
    }
    const id = String(args["id"],);
    const navBar = this.project?.navigators.get(id,) as Navigator | undefined;
    if (!navBar) {
      this.error("rtf_nav_unknown_id", `Unknown navigator ${id}`,);
      return null;
    }
    return navBar.to_html();
  }
}
