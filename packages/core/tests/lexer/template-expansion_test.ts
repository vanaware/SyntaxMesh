/**
 * Expansão de template em duas fases (Fase 23, subfase 23.3).
 *
 * Fase 1 — `${MACRO …}` dentro do corpo é expandido textualmente **antes** do
 * render; Fase 2 — o corpo resultante é renderizado pelo Vento com os
 * parâmetros nomeados no contexto. O texto final reentra no stream como input
 * normal (mesma mecânica de `injectMacro`).
 *
 * O caminho de macro (`${MACRO "arg"}` posicional) é congelado: os testes da
 * Fase 10 continuam valendo sem ajuste.
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md §4.4, §4.5, §5
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md §23.3
 */
import { assert, assertEquals, } from "@std/assert";
import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { FileStreamHandle, } from "../../src/lexer/stream-handle.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Allocation, } from "../../src/scheduling/allocation.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Resource, } from "../../src/model/resource.ts";
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

/** Parse de um caso que deve ser válido. */
function projectOf(body: string,): Project {
  const out = parse(body,);
  assertEquals(
    out.messageIds,
    [],
    `msgs=${out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)}`,
  );
  assert(
    out.result instanceof Object && out.result !== false,
    `resultado inválido: ${String(out.result,)}`,
  );
  return out.result as Project;
}

/** Mensagens registradas pelo MessageHandler (com sfi/linha). */
function messagesOf(out: ParseOutcome,) {
  void out;
  return MessageHandlerInstance.instance.messages;
}

/** IDs de alocação de uma task, na ordem de registro. */
function allocationIds(p: Project, taskId: string,): string[] {
  const allocs = p.task(taskId,)!.getForScenario("allocate", 0,) as
    | Allocation[]
    | null;
  return (allocs ?? []).flatMap((a,) =>
    a.candidates.map((r: Resource,) => r.fullId)
  );
}

beforeEach(() => {
  MessageHandlerInstance.instance.reset();
},);

afterEach(() => {
  FileStreamHandle.fileLoader = null;
},);

describe("template — expansão básica (23.3.1/23.3.4/23.3.5)", () => {
  it("chamada com params nomeados gera a task renderizada", () => {
    const p = projectOf(
      "{\n" +
        '  template CARD [ task {{ id }} "{{ nome }}" { effort {{ esforco }} } ] (id, nome, esforco)\n' +
        "}\n" +
        '${CARD id="t1" nome="Design" esforco="5d"}\n' +
        'task manual "Manual" {\n  effort 5d\n}\n',
    );
    const t1 = p.task("t1",);
    assert(t1, "task t1 deveria existir após a expansão",);
    assertEquals(t1.name, "Design",);
    // O texto renderizado é TaskJuggler normal: `effort 5d` vale o mesmo que
    // na declaração escrita à mão.
    assertEquals(
      t1.getForScenario("effort", 0,),
      p.task("manual",)!.getForScenario("effort", 0,),
    );
  });

  it("parâmetros chegam ao contexto (template de resource)", () => {
    const p = projectOf(
      "{\n" +
        '  template PERSON [ resource {{ id }} "{{ nome }}" ] (id, nome)\n' +
        "}\n" +
        '${PERSON id="alice" nome="Alice Silva"}\n',
    );
    assertEquals(p.resource("alice",)!.name, "Alice Silva",);
  });

  it("cada chamada injeta o seu texto; duas linhas seguidas expandem", () => {
    const p = projectOf(
      "{\n" +
        '  template PERSON [ resource {{ id }} "{{ nome }}" ] (id, nome)\n' +
        "}\n" +
        '${PERSON id="r1" nome="Um"}\n' +
        '${PERSON id="r2" nome="Dois"}\n',
    );
    assertEquals(p.resource("r1",)!.name, "Um",);
    assertEquals(p.resource("r2",)!.name, "Dois",);
  });

  it("corpo multi-linha expande preservando as quebras de linha", () => {
    const p = projectOf(
      "{\n" +
        "  template BLOCK [\n" +
        '    resource {{ id }} "{{ nome }}" {\n' +
        "      rate {{ taxa }}\n" +
        "    }\n" +
        "  ] (id, nome, taxa)\n" +
        "}\n" +
        '${BLOCK id="bob" nome="Bob" taxa="120"}\n',
    );
    const bob = p.resource("bob",)!;
    assertEquals(bob.name, "Bob",);
    assertEquals(bob.getForScenario("rate", 0,), 120,);
  });

  it("template sem parâmetros expande com corpo literal", () => {
    const p = projectOf(
      "{\n" +
        '  template SOLO [ task solo "Sozinho" { effort 1d } ]\n' +
        "}\n" +
        "${SOLO}\n",
    );
    assertEquals(p.task("solo",)!.name, "Sozinho",);
  });
});

describe("template — macros dentro do corpo (23.3.3)", () => {
  it("expande ${MACRO} do corpo antes do render", () => {
    const p = projectOf(
      "macro ALLOCATE_TEAM [ allocate tux1, tux2 ]\n" +
        'resource tux1 "Tux 1"\n' +
        'resource tux2 "Tux 2"\n' +
        "template DEV_TASK [\n" +
        '  task {{ id }} "{{ nome }}" {\n' +
        "    effort {{ esforco }}\n" +
        "    ${ALLOCATE_TEAM}\n" +
        "  }\n" +
        "] (id, nome, esforco)\n" +
        '${DEV_TASK id="t1" nome="Setup" esforco="3d"}\n',
    );
    assertEquals(allocationIds(p, "t1",), ["tux1", "tux2",],);
  });

  it("macro com argumento posicional dentro do corpo", () => {
    const p = projectOf(
      "macro RATE [ rate ${1} ]\n" +
        'template PAID [ resource {{ id }} "{{ nome }}" { ${RATE "99"} } ] (id, nome)\n' +
        '${PAID id="carol" nome="Carol"}\n',
    );
    assertEquals(p.resource("carol",)!.getForScenario("rate", 0,), 99,);
  });
});

describe("template — composição reentrante (23.3.9)", () => {
  it("texto renderizado com ${OUTRO …} expande na reentrada do stream", () => {
    const p = projectOf(
      "{\n" +
        '  template INNER [ resource {{ id }} "{{ nome }}" ] (id, nome)\n' +
        '  template OUTER [ {{ "$" }}{INNER id="r9" nome="Nove"} ]\n' +
        "}\n" +
        "${OUTER}\n",
    );
    assertEquals(p.resource("r9",)!.name, "Nove",);
  });
});

describe("template — erros (23.3.7/23.3.8)", () => {
  it("erro de sintaxe Vento aponta para a definição", () => {
    const out = parse(
      "{\n" + "  template BAD [ {{ if }} oops {{ /for }} ]\n" + "}\n" +
        "${BAD}\n",
    );
    const msg = messagesOf(out,).find((m,) => m.id === "template_syntax_error");
    assert(msg, `ids: ${out.messageIds.join(",",)}`,);
    assert(
      msg.message.startsWith("template 'BAD': erro de sintaxe",),
      `mensagem: ${msg.message}`,
    );
    // sfi da *definição* (linha 3 do arquivo: cabeçalho, `{`, `template BAD`).
    assertEquals(msg.sourceFileInfo?.lineNo, 3,);
  });

  it("erro na chamada (parâmetro faltante) aponta para a chamada", () => {
    const out = parse(
      "{\n" +
        '  template PERSON [ resource {{ id }} "{{ nome }}" ] (id, nome)\n' +
        "}\n" +
        '${PERSON id="alice"}\n',
    );
    const msg = messagesOf(out,).find((m,) =>
      m.id === "template_missing_param"
    );
    assert(msg, `ids: ${out.messageIds.join(",",)}`,);
    assertEquals(
      msg.message,
      "template 'PERSON': parâmetro 'nome' não fornecido",
    );
    assertEquals(msg.sourceFileInfo?.lineNo, 5,);
  });
});
