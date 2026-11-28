/**
 * `views/host.ts` — view wiring over the VS Code API (22.7.6).
 *
 * Materializes the pure projections of 22.7.2/22.7.3: a `TreeDataProvider`
 * whose `getChildren`/`getTreeItem` delegate to {@link treeChildren}/
 * {@link treeItem}, and a status-bar item whose text comes from
 * {@link statusText}. The tree follows the registry's explicit active project;
 * the status bar summarizes the daemon state, the detected locale and the last
 * load's report count. All
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
import type { DaemonHost, } from "../daemon/host.ts";
import type { ProjectModel, } from "../daemon/types.ts";
import {
  type CollapsibleState,
  treeChildren,
  treeItem,
  type TreeNode,
} from "./project-tree.ts";
import {
  ExecutionActivity,
  projectStatusState,
  STATUS_BAR_COMMAND,
  type StatusBarState,
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

/** Codicon shown in the status bar for aggregate state and pending work. */
function statusIcon(state: StatusBarState,): string {
  if (state.busy) return "loading~spin";
  switch (state.status) {
    case "ok":
      return "check";
    case "error":
      return "error";
    default:
      return "circle-outline";
  }
}

/**
 * `TreeDataProvider` over every cached daemon project. Root children are project
 * nodes; nested children are each projected node's own category/entity subtree.
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

  /** @returns the registry's explicit active project for tree and status bar. */
  activeModel(): ProjectModel | undefined {
    return this.daemon.activeProject();
  }

  getChildren(element?: TreeNode,): TreeNode[] {
    if (element !== undefined) return element.children;
    return treeChildren(
      this.daemon.core.cache.list(),
      this.daemon.core.cache.active(),
    );
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
    item.contextValue = node.contextValue;
    if (node.command !== undefined) {
      item.command = {
        command: node.command,
        title: data.label,
        arguments: node.commandArgs,
      };
    }
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
  private readonly daemon: DaemonHost;
  private readonly activity = new ExecutionActivity();
  private readonly statusBar: StatusBarItem;

  /**
   * @param context the extension context (owns the view/status disposables).
   * @param daemon the started daemon host.
   */
  constructor(context: ExtensionContext, daemon: DaemonHost,) {
    this.daemon = daemon;
    this.provider = new ProjectTreeProvider(daemon,);
    this.statusBar = window.createStatusBarItem(StatusBarAlignment.Left, 100,);
    this.statusBar.command = STATUS_BAR_COMMAND;
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

  /**
   * Tracks one asynchronous execution, refreshing views before and after it.
   * Overlapping calls share the same pending count.
   */
  async runBusy<T,>(action: () => Promise<T>,): Promise<T> {
    return await this.activity.run(action, () => this.refresh(),);
  }

  /** Projects aggregate cached state into the status-bar item and renders it. */
  private updateStatusBar(): void {
    const state = projectStatusState(
      this.daemon.core.cache.list(),
      this.daemon.core.cache.active(),
      this.activity.busy,
    );
    this.statusBar.text = `$(${statusIcon(state,)}) ${statusText(state,)}`;
    this.statusBar.show();
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

/** Runs an action through the active views host's busy tracker when available. */
export async function withBusy<T,>(action: () => Promise<T>,): Promise<T> {
  const current = getViews();
  return current === undefined
    ? await action()
    : await current.runBusy(action,);
}

/** Releases the running views host (no-op when already stopped). */
export function stopViews(): void {
  if (views !== undefined) {
    views.dispose();
    views = undefined;
  }
}
