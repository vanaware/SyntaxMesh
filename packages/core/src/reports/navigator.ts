/**
 * Navigator + NavigatorElement (Fase 14.21) — barra de navegação de relatórios.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/Navigator.rb`. O
 * parser (Fase 10) cria `Navigator` objects ao processar `navigator "id"`; a
 * geração da barra (via `[[navigator:id=…]]`) é feita por `RTFNavigator`
 * chamando `to_html()` aqui. Nenhuma escrita a disco (ADR 027); `to_html`
 * retorna `XMLElementLike`.
 *
 * A heurística de `normalizeURL` e `findReportURL` preserva a semântica do
 * Ruby: URLs relativos cortados pelo último diretório em comum com o relatório
 * atual, e URLs interativas usam o esquema `taskjuggler?project=…;report=…`.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.21)
 */
import type { Project, } from "../model/project.ts";
import type { Report, } from "../model/report.ts";
import { PropertyList, } from "../model/property-list.ts";
import { LogicalExpression, } from "../logic/logical-expression.ts";
import { LogicalOperation, } from "../logic/logical-operation.ts";
import { Query, } from "../query/query.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";

/**
 * Nó da árvore de navegação. Cada entrada guarda label/URL, elementos filhos e
 * um flag `current` marcando o ramo que contém o relatório sendo renderizado.
 */
export class NavigatorElement {
  readonly parent: NavigatorElement | null;
  readonly label: string | null;
  url: string | null;
  elements: NavigatorElement[];
  current: boolean;

  constructor(
    parent: NavigatorElement | null,
    label: string | null = null,
    url: string | null = null,
  ) {
    this.parent = parent;
    this.label = label;
    this.url = url;
    this.elements = [];
    this.current = false;
  }

  /**
   * Renderiza HTML da barra. Sem container: cria `div.navbar_container`,
   * `<hr class="navbar_topruler">` e `<hr class="navbar_bottomruler">` (raiz).
   * Cada submenu é um `div.navbar` com spans `navbar_current`/`navbar_other`
   * separados por `|`. O ramo `current` é recursado abaixo de `<hr class=
   * "navbar_midruler">` quando não é o primeiro item.
   */
  to_html(html: XMLElementLike | null = null,): XMLElementLike {
    let first = true;
    const topLevel = html === null || html === undefined;
    let container: XMLElement;
    if (topLevel) {
      container = new XMLElement("div", { class: "navbar_container", },);
      container.append(
        new XMLElement("hr", { class: "navbar_topruler", },),
      );
    } else {
      container = html as XMLElement;
    }

    const div = new XMLElement("div", { class: "navbar", },);
    container.append(div,);

    for (const element of this.elements) {
      if (first) {
        first = false;
      } else {
        div.append("|",);
      }
      if (element.current) {
        const span = new XMLElement("span", {
          class: "navbar_current",
        },);
        span.append(element.label ?? "",);
        div.append(span,);
      } else {
        const span = new XMLElement("span", { class: "navbar_other", },);
        const a = new XMLElement("a", { href: element.url ?? "", },);
        a.append(element.label ?? "",);
        span.append(a,);
        div.append(span,);
      }
    }

    // Sub-menu do ramo current (uma linha abaixo de <hr class=navbar_midruler>).
    for (const element of this.elements) {
      if (element.current && element.elements.length > 0) {
        if (!first) {
          container.append(
            new XMLElement("hr", { class: "navbar_midruler", },),
          );
        }
        element.to_html(container,);
        break;
      }
    }

    if (topLevel) {
      container.append(
        new XMLElement("hr", { class: "navbar_bottomruler", },),
      );
    }
    return container;
  }

  /** Dump textual (debug): imprime árvore com indentação e marca `<label>` current. */
  to_s(indent: number = 0,): string {
    const lines: string[] = [];
    const pad = " ".repeat(indent,);
    for (const element of this.elements) {
      const marker = element.current ? "<" : "";
      const closer = element.current ? ">" : "";
      lines.push(
        `${pad}${marker}${element.label ?? ""}${closer} -> ${
          element.url ?? ""
        }`,
      );
      lines.push(element.to_s(indent + 1,),);
    }
    return lines.join("\n",) + (lines.length ? "\n" : "");
  }
}

/**
 * Barra de navegação de relatórios. Instanciado pelo parser via diretiva
 * `navigator "id"`; consumido por `RTFNavigator.to_html`.
 */
export class Navigator {
  readonly id: string;
  readonly project: Project;
  hideReport: LogicalExpression;

  constructor(id: string, project: Project,) {
    this.id = id;
    this.project = project;
    // Padrão: expressão false (equivalente a `LogicalOperation.new(0)` do Ruby).
    this.hideReport = new LogicalExpression(new LogicalOperation(0,),);
  }

  /**
   * Constrói a árvore de `NavigatorElement` para os relatórios informados.
   * `parentElement` recebe as entradas de topo; recursa para os `kids` do
   * relatório que contém `reportDef`.
   */
  generate(
    allReports: PropertyList<Report>,
    currentReports: Report[],
    reportDef: Report,
    parentElement: NavigatorElement,
  ): void {
    let element: NavigatorElement | null = null;
    let nextParentElement: NavigatorElement | null = null;
    let nextParentReport: Report | null = null;

    for (const report of currentReports) {
      const formats = (report.get("formats",) as string[] | null) ?? [];
      const hasURL = formats.includes("html",);
      // Só gera entrada para container reports ou leaf reports com formato html.
      if ((report.leaf() && !hasURL) || !allReports.includes(report,)) {
        continue;
      }
      const title = report.get("title",) as string | null;
      const label = title ?? report.name;
      const url = this.findReportURL(report, allReports, reportDef,);

      const child = new NavigatorElement(parentElement, label, url,);
      parentElement.elements.push(child,);
      element = child;

      if (reportDef === report || reportDef.isChildOf(report,)) {
        nextParentReport = report;
        nextParentElement = element;
        element.current = true;
      }
    }

    if (nextParentReport && nextParentReport.container()) {
      this.generate(
        allReports,
        nextParentReport.kids() as Report[],
        reportDef,
        nextParentElement as NavigatorElement,
      );
    }
  }

  /**
   * Renderiza a barra de navegação. `reportDef` é o relatório do contexto
   * atual. Sem relatórios filtrados → `null`; contexto sem o relatório atual
   * → warning + `null`.
   */
  to_html(reportDefArg?: Report,): XMLElementLike | null {
    const contexts = this.project.reportContexts;
    const reportDef: Report | null = reportDefArg ??
      (contexts.length > 0 ? contexts[contexts.length - 1]!.report : null);
    if (!reportDef) {
      throw new Error("Report context missing",);
    }

    const reports = this.filterReports();
    if (reports.length() === 0) return null;

    if (!reports.includes(reportDef,)) {
      MessageHandlerInstance.instance.warning(
        "nav_in_hidden_rep",
        "Navigator requested for a report that is not included in the " +
          "navigator list.",
        reportDef.sourceFileInfo,
      );
      return null;
    }

    // Relatórios de topo: sobe até o pai raiz e usa os `kids` dele.
    let topLevelReports: Report[] = [reportDef,];
    let cursor: Report | null = reportDef;
    while (cursor && cursor.parent) {
      cursor = cursor.parent as Report;
      topLevelReports = cursor.kids() as Report[];
    }

    const content = new NavigatorElement(null,);
    this.generate(reports, topLevelReports, reportDef, content,);
    return content.to_html(null,);
  }

  /**
   * Lista ordenada de `Report` a incluir na barra, removendo os ocultados por
   * `hideReport`. Equivalente ao `filterReports` do Ruby.
   */
  private filterReports(): PropertyList<Report> {
    const list = new PropertyList<Report>(this.project.reports,);
    list.setSorting([["seqno", true, -1,],],);
    list.sort();
    const ctxQuery = this.project.reportContexts.at(-1,)?.query;
    const query: Query = (ctxQuery ?? new Query({ project: this.project, },))
      .dup();
    query.scopeProperty = null;
    query.scenarioIdx = undefined;
    query.scenario = null;
    list.deleteIf((property,) => {
      query.property = property;
      return this.hideReport.eval(query,);
    },);
    return list;
  }

  /**
   * Corta de `url1` o prefixo idêntico a `url2` até o último `/` em comum.
   * Ruby: itera `url1.length` comparando caractere a caractere. Sem match na
   * posição `i`, retorna `url1.substring(cut)`; caso contrário devolve `url1`.
   */
  private normalizeURL(url1: string, url2: string,): string {
    let cut = 0;
    for (let i = 0; i < url1.length; i++) {
      if (i >= url2.length || url1[i] !== url2[i]) {
        return url1.substring(cut,);
      }
      if (url1[i] === "/") cut = i + 1;
    }
    return url1;
  }

  /**
   * Acha a URL do menu entry. Se `report` tem formato HTML → devolve a URL
   * (interativa: `taskjuggler?...`; senão: `report.name + '.html'` cortado
   * contra o `reportDef`). Containers sem HTML recursam nos `kids`.
   */
  private findReportURL(
    report: Report,
    allReports: PropertyList<Report>,
    reportDef: Report,
  ): string | null {
    if (!allReports.includes(report,)) return null;

    const formats = (report.get("formats",) as string[] | null) ?? [];
    if (formats.includes("html",)) {
      const ctx = this.project.reportContexts[0];
      const current = ctx ? ctx.report : reportDef;
      if (
        typeof current["interactive?"] === "function" &&
        current["interactive?"]()
      ) {
        const pid = String(this.project.get("projectid",) ?? "",);
        return `/taskjuggler?project=${pid};report=${report.fullId}`;
      }
      const url = report.name + ".html";
      return this.normalizeURL(url, reportDef.name,);
    }
    // Container sem HTML: herda a URL do primeiro kid com URL.
    for (const kid of report.kids() as Report[]) {
      const url = this.findReportURL(kid, allReports, reportDef,);
      if (url) return url;
    }
    return null;
  }
}
