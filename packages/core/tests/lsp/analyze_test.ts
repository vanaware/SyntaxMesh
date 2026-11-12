/**
 * Testes do `analyzeDocument` (22.1.7): projeto válido, erro de sintaxe,
 * isolamento do singleton entre chamadas, version e reuso incremental.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §P2.4
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { analyzeDocument, } from "../../src/lsp/analyze.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";

/** Projeto mínimo válido (inglês, sem diretiva de idioma). */
const VALID = `project prj "Probe" "1.0" 2026-01-01 - 2026-12-31 {
}
task t "Task" {
}
`;

/** Projeto com atributo inexistente dentro da task. */
const INVALID = `project prj "Broken" "1.0" 2026-01-01 - 2026-12-31 {
}
task t "Task" {
  bogusattr 42
}
`;

describe("analyzeDocument (22.1.7)", () => {
  it("projeto válido: ok, project montado, sem mensagens", () => {
    const result = analyzeDocument("file:///valid.tjp", VALID,);
    assertEquals(result.ok, true,);
    assert(result.project !== null,);
    assertEquals(result.project!.id, "prj",);
    assertEquals(result.messages, [],);
    assertEquals(result.locale, "en",);
    assertEquals(result.uri, "file:///valid.tjp",);
  });

  it("erro de sintaxe: ok false e mensagens de erro com localização", () => {
    const result = analyzeDocument("file:///bad.tjp", INVALID,);
    assertEquals(result.ok, false,);
    assert(result.messages.length > 0,);
    assert(result.messages.every((m,) => m.type === "error"),);
    const sfi = result.messages[0]!.sourceFileInfo;
    assert(sfi !== null,);
    assertEquals(sfi!.fileName, "file:///bad.tjp",);
  });

  it("isolamento: uma chamada não herda mensagens da anterior", () => {
    const bad = analyzeDocument("file:///bad.tjp", INVALID,);
    assert(bad.messages.length > 0,);
    // O singleton ficou sujo de propósito; a próxima chamada reseta.
    assert(MessageHandlerInstance.instance.messages.length > 0,);
    const good = analyzeDocument("file:///valid.tjp", VALID,);
    assertEquals(good.ok, true,);
    assertEquals(good.messages, [],);
    // O snapshot da chamada anterior não foi mutado pelo reset.
    assert(bad.messages.length > 0,);
  });

  it("version carimbada e reuso incremental com texto idêntico", () => {
    const first = analyzeDocument("file:///valid.tjp", VALID, { version: 3, },);
    assertEquals(first.version, 3,);
    const reused = analyzeDocument("file:///valid.tjp", VALID, {
      version: 4,
      previous: first,
    },);
    assertEquals(reused.version, 4,);
    // Reuso: mesma instância de projeto (o parse não rodou de novo).
    assertEquals(reused.project, first.project,);
    // Texto diferente força novo parse.
    const changed = analyzeDocument(
      "file:///valid.tjp",
      VALID + "\n",
      { version: 5, previous: first, },
    );
    assertEquals(changed.version, 5,);
    assert(changed.project !== first.project,);
  });
});
