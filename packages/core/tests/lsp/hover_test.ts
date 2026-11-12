/**
 * Testes do `getHover` (22.1.10): keyword → projeção do doc-core (I 7.5),
 * identificador → resumo do nó (tipo/nome/localização/atributos fornecidos),
 * posição vazia/literal/comentário → null.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { analyzeDocument, } from "../../src/lsp/analyze.ts";
import { getHover, } from "../../src/lsp/hover.ts";

/** Projeto com task (effort/start fornecidos), resource e um comentário. */
const TEXT = `project prj "Probe" "1.0" 2026-01-01 - 2026-12-31 {
}
task t "Task" {
  effort 5d
  start 2026-02-01
}
resource r "Worker" {
}
# nota
`;

describe("getHover (22.1.10)", () => {
  it("keyword devolve a referência Markdown do doc-core com range do token", () => {
    const analysis = analyzeDocument("file:///h.tjp", TEXT,);
    const hover = getHover(analysis, { line: 2, character: 1, },);
    assert(hover !== null,);
    assertEquals(hover!.contents.kind, "markdown",);
    assertStringIncludes(hover!.contents.value, "### task",);
    assertEquals(hover!.range, {
      start: { line: 2, character: 0, },
      end: { line: 2, character: 4, },
    },);
  });

  it("identificador devolve tipo, nome, localização e atributos fornecidos", () => {
    const analysis = analyzeDocument("file:///h.tjp", TEXT,);
    // "t" em `task t "Task"` (coluna 5).
    const hover = getHover(analysis, { line: 2, character: 5, },);
    assert(hover !== null,);
    const value = hover!.contents.value;
    assertStringIncludes(value, "**task** `t`",);
    assertStringIncludes(value, "Task",);
    assertStringIncludes(value, "Declared at file:///h.tjp:3",);
    // Só os atributos que o usuário escreveu (provided), não o mapa inteiro.
    assertStringIncludes(value, "Attributes: effort, start",);
    // Resource irmão também resolve, com o kind certo.
    const resource = getHover(analysis, { line: 6, character: 9, },);
    assert(resource !== null,);
    assertStringIncludes(resource!.contents.value, "**resource** `r`",);
  });

  it("posição vazia (espaço/pontuação) devolve null", () => {
    const analysis = analyzeDocument("file:///h.tjp", TEXT,);
    // Início da linha 3 é indentação; linha 1 é só "}".
    assertEquals(getHover(analysis, { line: 3, character: 0, },), null,);
    assertEquals(getHover(analysis, { line: 1, character: 0, },), null,);
    // Fora do texto.
    assertEquals(getHover(analysis, { line: 99, character: 0, },), null,);
  });

  it("literais e comentários não têm hover útil (null)", () => {
    const analysis = analyzeDocument("file:///h.tjp", TEXT,);
    // String "Task" (coluna 7), número 5 (coluna 9), data e comentário.
    assertEquals(getHover(analysis, { line: 2, character: 8, },), null,);
    assertEquals(getHover(analysis, { line: 3, character: 9, },), null,);
    assertEquals(getHover(analysis, { line: 4, character: 8, },), null,);
    assertEquals(getHover(analysis, { line: 8, character: 2, },), null,);
  });

  it("nome desconhecido ou documento não parseado devolve null", () => {
    const analysis = analyzeDocument("file:///h.tjp", TEXT,);
    // "prj" é o id do project — não é nó dos property sets pesquisados.
    assertEquals(getHover(analysis, { line: 0, character: 8, },), null,);
    // Documento quebrado: project null, identificador não resolve.
    const broken = analyzeDocument(
      "file:///bad.tjp",
      'task t "X" {\n  bogusattr 1\n}\n',
    );
    assertEquals(getHover(broken, { line: 0, character: 5, },), null,);
  });

  it("atributos de subtask e chaves dentro de string não vazam para o pai", () => {
    const nested = analyzeDocument(
      "file:///n.tjp",
      `project prj "P" "1.0" 2026-01-01 - 2026-12-31 {
}
task outer "Outer { }" {
  effort 2d
  task inner "Inner" {
    effort 9d
    priority 800
  }
}
`,
    );
    // "outer" na linha 2, coluna 5.
    const hover = getHover(nested, { line: 2, character: 5, },);
    assert(hover !== null,);
    const value = hover!.contents.value;
    // Só effort do pai; priority/effort da subtask ficam fora (depth 2).
    assertStringIncludes(value, "Attributes: effort",);
    assertEquals(value.includes("priority",), false,);
    // A subtask vê os próprios atributos.
    const inner = getHover(nested, { line: 4, character: 7, },);
    assert(inner !== null,);
    assertStringIncludes(
      inner!.contents.value,
      "Attributes: effort, priority",
    );
  });
});
