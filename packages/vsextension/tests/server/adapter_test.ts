/**
 * Unit tests of the pure transport adapter (22.4.1). BDD + `@std/assert`,
 * no `vscode`/library runtime — a structural mock stands in for the real
 * `vscode-languageserver` connection.
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  capabilities,
  type InitializeResult,
  type PublishDiagnosticsParams,
  type SemanticTokensResult,
  type TextDocumentIdentifier,
} from "@vanaware/syntaxmesh/lsp-core";
import {
  adaptConnection,
  type ConnectionLike,
} from "../../src/server/adapter.ts";

/** Observable state recorded by the mock connection. */
interface MockState {
  registered: string[];
  diagnostics: PublishDiagnosticsParams[];
  initializeHandler: ((params: unknown,) => InitializeResult) | null;
  semanticHandler:
    | ((
      params: { textDocument: TextDocumentIdentifier },
    ) => SemanticTokensResult)
    | null;
}

/** A mock connection that records every registration and notification. */
function mockConnection(): ConnectionLike & { state: MockState } {
  const state: MockState = {
    registered: [],
    diagnostics: [],
    initializeHandler: null,
    semanticHandler: null,
  };
  const conn: ConnectionLike = {
    onInitialize(handler,) {
      state.registered.push("onInitialize",);
      state.initializeHandler = handler;
    },
    onDidOpenTextDocument() {
      state.registered.push("onDidOpenTextDocument",);
    },
    onDidChangeTextDocument() {
      state.registered.push("onDidChangeTextDocument",);
    },
    onDidCloseTextDocument() {
      state.registered.push("onDidCloseTextDocument",);
    },
    onHover() {
      state.registered.push("onHover",);
    },
    onCompletion() {
      state.registered.push("onCompletion",);
    },
    onDefinition() {
      state.registered.push("onDefinition",);
    },
    onReferences() {
      state.registered.push("onReferences",);
    },
    onDocumentSymbol() {
      state.registered.push("onDocumentSymbol",);
    },
    onWorkspaceSymbol() {
      state.registered.push("onWorkspaceSymbol",);
    },
    sendDiagnostics(params,) {
      state.diagnostics.push(params,);
    },
    languages: {
      semanticTokens: {
        on(handler,) {
          state.registered.push("semanticTokens",);
          state.semanticHandler = handler;
        },
      },
    },
  };
  return Object.assign(conn, { state, },);
}

describe("adaptConnection", () => {
  it("forwards initialize and preserves the handler result", () => {
    const mock = mockConnection();
    const adapted = adaptConnection(mock,);
    adapted.onInitialize(() => ({ capabilities, }));
    assert(mock.state.registered.includes("onInitialize",),);
    assertEquals(mock.state.initializeHandler!(undefined,), { capabilities, },);
  });

  it("delegates document sync 1:1", () => {
    const mock = mockConnection();
    const adapted = adaptConnection(mock,);
    adapted.onDidOpenTextDocument(() => {},);
    adapted.onDidChangeTextDocument(() => {},);
    adapted.onDidCloseTextDocument(() => {},);
    assertEquals(mock.state.registered, [
      "onDidOpenTextDocument",
      "onDidChangeTextDocument",
      "onDidCloseTextDocument",
    ],);
  });

  it("adapts semantic tokens to languages.semanticTokens.on", () => {
    const mock = mockConnection();
    const adapted = adaptConnection(mock,);
    const handler = (): SemanticTokensResult => ({ data: [0, 0, 3, 1, 0,], });
    adapted.onSemanticTokens!(handler,);
    assert(mock.state.registered.includes("semanticTokens",),);
    // The exact handler is forwarded, and invoking it yields the token data.
    assertEquals(mock.state.semanticHandler, handler,);
    assertEquals(
      mock.state.semanticHandler!({
        textDocument: { uri: "file:///x.smx", },
      },),
      { data: [0, 0, 3, 1, 0,], },
    );
  });

  it("publishes diagnostics through sendDiagnostics", () => {
    const mock = mockConnection();
    const adapted = adaptConnection(mock,);
    const params: PublishDiagnosticsParams = {
      uri: "file:///x.smx",
      diagnostics: [],
    };
    adapted.sendDiagnostics(params,);
    assertEquals(mock.state.diagnostics, [params,],);
  });

  it("exposes every ServerConnection method", () => {
    const mock = mockConnection();
    const adapted = adaptConnection(mock,);
    adapted.onInitialize(() => ({ capabilities, }));
    adapted.onDidOpenTextDocument(() => {},);
    adapted.onDidChangeTextDocument(() => {},);
    adapted.onDidCloseTextDocument(() => {},);
    adapted.onHover(() => null);
    adapted.onCompletion(() => []);
    adapted.onDefinition(() => null);
    adapted.onReferences(() => []);
    adapted.onDocumentSymbol(() => []);
    adapted.onWorkspaceSymbol(() => []);
    adapted.onSemanticTokens!(() => ({ data: [], }));
    assertEquals(mock.state.registered, [
      "onInitialize",
      "onDidOpenTextDocument",
      "onDidChangeTextDocument",
      "onDidCloseTextDocument",
      "onHover",
      "onCompletion",
      "onDefinition",
      "onReferences",
      "onDocumentSymbol",
      "onWorkspaceSymbol",
      "semanticTokens",
    ],);
  });
});
