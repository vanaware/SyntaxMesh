/**
 * ReportBase (phase 14.3) — abstract base class of every report.
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/reports/ReportBase.rb`.
 * It provides report attribute access (`a`), propagation of the `Query` to the
 * RichText blocks (`generateIntermediateFormat`), the list filters
 * (tasks/resources/accounts) backed by `standardFilterOps`, and HTML frame
 * helpers.
 *
 * ⚠️ Browser (ADR 027): reports return strings; no disk write happens here.
 * The HTML helpers build `XMLElementLike` trees.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.3)
 */

import type { Project, } from "../model/project.ts";
import type { Report, } from "../model/report.ts";
import type { Task, } from "../model/task.ts";
import type { Resource, } from "../model/resource.ts";
import type { Account, } from "../model/account.ts";
import type { Material, } from "../model/material.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import { PropertyList, } from "../model/property-list.ts";
import type { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "../logic/logical-expression.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import type { TjTime, } from "../time/tj-time.ts";
import type { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import { RichText, } from "../richtext/rich-text.ts";
import { MarkdownFactory, } from "../markdown/factory.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { XMLElement, } from "../xml/xml-element.ts";

/**
 * Collection of open nodes, mirroring the Ruby `Set` of
 * `[parent, scopeProperty]` entries. Used by `openNodes` in
 * `standardFilterOps`.
 */
export type OpenNodes = Array<[PropertyTreeNode, PropertyTreeNode | null,]>;

/** RichText members known to `generateIntermediateFormat`. */
const RICH_TEXT_BLOCKS = [
  "header",
  "left",
  "center",
  "right",
  "footer",
  "prolog",
  "headline",
  "caption",
  "epilog",
] as const;

/**
 * Abstract base for every report class. Subclasses are expected to override
 * `generateIntermediateFormat` and implement the `to_*` converters.
 */
export abstract class ReportBase {
  /** Report this instance renders. */
  readonly report: Report;
  /** Project the report belongs to. */
  readonly project: Project;

  /**
   * Creates the base state of a report.
   *
   * @param report Report being rendered.
   */
  constructor(report: Report,) {
    this.report = report;
    this.project = report.project as Project;
  }

  /**
   * Reads an attribute of the report.
   *
   * @param attribute Name of the report attribute.
   * @returns The attribute value, or `undefined`-like when unset.
   */
  a(attribute: string,): unknown {
    return this.report.get(attribute,);
  }

  /**
   * Propagates the `Query` of the current context to every RichText block of
   * the report. Missing blocks are skipped.
   */
  generateIntermediateFormat(): void {
    const query = this.currentQuery();
    for (const name of RICH_TEXT_BLOCKS) {
      const text = this.a(name,);
      if (!text) continue;
      (text as RichTextIntermediate).setQuery(query,);
    }
  }

  /**
   * Removes accounts matching the hide/rollup expression or not descending
   * from `accountroot`.
   *
   * @param list_ Accounts to filter.
   * @param hideExpr Expression of the `hide` attribute, or `null` for none.
   * @param rollupExpr Expression of the `rollup` attribute, or `null`.
   * @param openNodes Explicitly opened nodes, or `null` for none.
   * @returns The filtered list.
   */
  filterAccountList(
    list_: PropertyList<Account> | Iterable<Account>,
    hideExpr: LogicalExpression | null,
    rollupExpr: LogicalExpression | null,
    openNodes: OpenNodes | null,
  ): PropertyList<Account> {
    const list = new PropertyList<Account>(list_ as PropertyList<Account>,);
    const accountroot = this.a("accountroot",) as Account | null;
    if (accountroot) {
      list.deleteIf((account,) => !account.isChildOf(accountroot,));
    }
    return this.standardFilterOps(
      list,
      hideExpr,
      rollupExpr,
      openNodes,
      null,
      accountroot,
    );
  }

  /**
   * Removes tasks matching hide/rollup or not descending from `taskroot`.
   *
   * When `resource` is given, a task is kept only if that resource is
   * allocated to it in some reported scenario.
   *
   * @param list_ Tasks to filter.
   * @param resource Resource the tasks must be allocated to, or `null`.
   * @param hideExpr Expression of the `hide` attribute, or `null`.
   * @param rollupExpr Expression of the `rollup` attribute, or `null`.
   * @param openNodes Explicitly opened nodes, or `null`.
   * @returns The filtered list.
   */
  filterTaskList(
    list_: PropertyList<Task> | Iterable<Task>,
    resource: Resource | null,
    hideExpr: LogicalExpression | null,
    rollupExpr: LogicalExpression | null,
    openNodes: OpenNodes | null,
  ): PropertyList<Task> {
    const list = new PropertyList<Task>(list_ as PropertyList<Task>,);
    const taskRoot = this.a("taskroot",) as Task | null;
    if (taskRoot) {
      list.deleteIf((task,) => !task.isChildOf(taskRoot,));
    }

    if (resource) {
      const scenarios = (this.a("scenarios",) as number[]) ?? [];
      list.deleteIf((task,) => {
        for (const scenarioIdx of scenarios) {
          const iv = new TimeInterval(
            this.a("start",) as TjTime,
            this.a("end",) as TjTime,
          );
          if (hasResourceAllocated(task, scenarioIdx, iv, resource,)) {
            return false;
          }
        }
        return true;
      },);
    }

    return this.standardFilterOps(
      list,
      hideExpr,
      rollupExpr,
      openNodes,
      resource,
      taskRoot,
    );
  }

  /**
   * Removes resources matching hide/rollup or not descending from
   * `resourceroot`.
   *
   * When `task` is given, a resource is kept only if it is allocated to that
   * task in some reported scenario.
   *
   * @param list_ Resources to filter.
   * @param task Task the resources must be allocated to, or `null`.
   * @param hideExpr Expression of the `hide` attribute, or `null`.
   * @param rollupExpr Expression of the `rollup` attribute, or `null`.
   * @param openNodes Explicitly opened nodes, or `null`.
   * @returns The filtered list.
   */
  filterResourceList(
    list_: PropertyList<Resource> | Iterable<Resource>,
    task: Task | null,
    hideExpr: LogicalExpression | null,
    rollupExpr: LogicalExpression | null,
    openNodes: OpenNodes | null,
  ): PropertyList<Resource> {
    const list = new PropertyList<Resource>(list_ as PropertyList<Resource>,);
    const resourceRoot = this.a("resourceroot",) as Resource | null;
    if (resourceRoot) {
      list.deleteIf((resource,) => !resource.isChildOf(resourceRoot,));
    }

    if (task) {
      const iv = new TimeInterval(
        this.a("start",) as TjTime,
        this.a("end",) as TjTime,
      );
      const scenarios = (this.a("scenarios",) as number[]) ?? [];
      list.deleteIf((resource,) => {
        for (const scenarioIdx of scenarios) {
          if (hasResourceAllocated(task, scenarioIdx, iv, resource,)) {
            return false;
          }
        }
        return true;
      },);
    }

    return this.standardFilterOps(
      list,
      hideExpr,
      rollupExpr,
      openNodes,
      task,
      resourceRoot,
    );
  }

  /**
   * Removes materials matching the hide/rollup expression (SyntaxMesh extension
   * 14C.6.6/6.9).
   *
   * Materials have no root of their own (`materialroot` does not exist), so
   * only the `hide`/`rollup` filters apply, without any subtree trimming.
   *
   * @param list_ Materials to filter.
   * @param hideExpr Expression of the `hide` attribute, or `null`.
   * @param rollupExpr Expression of the `rollup` attribute, or `null`.
   * @param openNodes Explicitly opened nodes, or `null`.
   * @returns The filtered list.
   */
  filterMaterialList(
    list_: PropertyList<Material> | Iterable<Material>,
    hideExpr: LogicalExpression | null,
    rollupExpr: LogicalExpression | null,
    openNodes: OpenNodes | null,
  ): PropertyList<Material> {
    const list = new PropertyList<Material>(
      list_ as PropertyList<Material>,
    );
    return this.standardFilterOps(
      list,
      hideExpr,
      rollupExpr,
      openNodes,
      null,
      null,
    );
  }

  /**
   * Evaluates a report hide expression against a property (14C.6.5). Promoted
   * from `RdoReport` so every report can use it.
   *
   * @param attribute Name of the report attribute holding the expression.
   * @param property Property the expression is evaluated on.
   * @returns `true` when the property is hidden by the expression.
   */
  protected hiddenBy(attribute: string, property: PropertyTreeNode,): boolean {
    const expression = this.a(attribute,) as
      | { eval?: (query: unknown,) => unknown }
      | null;
    if (!expression || typeof expression.eval !== "function") return false;
    const query = this.currentQuery().dup();
    query.property = property;
    return !!expression.eval(query,);
  }

  /**
   * Generic filtering shared by every list: drops items hidden by `hideExpr`,
   * drops descendants of rolled-up nodes (`rollupExpr`/`openNodes`) and, in tree
   * mode, re-adds the parents of the kept items.
   *
   * @param list List being filtered in place.
   * @param hideExpr Expression of the `hide` attribute, or `null`.
   * @param rollupExpr Expression of the `rollup` attribute, or `null`.
   * @param openNodes Explicitly opened nodes, or `null`.
   * @param scopeProperty Property exposed as the query scope, or `null`.
   * @param root Root of the tree, or `null` to walk up to the very top.
   * @returns The same list, filtered.
   */
  protected standardFilterOps<T extends PropertyTreeNode,>(
    list: PropertyList<T>,
    hideExpr: LogicalExpression | null,
    rollupExpr: LogicalExpression | null,
    openNodes: OpenNodes | null,
    scopeProperty: PropertyTreeNode | null,
    root: PropertyTreeNode | null,
  ): PropertyList<T> {
    const query = this.currentQuery().dup();
    query.scopeProperty = scopeProperty;

    // Drops the properties the user asked to hide.
    if (hideExpr) {
      list.deleteIf((property,) => {
        query.property = property;
        return hideExpr.eval(query,);
      },);
    }

    // Drops the children of rolled-up properties.
    if (rollupExpr || openNodes) {
      list.deleteIf((property,) => {
        let parent = property.parent;
        let deleteNode = false;
        while (parent) {
          query.property = parent;
          const rolledUp = openNodes
            ? !openNodes.some(
              ([node, scope,],) => node === parent && scope === scopeProperty,
            )
            : !!rollupExpr && rollupExpr.eval(query,);
          if (rolledUp) {
            deleteNode = true;
            break;
          }
          parent = parent.parent;
        }
        return deleteNode;
      },);
    }

    // Re-adds the parents in tree mode.
    if (list.treeMode()) {
      const parents: T[] = [];
      for (const property of list.toArray()) {
        let parent = property.parent;
        while (parent) {
          const candidate = parent as T;
          if (
            !list.includes(candidate,) &&
            !parents.some((p,) => p === candidate)
          ) {
            parents.push(candidate,);
          }
          if (parent === root) break;
          parent = parent.parent;
        }
      }
      list.append(parents,);
    }

    return list;
  }

  /** Builds the HTML table frame, with the headline box when present. */
  protected generateHtmlTableFrame(): XMLElementLike {
    const table = new XMLElement("table", {
      class: "tj_table_frame",
      cellspacing: "1",
    },);

    const headline = this.a("headline",);
    if (headline) {
      const td = new XMLElement("td",);
      const div = new XMLElement("div", { class: "tj_table_headline", },);
      const html = (headline as RichTextIntermediate).to_html();
      if (html) div.append(html,);
      td.append(div,);
      table.append(this.generateHtmlTableRow(td,),);
    }

    return table;
  }

  /** Creates a `<tr>` line wrapping the given cell. */
  protected generateHtmlTableRow(cell: XMLElementLike,): XMLElementLike {
    const tr = new XMLElement("tr",);
    tr.append(cell,);
    return tr;
  }

  /** Renders the RichText block `name` as HTML, without section numbering. */
  protected rt_to_html(name: string,): XMLElementLike | null {
    const obj = this.a(name,);
    if (!obj) return null;
    const rt = obj as RichTextIntermediate;
    rt.sectionNumbers = false;
    return rt.to_html();
  }

  /**
   * Renders the RichText block `name` as Markdown (SyntaxMesh extension —
   * addendum §10). Without section numbering, as in the report HTML.
   *
   * @param name Name of the RichText block.
   * @returns The Markdown text, or `null` when the block is absent or empty.
   */
  protected rt_to_markdown(name: string,): string | null {
    const obj = this.a(name,);
    if (!obj) return null;
    const rt = obj as RichTextIntermediate;
    rt.sectionNumbers = false;
    const md = rt.to_markdown();
    return md === "" ? null : md;
  }

  /**
   * Returns the `Query` of the current report context.
   *
   * @throws Error When no report context is active.
   */
  protected currentQuery(): Query {
    const ctx = this.project.reportContexts.at(-1,);
    if (!ctx) {
      throw new Error("ReportBase: no active ReportContext",);
    }
    return ctx.query;
  }

  /**
   * Adapts a property `RichTextIntermediate` (the `note` of a task/resource/
   * material/account — 14C.5.7) to the dialect of the report.
   *
   * The `note` is read while loading the project, when no report is current,
   * so it is always built with the default richtext. When the report asks for
   * `format markdown`, the RTI is rebuilt from the source text
   * (`RichText#inputText`) by the {@link MarkdownFactory}. Otherwise the RTI is
   * returned untouched — the regression of `.tjp` files without `format` is
   * thereby preserved.
   *
   * @param rti Intermediate representation of the property note.
   * @returns The RTI adapted to the report dialect.
   */
  protected rtiForReport(
    rti: RichTextIntermediate,
  ): RichTextIntermediate {
    if (this.report.richTextFormat() !== "markdown") return rti;
    if (!(rti.richText instanceof RichText)) return rti;
    return new MarkdownFactory(this.project, this.report.sourceFileInfo,)
      .create(rti.richText.inputText,);
  }

  /**
   * Cell text (`celltext`) in the dialect of the report (14C.5.7).
   *
   * `celltext` is a raw string in TaskJuggler (Ruby assigns it to `cell.text`
   * without any markup). In `format markdown` reports it goes through the
   * Markdown pipeline — the SyntaxMesh extension that allows bold and links in
   * the cell label. Outside Markdown the behaviour is Ruby's (literal text).
   *
   * @param text Raw cell text.
   * @returns The literal text, or its Markdown intermediate representation.
   */
  protected cellTextForReport(
    text: string,
  ): string | RichTextIntermediate {
    if (this.report.richTextFormat() !== "markdown") return text;
    return new MarkdownFactory(this.project, this.report.sourceFileInfo,)
      .create(text,);
  }
}

/**
 * Checks whether `resource` is allocated to `task` in the given scenario and
 * interval. Thin delegation to `Task#hasResourceAllocated` (engine, integrated
 * in 14.23).
 */
function hasResourceAllocated(
  task: Task,
  scenarioIdx: number,
  iv: TimeInterval,
  resource: Resource,
): boolean {
  return task.hasResourceAllocated(scenarioIdx, iv, resource,);
}
