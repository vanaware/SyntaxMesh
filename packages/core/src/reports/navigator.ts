/**
 * Navigator + NavigatorElement (phase 14.21) — report navigation bar.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/Navigator.rb`. The parser (phase 10)
 * creates `Navigator` objects while processing `navigator "id"`; the bar itself
 * is generated (through `[[navigator:id=…]]`) by `RTFNavigator` calling
 * `to_html()` here. Nothing is written to disk (ADR 027); `to_html` returns an
 * `XMLElementLike`.
 *
 * The heuristics of `normalizeURL` and `findReportURL` preserve the Ruby
 * semantics: relative URLs are cut at the last directory shared with the current
 * report, and interactive URLs use the `taskjuggler?project=…;report=…` scheme.
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
 * Node of the navigation tree. Every entry stores a label/URL, its child
 * elements and a `current` flag marking the branch that holds the report being
 * rendered.
 */
export class NavigatorElement {
  /** Parent element, or `null` for the root of the tree. */
  readonly parent: NavigatorElement | null;
  /** Label shown in the bar, or `null` for none. */
  readonly label: string | null;
  /** Target URL of the entry, or `null` when it is not a link. */
  url: string | null;
  /** Child elements of the entry. */
  elements: NavigatorElement[];
  /** Whether this branch contains the report being rendered. */
  current: boolean;

  /**
   * Creates a navigation element.
   *
   * @param parent Parent element, or `null` for the root.
   * @param label Label shown in the bar.
   * @param url Target URL of the entry.
   */
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
   * Renders the bar as HTML. Without a container it creates
   * `div.navbar_container`, `<hr class="navbar_topruler">` and
   * `<hr class="navbar_bottomruler">` (root). Every submenu is a `div.navbar`
   * with `navbar_current`/`navbar_other` spans separated by `|`. The `current`
   * branch is recursed below `<hr class="navbar_midruler">` when it is not the
   * first item.
   *
   * @param html Container to append to, or `null` to create the root one.
   * @returns The container holding the rendered bar.
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

    // Sub-menu of the current branch (one line below <hr class=navbar_midruler>).
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

  /** Text dump (debug): prints the tree with indentation, marking `<label>` as current. */
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
 * Report navigation bar. Instantiated by the parser through the
 * `navigator "id"` directive; consumed by `RTFNavigator.to_html`.
 */
export class Navigator {
  /** Id of the navigator as declared. */
  readonly id: string;
  /** Project the navigator belongs to. */
  readonly project: Project;
  /** Expression deciding which reports are hidden from the bar. */
  hideReport: LogicalExpression;

  /**
   * Creates a navigator.
   *
   * @param id Id of the navigator as declared.
   * @param project Project the navigator belongs to.
   */
  constructor(id: string, project: Project,) {
    this.id = id;
    this.project = project;
    // Default: a false expression (the equivalent of Ruby's
    // `LogicalOperation.new(0)`).
    this.hideReport = new LogicalExpression(new LogicalOperation(0,),);
  }

  /**
   * Builds the `NavigatorElement` tree for the given reports. `parentElement`
   * receives the top-level entries; the recursion descends into the `kids` of
   * the report that contains `reportDef`.
   *
   * @param allReports Every report of the project.
   * @param currentReports Reports of the level being rendered.
   * @param reportDef Report being rendered.
   * @param parentElement Element receiving the new entries.
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
      // Only container reports, or leaf reports with the html format, get an
      // entry.
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
   * Renders the navigation bar. `reportDef` is the report of the current
   * context. No filtered reports → `null`; a context without the current report
   * → a warning plus `null`.
   *
   * @param reportDefArg Report being rendered; defaults to the one of the last
   *   report context.
   * @returns The rendered bar, or `null` when there is nothing to render.
   * @throws Error When no report definition can be resolved at all.
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

    // Top-level reports: climb to the root parent and use its `kids`.
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
   * Ordered list of the `Report`s to include in the bar, dropping those hidden
   * by `hideReport`. Equivalent to Ruby's `filterReports`.
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
   * Cuts from `url1` the prefix shared with `url2` up to the last `/`.
   *
   * Ruby iterates `url1.length`, comparing character by character. With no match
   * at position `i` it returns `url1.substring(cut)`; otherwise it returns
   * `url1` unchanged.
   *
   * @param url1 URL being normalized.
   * @param url2 URL it is compared against.
   * @returns The relative URL, or `url1` when it is entirely shared.
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
   * Finds the URL of the menu entry. When `report` has the HTML format the URL
   * is returned (interactive: `taskjuggler?...`; otherwise
   * `report.name + '.html'` cut against `reportDef`). Containers without HTML
   * recurse into their `kids`.
   *
   * @param report Report whose entry URL is being resolved.
   * @param allReports Every report of the project.
   * @param reportDef Report being rendered.
   * @returns The target URL, or `null` when none can be derived.
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
    // Container without HTML: inherits the URL of the first kid that has one.
    for (const kid of report.kids() as Report[]) {
      const url = this.findReportURL(kid, allReports, reportDef,);
      if (url) return url;
    }
    return null;
  }
}
