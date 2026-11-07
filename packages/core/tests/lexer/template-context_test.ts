/**
 * Contexto e composição de templates (Fase 23, subfase 23.6).
 *
 * Duas coisas são verificadas aqui:
 *
 * 1. **Contexto** (§4.7) — além dos parâmetros, todo corpo enxerga `project`
 *    (view congelada, somente leitura), `ids()`, `expandTemplate`,
 *    `expandMacro` e `expandTemplateList`.
 * 2. **Composição** (§4.4) — um template pode renderizar outro template
 *    (`expandTemplate`) ou uma macro (`expandMacro`), na mesma expansão.
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md §4.4, §4.7
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md §23.6
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

/** Parse de um caso válido, devolvendo o Project. */
function projectOf(body: string,): Project {
  const out = parse(body,);
  const failures = MessageHandlerInstance.instance.messages
    .filter((m,) => m.type === "error" || m.type === "fatal")
    .map((m,) => `${m.id}:${m.message}`);
  assertEquals(failures, [],);
  assert(out.result instanceof Object && out.result !== false,);
  return out.result as Project;
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

describe("template — contexto (23.6.1)", () => {
  it("parâmetros continuam disponíveis ao lado das globais", () => {
    const p = projectOf(
      "{\n" +
        '  template P [ resource {{ id }} "{{ nome }}@{{ project.name }}" ] (id, nome)\n' +
        "}\n" +
        '${P id="r1" nome="Ana"}\n',
    );
    // `PROJECT_HEADER` declara `project prj "Test" "1.0"`.
    assertEquals(p.resource("r1",)!.name, "Ana@Test",);
  });

  it("project expõe metadados somente leitura (id/name/version)", () => {
    const p = projectOf(
      "{\n" +
        '  template P [ resource {{ id }} "{{ project.id }}:{{ project.version }}" ] (id)\n' +
        "}\n" +
        '${P id="r1"}\n',
    );
    assertEquals(p.resource("r1",)!.name, "prj:1.0",);
  });

  it("ids() resolve o ID canônico e preserva um ID desconhecido", () => {
    const p = projectOf(
      "{\n" +
        "  template P [ resource {{ id }} \"{{ ids(origem) }}/{{ ids('nao.existe') }}\" ] (id, origem)\n" +
        "}\n" +
        'resource base "Base"\n' +
        '${P id="r1" origem="base"}\n',
    );
    assertEquals(p.resource("r1",)!.name, "base/nao.existe",);
  });
});

describe("template — expandTemplate (23.6.2)", () => {
  it("template renderiza template (exemplo WRAPPER do §4.4)", () => {
    const p = projectOf(
      "{\n" +
        '  template CARD [ task {{ id }} "{{ nome }}" ] (id, nome)\n' +
        '  template WRAPPER [ {{ expandTemplate("CARD", { id: id, nome: nome }) }} ] (id, nome)\n' +
        "}\n" +
        '${WRAPPER id="t1" nome="Envolvido"}\n',
    );
    assertEquals(p.task("t1",)!.name, "Envolvido",);
  });

  it("o texto composto pode ser guardado com `set` antes de emitir", () => {
    const p = projectOf(
      "{\n" +
        '  template PERSON [ resource {{ id }} "{{ nome }}" ] (id, nome)\n' +
        '  template TWO [ {{ set a = expandTemplate("PERSON", { id: id1, nome: n1 }) }}{{ set b = expandTemplate("PERSON", { id: id2, nome: n2 }) }}{{ a }}{{ b }} ] (id1, n1, id2, n2)\n' +
        "}\n" +
        '${TWO id1="r1" n1="Um" id2="r2" n2="Dois"}\n',
    );
    assertEquals(p.resource("r1",)!.name, "Um",);
    assertEquals(p.resource("r2",)!.name, "Dois",);
  });

  it("expandTemplate de template inexistente reporta 'não definido'", () => {
    const out = parse(
      "{\n" +
        '  template W [ {{ expandTemplate("NOPE", {}) }} ]\n' +
        "}\n" +
        "${W}\n",
    );
    assert(out.messageIds.includes("template_not_defined",),);
  });

  it("recursão via expandTemplate é detectada", () => {
    const out = parse(
      "{\n" +
        '  template R [ {{ expandTemplate("R", {}) }} ]\n' +
        "}\n" +
        "${R}\n",
    );
    const msg = MessageHandlerInstance.instance.messages.find((m,) =>
      m.id === "template_recursion"
    );
    assert(msg, `ids: ${out.messageIds.join(",",)}`,);
    assertEquals(msg.message, "recursão detectada: R → R",);
  });
});

describe("template — expandMacro (23.6.3)", () => {
  it("macro explícita a partir de string", () => {
    const p = projectOf(
      "{\n" +
        '  template DEV [ task {{ id }} "d" { {{ expandMacro("ALLOCATE_TEAM") }} } ] (id)\n' +
        "}\n" +
        "macro ALLOCATE_TEAM [ allocate tux1, tux2 ]\n" +
        'resource tux1 "Tux 1"\n' +
        'resource tux2 "Tux 2"\n' +
        '${DEV id="t1"}\n',
    );
    assertEquals(allocationIds(p, "t1",), ["tux1", "tux2",],);
  });

  it("macro inexistente reporta undefined_macro", () => {
    const out = parse(
      "{\n" +
        '  template D [ {{ expandMacro("NAO_EXISTE") }} ]\n' +
        "}\n" +
        "${D}\n",
    );
    assert(out.messageIds.includes("undefined_macro",),);
  });
});

describe("template — expandTemplateList (23.6.4)", () => {
  it("renderiza o template para cada item da lista", () => {
    const p = projectOf(
      "{\n" +
        '  template LINE [ task {{ id }} "{{ id }}" ] (id)\n' +
        "  template SUMMARY [\n" +
        '{{ for t of expandTemplateList("LINE", itens) }}{{ t }}\n' +
        "{{ /for }}\n" +
        "  ] (itens)\n" +
        "}\n" +
        '${SUMMARY itens=["a", "b", "c"]}\n',
    );
    assertEquals(p.task("a",)!.name, "a",);
    assertEquals(p.task("b",)!.name, "b",);
    assertEquals(p.task("c",)!.name, "c",);
  });

  it("itens-objeto alimentam os params por nome", () => {
    const p = projectOf(
      "{\n" +
        '  template LINE [ resource {{ id }} "{{ nome }}" ] (id, nome)\n' +
        "  template SUMMARY [\n" +
        '{{ for t of expandTemplateList("LINE", itens) }}{{ t }}\n' +
        "{{ /for }}\n" +
        "  ] (itens)\n" +
        "}\n" +
        '${SUMMARY itens=[{ id: "r1", nome: "Um" }, { id: "r2", nome: "Dois" }]}\n',
    );
    assertEquals(p.resource("r1",)!.name, "Um",);
    assertEquals(p.resource("r2",)!.name, "Dois",);
  });
});

describe("template — precedência e imutabilidade (23.6.5/23.6.6)", () => {
  it("parâmetro sobrescreve a global homônima e emite aviso", () => {
    const out = parse(
      "{\n" +
        '  template P [ resource {{ id }} "{{ ids }}" ] (id, ids)\n' +
        "}\n" +
        '${P id="r1" ids="sobrescrito"}\n',
    );
    const warn = MessageHandlerInstance.instance.messages.find((m,) =>
      m.id === "template_shadowed_global"
    );
    assert(warn, `ids: ${out.messageIds.join(",",)}`,);
    assert(warn.message.includes("'ids'",), `msg: ${warn.message}`,);
    assertEquals(warn.type, "warning",);
    const p = out.result as Project;
    assertEquals(p.resource("r1",)!.name, "sobrescrito",);
  });

  it("a view de project é congelada em runtime", () => {
    const p = projectOf(
      "{\n" +
        '  template P [ resource {{ id }} "{{ Object.isFrozen(project) }}" ] (id)\n' +
        "}\n" +
        '${P id="r1"}\n',
    );
    assertEquals(p.resource("r1",)!.name, "true",);
  });
});

describe("template — exemplos canônicos (23.6.7/23.6.8)", () => {
  it("SUMMARY do §4.7 (project.name + for sobre expandTemplateList)", () => {
    const p = projectOf(
      "{\n" +
        '  template TASK_LINE [ task {{ id }} "Linha {{ id }}" ] (id)\n' +
        "  template SUMMARY [\n" +
        "# Projeto: {{ project.name }}\n" +
        '{{ for t of expandTemplateList("TASK_LINE", tarefas) }}{{ t }}\n' +
        "{{ /for }}\n" +
        "  ] (tarefas)\n" +
        "}\n" +
        '${SUMMARY tarefas=["x1", "x2"]}\n',
    );
    assertEquals(p.task("x1",)!.name, "Linha x1",);
    assertEquals(p.task("x2",)!.name, "Linha x2",);
  });

  it("DEV_TASK do §4.4 (macro no corpo + params + render) de ponta a ponta", () => {
    const p = projectOf(
      "{\n" +
        "  template DEV_TASK [\n" +
        '  task {{ id }} "{{ nome }}" {\n' +
        "    effort {{ esforco }}\n" +
        "    ${ALLOCATE_TEAM}\n" +
        "  }\n" +
        "] (id, nome, esforco)\n" +
        "}\n" +
        "macro ALLOCATE_TEAM [ allocate tux1, tux2, tux3 ]\n" +
        'resource tux1 "Tux 1"\n' +
        'resource tux2 "Tux 2"\n' +
        'resource tux3 "Tux 3"\n' +
        '${DEV_TASK id="t1" nome="Setup" esforco="3d"}\n',
    );
    const t = p.task("t1",)!;
    assertEquals(t.name, "Setup",);
    assertEquals(
      allocationIds(p, "t1",),
      ["tux1", "tux2", "tux3",],
    );
    assert(typeof t.getForScenario("effort", 0,) === "number",);
  });
});
