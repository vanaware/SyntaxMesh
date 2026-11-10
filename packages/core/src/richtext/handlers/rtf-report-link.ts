/**
 * RTFReportLink — handler of the `[[reportlink:…]]` function (phase 12.16 /
 * 14.24).
 *
 * Builds a link to another report: static (`Name.html`) or interactive
 * (`taskjuggler?project=…;report=…[;attributes=…]`, with query expansion
 * through `SimpleQueryExpander` and `URLParameter.encode`). Unanchored in
 * 14.24.6.
 *
 * Documented divergence: in Ruby, `attributes` without a resolved `@query`
 * crashes (nil.dup in the expander); here the expansion is skipped when the
 * handler has not received `setQuery` yet — the link stays valid.
 *
 * Port of `RichText/RTFReportLink.rb`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFReportLink.rb
 * @see ADR 025 (RichText and function handlers)
 * @see ADR 027 (reports return strings, browser)
 */

import { RTFWithQuerySupport, } from "./rtf-with-query-support.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import { XMLElement, } from "../../xml/xml-element.ts";
import type { XMLElementLike, } from "../../xml/xml-element-like.ts";
import type { SourceFileInfo, } from "../../source-file-info.ts";
import type { Project, } from "../../model/project.ts";
import type { Report, } from "../../model/report.ts";
import { SimpleQueryExpander, } from "../../query/simple-query-expander.ts";
import { URLParameter, } from "../../utils/url-parameter.ts";

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

  override to_s(args: RichTextFunctionArgs,): string {
    // Ruby: checkArgs → report.name (with a nil project the error already
    // aborted).
    const report = this.checkArgs(args,);
    return report ? String(report.name,) : "";
  }

  /** Not supported for this function. */
  override to_tagged(_args: RichTextFunctionArgs,): string | null {
    return null;
  }

  override to_html(args: RichTextFunctionArgs,): XMLElementLike | null {
    // Ruby RTFReportLink#to_html (l.41-62).
    const report = this.checkArgs(args,);
    if (!report) return null;

    let url: string;
    if (report["interactive?"]()) {
      // Interactive report: project + id go as the query; `attributes`
      // expands the query placeholders and goes encoded (deflate+Base64).
      const pid = String(this.project?.get("projectid",) ?? "",);
      url = `taskjuggler?project=${pid};report=${report.fullId}`;
      const attributes = args?.["attributes"];
      if (attributes !== undefined && attributes !== null && this.query) {
        const qEx = new SimpleQueryExpander(
          String(attributes,),
          this.query,
          this.sourceFileInfo,
        );
        url += ";attributes=" + URLParameter.encode(qEx.expand(),);
      }
    } else {
      // Static: the report name gets the '.html' extension.
      url = `${report.name}.html`;
    }
    const a = new XMLElement("a", { href: url, },);
    a.append(String(report.name,),);
    return a;
  }

  /** Resolves the report of the `id` argument, with the Ruby errors (l.71-83). */
  private checkArgs(args: RichTextFunctionArgs,): Report | null {
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
    return report;
  }
}
