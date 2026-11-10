/**
 * RTFReport — handler of the `[[report:…]]` function (phase 12.15 / 14.24).
 *
 * Includes a report in the RichText output: resolves the `id`, detects nesting
 * recursion, pushes a `ReportContext`, generates the intermediate format and
 * returns the HTML of the content. Report generation is phase 14; the body was
 * unanchored in 14.24.6.
 *
 * Port of `RichText/RTFReport.rb`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFReport.rb
 * @see ADR 025 (RichText and function handlers)
 * @see ADR 027 (reports return strings, browser)
 */

import { RichTextFunctionHandler, } from "./function-handler.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import { Fragment, XMLElement, } from "../../xml/xml-element.ts";
import type { XMLElementLike, } from "../../xml/xml-element-like.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { Project, } from "../../model/project.ts";
import { ReportContext, } from "../../reports/report-context.ts";

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

  /** Not supported for this function. */
  override to_s(_args: RichTextFunctionArgs,): string {
    return "";
  }

  /** Not supported for this function. */
  override to_tagged(_args: RichTextFunctionArgs,): string | null {
    return null;
  }

  override to_html(args: RichTextFunctionArgs,): XMLElementLike | null {
    // Ruby RTFReport#to_html (l.36-75).
    if (
      args === null || args === undefined || args["id"] === undefined ||
      args["id"] === null
    ) {
      this.error(
        "rtp_report_id",
        "Argument 'id' missing to specify the report to be used.",
      );
      return null;
    }
    const id = String(args["id"],);
    const report = this.project ? this.project.report(id,) : null;
    if (!report) {
      this.error("rtp_report_unknown_id", `Unknown report ${id}`,);
      return null;
    }

    // Detects recursive nesting (RTFReport.rb:46-65): the report is already
    // on the context stack → pushes a message with the path and aborts.
    const contexts = this.project!.reportContexts;
    if (contexts.some((c,) => c.report === report)) {
      let stack = "";
      for (const context of contexts) {
        if (stack !== "") stack += " -> ";
        if (context.report === report) stack += "[ ";
        stack += context.report.fullId;
      }
      stack += ` -> ${report.fullId} ] ...`;
      this.error(
        "rtp_report_recursion",
        `Recursive nesting of reports detected: ${stack}`,
      );
      return null;
    }

    // New context for the report; generate; return the HTML of the content.
    // Ruby pops without ensure — here `finally` never leaks the context on
    // error.
    contexts.push(new ReportContext(this.project!, report,),);
    try {
      report.generateIntermediateFormat();
      const html = report.to_html();
      // `Report#to_html` accepts string/array (CSV/text contents); RichText
      // embeds a single node — normalizes into a fragment.
      if (Array.isArray(html,)) {
        const frag = new Fragment();
        for (const el of html) frag.append(el,);
        return frag;
      }
      if (typeof html === "string") {
        const frag = new Fragment();
        frag.append(html,);
        return frag;
      }
      return html;
    } finally {
      contexts.pop();
    }
  }
}
