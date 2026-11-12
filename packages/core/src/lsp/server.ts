/**
 * `server.ts` — protocol wiring of the lsp-core (22.1.15).
 *
 * `registerLspServer` connects every service of the contract §5 to a
 * **structural** connection: the `Connection` of `vscode-languageserver`
 * satisfies `ServerConnection` without the core importing the library
 * (boundary §5.1). The same wiring serves the desktop extension, the web
 * worker and the standalone stdio bootstrap — creating the connection is
 * the bootstrap's job, never this module's.
 *
 * State: one `DocumentStore` plus the latest `AnalysisResult` per open URI.
 * `didOpen`/`didChange` re-analyze and publish diagnostics; `didClose`
 * forgets the document and clears its diagnostics. Navigation and workspace
 * symbols see every open analysis (cross-file).
 *
 * Semantic tokens: the real `Connection` exposes them under
 * `languages.semanticTokens.on`, so `onSemanticTokens` is **optional** here
 * and the bootstrap adapts it; every other method maps 1:1.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (registerLspServer)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { type AnalysisResult, analyzeDocument, } from "./analyze.ts";
import { capabilities, } from "./capabilities.ts";
import { getCompletions, } from "./completion.ts";
import { toDiagnostics, } from "./diagnostics.ts";
import { DocumentStore, } from "./documents.ts";
import { getHover, } from "./hover.ts";
import { getDefinition, getReferences, } from "./navigation.ts";
import { getSemanticTokens, } from "./semantic-tokens.ts";
import { getDocumentSymbols, getWorkspaceSymbols, } from "./symbols.ts";
import type {
  CompletionItem,
  ContentChange,
  Diagnostic,
  DocumentSymbol,
  Hover,
  Location,
  Position,
  ServerCapabilities,
  SymbolInformation,
} from "./types.ts";

/** `textDocument` reference carried by every request parameter. */
export interface TextDocumentIdentifier {
  /** URI of the document. */
  uri: string;
}

/** Parameter of `textDocument/didOpen` (structural subset). */
export interface DidOpenParams {
  /** The opened document, with its full text. */
  textDocument: TextDocumentIdentifier & { text: string; version?: number };
}

/** Parameter of `textDocument/didChange` (full or incremental). */
export interface DidChangeParams {
  /** The changed document and its new version. */
  textDocument: TextDocumentIdentifier & { version: number };
  /** The content changes, in application order. */
  contentChanges: ContentChange[];
}

/** Parameter of `textDocument/didClose`. */
export interface DidCloseParams {
  /** The closed document. */
  textDocument: TextDocumentIdentifier;
}

/** Parameter of position-based requests (hover, completion, navigation). */
export interface TextDocumentPositionParams {
  /** The document the cursor is in. */
  textDocument: TextDocumentIdentifier;
  /** 0-based cursor position. */
  position: Position;
}

/** Parameter of `workspace/symbol`. */
export interface WorkspaceSymbolParams {
  /** Case-insensitive search text (empty = all). */
  query: string;
}

/** Payload of `textDocument/publishDiagnostics`. */
export interface PublishDiagnosticsParams {
  /** URI the diagnostics belong to. */
  uri: string;
  /** The diagnostics (empty clears them). */
  diagnostics: Diagnostic[];
}

/** Result of `initialize` (structural subset of `InitializeResult`). */
export interface InitializeResult {
  /** The capabilities the server advertises. */
  capabilities: ServerCapabilities;
}

/** Result of a semantic-tokens request. */
export interface SemanticTokensResult {
  /** Delta-encoded token data (five integers per token). */
  data: number[];
}

/**
 * The minimal connection the wiring needs. The `Connection` of
 * `vscode-languageserver` satisfies it (with `sendDiagnostics` as the
 * publish notification); a mock satisfies it in the tests. Handlers may be
 * sync or async — the core services are all sync.
 */
export interface ServerConnection {
  /** Registers the `initialize` handler. */
  onInitialize(handler: (params: unknown,) => InitializeResult,): void;
  /** Registers the `textDocument/didOpen` handler. */
  onDidOpenTextDocument(handler: (params: DidOpenParams,) => void,): void;
  /** Registers the `textDocument/didChange` handler. */
  onDidChangeTextDocument(handler: (params: DidChangeParams,) => void,): void;
  /** Registers the `textDocument/didClose` handler. */
  onDidCloseTextDocument(handler: (params: DidCloseParams,) => void,): void;
  /** Registers the `textDocument/hover` handler. */
  onHover(
    handler: (params: TextDocumentPositionParams,) => Hover | null,
  ): void;
  /** Registers the `textDocument/completion` handler. */
  onCompletion(
    handler: (params: TextDocumentPositionParams,) => CompletionItem[],
  ): void;
  /** Registers the `textDocument/definition` handler. */
  onDefinition(
    handler: (params: TextDocumentPositionParams,) => Location | null,
  ): void;
  /** Registers the `textDocument/references` handler. */
  onReferences(
    handler: (params: TextDocumentPositionParams,) => Location[],
  ): void;
  /** Registers the `textDocument/documentSymbol` handler. */
  onDocumentSymbol(
    handler: (
      params: { textDocument: TextDocumentIdentifier },
    ) => DocumentSymbol[],
  ): void;
  /** Registers the `workspace/symbol` handler. */
  onWorkspaceSymbol(
    handler: (params: WorkspaceSymbolParams,) => SymbolInformation[],
  ): void;
  /**
   * Registers the semantic-tokens handler. Optional: the real `Connection`
   * exposes it as `languages.semanticTokens.on`, adapted by the bootstrap.
   */
  onSemanticTokens?(
    handler: (
      params: { textDocument: TextDocumentIdentifier },
    ) => SemanticTokensResult,
  ): void;
  /** Publishes diagnostics for one document (`publishDiagnostics`). */
  sendDiagnostics(params: PublishDiagnosticsParams,): void;
}

/**
 * Wires every lsp-core service into the connection: `initialize` answers
 * with {@link capabilities}; document sync keeps the {@link DocumentStore}
 * and the per-URI analyses, publishing diagnostics on open/change and
 * clearing them on close; the request handlers project the latest analysis
 * (navigation and workspace symbols aggregate every open document).
 *
 * @param connection structural connection (real or mock); not created here.
 */
export function registerLspServer(connection: ServerConnection,): void {
  const store = new DocumentStore();
  const analyses = new Map<string, AnalysisResult>();

  /** Re-analyzes one open document and publishes its diagnostics. */
  const refresh = (uri: string, version: number,): void => {
    const entry = store.get(uri,);
    if (entry === undefined) return;
    const previous = analyses.get(uri,);
    const analysis = analyzeDocument(uri, entry.text, { version, previous, },);
    analyses.set(uri, analysis,);
    connection.sendDiagnostics({
      uri,
      diagnostics: toDiagnostics(analysis,),
    },);
  };

  /** Latest analysis of a URI, or `null` when the document is not open. */
  const analysisOf = (uri: string,): AnalysisResult | null =>
    analyses.get(uri,) ?? null;

  /** Every open analysis, in insertion order (cross-file requests). */
  const workspace = (): AnalysisResult[] => [...analyses.values(),];

  connection.onInitialize(() => ({ capabilities, }));

  connection.onDidOpenTextDocument((params,) => {
    const { uri, text, version, } = params.textDocument;
    store.open(uri, text, version ?? 0,);
    refresh(uri, version ?? 0,);
  },);

  connection.onDidChangeTextDocument((params,) => {
    const { uri, version, } = params.textDocument;
    if (!store.change(uri, version, params.contentChanges,)) return;
    refresh(uri, version,);
  },);

  connection.onDidCloseTextDocument((params,) => {
    const { uri, } = params.textDocument;
    store.close(uri,);
    analyses.delete(uri,);
    connection.sendDiagnostics({ uri, diagnostics: [], },);
  },);

  connection.onHover((params,) => {
    const analysis = analysisOf(params.textDocument.uri,);
    return analysis === null ? null : getHover(analysis, params.position,);
  },);

  connection.onCompletion((params,) => {
    const analysis = analysisOf(params.textDocument.uri,);
    return analysis === null ? [] : getCompletions(analysis, params.position,);
  },);

  connection.onDefinition((params,) => {
    const analysis = analysisOf(params.textDocument.uri,);
    return analysis === null
      ? null
      : getDefinition(analysis, params.position, workspace(),);
  },);

  connection.onReferences((params,) => {
    const analysis = analysisOf(params.textDocument.uri,);
    return analysis === null
      ? []
      : getReferences(analysis, params.position, workspace(),);
  },);

  connection.onDocumentSymbol((params,) => {
    const analysis = analysisOf(params.textDocument.uri,);
    return analysis === null ? [] : getDocumentSymbols(analysis,);
  },);

  connection.onWorkspaceSymbol((params,) =>
    getWorkspaceSymbols(workspace(), params.query,)
  );

  connection.onSemanticTokens?.((params,) => {
    const analysis = analysisOf(params.textDocument.uri,);
    return { data: analysis === null ? [] : getSemanticTokens(analysis,), };
  },);
}
