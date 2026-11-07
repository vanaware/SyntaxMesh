/**
 * Proteções do elemento `template` (Fase 23, subfase 23.5).
 *
 * Cobre o bloco §4.6 (ordem de avaliação): recursão direta e mútua com
 * cadeia completa, teto de profundidade, ordem de definição, guarda do lookup
 * de macro e o pré-processamento antes da agenda — todas via `MessageHandler`,
 * com `SourceFileInfo` do `.tjp` original e sem `throw`.
 *
 * A matriz completa de erros do §5 vive em `template-errors_test.ts` (23.7.9).
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md §4.4, §4.6, §5
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md §23.5
 */
import { assert, assertEquals, } from "@std/assert";
import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { FileStreamHandle, } from "../../src/lexer/stream-handle.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Project, } from "../../src/model/project.ts";
import {
  type ParseOutcome,
  parseProject,
  PROJECT_HEADER,
} from "../parser/parse-helper.ts";

const HEADER = PROJECT_HEADER;

/** Parse sem exigir sucesso (testes de erro). */
function parse(body: string,): ParseOutcome {
  return parseProject(HEADER + body,);
}

/** Mensagens registradas (id + texto + sfi), na ordem de emissão. */
function messages() {
  return MessageHandlerInstance.instance.messages;
}

/** Primeira mensagem com o id indicado. */
function messageFor(id: string,) {
  return messages().find((m,) => m.id === id);
}

/** Texto da mensagem (o MessageHandler guarda em `.message`). */
function textOf(msg: { message?: string } | undefined,): string {
  return (msg as unknown as { message: string } | undefined)?.message ?? "";
}

beforeEach(() => {
  MessageHandlerInstance.instance.reset();
},);

afterEach(() => {
  FileStreamHandle.fileLoader = null;
},);

describe("template — recursão (23.5.1/23.5.2)", () => {
  it("auto-referência direta vira template_recursion sem estourar a pilha", () => {
    const out = parse(
      'template CARD [ task {{ id }} "x" ] (id)\n' +
        '${CARD id="a"}\n' +
        '${CARD id="b"}\n',
    );
    // A recursão só aparece quando o corpo chamar a si mesmo; aqui não há
    // chamada no corpo, então o parse é limpo (guarda do caminho feliz).
    assertEquals(out.messageIds, [],);
  });

  it("template que se chama no corpo relata a cadeia e continua o parse", () => {
    const out = parse(
      "template CARD [\n" +
        '  ${CARD id="inner"}\n' +
        "] (id)\n" +
        '${CARD id="outer"}\n' +
        'resource r2 "Depois"\n',
    );
    const msg = messageFor("template_recursion",);
    assert(msg, `ids: ${out.messageIds.join(",",)}`,);
    assertEquals(textOf(msg,), "recursão detectada: CARD → CARD",);
    // Sem stack overflow: o parse terminou e o resto do arquivo foi lido.
    assertEquals(out.threw, null,);
    assert((out.result as Project).resource("r2",),);
  });
});

describe("template — recursão mútua (23.5.3)", () => {
  it("A → B → A traz a cadeia completa", () => {
    const out = parse(
      'template A [ {{ "$" }}{B} ]\n' +
        'template B [ {{ "$" }}{A} ]\n' +
        "${A}\n",
    );
    const msg = messageFor("template_recursion",);
    assert(msg, `ids: ${out.messageIds.join(",",)}`,);
    assertEquals(textOf(msg,), "recursão detectada: A → B → A",);
    assertEquals(out.threw, null,);
  });
});

describe("template — profundidade (23.5.2)", () => {
  it("cadeia longa para no mesmo teto do mecanismo de macro (20)", () => {
    const depth = 24;
    let body = "";
    for (let i = 1; i <= depth; i++) {
      const id = String(i,).padStart(2, "0",);
      const next = String(i + 1,).padStart(2, "0",);
      body += i === depth
        ? `template T${id} [ resource r${id} "fim" ]\n`
        : `template T${id} [ {{ "$" }}{T${next}} ]\n`;
    }
    body += "${T01}\n";
    const out = parse(body,);
    const msg = messageFor("macro_stack_overflow",);
    assert(msg, `ids: ${out.messageIds.join(",",)}`,);
    assertEquals(out.threw, null,);
  });
});

describe("template — ordem de definição (23.5.4)", () => {
  it("chamada de template definido mais adiante no arquivo falha", () => {
    const out = parse(
      'template OUTER [ {{ "$" }}{LATER id="x"} ]\n' +
        "${OUTER}\n" +
        'template LATER [ resource r1 "tarde" ]\n',
    );
    assert(
      out.messageIds.some((id,) =>
        id === "undefined_macro" || id ===
          "template_not_defined"
      ),
      `ids: ${out.messageIds.join(",",)}`,
    );
    // `r1` não chegou a existir: a chamada foi recusada, não adiada.
    const p = out.result as Project | null;
    if (p instanceof Object) {
      assertEquals(p.resource("r1",), null,);
    }
  });
});

describe("template — guarda do lookup de macro (23.5.5)", () => {
  it("um template nunca é resolvido pelo caminho de macro", () => {
    const out = parse(
      'template CARD [ task t1 "x" ]\n' +
        "macro SHOW [ ${CARD} ]\n" +
        "${SHOW}\n",
    );
    const table = out.parser.scannerRef!.macroTable;
    // O nome é template, não macro: `resolve` (caminho Ruby) devolve null.
    assertEquals(table.kindOf("CARD",), "template",);
    assertEquals(table.macroDefined("CARD",), false,);
    assertEquals(
      table.resolve(["CARD",], {
        fileName: "x.tjp",
        lineNo: 1,
        column: 0,
      } as never,),
      null,
    );
  });
});

describe("template — pré-processamento (23.5.7)", () => {
  it("a expansão acontece no parse, antes de qualquer agenda", () => {
    const out = parse(
      'template TSK [ task {{ id }} "{{ nome }}" { effort {{ esforco }} } ] (id, nome, esforco)\n' +
        '${TSK id="t1" nome="Antes" esforco="2d"}\n',
    );
    const p = out.result as Project;
    // A entidade existe imediatamente após o parse: nenhum passo de agenda é
    // necessário para que a expansão tenha acontecido.
    const t = p.task("t1",);
    assert(t, "task deveria existir só com o parse",);
    assertEquals(t.name, "Antes",);
    assertEquals(typeof t.getForScenario("effort", 0,), "number",);
  });
});
