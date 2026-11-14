/**
 * `server/adapter.ts` — pure transport adapter (22.4.1).
 *
 * Bridges the real `vscode-languageserver` `Connection` to the **structural**
 * {@link ServerConnection} that `registerLspServer` consumes. Every method maps
 * 1:1 except semantic tokens: the real connection exposes them under
 * `languages.semanticTokens.on`, so the adapter forwards `onSemanticTokens`
 * there (ADR 035; lsp-core boundary §5.1).
 *
 * No library import: {@link ConnectionLike} is a structural type derived from
 * `ServerConnection`, so this module is pure and testable with a mock in Deno.
 * The bootstraps (22.4.4/22.4.5) create the real connection and pass it here;
 * the intelligence stays in the core (`registerLspServer`).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension.md §5/§7
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.4.1
 */

import type {
  SemanticTokensResult,
  ServerConnection,
  TextDocumentIdentifier,
} from "@vanaware/syntaxmesh/lsp-core";

/**
 * Structural shape of the real connection the adapter needs: every
 * {@link ServerConnection} method except `onSemanticTokens`, plus the
 * `languages.semanticTokens.on` registration the library actually exposes.
 * The `Connection` of `vscode-languageserver` satisfies this without the core
 * (or this module) importing the library.
 */
export type ConnectionLike =
  & Omit<ServerConnection, "onSemanticTokens">
  & {
    /** Semantic-tokens registration as exposed by the real connection. */
    languages: {
      semanticTokens: {
        on(
          handler: (
            params: { textDocument: TextDocumentIdentifier },
          ) => SemanticTokensResult,
        ): void;
      };
    };
  };

/**
 * Adapts a real (or mock) connection to the structural {@link ServerConnection}.
 * Delegation is explicit (arrow wrappers) so the connection's `this` binding is
 * preserved; `onSemanticTokens` is forwarded to `languages.semanticTokens.on`.
 *
 * @param conn the connection created by a bootstrap (node/browser/stdio).
 * @returns the structural connection `registerLspServer` expects.
 */
export function adaptConnection(conn: ConnectionLike,): ServerConnection {
  return {
    onInitialize: (handler,) => conn.onInitialize(handler,),
    onDidOpenTextDocument: (handler,) => conn.onDidOpenTextDocument(handler,),
    onDidChangeTextDocument: (handler,) =>
      conn.onDidChangeTextDocument(handler,),
    onDidCloseTextDocument: (handler,) => conn.onDidCloseTextDocument(handler,),
    onHover: (handler,) => conn.onHover(handler,),
    onCompletion: (handler,) => conn.onCompletion(handler,),
    onDefinition: (handler,) => conn.onDefinition(handler,),
    onReferences: (handler,) => conn.onReferences(handler,),
    onDocumentSymbol: (handler,) => conn.onDocumentSymbol(handler,),
    onWorkspaceSymbol: (handler,) => conn.onWorkspaceSymbol(handler,),
    onSemanticTokens: (handler,) => conn.languages.semanticTokens.on(handler,),
    sendDiagnostics: (params,) => conn.sendDiagnostics(params,),
  };
}

/**
 * Bridges a real `vscode-languageserver` connection to {@link ConnectionLike}.
 *
 * The lsp-core protocol shapes are **structural twins** that use `number`
 * where `vscode-languageserver-types` uses string/number enums (e.g.
 * `CompletionItem.kind`, `Diagnostic.severity`). The shapes are identical at
 * runtime — enums are numbers — but TypeScript treats `number` and an enum as
 * mutually unassignable, so the real `Connection` cannot be assigned to
 * `ConnectionLike` directly. This single, deliberate assertion isolates that
 * lib/core boundary in one place; the bootstraps call it instead of scattering
 * casts. The mock in the tests satisfies `ConnectionLike` without it.
 *
 * @param conn the real connection created by `createConnection` (node/browser).
 * @returns the same connection viewed as the structural {@link ConnectionLike}.
 */
export function asConnectionLike(conn: unknown,): ConnectionLike {
  return conn as ConnectionLike;
}
