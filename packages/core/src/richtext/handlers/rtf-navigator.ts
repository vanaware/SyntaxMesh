/**
 * RTFNavigator — handler for the `[[navigator:…]]` function (phase 12.17/14.21).
 *
 * Generates a navigation bar for the reports matching the `LogicalExpression`
 * of the `Navigator` referenced by the `id` argument. The actual construction
 * of the HTML tree lives in `Navigator.to_html()` (phase 14.21); this handler
 * only resolves the id in the `project.navigators` map and delegates.
 *
 * Port of `RichText/RTFNavigator.rb`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFNavigator.rb
 * @see ADR 025 (RichText e function handlers)
 */

import { RichTextFunctionHandler, } from "./function-handler.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import type { XMLElementLike, } from "../../xml/xml-element-like.ts";
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

  /** Not supported for this function. */
  override to_s(_args: RichTextFunctionArgs,): string {
    return "";
  }

  /** Not supported for this function. */
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
