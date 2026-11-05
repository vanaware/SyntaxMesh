/**
 * ReportBase (Fase 14.3) — classe abstrata base de todos os relatórios.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/ReportBase.rb`.
 * Fornece acesso a atributos do relatório (`a`), propagação do `Query` aos
 * blocos de RichText (`generateIntermediateFormat`), os filtros de listas
 * (tasks/recursos/contas) com `standardFilterOps` e helpers de moldura HTML.
 *
 * ⚠️ Browser (ADR 027): os relatórios retornam strings; nenhuma escrita a
 * disco acontece aqui. Os helpers HTML constroem árvores `XMLElementLike`.
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
 * Coleção de nós abertos, espelhando o `Set` de Ruby com entradas
 * `[parent, scopeProperty]`. Usado por `openNodes` em `standardFilterOps`.
 */
export type OpenNodes = Array<[PropertyTreeNode, PropertyTreeNode | null,]>;

/** Membros de RichText que o `generateIntermediateFormat` conhece. */
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
 * Base abstrata para todas as classes de relatório. As derivadas devem
 * implementar `generateIntermediateFormat` (sobrescrevendo) e os `to_*`.
 */
export abstract class ReportBase {
  readonly report: Report;
  readonly project: Project;

  constructor(report: Report,) {
    this.report = report;
    this.project = report.project as Project;
  }

  /** Atalho para acessar um atributo do relatório. */
  a(attribute: string,): unknown {
    return this.report.get(attribute,);
  }

  /**
   * Propaga o `Query` do contexto atual a todos os blocos de RichText do
   * relatório. Blocos ausentes são ignorados.
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
   * Remove contas que casa com a expressão de ocultação/rollup ou que não são
   * descendentes de `accountroot`.
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
   * Remove tarefas que casa com hide/rollup ou não são descendentes de
   * `taskroot`. Se `resource` for fornecido, uma tarefa só é mantida se o
   * recurso estiver alocado a ela em algum cenário reportado.
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
   * Remove recursos que casa com hide/rollup ou não são descendentes de
   * `resourceroot`. Se `task` for fornecido, um recurso só é mantido se estiver
   * alocado à tarefa em algum cenário reportado.
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
   * Remove materiais que casam com a expressão de ocultação/consolidação
   * (extensão SyntaxMesh 14C.6.6/6.9).
   *
   * Materiais não têm raiz própria (`materialroot` não existe): só os filtros
   * de `hide`/`rollup` são aplicados, sem recorte de subárvore.
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
   * Avalia uma expressão de ocultação do relatório contra uma propriedade
   * (14C.6.5). Promovido do `RdoReport` para uso em todos os relatórios.
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
   * Filtragem genérica para todas as listas: remove itens ocultos pela
   * `hideExpr`, remove descendentes de nós enrollados (`rollupExpr`/`openNodes`)
   * e, em modo árvore, readiciona os pais dos itens mantidos.
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

    // Remove propriedades que o usuário deseja ocultar.
    if (hideExpr) {
      list.deleteIf((property,) => {
        query.property = property;
        return hideExpr.eval(query,);
      },);
    }

    // Remove filhos de propriedades que foram enrolladas.
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

    // Readiciona pais em modo árvore.
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

  /** Monta a moldura da tabela HTML com a caixa de headline, se houver. */
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

  /** Cria uma linha `<tr>` contendo a célula fornecida. */
  protected generateHtmlTableRow(cell: XMLElementLike,): XMLElementLike {
    const tr = new XMLElement("tr",);
    tr.append(cell,);
    return tr;
  }

  /** Converte o bloco RichText `name` em HTML, sem numeração de seção. */
  protected rt_to_html(name: string,): XMLElementLike | null {
    const obj = this.a(name,);
    if (!obj) return null;
    const rt = obj as RichTextIntermediate;
    rt.sectionNumbers = false;
    return rt.to_html();
  }

  /**
   * Converte o bloco RichText `name` em Markdown (extensão SyntaxMesh —
   * adendo §10). Sem numeração de seção, como no HTML do relatório.
   */
  protected rt_to_markdown(name: string,): string | null {
    const obj = this.a(name,);
    if (!obj) return null;
    const rt = obj as RichTextIntermediate;
    rt.sectionNumbers = false;
    const md = rt.to_markdown();
    return md === "" ? null : md;
  }

  /** Retorna o `Query` do contexto de relatório corrente. */
  protected currentQuery(): Query {
    const ctx = this.project.reportContexts.at(-1,);
    if (!ctx) {
      throw new Error("ReportBase: no active ReportContext",);
    }
    return ctx.query;
  }

  /**
   * Adapta um `RichTextIntermediate` de propriedade (`note` de task/resource/
   * material/account — 14C.5.7) ao dialeto do relatório.
   *
   * O `note` é lido no carregamento do projeto, quando não existe relatório
   * corrente, então nasce sempre no default richtext. Quando o relatório pede
   * `format markdown`, o RTI é reconstruído a partir do texto de origem
   * (`RichText#inputText`) pelo {@link MarkdownFactory}. Nos demais casos o RTI
   * volta intacto — a regressão dos `.tjp` sem `format` fica garantida.
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
   * Texto de célula (`celltext`) no dialeto do relatório (14C.5.7).
   *
   * `celltext` é uma string crua no TaskJuggler (o Ruby a atribui a
   * `cell.text` sem markup). Em relatórios `format markdown` ela passa pelo
   * pipeline markdown — a extensão SyntaxMesh para permitir negrito/links no
   * rótulo da célula. Fora do markdown o comportamento é o do Ruby (texto
   * literal).
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
 * Consulta se `resource` está alocado a `task` no cenário e intervalo dados.
 * Delegação direta a `Task#hasResourceAllocated` (engine, integrada em 14.23).
 */
function hasResourceAllocated(
  task: Task,
  scenarioIdx: number,
  iv: TimeInterval,
  resource: Resource,
): boolean {
  return task.hasResourceAllocated(scenarioIdx, iv, resource,);
}
