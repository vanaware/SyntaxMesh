/**
 * Fase 24 (24.7) — fidelidade do agendador descoberta pelo golden CLI × `tj3`.
 *
 * Dois defeitos que só apareceram ao rodar a CLI sobre o corpus real:
 *
 * 1. **Laço infinito** em `Project.scheduleScenario`: o port tinha só dois dos
 *    três caminhos de término do laço principal do Ruby (`Project.rb:1225`).
 *    Quando uma tarefa já tinha falhado e depois nenhuma outra ficava pronta,
 *    o processo girava para sempre (o `tj3` encerra com "Some tasks did not fit
 *    into the project time frame"). Reprodução mínima: `Syntax/Correct/
 *    AccountReport.tjp`.
 * 2. **Laço de dependência mudo**: `checkForLoops` usava `Array#includes` para
 *    procurar a tupla `[tarefa, noFim]` no caminho. O `include?` do Ruby
 *    compara estruturalmente; o `includes` do JS compara por referência, então
 *    a recursão nunca detectava o ciclo e o port saía com exit 1 **sem
 *    mensagem** — o `tj3` emite `loop_detected`, `Loop ctnd. …` e `Aborting`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Project.rb:scheduleScenario
 * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:checkForLoops
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.7)
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { execute, } from "../../src/execution/execute.ts";
import type { ExecutionResult, } from "../../src/execution/types.ts";
// Efeito colateral: registra as fábricas de conteúdo dos relatórios.
import "../../src/reports/mod.ts";

/** Projeto cujo único par de tarefas se referencia mutuamente. */
const CYCLE = [
  'project prj "Cycle" 2026-01-01 - 2026-12-31',
  'task a "A" {',
  "  duration 1d",
  "  depends b",
  "}",
  'task b "B" {',
  "  duration 1d",
  "  depends a",
  "}",
].join("\n",);

/**
 * Projeto em que a primeira tarefa estoura o intervalo do projeto (20 meses de
 * esforço num ano com um único recurso). A dependente nunca fica pronta — é o
 * estado que travava o laço principal.
 */
const RUNAWAY = [
  'project prj "Runaway" 2011-11-09 +1y',
  'resource dev "Dev" { rate 420 }',
  'task "Products" {',
  '  task p1 "Product 1" {',
  "    effort 20m",
  "    allocate dev",
  "  }",
  '  task delivery "Delivery" {',
  "    depends !p1",
  "    duration 2w",
  "  }",
  "}",
].join("\n",);

/** Roda o pipeline completo com o singleton de mensagens limpo. */
async function run(content: string,): Promise<ExecutionResult> {
  MessageHandlerInstance.instance.reset();
  return await execute({ files: [{ path: "proj.tjp", content, },], },);
}

describe("Project.scheduleScenario — término do laço (24.7)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("não gira para sempre quando há falha e nenhuma tarefa pronta", async () => {
    const result = await run(RUNAWAY,);

    // O processo **termina** (antes desta correção o teste pendurava) e o
    // desfecho é o do `tj3`: erro de agendamento, sem relatórios.
    assertEquals(result.ok, false,);
    assertEquals(result.exitCode, 1,);
    const ids = result.messages.map((m,) => m.id);
    assert(ids.includes("runaway",),);
    assert(ids.includes("sched_runaway",),);
    // É exatamente a mensagem do `tj3` (mesma fração de esforço restante).
    const runaway = result.messages.find((m,) => m.id === "runaway")!;
    assertEquals(
      runaway.text,
      "173.5d of effort of task _Task_1.p1 does not fit into the project time frame.",
    );
  });

  it("agenda normalmente um projeto sem falhas", async () => {
    const result = await run(
      [
        'project prj "Ok" 2026-01-01 - 2026-12-31',
        'resource dev "Dev"',
        'task t "T" {',
        "  effort 3d",
        "  allocate dev",
        "}",
      ].join("\n",),
    );

    assertEquals(result.ok, true,);
    assertEquals(
      result.messages.filter((m,) => m.severity === "error").length,
      0,
    );
  });
});

describe("TaskScenario.checkForLoops — comparação estrutural (24.7)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.reset();
  },);

  it("detecta o ciclo e reproduz as mensagens do `tj3`", async () => {
    const result = await run(CYCLE,);

    assertEquals(result.ok, false,);
    assertEquals(result.exitCode, 1,);
    const summary = result.messages.map((m,) => `${m.severity}:${m.id}`);
    assertEquals(summary, [
      "warning:loop_detected",
      "info:loop_at_end",
      "info:loop_at_start",
      "info:loop_at_end",
      "error:loop_end",
    ],);
    // `Loop ctnd.` é o texto abreviado do Ruby (`TaskScenario.rb:642`).
    assertEquals(result.messages.map((m,) => m.text), [
      "Dependency loop detected at start of task a",
      "Loop ctnd. at end of task a",
      "Loop ctnd. at start of task b",
      "Loop ctnd. at end of task b",
      "Aborting",
    ],);
    // As linhas vêm do `sourceFileInfo` de cada tarefa do caminho (o `tj3`
    // usa o mesmo par tarefa → `t.sourceFileInfo`).
    assertEquals(result.messages.map((m,) => m.line), [2, 2, 6, 6, 2,],);
  });
});
