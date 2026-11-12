/**
 * Testes do `DocumentStore` (22.1.5): open/change/close/get com sync full e
 * incremental (range edits), incluindo multi-edit sequencial.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { DocumentStore, } from "../../src/lsp/documents.ts";

/** Documento de três linhas usado nos testes de range. */
const TEXT = "alpha\nbeta\ngamma\n";

describe("DocumentStore (22.1.5)", () => {
  it("open registra texto e versão; get devolve a entrada", () => {
    const store = new DocumentStore();
    store.open("file:///a.tjp", TEXT, 1,);
    assertEquals(store.size, 1,);
    assertEquals(store.get("file:///a.tjp",), { text: TEXT, version: 1, },);
    assertEquals(store.get("file:///missing.tjp",), undefined,);
  });

  it("change full substitui o texto inteiro", () => {
    const store = new DocumentStore();
    store.open("file:///a.tjp", TEXT, 1,);
    const ok = store.change("file:///a.tjp", 2, [{ text: "novo\n", },],);
    assertEquals(ok, true,);
    assertEquals(store.get("file:///a.tjp",), { text: "novo\n", version: 2, },);
  });

  it("change incremental aplica o range edit (0-based)", () => {
    const store = new DocumentStore();
    store.open("file:///a.tjp", TEXT, 1,);
    // Substitui "beta" (linha 1, chars 0..4) por "BETA".
    const ok = store.change("file:///a.tjp", 2, [
      {
        range: {
          start: { line: 1, character: 0, },
          end: { line: 1, character: 4, },
        },
        text: "BETA",
      },
    ],);
    assertEquals(ok, true,);
    assertEquals(store.get("file:///a.tjp",)!.text, "alpha\nBETA\ngamma\n",);
  });

  it("multi-edit: ranges sequenciais sobre o estado intermediário", () => {
    const store = new DocumentStore();
    store.open("file:///a.tjp", TEXT, 1,);
    const ok = store.change("file:///a.tjp", 2, [
      // Insere "X" no início da linha 0.
      {
        range: {
          start: { line: 0, character: 0, },
          end: { line: 0, character: 0, },
        },
        text: "X",
      },
      // Apaga "gamma" na linha 2 (estado após o primeiro edit).
      {
        range: {
          start: { line: 2, character: 0, },
          end: { line: 2, character: 5, },
        },
        text: "",
      },
    ],);
    assertEquals(ok, true,);
    assertEquals(store.get("file:///a.tjp",)!.text, "Xalpha\nbeta\n\n",);
  });

  it("close remove o documento; change em URI fechada devolve false", () => {
    const store = new DocumentStore();
    store.open("file:///a.tjp", TEXT, 1,);
    assertEquals(store.close("file:///a.tjp",), true,);
    assertEquals(store.close("file:///a.tjp",), false,);
    assertEquals(store.size, 0,);
    assertEquals(
      store.change("file:///a.tjp", 2, [{ text: "x", },],),
      false,
    );
  });

  it("posições fora do texto são clampadas (defensivo)", () => {
    const store = new DocumentStore();
    store.open("file:///a.tjp", "ab\ncd\n", 1,);
    store.change("file:///a.tjp", 2, [
      {
        range: {
          start: { line: 99, character: 99, },
          end: { line: 99, character: 99, },
        },
        text: "Z",
      },
    ],);
    // Linha 99 clampa para a última linha (a vazia após o \n final).
    assertEquals(store.get("file:///a.tjp",)!.text, "ab\ncd\nZ",);
  });
});
