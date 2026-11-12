/**
 * `capabilities.ts` — the server capabilities as a pure object (22.1.9).
 *
 * Declares exactly what the `lsp-core` services implement: incremental sync,
 * hover, completion, definition, references, semantic tokens (with the stable
 * legend shared with `semantic-tokens.ts`) and document/workspace symbols.
 * `registerLspServer` answers `initialize` with this object.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (capabilities)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import type { SemanticTokensLegend, ServerCapabilities, } from "./types.ts";

/**
 * Token types of the semantic-tokens legend, in encoding order. The indexes
 * are part of the contract with the client — append only, never reorder
 * (22.1.13 reuses this legend for the delta encoding).
 */
export const SEMANTIC_TOKEN_TYPES: readonly string[] = [
  "keyword",
  "identifier",
  "string",
  "number",
  "date",
  "comment",
];

/** Token modifiers of the legend (none in v1). */
export const SEMANTIC_TOKEN_MODIFIERS: readonly string[] = [];

/** The stable semantic-tokens legend advertised to the client. */
export const semanticTokensLegend: SemanticTokensLegend = {
  tokenTypes: [...SEMANTIC_TOKEN_TYPES,],
  tokenModifiers: [...SEMANTIC_TOKEN_MODIFIERS,],
};

/**
 * The capabilities of the SyntaxMesh language server. Numeric literals mirror
 * the protocol enums (`TextDocumentSyncKind.Incremental = 2`) so the module
 * stays free of runtime imports.
 */
export const capabilities: ServerCapabilities = {
  textDocumentSync: 2,
  hoverProvider: true,
  completionProvider: {},
  definitionProvider: true,
  referencesProvider: true,
  semanticTokensProvider: {
    legend: semanticTokensLegend,
    full: true,
  },
  documentSymbolProvider: true,
  workspaceSymbolProvider: true,
};
