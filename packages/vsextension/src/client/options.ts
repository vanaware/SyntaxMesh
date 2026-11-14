/**
 * `client/options.ts` — pure language-client options (22.4.2).
 *
 * Builds the **data** of the `LanguageClientOptions` from the user settings,
 * with no `vscode`/library runtime so it is testable in Deno. The bootstraps
 * (22.4.6) materialize the runtime pieces: the `synchronize.fileEvents` glob is
 * turned into a real `FileSystemWatcher`, and `trace` is passed to the client.
 *
 * The document selector is restricted to the `syntaxmesh` language id, which
 * the manifest maps to `.smx` (native) plus `.tjp`/`.tji` (compatibility). It is
 * scheme-agnostic so the same options serve Desktop and Web (plan §7).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.4.2
 */

import type { SyntaxMeshSettings, TraceLevel, } from "../config/settings.ts";

/** Client identifier (used for the output channel and registration). */
export const CLIENT_ID = "syntaxmesh";
/** Human-readable server identifier (English, v1). */
export const SERVER_ID = "SyntaxMesh Language Server";

/** Glob of the files watched for reanalysis of closed documents. */
export const FILE_WATCHER_GLOB = "**/*.{smx,tjp,tji}";

/**
 * One structural document filter of a `DocumentSelector`. Mirrors the LSP
 * `TextDocumentFilter`: at least one of `language`/`scheme`/`pattern` must be
 * present (the protocol rejects an empty filter), so the value is assignable
 * to the library selector without a boundary cast.
 */
export type DocumentFilter =
  | { language: string; scheme?: string; pattern?: string }
  | { language?: string; scheme: string; pattern?: string }
  | { language?: string; scheme?: string; pattern: string };

/** Structural `DocumentSelector` (array of filters). */
export type DocumentSelector = DocumentFilter[];

/** The documents the client attaches to: the `syntaxmesh` language, any scheme. */
export const DOCUMENT_SELECTOR: DocumentSelector = [{
  language: "syntaxmesh",
},];

/**
 * Structural `LanguageClientOptions` produced by {@link buildClientOptions}.
 * `synchronize.fileEvents` is the watcher **glob** (the bootstrap creates the
 * real watcher); `trace` uses the same string values as the client `Trace`.
 */
export interface ClientOptionsLike {
  /** Documents the client synchronizes. */
  documentSelector: DocumentSelector;
  /** File-change synchronization (glob descriptor of the watcher). */
  synchronize: { fileEvents: string };
  /** Options forwarded to the server on `initialize`. */
  initializationOptions: { maxNumberOfProblems: number };
  /** Trace level of the client/server channel. */
  trace: TraceLevel;
}

/**
 * Builds the client options from the user settings. Pure and deterministic.
 *
 * @param settings the resolved SyntaxMesh settings (22.2.3).
 * @returns the structural client options the bootstraps materialize.
 */
export function buildClientOptions(
  settings: SyntaxMeshSettings,
): ClientOptionsLike {
  return {
    documentSelector: DOCUMENT_SELECTOR,
    synchronize: { fileEvents: FILE_WATCHER_GLOB, },
    initializationOptions: {
      maxNumberOfProblems: settings.maxNumberOfProblems,
    },
    trace: settings.traceServer,
  };
}
