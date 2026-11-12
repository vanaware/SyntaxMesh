/**
 * Testes do `registerLspServer` (22.1.15): wiring completo sobre uma
 * conexão mock (interface estrutural, sem vscode-languageserver) —
 * initialize, sync incremental, diagnostics, hover, completion e os
 * demais handlers do contrato §5.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { capabilities, } from "../../src/lsp/capabilities.ts";
import {
  type DidChangeParams,
  type DidCloseParams,
  type DidOpenParams,
  type PublishDiagnosticsParams,
  registerLspServer,
  type SemanticTokensResult,
  type ServerConnection,
  type TextDocumentPositionParams,
  type WorkspaceSymbolParams,
} from "../../src/lsp/server.ts";
import type {
  CompletionItem,
  DocumentSymbol,
  Hover,
  Location,
  SymbolInformation,
} from "../../src/lsp/types.ts";

/** Conexão mock: guarda os handlers registrados e os diagnostics publicados. */
function mockConnection(): {
  connection: ServerConnection;
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
      params: { textDocument: { uri: string } },
    ) => DocumentSymbol[];
    workspaceSymbol: (params: WorkspaceSymbolParams,) => SymbolInformation[];
    semanticTokens: (
      params: { textDocument: { uri: string } },
    ) => SemanticTokensResult;
  };
} {
  const published: PublishDiagnosticsParams[] = [];
  const handlers = new Map<string, unknown>();
  const on = (name: string,) => (handler: unknown,) => {
    handlers.set(name, handler,);
  };
  const connection: ServerConnection = {
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
    onSemanticTokens: on("semanticTokens",),
    sendDiagnostics: (params,) => {
      published.push(params,);
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
      documentSymbol: (p: { textDocument: { uri: string } },) =>
        call<DocumentSymbol[]>("documentSymbol", p,),
      workspaceSymbol: (p: WorkspaceSymbolParams,) =>
        call<SymbolInformation[]>("workspaceSymbol", p,),
      semanticTokens: (p: { textDocument: { uri: string } },) =>
        call<SemanticTokensResult>("semanticTokens", p,),
    },
  };
}

const URI = "file:///srv.tjp";
const VALID = `project prj "Probe" "1.0" 2026-01-01 - 2026-12-31 {
}
task t "Task" {
}
`;

describe("registerLspServer (22.1.15)", () => {
  it("initialize responde com as capabilities do contrato", () => {
    const { connection, fire, } = mockConnection();
    registerLspServer(connection,);
    assertEquals(fire.initialize(), { capabilities, },);
  });

  it("didOpen/didChange: sync incremental e diagnostics publicados", () => {
    const { connection, fire, published, } = mockConnection();
    registerLspServer(connection,);
    fire.open({ textDocument: { uri: URI, text: VALID, version: 1, }, },);
    assertEquals(published.length, 1,);
    assertEquals(published[0]!.uri, URI,);
    assertEquals(published[0]!.diagnostics, [],);
    // Edit incremental: troca "Task" por "Task" + atributo inválido na task.
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
    // didChange de documento fechado é ignorado (sem publicar).
    fire.change({
      textDocument: { uri: "file:///ghost.tjp", version: 1, },
      contentChanges: [{ text: "x", },],
    },);
    assertEquals(published.length, 2,);
  });

  it("didClose limpa o documento e os diagnostics", () => {
    const { connection, fire, published, } = mockConnection();
    registerLspServer(connection,);
    fire.open({ textDocument: { uri: URI, text: VALID, }, },);
    fire.close({ textDocument: { uri: URI, }, },);
    const last = published[published.length - 1]!;
    assertEquals(last.uri, URI,);
    assertEquals(last.diagnostics, [],);
    // Depois de fechado, hover/completion não respondem mais.
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

  it("hover e completion respondem sobre o documento aberto", () => {
    const { connection, fire, } = mockConnection();
    registerLspServer(connection,);
    fire.open({ textDocument: { uri: URI, text: VALID, }, },);
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
  });

  it("definition/references/symbols/semanticTokens agregam o workspace", () => {
    const { connection, fire, } = mockConnection();
    registerLspServer(connection,);
    fire.open({ textDocument: { uri: URI, text: VALID, }, },);
    // "t" declarado na linha 2, coluna 5.
    const position = { line: 2, character: 5, };
    const definition = fire.definition({
      textDocument: { uri: URI, },
      position,
    },);
    assert(definition !== null,);
    assertEquals(definition!.uri, URI,);
    const references = fire.references({
      textDocument: { uri: URI, },
      position,
    },);
    assert(references.length >= 1,);
    const symbols = fire.documentSymbol({ textDocument: { uri: URI, }, },);
    assertEquals(symbols.length, 1,);
    assertEquals(symbols[0]!.name, "prj",);
    const workspace = fire.workspaceSymbol({ query: "t", },);
    assert(workspace.some((s,) => s.name === "t"),);
    const tokens = fire.semanticTokens({ textDocument: { uri: URI, }, },);
    assert(tokens.data.length > 0,);
    assertEquals(tokens.data.length % 5, 0,);
  });
});
