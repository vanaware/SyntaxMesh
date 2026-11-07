/**
 * Fase 23 (23.10) — listas como argumento de template e `{{ for }}` no corpo.
 *
 * Responde a duas perguntas de uso:
 *
 * 1. **Como passar uma lista?** `itens=["a", "b"]`,
 *    `pessoas=[{ id: "r1", nome: "Ana" }]` ou `refs=[!t1, !t2]` (§2.1).
 * 2. **Como iterar?** `{{ for x of lista }}` (valor),
 *    `{{ for i, x of lista }}` (índice 0-based, valor) e
 *    `{{ for k, v of mapa }}` (chave, valor). O Vento **não** tem `loop`.
 *
 * O fixture `tests/fixtures/templates/lists-for.tjp` é o exemplo canônico
 * (copiável); esta suíte fixa o comportamento e a ancoragem no golden.
 *
 * @see docs/syntaxmesh/11-referencia-template.md §2.1, §3.1
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md (23.10)
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { parseProject, PROJECT_HEADER, } from "../parser/parse-helper.ts";
import { loadTemplateFixture, } from "../golden/template-expansion-snapshot.ts";
import type { Project, } from "../../src/model/project.ts";
import type { Task, } from "../../src/model/task.ts";
import type { Resource, } from "../../src/model/resource.ts";
import type { Allocation, } from "../../src/scheduling/allocation.ts";

/** Projeto da fixture, ou `null` quando o parse não produziu modelo. */
function fixtureProject() {
  const out = parseProject(loadTemplateFixture("lists-for",),);
  return {
    out,
    project: out.result instanceof Object && out.result !== false
      ? out.result as Project
      : null,
  };
}

/** Ids de todos os recursos alocados numa task. */
function allocationIds(task: Task,): string[] {
  return ((task.getForScenario("allocate", 0,) as Allocation[] | null) ?? [])
    .flatMap((a,) => a.candidates.map((r,) => r.fullId));
}

describe("23.10 — listas como argumento e `{{ for }}` (fixture)", () => {
  it("carrega sem mensagens", () => {
    const { out, } = fixtureProject();
    assertEquals(
      out.messageIds,
      [],
      `msgs=${out.messages.map((m,) => `${m.id}:${m.text}`).join(" | ",)}`,
    );
  });

  it("lista de strings gera uma task por item, id pelo índice", () => {
    const { project, } = fixtureProject();
    const tasks = (project!.tasks.toArray() as Task[])
      .filter((t,) => t.id.startsWith("s_",))
      .map((t,) => [t.id, t.name,]);
    assertEquals(tasks, [
      ["s_0", "Análise",],
      ["s_1", "Design",],
      ["s_2", "Build",],
    ],);
  });

  it("lista de objetos gera um resource por item", () => {
    const { project, } = fixtureProject();
    const resources = (project!.resources.toArray() as Resource[])
      .map((r,) => [r.id, r.name,]);
    assertEquals(resources, [
      ["ana", "Ana",],
      ["bia", "Bia",],
    ],);
  });

  it("mapa (chave, valor) gera uma alocação por entrada", () => {
    const { project, } = fixtureProject();
    const task = project!.tasks.toArray().find((t,) => t.id === "a") as Task;
    assert(task, "task 'a' do template ALLOC",);
    assertEquals(allocationIds(task,), ["ana", "bia",],);
  });

  it("lista de `!refs` atravessa o filtro `join` e vira `depends`", () => {
    const { project, } = fixtureProject();
    const task = project!.tasks.toArray().find((t,) => t.id === "c") as Task;
    assert(task, "task 'c' do template CHAIN",);
    const deps = (task.getForScenario("depends", 0,) as Array<{
      taskId: string;
    }>).map((d,) => d.taskId);
    assertEquals(deps, ["s_0", "s_1",],);
  });
});

describe("23.10 — semântica do `for` do Vento", () => {
  /** Template mínimo + chamada, para isolar uma forma de laço por teste. */
  function run(body: string, call: string,) {
    return parseProject(
      PROJECT_HEADER + `template T ${body}\n` + call + "\n",
    );
  }

  it("`for x of lista` percorre os valores", () => {
    const out = run(
      '[ {{ for x of itens }}resource {{ x }} "{{ x }}"\n{{ /for }} ] (itens)',
      '${T itens=["a", "b", "c"]}',
    );
    assertEquals(out.messageIds, [],);
    const project = out.result as Project;
    assertEquals(
      project.resources.toArray().map((r,) => r.id),
      ["a", "b", "c",],
    );
  });

  it("`for i, x of lista` percorre índice (0-based) e valor", () => {
    const out = parseProject(
      PROJECT_HEADER +
        'template IDX [ {{ for i, x of itens }}task t{{ i }} "{{ x }}"\n{{ /for }} ] (itens)\n' +
        '${IDX itens=["Ana", "Bia"]}\n',
    );
    assertEquals(out.messageIds, [],);
    const project = out.result as Project;
    assertEquals(
      project.tasks.toArray().map((t,) => [t.id, t.name,]),
      [["t0", "Ana",], ["t1", "Bia",],],
    );
  });

  it("`for k, v of mapa` percorre chave e valor", () => {
    const out = parseProject(
      PROJECT_HEADER +
        'template MAP [ {{ for k, v of mapa }}task {{ k }} "{{ v }}"\n{{ /for }} ] (mapa)\n' +
        '${MAP mapa={ x: "Ex", y: "Wye" }}\n',
    );
    assertEquals(out.messageIds, [],);
    const project = out.result as Project;
    assertEquals(
      project.tasks.toArray().map((t,) => [t.id, t.name,]),
      [["x", "Ex",], ["y", "Wye",],],
    );
  });

  it("lista vazia não gera texto nem erro", () => {
    const out = parseProject(
      PROJECT_HEADER +
        "template NONE [ {{ for x of itens }}{{ x }}{{ /for }} ] (itens)\n" +
        "${NONE itens=[]}\n",
    );
    assertEquals(out.messageIds, [],);
  });

  it("`{{ loop.index }}` não existe no Vento → template_render_error", () => {
    const out = parseProject(
      PROJECT_HEADER +
        "template BAD [ {{ for x of itens }}{{ loop.index }}{{ /for }} ] (itens)\n" +
        '${BAD itens=["a"]}\n',
    );
    assert(
      out.messageIds.includes("template_render_error",),
      `ids=${out.messageIds.join(",",)}`,
    );
    // A mensagem aponta o template e a linha do corpo, não o arquivo todo.
    const msg = out.messages.find((m,) => m.id === "template_render_error");
    assert(msg?.text.includes("template 'BAD': erro de execução",),);
  });
});
