/**
 * Testes do `getDefinition`/`getReferences` (22.1.12): salto para a declaração
 * via `sourceFileInfo`, referências por varredura de ids, símbolo inexistente
 * e cross-file com análises agregadas.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { analyzeDocument, } from "../../src/lsp/analyze.ts";
import type { AnalysisResult, } from "../../src/lsp/analyze.ts";
import {
  getDefinition,
  getReferences,
  symbolAt,
} from "../../src/lsp/navigation.ts";

/** Projeto com uma task referenciada por `depends` e um resource por `allocate`. */
const TEXT = `project prj "Probe" "1.0" 2026-01-01 - 2026-12-31 {
}
resource dev "Dev" {
}
task a "Task A" {
}
task b "Task B" {
  depends a
  allocate dev
}
`;

/** Análise sintética só com texto (para o arquivo que referencia cross-file). */
function synthetic(uri: string, text: string,): AnalysisResult {
  return {
    uri,
    text,
    version: 1,
    locale: "en",
    project: null,
    messages: [],
    ok: true,
  };
}

describe("navigation (22.1.12)", () => {
  it("definição: referência `depends a` salta para a declaração de `a`", () => {
    const analysis = analyzeDocument("file:///nav.tjp", TEXT,);
    // Cursor sobre o `a` de `depends a` (linha 7, caractere 10).
    const location = getDefinition(analysis, { line: 7, character: 10, },);
    assert(location !== null,);
    assertEquals(location!.uri, "file:///nav.tjp",);
    // Declaração `task a` na linha 4; o span é refinado para o id (char 5..6).
    assertEquals(location!.range.start, { line: 4, character: 5, },);
    assertEquals(location!.range.end, { line: 4, character: 6, },);
  });

  it("definição: `allocate dev` salta para o resource `dev`", () => {
    const analysis = analyzeDocument("file:///nav.tjp", TEXT,);
    const location = getDefinition(analysis, { line: 8, character: 11, },);
    assert(location !== null,);
    assertEquals(location!.range.start, { line: 2, character: 9, },);
    assertEquals(location!.range.end, { line: 2, character: 12, },);
  });

  it("referências: declaração + usos, com spans exatos", () => {
    const analysis = analyzeDocument("file:///nav.tjp", TEXT,);
    // Cursor sobre o `a` da declaração (linha 4, caractere 5).
    const refs = getReferences(analysis, { line: 4, character: 5, },);
    assertEquals(refs.length, 2,);
    assertEquals(refs[0]!.range.start, { line: 4, character: 5, },);
    assertEquals(refs[1]!.range.start, { line: 7, character: 10, },);
    assertEquals(refs.every((r,) => r.uri === "file:///nav.tjp"), true,);
  });

  it("símbolo inexistente: keyword e id sem declaração devolvem null/[]", () => {
    const analysis = analyzeDocument("file:///nav.tjp", TEXT,);
    // Cursor sobre a keyword `task` (linha 4, char 0): não é símbolo.
    assertEquals(getDefinition(analysis, { line: 4, character: 0, },), null,);
    assertEquals(getReferences(analysis, { line: 4, character: 0, },), [],);
    // `prj` é o id do projeto, não um nó dos property sets: sem declaração.
    assertEquals(getDefinition(analysis, { line: 0, character: 8, },), null,);
    // Posição fora de qualquer token.
    assertEquals(symbolAt(TEXT, { line: 1, character: 0, },), null,);
  });

  it("cross-file: definição e referências atravessam análises agregadas", () => {
    const one = analyzeDocument(
      "file:///one.tjp",
      `project p1 "One" "1.0" 2026-01-01 - 2026-12-31 {
}
task alpha "Alpha" {
}
`,
    );
    const two = synthetic(
      "file:///two.tjp",
      `task beta "B" {
  depends alpha
}
`,
    );
    const workspace = [one, two,];
    // Cursor sobre `alpha` em two.tjp (linha 1, char 10).
    const position = { line: 1, character: 10, };
    const definition = getDefinition(two, position, workspace,);
    assert(definition !== null,);
    assertEquals(definition!.uri, "file:///one.tjp",);
    assertEquals(definition!.range.start, { line: 2, character: 5, },);
    const refs = getReferences(two, position, workspace,);
    assertEquals(refs.length, 2,);
    assertEquals(refs[0]!.uri, "file:///one.tjp",);
    assertEquals(refs[1]!.uri, "file:///two.tjp",);
  });

  it("symbolAt: identifier, id absoluto e não-símbolos", () => {
    const text = 'task prj.t1 "x" {\n  depends a\n}\n';
    assertEquals(symbolAt(text, { line: 0, character: 6, },), "prj.t1",);
    assertEquals(symbolAt(text, { line: 1, character: 10, },), "a",);
    // String e keyword não são símbolos.
    assertEquals(symbolAt(text, { line: 0, character: 12, },), null,);
    assertEquals(symbolAt(text, { line: 0, character: 0, },), null,);
  });
});
