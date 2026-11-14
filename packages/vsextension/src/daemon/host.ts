/**
 * `daemon/host.ts` — daemon bootstrap over the VS Code API (22.5.8).
 *
 * Materializes the runtime pieces the pure daemon core (22.5.6) injects: the
 * real `execute` from `@vanaware/syntaxmesh`, a file reader backed by
 * `workspace.fs`/open buffers, and persistence to `context.storageUri`
 * (Desktop) or an in-memory string (Web, where `storageUri` is absent). All
 * orchestration lives in {@link DaemonCore}; this file only wires I/O (ADR 035).
 *
 * It imports the `vscode`/core runtime, so it is type-checked here and exercised
 * inside VS Code (acceptance deferred to P7); the pure modules it consumes are
 * unit-tested in Deno. The daemon never watches `onDidChange`/`onDidSave` —
 * updates are explicit manual commands (plan §3.2).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §3.2 (daemon)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.5.8
 */
import { execute, } from "@vanaware/syntaxmesh";
import { Uri, workspace, } from "vscode";
import type { ExtensionContext, } from "vscode";
import { DaemonCore, } from "./daemon-core.ts";
import { buildClosure, } from "./include-closure.ts";
import { deserializeCache, serializeCache, } from "./persistence.ts";
import type { ProjectModel, } from "./types.ts";

/** Name of the persisted cache file under `storageUri`. */
const CACHE_FILE = "daemon-cache.json";

/** Basename of a URI path (the master entry within its directory). */
function basename(uri: Uri,): string {
  const path = uri.path;
  const index = path.lastIndexOf("/",);
  return index < 0 ? path : path.slice(index + 1,);
}

/**
 * Host-side daemon: a {@link DaemonCore} plus the reader and persistence the
 * pure core injects. One instance per extension activation.
 */
export class DaemonHost {
  /** The pure orchestration core (real `execute` injected). */
  readonly core: DaemonCore;
  private readonly context: ExtensionContext;
  /** Web fallback store when `storageUri` is absent. */
  private memoryStore: string | null = null;

  /**
   * @param context the extension context (provides `storageUri` on Desktop).
   */
  constructor(context: ExtensionContext,) {
    this.context = context;
    this.core = new DaemonCore(execute,);
  }

  /**
   * Builds a reader rooted at the master's directory. Closure paths are
   * relative to that root; an open buffer wins over the disk so unsaved edits
   * are included. `Uri.joinPath` resolves `..` segments posix-style.
   */
  private readerFor(masterUri: Uri,): (path: string,) => Promise<string> {
    const root = Uri.joinPath(masterUri, "..",);
    return async (path: string,): Promise<string> => {
      const target = Uri.joinPath(root, path,);
      const key = target.toString();
      const open = workspace.textDocuments.find((d,) =>
        d.uri.toString() === key
      );
      if (open !== undefined) return open.getText();
      const bytes = await workspace.fs.readFile(target,);
      return new TextDecoder().decode(bytes,);
    };
  }

  /**
   * Reads the closure of a master document and adds it to the daemon.
   *
   * @param masterUri URI of the master `.smx`/`.tjp` document.
   * @returns the cached model (status projected from the load envelope).
   */
  async addProject(masterUri: Uri,): Promise<ProjectModel> {
    const closure = await buildClosure(
      basename(masterUri,),
      this.readerFor(masterUri,),
    );
    const model = await this.core.addProject(masterUri.toString(), closure,);
    await this.persist();
    return model;
  }

  /**
   * Re-reads the closure of a master document and reloads it.
   *
   * @param masterUri URI of the master document.
   * @returns the refreshed cached model.
   */
  async reloadProject(masterUri: Uri,): Promise<ProjectModel> {
    const closure = await buildClosure(
      basename(masterUri,),
      this.readerFor(masterUri,),
    );
    const model = await this.core.reloadProject(masterUri.toString(), closure,);
    await this.persist();
    return model;
  }

  /** Restores the persisted cache into the core (no-op when absent/stale). */
  async restore(): Promise<void> {
    const json = await this.readStore();
    if (json === null) return;
    for (const model of deserializeCache(json,)) this.core.cache.set(model,);
  }

  /** Persists the current cache (Desktop file / Web memory). */
  async persist(): Promise<void> {
    await this.writeStore(serializeCache(this.core.cache.list(),),);
  }

  /** Reads the stored payload, or `null` when absent/unreadable. */
  private async readStore(): Promise<string | null> {
    const base = this.context.storageUri;
    if (base === undefined) return this.memoryStore;
    try {
      const bytes = await workspace.fs.readFile(
        Uri.joinPath(base, CACHE_FILE,),
      );
      return new TextDecoder().decode(bytes,);
    } catch {
      return null;
    }
  }

  /** Writes the payload, creating the storage directory on Desktop. */
  private async writeStore(json: string,): Promise<void> {
    const base = this.context.storageUri;
    if (base === undefined) {
      this.memoryStore = json;
      return;
    }
    await workspace.fs.createDirectory(base,);
    await workspace.fs.writeFile(
      Uri.joinPath(base, CACHE_FILE,),
      new TextEncoder().encode(json,),
    );
  }
}

/** The running host, or `undefined` when stopped (single instance). */
let host: DaemonHost | undefined;

/**
 * Creates the daemon host and restores its persisted cache.
 *
 * @param context the extension context.
 * @returns the started host (also reachable via {@link getDaemon}).
 */
export async function startDaemon(
  context: ExtensionContext,
): Promise<DaemonHost> {
  const created = new DaemonHost(context,);
  await created.restore();
  host = created;
  return created;
}

/** The running host, or `undefined` when the daemon was not started. */
export function getDaemon(): DaemonHost | undefined {
  return host;
}

/** Persists and forgets the running host (no-op when already stopped). */
export async function stopDaemon(): Promise<void> {
  if (host !== undefined) {
    await host.persist();
    host = undefined;
  }
}
