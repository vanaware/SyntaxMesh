/**
 * Wiring smoke test of the extension transport (22.4.8).
 *
 * Runs a **full editing session** through the extension's real path —
 * `registerLspServer(adaptConnection(mock))` — with no VS Code: initialize →
 * didOpen → publishDiagnostics → hover/completion → incremental didChange →
 * didClose. Where the core `server_test` wires a `ServerConnection` directly,
 * this exercises the {@link adaptConnection} layer on top (the `ConnectionLike`
 * with `languages.semanticTokens.on`), proving the adapter contract and the
 * core wiring compose end to end.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §22.4.8
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  capabilities,
  type CompletionItem,
  type DidChangeParams,
  type DidCloseParams,
  type DidOpenParams,
  type DocumentSymbol,
  type Hover,
  type Location,
  type PublishDiagnosticsParams,
  registerLspServer,
  type SemanticTokensResult,
  type SymbolInformation,
  type TextDocumentIdentifier,
  type TextDocumentPositionParams,
  type WorkspaceSymbolParams,
} from "@vanaware/syntaxmesh/lsp-core";
import {
  adaptConnection,
  type ConnectionLike,
} from "../../src/server/adapter.ts";

/** A mock `ConnectionLike` that captures handlers and published diagnostics. */
function mockConnection(): {
  connection: ConnectionLike;
  published: PublishDiagnosticsParams[];
  fire: {
    initialize: () => { capabilities: unknown };
    open: (params: DidOpenParams,) => void;
    change: (params: DidChangeParams,) => void;
    close: (params: DidCloseParams,) => void;
    hover: (params: TextDocumentPositionParams,) => Hover | null;
    completion: (params: TextDocumentPositionParams,) => CompletionItem[];
    definition: (params: TextDocumentPositionParams,) => Location | null;
    references: (params: TextDocumentPositionParams,) => Location[];
    documentSymbol: (
      params: { textDocument: TextDocumentIdentifier },
    ) => DocumentSymbol[];
    workspaceSymbol: (params: WorkspaceSymbolParams,) => SymbolInformation[];
    semanticTokens: (
      params: { textDocument: TextDocumentIdentifier },
    ) => SemanticTokensResult;
  };
} {
  const published: PublishDiagnosticsParams[] = [];
  const handlers = new Map<string, unknown>();
  const on = (name: string,) => (handler: unknown,) => {
    handlers.set(name, handler,);
  };
  const connection: ConnectionLike = {
    onInitialize: on("initialize",),
    onDidOpenTextDocument: on("open",),
    onDidChangeTextDocument: on("change",),
    onDidCloseTextDocument: on("close",),
    onHover: on("hover",),
    onCompletion: on("completion",),
    onDefinition: on("definition",),
    onReferences: on("references",),
    onDocumentSymbol: on("documentSymbol",),
    onWorkspaceSymbol: on("workspaceSymbol",),
    sendDiagnostics: (params,) => {
      published.push(params,);
    },
    languages: {
      semanticTokens: { on: on("semanticTokens",), },
    },
  };
  const call = <T,>(name: string, params: unknown,): T =>
    (handlers.get(name,) as (p: unknown,) => T)(params,);
  return {
    connection,
    published,
    fire: {
      initialize: () => call<{ capabilities: unknown }>("initialize", {},),
      open: (p: DidOpenParams,) => call<void>("open", p,),
      change: (p: DidChangeParams,) => call<void>("change", p,),
      close: (p: DidCloseParams,) => call<void>("close", p,),
      hover: (p: TextDocumentPositionParams,) =>
        call<Hover | null>("hover", p,),
      completion: (p: TextDocumentPositionParams,) =>
        call<CompletionItem[]>("completion", p,),
      definition: (p: TextDocumentPositionParams,) =>
        call<Location | null>("definition", p,),
      references: (p: TextDocumentPositionParams,) =>
        call<Location[]>("references", p,),
      documentSymbol: (p: { textDocument: TextDocumentIdentifier },) =>
        call<DocumentSymbol[]>("documentSymbol", p,),
      workspaceSymbol: (p: WorkspaceSymbolParams,) =>
        call<SymbolInformation[]>("workspaceSymbol", p,),
      semanticTokens: (p: { textDocument: TextDocumentIdentifier },) =>
        call<SemanticTokensResult>("semanticTokens", p,),
    },
  };
}

const URI = "file:///session.smx";
const VALID = `project prj "Session" "1.0" 2026-01-01 - 2026-12-31 {
}
task t "Task" {
}
`;

describe("extension wiring smoke (22.4.8)", () => {
  it("runs a full editing session through the adapter", () => {
    const { connection, fire, published, } = mockConnection();
    registerLspServer(adaptConnection(connection,),);

    // initialize → the contract capabilities.
    assertEquals(fire.initialize(), { capabilities, },);

    // didOpen → analysis published with no diagnostics on a valid document.
    fire.open({ textDocument: { uri: URI, text: VALID, version: 1, }, },);
    assertEquals(published.length, 1,);
    assertEquals(published[0]!.uri, URI,);
    assertEquals(published[0]!.diagnostics, [],);

    // hover/completion respond over the open document.
    const hover = fire.hover({
      textDocument: { uri: URI, },
      position: { line: 2, character: 1, },
    },);
    assert(hover !== null,);
    assertEquals(hover!.contents.kind, "markdown",);
    const items = fire.completion({
      textDocument: { uri: URI, },
      position: { line: 2, character: 4, },
    },);
    assert(items.some((i,) => i.label === "task"),);

    // Incremental didChange → reanalysis publishes a diagnostic.
    fire.change({
      textDocument: { uri: URI, version: 2, },
      contentChanges: [{
        range: {
          start: { line: 3, character: 0, },
          end: { line: 3, character: 0, },
        },
        text: "  bogusattr 42\n",
      },],
    },);
    assertEquals(published.length, 2,);
    assert(published[1]!.diagnostics.length > 0,);
    assertEquals(published[1]!.diagnostics[0]!.source, "syntaxmesh",);

    // didClose → diagnostics cleared and requests go silent.
    fire.close({ textDocument: { uri: URI, }, },);
    const last = published[published.length - 1]!;
    assertEquals(last.uri, URI,);
    assertEquals(last.diagnostics, [],);
    assertEquals(
      fire.hover({
        textDocument: { uri: URI, },
        position: { line: 2, character: 1, },
      },),
      null,
    );
    assertEquals(
      fire.completion({
        textDocument: { uri: URI, },
        position: { line: 2, character: 1, },
      },),
      [],
    );
  });

  it("serves navigation, symbols and semantic tokens via the adapted connection", () => {
    const { connection, fire, } = mockConnection();
    registerLspServer(adaptConnection(connection,),);
    fire.open({ textDocument: { uri: URI, text: VALID, }, },);

    // "t" declared at line 2, column 5.
    const position = { line: 2, character: 5, };
    const definition = fire.definition({
      textDocument: { uri: URI, },
      position,
    },);
    assert(definition !== null,);
    assertEquals(definition!.uri, URI,);
    assert(
      fire.references({ textDocument: { uri: URI, }, position, },).length >= 1,
    );

    const symbols = fire.documentSymbol({ textDocument: { uri: URI, }, },);
    assertEquals(symbols.length, 1,);
    assertEquals(symbols[0]!.name, "prj",);
    assert(
      fire.workspaceSymbol({ query: "t", },).some((s,) => s.name === "t"),
    );

    // Semantic tokens travel through languages.semanticTokens.on (adapted).
    const tokens = fire.semanticTokens({ textDocument: { uri: URI, }, },);
    assert(tokens.data.length > 0,);
    assertEquals(tokens.data.length % 5, 0,);
  });
});
