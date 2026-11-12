/**
 * Testes do `capabilities` (22.1.9): shape do objeto puro e estabilidade da
 * legend de semantic tokens (o índice dos tipos é contrato com o cliente).
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  capabilities,
  SEMANTIC_TOKEN_TYPES,
  semanticTokensLegend,
} from "../../src/lsp/capabilities.ts";

describe("capabilities (22.1.9)", () => {
  it("shape: sync incremental + todos os providers do contrato §5", () => {
    // TextDocumentSyncKind.Incremental === 2.
    assertEquals(capabilities.textDocumentSync, 2,);
    assertEquals(capabilities.hoverProvider, true,);
    assertEquals(capabilities.definitionProvider, true,);
    assertEquals(capabilities.referencesProvider, true,);
    assertEquals(capabilities.documentSymbolProvider, true,);
    assertEquals(capabilities.workspaceSymbolProvider, true,);
    assertEquals(typeof capabilities.completionProvider, "object",);
    const semantic = capabilities.semanticTokensProvider as {
      full: boolean;
      legend: unknown;
    };
    assertEquals(semantic.full, true,);
    assertEquals(semantic.legend, semanticTokensLegend,);
  });

  it("legend estável: tipos na ordem do contrato, sem modificadores", () => {
    assertEquals(SEMANTIC_TOKEN_TYPES, [
      "keyword",
      "identifier",
      "string",
      "number",
      "date",
      "comment",
    ],);
    assertEquals(semanticTokensLegend, {
      tokenTypes: [
        "keyword",
        "identifier",
        "string",
        "number",
        "date",
        "comment",
      ],
      tokenModifiers: [],
    },);
  });
});
