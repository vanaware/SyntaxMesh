/**
 * `web/small-state.ts` — pure small-state store over a Memento (22.8.5).
 *
 * Small key-value state (recent projects, last report format) belongs in the
 * VS Code Mementos (`workspaceState`/`globalState`), which persist through the
 * host's own storage even on the Web (plan §9.3). This module wraps a structural
 * Memento seam with typed accessors and ships an in-memory Memento for hosts
 * with no state at all. It never touches IndexedDB/OPFS directly and is
 * unit-testable in Deno without the `vscode` runtime.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §9.3 (storage strategy)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.8.5
 */

/** Structural subset of `vscode.Memento` (`globalState`/`workspaceState`). */
export interface MementoLike {
  /** Reads a key, returning `defaultValue` when absent. */
  get<T,>(key: string, defaultValue: T,): T;
  /** Writes a key (the host persists it). */
  update(key: string, value: unknown,): PromiseLike<void>;
}

/** The small-state keys owned by the extension. */
export const STATE_KEYS = {
  /** Most-recent-first list of project URIs added to the daemon. */
  recentProjects: "syntaxmesh.recentProjects",
  /** The last report format the user chose. */
  lastReportFormat: "syntaxmesh.lastReportFormat",
} as const;

/** Maximum number of recent projects retained. */
export const MAX_RECENT_PROJECTS = 10;

/**
 * An in-memory {@link MementoLike} used when the host exposes no state (the Web
 * fallback). Values live only for the current activation.
 */
export class MemoryMemento implements MementoLike {
  private readonly map = new Map<string, unknown>();

  /** @inheritdoc */
  get<T,>(key: string, defaultValue: T,): T {
    return this.map.has(key,) ? this.map.get(key,) as T : defaultValue;
  }

  /** @inheritdoc */
  update(key: string, value: unknown,): Promise<void> {
    this.map.set(key, value,);
    return Promise.resolve();
  }
}

/** Typed accessors for the extension's small state over any Memento. */
export class SmallStateStore {
  private readonly memento: MementoLike;

  /** @param memento the host Memento (or a {@link MemoryMemento} fallback). */
  constructor(memento: MementoLike,) {
    this.memento = memento;
  }

  /** The recent project URIs, most recent first (empty when none). */
  recentProjects(): string[] {
    return this.memento.get<string[]>(STATE_KEYS.recentProjects, [],);
  }

  /**
   * Records a project URI as the most recent, de-duplicating and capping the
   * list at {@link MAX_RECENT_PROJECTS}.
   *
   * @param uri the project URI to remember.
   */
  async addRecentProject(uri: string,): Promise<void> {
    const next = [
      uri,
      ...this.recentProjects().filter((u,) => u !== uri),
    ].slice(0, MAX_RECENT_PROJECTS,);
    await this.memento.update(STATE_KEYS.recentProjects, next,);
  }

  /**
   * The last report format the user chose.
   *
   * @param fallback the value returned when nothing was stored yet.
   */
  lastReportFormat(fallback: string,): string {
    return this.memento.get<string>(STATE_KEYS.lastReportFormat, fallback,);
  }

  /**
   * Remembers the last report format the user chose.
   *
   * @param format the chosen format id.
   */
  async setLastReportFormat(format: string,): Promise<void> {
    await this.memento.update(STATE_KEYS.lastReportFormat, format,);
  }
}
