/**
 * `types.ts` — structural protocol shapes used by the lsp-core (22.1).
 *
 * Minimal, self-owned declarations of the LSP shapes the services exchange
 * with the host. They are structurally identical to the official protocol
 * types (`vscode-languageserver-protocol`), so values pass unchanged through
 * any transport. Two constraints shape this file:
 *
 * - `vscode-languageserver-types` (the only protocol package the boundary
 *   allows) does not export every shape we need (`ServerCapabilities`,
 *   `TextDocumentContentChangeEvent` live in `-protocol`);
 * - the doc ratchet (`deno doc --lint`) flags references to types that are
 *   not public through the entry point, so re-exporting an external library
 *   would either fail the gate or drag its whole surface into the ratchet.
 *
 * Owning the few shapes we use keeps the module runtime-free and the public
 * API fully documented. Numeric literals mirror the protocol enums
 * (`TextDocumentSyncKind.Incremental = 2`, `DiagnosticSeverity.Error = 1`).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (service contract)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */

/** A position in a document: 0-based line and character (UTF-16 units). */
export interface Position {
  /** Zero-based line number. */
  line: number;
  /** Zero-based character offset within the line. */
  character: number;
}

/** A range in a document, from `start` (inclusive) to `end` (exclusive). */
export interface Range {
  /** Start position of the range. */
  start: Position;
  /** End position of the range. */
  end: Position;
}

/** A location inside a resource: a URI plus a range within that document. */
export interface Location {
  /** URI of the document that contains the range. */
  uri: string;
  /** Range within the document. */
  range: Range;
}

/**
 * A symbol of one document, with its hierarchy. `kind` uses the protocol
 * numeric `SymbolKind` values; `range` encloses `selectionRange` and every
 * child's range.
 */
export interface DocumentSymbol {
  /** Identifier of the symbol (shown in the outline). */
  name: string;
  /** Human-readable detail (the node's quoted name). */
  detail?: string;
  /** Protocol `SymbolKind` numeric value. */
  kind: number;
  /** Range enclosing the whole symbol (and its children). */
  range: Range;
  /** Range of the identifier itself (the jump target). */
  selectionRange: Range;
  /** Nested symbols (subtasks, child resources, …). */
  children?: DocumentSymbol[];
}

/** A flat workspace symbol: a name plus the location of its declaration. */
export interface SymbolInformation {
  /** Identifier of the symbol. */
  name: string;
  /** Protocol `SymbolKind` numeric value. */
  kind: number;
  /** Where the symbol is declared. */
  location: Location;
  /** Id of the enclosing symbol, when any. */
  containerName?: string;
}

/**
 * A diagnostic reported to the client. `severity` uses the protocol numeric
 * values: `1` Error, `2` Warning, `3` Information, `4` Hint.
 */
export interface Diagnostic {
  /** Range the diagnostic applies to. */
  range: Range;
  /** Severity of the diagnostic (protocol `DiagnosticSeverity` values). */
  severity?: number;
  /** Machine-readable code identifying the diagnostic kind. */
  code?: string | number;
  /** Human-readable source of the diagnostic (e.g. `"syntaxmesh"`). */
  source?: string;
  /** The diagnostic message. */
  message: string;
}

/** Legend of a semantic-tokens provider: the token vocabulary by index. */
export interface SemanticTokensLegend {
  /** Token types, in encoding order (indexes are part of the contract). */
  tokenTypes: string[];
  /** Token modifiers, in encoding order (empty in v1). */
  tokenModifiers: string[];
}

/** Options of the semantic-tokens provider advertised in the capabilities. */
export interface SemanticTokensOptions {
  /** The legend shared by every semantic-tokens response. */
  legend: SemanticTokensLegend;
  /** Whether the server supports full-document token requests. */
  full: boolean;
}

/** Options of the completion provider (v1: no trigger characters). */
export interface CompletionOptions {
  /** Characters that trigger completion automatically (none in v1). */
  triggerCharacters?: string[];
}

/**
 * One completion suggestion. `kind` uses the protocol numeric
 * `CompletionItemKind` values: `10` Property, `14` Keyword, `18` Reference.
 */
export interface CompletionItem {
  /** The text offered (and inserted by default). */
  label: string;
  /** Protocol `CompletionItemKind` numeric value. */
  kind?: number;
  /** Short human-readable detail shown beside the label. */
  detail?: string;
  /** Optional documentation of the item. */
  documentation?: MarkupContent | string;
  /** Text inserted when different from the label. */
  insertText?: string;
}

/**
 * The capabilities of the SyntaxMesh language server, structurally identical
 * to the protocol `ServerCapabilities` subset we implement. The host passes
 * this object verbatim as the `initialize` result.
 */
export interface ServerCapabilities {
  /** Text synchronization kind (`2` = incremental). */
  textDocumentSync?: number;
  /** Whether the server provides hover information. */
  hoverProvider?: boolean;
  /** Completion support; an object enables it with default options. */
  completionProvider?: CompletionOptions;
  /** Whether the server resolves go-to-definition requests. */
  definitionProvider?: boolean;
  /** Whether the server resolves find-references requests. */
  referencesProvider?: boolean;
  /** Semantic-tokens support with the stable legend. */
  semanticTokensProvider?: SemanticTokensOptions;
  /** Whether the server lists the symbols of one document. */
  documentSymbolProvider?: boolean;
  /** Whether the server searches symbols across the workspace. */
  workspaceSymbolProvider?: boolean;
}

/**
 * Markdown text exchanged with the host (contract §5 `MarkdownString`).
 * The host wraps it in its own markup type (`MarkupContent`/`MarkdownString`);
 * the core only produces the raw text.
 */
export type MarkdownString = string;

/**
 * Human-readable content of a hover/completion response, with its format.
 * Structural twin of the protocol `MarkupContent`.
 */
export interface MarkupContent {
  /** Content format (`"markdown"` in every lsp-core response). */
  kind: "markdown" | "plaintext";
  /** The content itself. */
  value: string;
}

/**
 * The result of a hover request: markup content plus the optional range it
 * applies to. Structural twin of the protocol `Hover` (markup-content form).
 */
export interface Hover {
  /** The hover content. */
  contents: MarkupContent;
  /** Range the hover applies to (the token under the cursor). */
  range?: Range;
}

/** A full-document content change (`textDocument/didChange`, full sync). */
export interface FullContentChange {
  /** The new full text of the document. */
  text: string;
}

/** An incremental content change replacing one range of the document. */
export interface RangeContentChange {
  /** Range to replace; refers to the state after the previous change. */
  range: Range;
  /** The text to insert at the range. */
  text: string;
}

/**
 * One `textDocument/didChange` event: either a full replacement or an
 * incremental range edit. Structural twin of the protocol
 * `TextDocumentContentChangeEvent`.
 */
export type ContentChange = FullContentChange | RangeContentChange;
