/**
 * Testes do `getDocumentSymbols`/`getWorkspaceSymbols` (22.1.14): hierarquia
 * project → task → subtask, ranges que encerram os filhos, busca
 * case-insensitive e query vazia.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { analyzeDocument, } from "../../src/lsp/analyze.ts";
import {
  getDocumentSymbols,
  getWorkspaceSymbols,
} from "../../src/lsp/symbols.ts";

/** Projeto com task aninhada e um resource, para exercitar a hierarquia. */
const TEXT = `project prj "Probe" "1.0" 2026-01-01 - 2026-12-31 {
}
resource dev "Dev" {
}
task outer "Outer" {
  task inner "Inner" {
  }
}
`;

describe("symbols (22.1.14)", () => {
  it("hierarquia: raiz project → task (com subtask) e resource irmão", () => {
    const analysis = analyzeDocument("file:///s.tjp", TEXT,);
    const symbols = getDocumentSymbols(analysis,);
    assertEquals(symbols.length, 1,);
    const root = symbols[0]!;
    assertEquals(root.name, "prj",);
    assertEquals(root.kind, 2,); // Module
    // tasks vêm antes de resources na ordem dos sets.
    assertEquals(root.children!.length, 2,);
    const outer = root.children![0]!;
    assertEquals(outer.name, "outer",);
    assertEquals(outer.detail, "Outer",);
    assertEquals(outer.kind, 5,); // Class
    assertEquals(outer.children!.length, 1,);
    assertEquals(outer.children![0]!.name, "outer.inner",);
    assertEquals(outer.children![0]!.detail, "Inner",);
    const dev = root.children![1]!;
    assertEquals(dev.name, "dev",);
    assertEquals(dev.kind, 13,); // Variable
    assertEquals(dev.children, undefined,);
  });

  it("ranges: selectionRange no id e range encerra a subtask", () => {
    const analysis = analyzeDocument("file:///s.tjp", TEXT,);
    const root = getDocumentSymbols(analysis,)[0]!;
    const outer = root.children![0]!;
    // `task outer` na linha 4; o id começa no caractere 5.
    assertEquals(outer.selectionRange.start, { line: 4, character: 5, },);
    assertEquals(outer.selectionRange.end, { line: 4, character: 10, },);
    // O range de outer cobre a declaração de inner (linha 5).
    const inner = outer.children![0]!;
    assertEquals(inner.selectionRange.start.line, 5,);
    assert(outer.range.end.line >= inner.selectionRange.start.line,);
    assertEquals(outer.range.start.line, 4,);
    // selectionRange contido no range.
    assert(outer.range.start.line <= outer.selectionRange.start.line,);
  });

  it("busca: query case-insensitive casa id e nome humano", () => {
    const analysis = analyzeDocument("file:///s.tjp", TEXT,);
    const byId = getWorkspaceSymbols([analysis,], "DEV",);
    assertEquals(byId.length, 1,);
    assertEquals(byId[0]!.name, "dev",);
    assertEquals(byId[0]!.location.uri, "file:///s.tjp",);
    assertEquals(byId[0]!.location.range.start, { line: 2, character: 9, },);
    // Nome humano também casa ("Inner" → outer.inner).
    const byName = getWorkspaceSymbols([analysis,], "inner",);
    assertEquals(byName.length, 1,);
    assertEquals(byName[0]!.name, "outer.inner",);
    assertEquals(byName[0]!.containerName, "outer",);
    // Sem correspondência.
    assertEquals(getWorkspaceSymbols([analysis,], "zzz",), [],);
  });

  it("query vazia devolve todos os símbolos; projeto não parseado → []", () => {
    const analysis = analyzeDocument("file:///s.tjp", TEXT,);
    const all = getWorkspaceSymbols([analysis,], "",);
    // dev, outer, outer.inner.
    assertEquals(all.length, 3,);
    assertEquals(all.map((s,) => s.name), ["outer", "outer.inner", "dev",],);
    // Análise sem projeto (parse falhou) não contribui.
    const broken = analyzeDocument("file:///bad.tjp", "task",);
    assertEquals(getDocumentSymbols(broken,), [],);
    assertEquals(getWorkspaceSymbols([broken,], "",), [],);
  });
});
