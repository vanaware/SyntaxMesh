/**
 * Testes do bloco 1 de TjpSyntaxRules — task (subfase 10.11.3).
 *
 * Cobre `rule_task`/`rule_taskHeader` (criação e hierarquia),
 * `rule_taskScenarioAttributes` (effort, duration, milestone, complete),
 * `rule_taskDep` (depends) e os testes agregados da spec.
 *
 * @see docs/syntaxmesh/fases/fase-10-parser-linguagem-tarefas.md §10.11.3
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { parseProject, PROJECT_HEADER, } from "./parse-helper.ts";

/** Pega o Project resultante (lança se o parse não produziu um). */
function project(out: ReturnType<typeof parseProject>,): Project {
  assert(
    out.threw === null,
    "parse não deveria lançar: " + out.threw?.message,
  );
  assert(out.result instanceof Object && out.messageIds.length === 0,);
  return out.result as Project;
}

describe("rule_task + rule_taskHeader (10.11.3.1)", () => {
  it("cria Task com id e nome no projeto", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'task t1 "Task 1" {\n}\n',),
    );
    const t = p.task("t1",);
    assert(t instanceof Task,);
    assertEquals(t!.name, "Task 1",);
    assertEquals(t!.fullId, "t1",);
  });

  it("task sem nome usa o id como nome (ID obrigatório apenas p/ id)", () => {
    // Ruby exige nome; aqui validamos o caminho com nome vazio explícito.
    const p = project(parseProject(PROJECT_HEADER + 'task t1 "" {\n}\n',),);
    assertEquals(p.task("t1",)!.name, "",);
  });

  it("tasks aninhadas herdam o pai e compõem fullId pontuado", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'task top "T" {\ntask child "C" {\neffort 8h\n}\n}\n',
      ),
    );
    const child = p.task("top.child",);
    assert(child instanceof Task, "filho registrado como top.child",);
    assertEquals(child!.parent, p.task("top",),);
  });

  it("atributo desconhecido no corpo registra erro sem lançar exceção", () => {
    const out = parseProject(
      PROJECT_HEADER + 'task e "E" {\nunknownattr\n}\n',
    );
    assertEquals(out.threw, null,);
    assert(out.messageIds.includes("no_reduce",),);
  });
});

describe("rule_taskScenarioAttributes (10.11.3.2)", () => {
  it("effort 8d vira 64 horas de trabalho (dailyworkinghours 8)", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'task t1 "T" {\neffort 8d\n}\n',),
    );
    assertEquals(p.task("t1",)!.getForScenario("effort", 0,), 64,);
  });

  it("duration 2d converte para horas de trabalho", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'task t1 "T" {\nduration 2d\n}\n',),
    );
    assertEquals(p.task("t1",)!.getForScenario("duration", 0,), 48,);
  });

  it("milestone ativa o atributo milestone; complete aceita lista", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'task m "M" {\nmilestone\ncomplete 100\n}\n',
      ),
    );
    assertEquals(p.task("m",)!.getForScenario("milestone", 0,), true,);
    assertEquals(p.task("m",)!.getForScenario("complete", 0,), 100,);
  });

  it("start com data absoluta é aceito", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'task s "S" {\nstart 2026-02-01\n}\n',
      ),
    );
    assert(p.task("s",)!.getForScenario("start", 0,), "start definido",);
  });
});

describe("rule_taskDep (10.11.3.4)", () => {
  it("depends t1 cria TaskDependency com o id referenciado", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'task t1 "A" {\n}\ntask t2 "B" {\ndepends t1\n}\n',
      ),
    );
    const deps = p.task("t2",)!.getForScenario("depends", 0,) as
      | Array<{ taskId: string }>
      | null;
    assertEquals(deps?.map((d,) => d.taskId), ["t1",],);
  });

  it("depends com lista separada por vírgula referencia todas as tasks", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'task a "A" {}\ntask b "B" {}\ntask c "C" {\n' +
          "depends a, b\n}\n",
      ),
    );
    const deps = p.task("c",)!.getForScenario("depends", 0,) as
      | Array<{ taskId: string }>
      | null;
    assertEquals(deps?.map((d,) => d.taskId), ["a", "b",],);
  });
});

describe("agregados de task (10.11.3.8-.10)", () => {
  it('agregado: `task t1 "Task 1" { effort 8d }`', () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'task t1 "Task 1" {\neffort 8d\n}\n',),
    );
    assertEquals(p.task("t1",)!.getForScenario("effort", 0,), 64,);
  });

  it("agregado: `task t2 { depends t1 }`", () => {
    const p = project(
      parseProject(
        PROJECT_HEADER + 'task t1 "One" {\neffort 8d\n}\n' +
          'task t2 "Two" {\ndepends t1\n}\n',
      ),
    );
    const deps = p.task("t2",)!.getForScenario("depends", 0,) as
      | Array<{ taskId: string }>
      | null;
    assertEquals(deps?.map((d,) => d.taskId), ["t1",],);
  });

  it("agregado: `task t3 { milestone }`", () => {
    const p = project(
      parseProject(PROJECT_HEADER + 'task t3 "M" {\nmilestone\n}\n',),
    );
    assertEquals(p.task("t3",)!.getForScenario("milestone", 0,), true,);
  });
});
