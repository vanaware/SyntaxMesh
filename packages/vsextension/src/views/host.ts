/**
 * `views/host.ts` — view wiring over the VS Code API (22.7.6).
 *
 * Materializes the pure projections of 22.7.2/22.7.3: a `TreeDataProvider`
 * whose `getChildren`/`getTreeItem` delegate to {@link treeChildren}/
 * {@link treeItem}, and a status-bar item whose text comes from
 * {@link statusText}. The tree follows the active editor's cached project
 * (falling back to the first loaded one); the status bar summarizes the
 * daemon state, the detected locale and the last load's report count. All
 * decisions live in the pure modules; this file only wires VS Code (ADR 035).
 *
 * Imports the `vscode` runtime, so it is type-checked here and exercised inside
 * VS Code (acceptance deferred to P7). Refresh is explicit — after add/reload/
 * remove and on active-editor change — never an automatic schedule (plan §3.2).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §8.1 (views)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.7.6
 */
import {
  EventEmitter,
  StatusBarAlignment,
  ThemeIcon,
  TreeItem,
  TreeItemCollapsibleState,
  window,
} from "vscode";
import type {
  Event,
  ExtensionContext,
  StatusBarItem,
  TreeDataProvider,
} from "vscode";
import { resolveLocale, } from "@vanaware/syntaxmesh/lsp-core";
import type { DaemonHost, } from "../daemon/host.ts";
import type { ProjectModel, } from "../daemon/types.ts";
import {
  type CollapsibleState,
  treeChildren,
  treeItem,
  type TreeNode,
} from "./project-tree.ts";
import {
  type StatusBarState,
  type StatusBarStatus,
  statusText,
} from "./status-bar.ts";

/** The Project Explorer view id (declared in the manifest, 22.7.7). */
const TREE_VIEW_ID = "syntaxmesh.projectTree";

/** Maps the pure expansion state to the VS Code enum. */
function toVscodeState(state: CollapsibleState,): TreeItemCollapsibleState {
  switch (state) {
    case "collapsed":
      return TreeItemCollapsibleState.Collapsed;
    case "expanded":
      return TreeItemCollapsibleState.Expanded;
    default:
      return TreeItemCollapsibleState.None;
  }
}

/** Codicon shown in the status bar for each daemon state. */
function statusIcon(status: StatusBarStatus,): string {
  switch (status) {
    case "ok":
      return "check";
    case "error":
      return "error";
    default:
      return "circle-outline";
  }
}

/**
 * `TreeDataProvider` over the daemon model. The root children are the pure
 * category projection; nested children are the node's own subtree.
 */
export class ProjectTreeProvider implements TreeDataProvider<TreeNode> {
  private readonly daemon: DaemonHost;
  private readonly emitter = new EventEmitter<TreeNode | undefined>();
  readonly onDidChangeTreeData: Event<TreeNode | undefined> =
    this.emitter.event;

  /**
   * @param daemon the started daemon host (source of cached models).
   */
  constructor(daemon: DaemonHost,) {
    this.daemon = daemon;
  }

  /**
   * The project the tree/status bar follow: the active editor's cached model,
   * or the first loaded project when the active file is not cached.
   */
  activeModel(): ProjectModel | undefined {
    const uri = window.activeTextEditor?.document.uri.toString();
    if (uri !== undefined) {
      const model = this.daemon.core.cache.get(uri,);
      if (model !== undefined) return model;
    }
    return this.daemon.core.cache.list()[0];
  }

  getChildren(element?: TreeNode,): TreeNode[] {
    if (element !== undefined) return element.children;
    const model = this.activeModel();
    return model === undefined ? [] : treeChildren(model,);
  }

  getTreeItem(node: TreeNode,): TreeItem {
    const data = treeItem(node,);
    const item = new TreeItem(
      data.label,
      toVscodeState(data.collapsibleState,),
    );
    if (data.description !== undefined) item.description = data.description;
    item.iconPath = new ThemeIcon(data.icon,);
    item.id = node.id;
    return item;
  }

  /** Signals VS Code to re-query the tree. */
  refresh(): void {
    this.emitter.fire(undefined,);
  }

  /** Releases the change emitter. */
  dispose(): void {
    this.emitter.dispose();
  }
}

/**
 * Owns the Project Explorer provider and the status-bar item for one
 * activation, refreshing both on demand.
 */
export class ViewsHost {
  /** The tree provider (exposed so commands can refresh it). */
  readonly provider: ProjectTreeProvider;
  private readonly statusBar: StatusBarItem;

  /**
   * @param context the extension context (owns the view/status disposables).
   * @param daemon the started daemon host.
   */
  constructor(context: ExtensionContext, daemon: DaemonHost,) {
    this.provider = new ProjectTreeProvider(daemon,);
    this.statusBar = window.createStatusBarItem(StatusBarAlignment.Left, 100,);
    this.statusBar.command = "syntaxmesh.showProjectTree";
    context.subscriptions.push(
      window.registerTreeDataProvider(TREE_VIEW_ID, this.provider,),
      this.statusBar,
      window.onDidChangeActiveTextEditor(() => this.refresh()),
    );
    this.refresh();
  }

  /** Re-queries the tree and recomputes the status-bar text. */
  refresh(): void {
    this.provider.refresh();
    this.updateStatusBar();
  }

  /** Projects the active model into the status-bar state and renders it. */
  private updateStatusBar(): void {
    const state = this.stateOf(this.provider.activeModel(),);
    this.statusBar.text = `$(${statusIcon(state.status,)}) ${
      statusText(state,)
    }`;
    this.statusBar.show();
  }

  /** Builds the pure status-bar state from a cached model (idle when none). */
  private stateOf(model: ProjectModel | undefined,): StatusBarState {
    if (model === undefined) return { status: "idle", };
    const master = model.files.find((f,) => f.path === model.entry) ??
      model.files[0];
    return {
      status: model.status === "error" ? "error" : "ok",
      locale: master === undefined
        ? undefined
        : resolveLocale(model.uri, master.content,),
      reportCount: model.envelope?.results.listReports?.length ?? 0,
    };
  }

  /** Releases the provider emitter (view/status disposed via the context). */
  dispose(): void {
    this.provider.dispose();
  }
}

/** The running views host, or `undefined` when stopped (single instance). */
let views: ViewsHost | undefined;

/**
 * Creates the views host (tree + status bar) and performs a first refresh.
 *
 * @param context the extension context.
 * @param daemon the started daemon host.
 * @returns the started host (also reachable via {@link getViews}).
 */
export function startViews(
  context: ExtensionContext,
  daemon: DaemonHost,
): ViewsHost {
  const created = new ViewsHost(context, daemon,);
  views = created;
  return created;
}

/** The running views host, or `undefined` when not started. */
export function getViews(): ViewsHost | undefined {
  return views;
}

/** Releases the running views host (no-op when already stopped). */
export function stopViews(): void {
  if (views !== undefined) {
    views.dispose();
    views = undefined;
  }
}
