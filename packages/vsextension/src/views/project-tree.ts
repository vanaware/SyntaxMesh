/**
 * `views/project-tree.ts` — pure multi-project projection for the Project
 * Explorer (22.7.2/22.12.17).
 *
 * Every cached project becomes a root with tasks, resources, accounts, shifts
 * and reports beneath it. The execute-based envelope (P4.1) carries only
 * `listReports`, not the entity tree, so entity nodes reuse the pure LSP symbol
 * intelligence (`analyzeDocument` + `getDocumentSymbols`) over the master text
 * already cached in {@link ProjectModel.files}; report leaves come from the
 * cached inventory. Icons, expansion state, context values and canonical command
 * metadata are emitted as **data**; the host only maps them to VS Code APIs
 * (ADR 035).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §8.1/P8.4
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.12.17
 */
import {
  analyzeDocument,
  getDocumentSymbols,
} from "@vanaware/syntaxmesh/lsp-core";
import type { DocumentSymbol, } from "@vanaware/syntaxmesh/lsp-core";
import { normalizeInputPath, } from "@vanaware/syntaxmesh";
import type { ProjectModel, } from "../daemon/types.ts";

/** Expansion state of a node, as data (host maps to `TreeItemCollapsibleState`). */
export type CollapsibleState = "none" | "collapsed" | "expanded";

/** Semantic kind of a projected node, also used by manifest context filters. */
export type TreeNodeKind = "project" | "category" | "entity" | "report";

/** A projected tree node — pure data, no `vscode` runtime. */
export interface TreeNode extends TreeItemData {
  /** Globally unique id, prefixed by the owning project root. */
  id: string;
  /** Semantic kind used by context menus. */
  kind: TreeNodeKind;
  /** Master URI of the project that owns this node. */
  projectUri: string;
  /** Cached report id, present only on report leaves. */
  reportId?: string;
  /** VS Code context value used by `view/item/context` filters. */
  contextValue: TreeNodeKind;
  /** Canonical command invoked when the node is clicked. */
  command?: string;
  /** Positional arguments forwarded to the canonical command. */
  commandArgs?: unknown[];
  /** Child nodes (empty for leaves). */
  children: TreeNode[];
}

/** Presentation fields of a node (the host builds a `vscode.TreeItem`). */
export interface TreeItemData {
  /** Display label. */
  label: string;
  /** Secondary text, when present. */
  description?: string;
  /** Codicon id. */
  icon: string;
  /** Expansion state as data. */
  collapsibleState: CollapsibleState;
}

/** One root category: its protocol `SymbolKind`, title and codicon. */
interface CategorySpec {
  id: string;
  label: string;
  kind: number;
  icon: string;
}

/**
 * The entity categories shown at the root, in display order. The `kind` values
 * mirror `lsp/symbols.ts` (task=Class 5, resource=Variable 13, account=Enum 10,
 * shift=Constant 14, report=Function 12).
 */
const CATEGORIES: CategorySpec[] = [
  { id: "tasks", label: "Tasks", kind: 5, icon: "list-tree", },
  { id: "resources", label: "Resources", kind: 13, icon: "person", },
  { id: "accounts", label: "Accounts", kind: 10, icon: "credit-card", },
  { id: "shifts", label: "Shifts", kind: 14, icon: "calendar", },
  { id: "reports", label: "Reports", kind: 12, icon: "graph", },
];

/** A synchronous include provider backed by the cached closure. */
function closureProvider(model: ProjectModel,): (path: string,) => string {
  const byPath = new Map<string, string>();
  for (const file of model.files) {
    byPath.set(normalizeInputPath(file.path,), file.content,);
  }
  return (path: string,): string =>
    byPath.get(normalizeInputPath(path,),) ?? "";
}

/** Document symbols of the master, or `[]` when the model has no parseable file. */
function projectSymbols(model: ProjectModel,): DocumentSymbol[] {
  const master = model.files.find((f,) => f.path === model.entry) ??
    model.files[0];
  if (master === undefined) return [];
  const analysis = analyzeDocument(model.uri, master.content, {
    provider: closureProvider(model,),
  },);
  return getDocumentSymbols(analysis,);
}

/** Projects one entity symbol (and its subtree) into a project-prefixed node. */
function entityNode(
  symbol: DocumentSymbol,
  icon: string,
  idPrefix: string,
  projectUri: string,
): TreeNode {
  const id = `${idPrefix}/${symbol.name}`;
  const children = (symbol.children ?? []).map((child,) =>
    entityNode(child, icon, idPrefix, projectUri,)
  );
  const node: TreeNode = {
    id,
    label: symbol.name,
    icon,
    collapsibleState: children.length > 0 ? "collapsed" : "none",
    children,
    kind: "entity",
    projectUri,
    contextValue: "entity",
  };
  if (symbol.detail !== undefined && symbol.detail.length > 0) {
    node.description = symbol.detail;
  }
  return node;
}

/** Projects cached report inventory into clickable leaves. */
function reportNodes(model: ProjectModel, idPrefix: string,): TreeNode[] {
  return (model.envelope?.results.listReports ?? []).map((report,) => {
    const reportId = report.id ?? report.name;
    return {
      id: `${idPrefix}/${reportId}`,
      label: report.name,
      description: report.type,
      icon: "graph",
      collapsibleState: "none",
      children: [],
      kind: "report",
      projectUri: model.uri,
      reportId,
      contextValue: "report",
      command: "syntaxmesh.report.open",
      commandArgs: [model.uri, reportId,],
    };
  },);
}

/** Codicon that reflects the cached project lifecycle status. */
function statusIcon(status: ProjectModel["status"],): string {
  switch (status) {
    case "loading":
      return "loading~spin";
    case "error":
      return "error";
    default:
      return "check";
  }
}

/** Projects one loaded project into a root with the five category nodes. */
function projectNode(model: ProjectModel, activeUri: string | null,): TreeNode {
  const id = `project:${model.uri}`;
  const intent = model.lastExecution?.intent ?? "inventory";
  const topLevel = projectSymbols(model,)[0]?.children ?? [];
  const children = CATEGORIES.map((category,): TreeNode => {
    const categoryId = `${id}/${category.id}`;
    const entities = category.id === "reports"
      ? reportNodes(model, categoryId,)
      : topLevel
        .filter((symbol,) => symbol.kind === category.kind)
        .map((symbol,) =>
          entityNode(symbol, category.icon, categoryId, model.uri,)
        );
    return {
      id: categoryId,
      label: category.label,
      icon: category.icon,
      collapsibleState: entities.length > 0 ? "collapsed" : "none",
      children: entities,
      kind: "category",
      projectUri: model.uri,
      contextValue: "category",
    };
  },);
  return {
    id,
    label: model.entry,
    description: model.uri === activeUri ? `Active · ${intent}` : intent,
    icon: statusIcon(model.status,),
    collapsibleState: "collapsed",
    children,
    kind: "project",
    projectUri: model.uri,
    contextValue: "project",
    command: "syntaxmesh.project.setActive",
    commandArgs: [model.uri,],
  };
}

/**
 * Projects every loaded project into a navigable root and its category subtree.
 *
 * @param models cached project models in registry order.
 * @param activeUri the registry's explicit active master, or `null`.
 * @returns one project root per model, each with globally prefixed child ids.
 */
export function treeChildren(
  models: ProjectModel[],
  activeUri: string | null,
): TreeNode[] {
  return models.map((model,) => projectNode(model, activeUri,));
}

/**
 * Projects a node into its presentation fields (the host builds a
 * `vscode.TreeItem` from these, dropping the children).
 *
 * @param node the projected tree node.
 * @returns the label/description/icon/expansion data of the node.
 */
export function treeItem(node: TreeNode,): TreeItemData {
  const item: TreeItemData = {
    label: node.label,
    icon: node.icon,
    collapsibleState: node.collapsibleState,
  };
  if (node.description !== undefined) item.description = node.description;
  return item;
}
