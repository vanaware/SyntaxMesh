/**
 * RTFReport — handler da função `[[report:…]]` (Fase 12.15 / 14.24).
 *
 * Inclui um relatório no output de RichText: resolve o `id`, detecta
 * recursão de aninhamento, empurra um `ReportContext`, gera o formato
 * intermediário e devolve o HTML do conteúdo. A geração de relatórios é a
 * Fase 14; o corpo foi desancorado em 14.24.6.
 *
 * Port de `RichText/RTFReport.rb`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/RTFReport.rb
 * @see ADR 025 (RichText e function handlers)
 * @see ADR 027 (reports retornam strings, browser)
 */

import { RichTextFunctionHandler, } from "./function-handler.ts";
import type { RichTextFunctionArgs, } from "./function-handler.ts";
import { SimpleXMLElement, } from "../xml-like.ts";
import type { XMLElementLike, } from "../xml-like.ts";
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

  /** Não suportado para esta função. */
  override to_s(_args: RichTextFunctionArgs,): string {
    return "";
  }

  /** Não suportado para esta função. */
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

    // Detecta aninhamento recursivo (RTFReport.rb:46-65): o relatório já
    // está na pilha de contextos → empilha mensagem com o caminho e aborta.
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

    // Novo contexto para o relatório; gera; devolve o HTML do conteúdo.
    // Ruby faz pop sem ensure — aqui `finally` não vaza contexto em erro.
    contexts.push(new ReportContext(this.project!, report,),);
    try {
      report.generateIntermediateFormat();
      const html = report.to_html();
      // `Report#to_html` admite string/array (conteúdos CSV/text); o RichText
      // embute um único nó — normaliza para fragmento.
      if (Array.isArray(html,)) {
        const frag = new SimpleXMLElement(null,);
        for (const el of html) frag.append(el,);
        return frag;
      }
      if (typeof html === "string") {
        const frag = new SimpleXMLElement(null,);
        frag.append(html,);
        return frag;
      }
      return html;
    } finally {
      contexts.pop();
    }
  }
}
