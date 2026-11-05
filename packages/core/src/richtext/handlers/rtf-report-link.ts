/**
 * RTFReportLink — handler da função `[[reportlink:…]]` (Fase 12.16 / 14.24).
 *
 * Gera um link para outro relatório: estático (`Nome.html`) ou interativo
 * (`taskjuggler?project=…;report=…[;attributes=…]`, com expansão de query via
 * `SimpleQueryExpander` e `URLParameter.encode`). Desancorado em 14.24.6.
 *
 * Divergência documentada: no Ruby, `attributes` sem `@query` resolvida
 * crashes (nil.dup no expander); aqui a expansão é pulada se o handler ainda
 * não recebeu `setQuery` — o link permanece válido.
 *
 * Port de `RichText/RTFReportLink.rb`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFReportLink.rb
 * @see ADR 025 (RichText e function handlers)
 * @see ADR 027 (reports retornam strings, browser)
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
    // Ruby: checkArgs → report.name (com project nil o erro já abortou).
    const report = this.checkArgs(args,);
    return report ? String(report.name,) : "";
  }

  /** Não suportado para esta função. */
  override to_tagged(_args: RichTextFunctionArgs,): string | null {
    return null;
  }

  override to_html(args: RichTextFunctionArgs,): XMLElementLike | null {
    // Ruby RTFReportLink#to_html (l.41-62).
    const report = this.checkArgs(args,);
    if (!report) return null;

    let url: string;
    if (report["interactive?"]()) {
      // Relatório interativo: projeto + id vão como query; `attributes`
      // expande placeholders da query e vai codificado (deflate+Base64).
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
      // Estático: o nome do relatório ganha extensão '.html'.
      url = `${report.name}.html`;
    }
    const a = new XMLElement("a", { href: url, },);
    a.append(String(report.name,),);
    return a;
  }

  /** Resolve o relatório do argumento `id`, com erros do Ruby (l.71-83). */
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
