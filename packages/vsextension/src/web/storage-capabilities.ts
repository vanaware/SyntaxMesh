/**
 * `web/storage-capabilities.ts` — pure storage capability resolver (22.8.4).
 *
 * The Web extension host may expose no file storage at all
 * (`storageUri`/`globalStorageUri` are `undefined`) and IndexedDB/OPFS are
 * unreliable there (plan §9.3). This module decides, from a structural view of
 * the extension context, where each kind of state should live: the daemon
 * cache (file on Desktop, memory on Web), small key-value state (a VS Code
 * Memento, else memory), and large report outputs (file, else on demand). The
 * decision is pure so it is unit-testable in Deno without the `vscode` runtime;
 * the host reads the real context and passes the capabilities in.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §9.3 (storage strategy)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.8.4
 */

/** Structural storage capabilities of the extension context. */
export interface StorageCapabilities {
  /** `context.storageUri?.toString()` — workspace file store (Desktop). */
  storageUri?: string;
  /** `context.globalStorageUri?.toString()` — global file store (Desktop). */
  globalStorageUri?: string;
  /** Whether `context.workspaceState` is available. */
  hasWorkspaceState: boolean;
  /** Whether `context.globalState` is available. */
  hasGlobalState: boolean;
}

/** Where the serialized daemon cache lives. */
export type DaemonCacheStore = "file" | "memory";

/** Where small key-value state lives. */
export type SmallStateStore = "workspaceState" | "globalState" | "memory";

/** Where large report outputs go. */
export type LargeReportStore = "file" | "ondemand";

/** The resolved storage strategy for the current host. */
export interface StorageStrategy {
  /** Daemon cache backend (file on Desktop, memory when no `storageUri`). */
  daemonCache: DaemonCacheStore;
  /** Small-state backend (workspace Memento preferred, then global, then memory). */
  smallState: SmallStateStore;
  /** Large-report backend (file when a storage URI exists, else on demand). */
  largeReports: LargeReportStore;
}

/**
 * Resolves the storage strategy from the host capabilities. Never relies on
 * IndexedDB/OPFS directly: file storage is used only when a VS Code storage URI
 * is present, otherwise everything degrades to memory / on-demand generation.
 *
 * @param caps the structural capabilities of the extension context.
 * @returns the storage strategy for daemon cache, small state, and reports.
 */
export function resolveStorageCapabilities(
  caps: StorageCapabilities,
): StorageStrategy {
  const workspaceFile = caps.storageUri !== undefined;
  const globalFile = caps.globalStorageUri !== undefined;
  const smallState: SmallStateStore = caps.hasWorkspaceState
    ? "workspaceState"
    : caps.hasGlobalState
    ? "globalState"
    : "memory";
  return {
    daemonCache: workspaceFile ? "file" : "memory",
    smallState,
    largeReports: globalFile || workspaceFile ? "file" : "ondemand",
  };
}
