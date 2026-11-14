/**
 * `views/project-tree.ts` — pure projection of the daemon model into a tree
 * (22.7.2).
 *
 * The Project Explorer lists the project's tasks, resources, accounts, shifts
 * and reports. The execute-based envelope (P4.1) carries only `listReports`,
 * not the entity tree, so this projection reuses the pure LSP symbol
 * intelligence (`analyzeDocument` + `getDocumentSymbols`) over the master text
 * already cached in {@link ProjectModel.files} — no core delta and no
 * reimplementation (ADR 035). Icons and expansion state are emitted as **data**
 * (codicon ids + a {@link CollapsibleState}); the host maps them to
 * `vscode.TreeItem`/`ThemeIcon` (22.7.6).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §8.1 (Project Explorer)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.7.2
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

/** A projected tree node — pure data, no `vscode` runtime. */
export interface TreeNode {
  /** Stable id (category id or entity dotted id). */
  id: string;
  /** Display label (the entity id, or the category title). */
  label: string;
  /** Secondary text (the entity's quoted human name), when present. */
  description?: string;
  /** Codicon id rendered by the host. */
  icon: string;
  /** Expansion state as data. */
  collapsibleState: CollapsibleState;
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

/** Projects one entity symbol (and its subtree) into a node. */
function entityNode(symbol: DocumentSymbol, icon: string,): TreeNode {
  const children = (symbol.children ?? []).map((child,) =>
    entityNode(child, icon,)
  );
  const node: TreeNode = {
    id: symbol.name,
    label: symbol.name,
    icon,
    collapsibleState: children.length > 0 ? "collapsed" : "none",
    children,
  };
  if (symbol.detail !== undefined && symbol.detail.length > 0) {
    node.description = symbol.detail;
  }
  return node;
}

/**
 * Projects the daemon model into the root category nodes (Tasks, Resources,
 * Accounts, Shifts, Reports), each populated with its top-level entities and
 * their subtrees. Returns `[]` when the model has no parsed project.
 *
 * @param model the cached project model (closure + envelope).
 * @returns the root categories in display order, or `[]` when empty.
 */
export function treeChildren(model: ProjectModel,): TreeNode[] {
  const topLevel = projectSymbols(model,)[0]?.children ?? [];
  if (topLevel.length === 0) return [];
  return CATEGORIES.map((category,): TreeNode => {
    const entities = topLevel
      .filter((symbol,) => symbol.kind === category.kind)
      .map((symbol,) => entityNode(symbol, category.icon,));
    return {
      id: category.id,
      label: category.label,
      icon: category.icon,
      collapsibleState: entities.length > 0 ? "collapsed" : "none",
      children: entities,
    };
  },);
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
