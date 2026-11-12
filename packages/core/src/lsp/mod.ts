/**
 * `lsp/mod.ts` — barrel of `lsp-core` (Fase 22, sub-phase 22.1).
 *
 * Entry point published as `@vanaware/syntaxmesh/lsp-core`: **pure** LSP
 * services (document store, analysis, diagnostics, hover, completion,
 * navigation, semantic tokens, symbols) built on the core and the doc-core.
 * There is no transport here — `registerLspServer` takes a structural
 * connection, so the same code serves the desktop extension, the web worker
 * and the standalone stdio server.
 *
 * Boundary constraint (enforced by `deno task check:lspcore`): no
 * `vscode-languageserver`/`vscode-languageclient` runtime, no `vscode` API,
 * no `node:*` and no `Deno.stdin`/`Deno.stdout`. Only the **types** of
 * `npm:vscode-languageserver-types` are allowed.
 *
 * Not re-exported by the root `mod.ts`: the PWA bundle must not pay for the
 * language services it does not use (same decision as the doc-core, 22.1b.7.3).
 *
 * The services (DocumentStore, analyze, diagnostics, hover, completion,
 * navigation, semantic tokens, symbols, `registerLspServer`) are exported
 * here as they land in P2.4 — each with full English JSDoc (ADR 041 ratchet).
 * Protocol shapes are owned by `./types.ts` (structural twins of the LSP
 * protocol): `vscode-languageserver-types` lacks `ServerCapabilities` and
 * `TextDocumentContentChangeEvent`, and re-exporting an external library
 * would drag its undocumented surface into the doc ratchet.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5 (service contract)
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco B
 */

export { analyzeDocument, } from "./analyze.ts";
export type { AnalysisResult, AnalyzeOptions, } from "./analyze.ts";
export {
  capabilities,
  SEMANTIC_TOKEN_MODIFIERS,
  SEMANTIC_TOKEN_TYPES,
  semanticTokensLegend,
} from "./capabilities.ts";
export { getCompletions, } from "./completion.ts";
export { toDiagnostics, } from "./diagnostics.ts";
export { DocumentStore, } from "./documents.ts";
export type { DocumentEntry, } from "./documents.ts";
export {
  clearKeywordHelpCache,
  getKeywordHelp,
  getManualPage,
  getManualToc,
  keywordHelpCacheSize,
  resetManualPageCache,
} from "./help.ts";
export type { ManualTocEntry, } from "./help.ts";
export { getHover, } from "./hover.ts";
export { resolveLocale, } from "./locale.ts";
export type { Locale, } from "./locale.ts";
export {
  findSymbolNode,
  getDefinition,
  getReferences,
  symbolAt,
} from "./navigation.ts";
export type { SymbolNode, } from "./navigation.ts";
export {
  encodeSemanticTokens,
  getSemanticTokens,
  tokenAt,
  tokenize,
} from "./semantic-tokens.ts";
export type { PositionedToken, } from "./semantic-tokens.ts";
export { registerLspServer, } from "./server.ts";
export type {
  DidChangeParams,
  DidCloseParams,
  DidOpenParams,
  InitializeResult,
  PublishDiagnosticsParams,
  SemanticTokensResult,
  ServerConnection,
  TextDocumentIdentifier,
  TextDocumentPositionParams,
  WorkspaceSymbolParams,
} from "./server.ts";
export { getDocumentSymbols, getWorkspaceSymbols, } from "./symbols.ts";
export type {
  CompletionItem,
  CompletionOptions,
  ContentChange,
  Diagnostic,
  DocumentSymbol,
  FullContentChange,
  Hover,
  Location,
  MarkdownString,
  MarkupContent,
  Position,
  Range,
  RangeContentChange,
  SemanticTokensLegend,
  SemanticTokensOptions,
  ServerCapabilities,
  SymbolInformation,
} from "./types.ts";
// Core types referenced by the public analysis API must be public through
// this entry as well (`deno doc --lint` measures each entry independently).
export type { FileContentProvider, } from "../taskjuggler.ts";
export type { Message, } from "../message.ts";
export type { Project, } from "../model/project.ts";
