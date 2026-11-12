/**
 * Testes do `SyntaxReference` além da fachada `man` (22.1b.2.11).
 *
 * O `checkKeyword` reproduz `SyntaxReference.rb:274-295`: keyword inválida
 * devolve `false` e acumula os chunks que o Ruby escreveria em `$stderr`
 * (⚠️ ADAPTAÇÃO — o doc-core não escreve no stderr real; `stderrLines`
 * drena o buffer para o consumidor decidir o destino).
 *
 * @see docs/taskjuggler/lib/taskjuggler/SyntaxReference.rb
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco D
 */
import { assert, assertEquals, assertStringIncludes, } from "@std/assert";
import { before, describe, it, } from "@std/testing/bdd";
import { SyntaxReference, } from "../../src/docgen/syntax-reference.ts";

describe("SyntaxReference.checkKeyword (22.1b.2.11)", () => {
  // A construção é cara (tabelas do parser + cross-reference); uma por suite.
  let reference: SyntaxReference;
  before(() => {
    reference = new SyntaxReference();
  },);

  it("keyword válida devolve true e não acumula nada", () => {
    assertEquals(reference.checkKeyword("task",), true,);
    assertEquals(reference.stderrLines(), [],);
  });

  it("keyword inválida devolve false com erro e lista de top-level", () => {
    assertEquals(reference.checkKeyword("nosuch",), false,);
    const lines = reference.stderrLines();
    assertEquals(lines.length, 3,);
    assertEquals(lines[0], "ERROR: nosuch is not a known keyword.\n\n",);
    assertEquals(
      lines[1],
      "Try one of the following keywords as argument to this program:\n",
    );
    const list = lines[2]!;
    assert(list.endsWith("\n",),);
    const names = list.slice(0, -1,).split(", ",);
    // `task`/`resource` têm contexts [self, supplement.*] na gramática portada
    // e ficam fora da lista, como no Ruby; `project`/`account`/`macro` entram.
    assert(names.includes("project",),);
    assert(names.includes("account",),);
    assert(names.includes("macro",),);
    assert(!names.includes("task",),);
    assert(!names.includes("resource",),);
  });

  it("a lista só contém keywords top-level (contexts vazio ou único == self)", () => {
    reference.checkKeyword("nosuch",);
    const list = reference.stderrLines()[2]!;
    const names = list.slice(0, -1,).split(", ",);
    // Recomputação independente a partir dos dados da referência.
    const expected: string[] = [];
    for (const kwd of reference.keywords.values()) {
      if (
        kwd.contexts.length === 0 ||
        (kwd.contexts.length === 1 && kwd.contexts[0] === kwd)
      ) {
        expected.push(kwd.keyword,);
      }
    }
    assertEquals(names, expected,);
    // Keywords aninhadas (contexts com outros) ficam fora da lista.
    const nested = [...reference.keywords.values(),].find(
      (kwd,) => kwd.contexts.length > 1,
    );
    assert(nested !== undefined, "o corpus tem keywords aninhadas",);
    assert(!names.includes(nested.keyword,),);
  });

  it("null devolve false sem a linha de erro", () => {
    assertEquals(reference.checkKeyword(null,), false,);
    const lines = reference.stderrLines();
    assertEquals(lines.length, 2,);
    assertEquals(
      lines[0],
      "Try one of the following keywords as argument to this program:\n",
    );
    assertStringIncludes(lines[1]!, "project",);
  });

  it("os chunks concatenados reproduzem os bytes do stderr Ruby", () => {
    reference.checkKeyword("nosuch",);
    const stderr = reference.stderrLines().join("",);
    // Reconstrução independente: erro + dica + lista top-level terminada em \n.
    const names: string[] = [];
    for (const kwd of reference.keywords.values()) {
      if (
        kwd.contexts.length === 0 ||
        (kwd.contexts.length === 1 && kwd.contexts[0] === kwd)
      ) {
        names.push(kwd.keyword,);
      }
    }
    assertEquals(
      stderr,
      "ERROR: nosuch is not a known keyword.\n\n" +
        "Try one of the following keywords as argument to this program:\n" +
        names.join(", ",) + "\n",
    );
  });

  it("stderrLines drena o buffer e chamadas acumulam", () => {
    reference.checkKeyword("nosuch",);
    reference.checkKeyword("alsonot",);
    const lines = reference.stderrLines();
    assertEquals(lines.length, 6,);
    assertEquals(lines[0], "ERROR: nosuch is not a known keyword.\n\n",);
    assertEquals(lines[3], "ERROR: alsonot is not a known keyword.\n\n",);
    // Drenado: a próxima leitura vem vazia.
    assertEquals(reference.stderrLines(), [],);
    // Chamada válida não limpa o que ficou pendente.
    reference.checkKeyword("nope",);
    assertEquals(reference.checkKeyword("task",), true,);
    assertEquals(reference.stderrLines().length, 3,);
  });
});
