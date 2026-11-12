/**
 * Testes do `getCompletions` (22.1.11 = I 7.7): prefixo via TST sobre
 * `SyntaxCore.categories()`, nomes definidos (Reference), kinds
 * Property/Keyword/Reference e locale ignorado no v1.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4 / I 7.7
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { analyzeDocument, } from "../../src/lsp/analyze.ts";
import { getCompletions, } from "../../src/lsp/completion.ts";

/** Projeto com task/resource/account para os nomes definidos. */
const TEXT = `project prj "Probe" "1.0" 2026-01-01 - 2026-12-31 {
}
task alpha "Alpha" {
}
resource beta "Beta" {
}
account gamma "Gamma" {
}
`;

/**
 * Análise com o prefixo escrito onde um identificador é válido (alvo de
 * `depends` numa task de probe) — o documento continua parseável, como no
 * editor enquanto o usuário digita.
 */
function withPrefix(prefix: string,): {
  analysis: ReturnType<typeof analyzeDocument>;
  position: { line: number; character: number };
} {
  const analysis = analyzeDocument(
    "file:///c.tjp",
    TEXT + `task probe "Probe" {\n  depends ${prefix}\n}\n`,
  );
  const line = TEXT.split("\n",).length;
  return { analysis, position: { line, character: 10 + prefix.length, }, };
}

describe("getCompletions (22.1.11 / I 7.7)", () => {
  it("prefixo: só keywords que começam com o texto sob o cursor (TST)", () => {
    const { analysis, position, } = withPrefix("eff",);
    const items = getCompletions(analysis, position,);
    const labels = items.map((i,) => i.label);
    assert(labels.includes("effort",),);
    // Nenhum nome definido casa "eff"; todos os itens são keywords do prefixo.
    for (const item of items) {
      assert(item.label.startsWith("eff",),);
      assertEquals(item.detail, "SyntaxMesh keyword",);
    }
    // Prefixo sem match → lista vazia (não lança).
    const none = withPrefix("zzzz",);
    assertEquals(getCompletions(none.analysis, none.position,), [],);
  });

  it("nomes definidos: tasks/resources/accounts viram Reference pelo subId", () => {
    const { analysis, position, } = withPrefix("al",);
    const items = getCompletions(analysis, position,);
    const alpha = items.find((i,) => i.label === "alpha");
    assert(alpha !== undefined,);
    assertEquals(alpha!.kind, 18,);
    assertEquals(alpha!.detail, "task name",);
    // Resource e account também completam.
    const be = withPrefix("be",);
    const beta = getCompletions(be.analysis, be.position,)
      .find((i,) => i.label === "beta");
    assert(beta !== undefined,);
    assertEquals(beta!.detail, "resource name",);
    const ga = withPrefix("ga",);
    const gamma = getCompletions(ga.analysis, ga.position,)
      .find((i,) => i.label === "gamma");
    assert(gamma !== undefined,);
    assertEquals(gamma!.detail, "account name",);
  });

  it("kinds: propriedade → Property(10), keyword comum → Keyword(14)", () => {
    const task = withPrefix("tas",);
    const taskItem = getCompletions(task.analysis, task.position,)
      .find((i,) => i.label === "task");
    assert(taskItem !== undefined,);
    assertEquals(taskItem!.kind, 10,);
    const effort = withPrefix("eff",);
    const effortItem = getCompletions(effort.analysis, effort.position,)
      .find((i,) => i.label === "effort");
    assert(effortItem !== undefined,);
    assertEquals(effortItem!.kind, 14,);
  });

  it("locale ignorado no v1: pt-br devolve os mesmos labels que en", () => {
    const { analysis, position, } = withPrefix("ta",);
    const en = getCompletions(analysis, position, "en",);
    const pt = getCompletions(analysis, position, "pt-br",);
    assertEquals(pt.map((i,) => i.label), en.map((i,) => i.label),);
  });

  it("prefixo vazio oferece tudo; dentro de string não oferece nada", () => {
    // Cursor em linha em branco (fora de qualquer token).
    const blank = analyzeDocument("file:///c.tjp", TEXT + "\n",);
    const line = TEXT.split("\n",).length - 1;
    const items = getCompletions(blank, { line, character: 0, },);
    assert(items.length > 100,);
    assert(items.some((i,) => i.label === "task"),);
    assert(items.some((i,) => i.label === "alpha" && i.kind === 18),);
    // Dentro da string "Alpha" (linha 2, coluna 12) → sem sugestões.
    assertEquals(
      getCompletions(blank, { line: 2, character: 12, },),
      [],
    );
  });
});
