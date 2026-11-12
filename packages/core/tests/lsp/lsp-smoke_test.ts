/**
 * Smoke do P2.4 (22.1.16): sessão completa de editor **sem VS Code**,
 * importando apenas o barril público `@vanaware/syntaxmesh/lsp-core`.
 *
 * Prova o critério de saída do plano §5.1/§11: o lsp-core roda em Deno
 * puro — initialize → didOpen → requests (hover/completion/definition/
 * symbols/tokens) → didChange com erro → didClose — e os serviços puros
 * também funcionam standalone, sem servidor.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4 (22.1.16)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  analyzeDocument,
  capabilities,
  type CompletionItem,
  type DidChangeParams,
  type DidCloseParams,
  type DidOpenParams,
  type DocumentSymbol,
  getDocumentSymbols,
  getHover,
  getSemanticTokens,
  type Hover,
  type InitializeResult,
  type Location,
  type PublishDiagnosticsParams,
  registerLspServer,
  resolveLocale,
  type SemanticTokensResult,
  type ServerConnection,
  type SymbolInformation,
  type TextDocumentIdentifier,
  type TextDocumentPositionParams,
  toDiagnostics,
  type WorkspaceSymbolParams,
} from "@vanaware/syntaxmesh/lsp-core";

/** Conexão mock tipada: guarda os handlers e os diagnostics publicados. */
function mockConnection(): {
  connection: ServerConnection;
  published: PublishDiagnosticsParams[];
  handlers: {
    initialize?: (params: unknown,) => InitializeResult;
    open?: (params: DidOpenParams,) => void;
    change?: (params: DidChangeParams,) => void;
    close?: (params: DidCloseParams,) => void;
    hover?: (params: TextDocumentPositionParams,) => Hover | null;
    completion?: (params: TextDocumentPositionParams,) => CompletionItem[];
    definition?: (params: TextDocumentPositionParams,) => Location | null;
    documentSymbol?: (
      params: { textDocument: TextDocumentIdentifier },
    ) => DocumentSymbol[];
    workspaceSymbol?: (params: WorkspaceSymbolParams,) => SymbolInformation[];
    semanticTokens?: (
      params: { textDocument: TextDocumentIdentifier },
    ) => SemanticTokensResult;
  };
} {
  const published: PublishDiagnosticsParams[] = [];
  const handlers: ReturnType<typeof mockConnection>["handlers"] = {};
  const connection: ServerConnection = {
    onInitialize: (h,) => {
      handlers.initialize = h;
    },
    onDidOpenTextDocument: (h,) => {
      handlers.open = h;
    },
    onDidChangeTextDocument: (h,) => {
      handlers.change = h;
    },
    onDidCloseTextDocument: (h,) => {
      handlers.close = h;
    },
    onHover: (h,) => {
      handlers.hover = h;
    },
    onCompletion: (h,) => {
      handlers.completion = h;
    },
    onDefinition: (h,) => {
      handlers.definition = h;
    },
    onReferences: () => {},
    onDocumentSymbol: (h,) => {
      handlers.documentSymbol = h;
    },
    onWorkspaceSymbol: (h,) => {
      handlers.workspaceSymbol = h;
    },
    onSemanticTokens: (h,) => {
      handlers.semanticTokens = h;
    },
    sendDiagnostics: (p,) => {
      published.push(p,);
    },
  };
  return { connection, published, handlers, };
}

const URI = "file:///smoke.tjp";
/** Fixture realista: projeto, resource e duas tasks com effort/allocate/depends. */
const TEXT = `project prj "Smoke" "1.0" 2026-01-01 - 2026-12-31 {
}
resource dev "Developer" {
}
task build "Build" {
  effort 5d
  allocate dev
}
task ship "Ship" {
  depends build
}
`;

describe("smoke lsp-core sem VS Code (22.1.16)", () => {
  it("sessão completa: initialize → open → requests → edit → close", () => {
    const { connection, published, handlers, } = mockConnection();
    registerLspServer(connection,);

    // initialize responde com as capabilities do contrato §5.
    assertEquals(handlers.initialize!({},), { capabilities, },);

    // didOpen: documento válido publica diagnostics vazios.
    handlers.open!({ textDocument: { uri: URI, text: TEXT, version: 1, }, },);
    assertEquals(published.length, 1,);
    assertEquals(published[0]!.diagnostics, [],);

    // hover sobre a keyword `task` (linha 4, coluna 1) → Markdown.
    const hover = handlers.hover!({
      textDocument: { uri: URI, },
      position: { line: 4, character: 1, },
    },);
    assert(hover !== null,);
    assertEquals(hover!.contents.kind, "markdown",);

    // completion dentro de `build` no depends (linha 9, prefixo "bu").
    const items = handlers.completion!({
      textDocument: { uri: URI, },
      position: { line: 9, character: 12, },
    },);
    const build = items.find((i,) => i.label === "build");
    assert(build !== undefined,);
    assertEquals(build!.kind, 18,); // Reference: nome definido.

    // definition do `dev` em `allocate dev` (linha 6) → declaração linha 2.
    const definition = handlers.definition!({
      textDocument: { uri: URI, },
      position: { line: 6, character: 12, },
    },);
    assert(definition !== null,);
    assertEquals(definition!.uri, URI,);
    assertEquals(definition!.range.start.line, 2,);

    // symbols: raiz prj com resource + tasks; workspace acha "build".
    const symbols = handlers.documentSymbol!({ textDocument: { uri: URI, }, },);
    assertEquals(symbols.length, 1,);
    assertEquals(symbols[0]!.name, "prj",);
    assertEquals(symbols[0]!.children?.length, 3,);
    const workspace = handlers.workspaceSymbol!({ query: "bu", },);
    assert(workspace.some((s,) => s.name === "build"),);

    // semantic tokens: encoding delta de 5 inteiros por token.
    const tokens = handlers.semanticTokens!({ textDocument: { uri: URI, }, },);
    assert(tokens.data.length > 0,);
    assertEquals(tokens.data.length % 5, 0,);

    // didChange incremental introduz atributo inválido → diagnostics.
    handlers.change!({
      textDocument: { uri: URI, version: 2, },
      contentChanges: [{
        range: {
          start: { line: 5, character: 0, },
          end: { line: 5, character: 0, },
        },
        text: "  bogusattr 42\n",
      },],
    },);
    assertEquals(published.length, 2,);
    assert(published[1]!.diagnostics.length > 0,);
    assertEquals(published[1]!.diagnostics[0]!.source, "syntaxmesh",);

    // didClose: diagnostics zerados e requests não respondem mais.
    handlers.close!({ textDocument: { uri: URI, }, },);
    const last = published[published.length - 1]!;
    assertEquals(last.diagnostics, [],);
    assertEquals(
      handlers.hover!({
        textDocument: { uri: URI, },
        position: { line: 4, character: 1, },
      },),
      null,
    );
  });

  it("serviços puros standalone: análise, diagnostics, tokens, symbols, locale", () => {
    // Sem servidor: o mesmo fluxo de dados direto sobre o barril.
    const analysis = analyzeDocument(URI, TEXT,);
    assertEquals(analysis.ok, true,);
    assertEquals(toDiagnostics(analysis,), [],);
    assert(getHover(analysis, { line: 5, character: 3, },) !== null,); // effort
    const data = getSemanticTokens(analysis,);
    assert(data.length > 0,);
    assertEquals(data.length % 5, 0,);
    assertEquals(getDocumentSymbols(analysis,)[0]!.name, "prj",);
    // Locale: diretiva do arquivo soberana; default en.
    assertEquals(resolveLocale(URI, TEXT,), "en",);
    assertEquals(
      resolveLocale(URI, 'language "pt_BR"\n' + TEXT,),
      "pt-br",
    );
  });

  it("documento inválido: ok false + diagnostics de erro sem lançar", () => {
    const analysis = analyzeDocument(URI, "project prj {\n",);
    assertEquals(analysis.ok, false,);
    const diagnostics = toDiagnostics(analysis,);
    assert(diagnostics.length > 0,);
    assertEquals(diagnostics[0]!.severity, 1,);
    // Os serviços toleram análise sem projeto (não lançam).
    assertEquals(getDocumentSymbols(analysis,), [],);
    assertEquals(
      getHover(analysis, { line: 0, character: 0, },)!.contents.kind,
      "markdown",
    ); // `project` é keyword documentada.
  });
});
