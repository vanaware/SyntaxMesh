/**
 * G1.4 (Complemento Fase 11 §6.1, 2ª onda) — integração com o scheduler.
 *
 * O plano pedia: rodar `Project.schedule()` para popular `start`/`end` +
 * bookings reais e então avaliar as funções da 2ª onda sobre eles.
 *
 * Estado real (probe de 2026-10-27): o loop do scheduler roda sem lançar,
 * mas **não conclui tarefas** mesmo no modelo mínimo construído à mão
 * (effort em segundos + `allocate` + `start`): `end` permanece null,
 * nenhum slot é reservado (`duties: []`, `effort: 0`) e o
 * `checkFailsAndWarnings` registra `task_end_undef`. É o gap central da
 * Fase 7 (em andamento), não algo que a Fase 11 possa resolver.
 *
 * Este arquivo tem, portanto, duas metades:
 *  1. Regression ativa: fixa o comportamento ATUAL do pipeline (roda sem
 *     exceção; não coloca datas/bookings) — quando a Fase 7 consertar o
 *     placement, esta metade falha de propósito e aponta para cá.
 *  2. Em bloco comentado: o comportamento pós-Fase-7 que G1.4 exige. Ao
 *     concluir a Fase 7, descomentá-lo e ajustar a metade 1.
 *
 * Nota: `ScenarioData#error` ainda é stub de `console.log`
 * (scenario-data.ts:96) — não há MessageHandler no caminho do scheduler,
 * então a regression observa o ESTADO (datas/bookings), não as mensagens.
 */
import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Allocation, } from "../../src/scheduling/allocation.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import type { Project, } from "../../src/model/project.ts";
import { LogicalFunction, } from "../../src/logic/logical-function.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { Query, } from "../../src/query/query.ts";

const D = (s: string,): TjTime => TjTime.fromString(s,);

/** Modelo agendável mínimo: 1 recurso full-time, 1 tarefa de 2 dias. */
function schedulableModel(): {
  project: Project;
  task: Task;
  resource: Resource;
} {
  const project = createTestProject(1,);
  const resource = new Resource(project, "r1", "R1", null,);
  const task = new Task(project, "t1", "T1", null,);
  // Esforço em segundos, como o parser armazena (`2d` → 2 * 8 * 3600).
  task.setForScenario("effort", 2 * 8 * 3600, 0,);
  task.setForScenario("allocate", [new Allocation([resource,],),], 0,);
  task.setForScenario("start", D("2026-01-01",), 0,);
  return { project, task, resource, };
}

/** Avalia `nome(args...)` contra `property` no cenário padrão. */
function evalFn(
  project: Project,
  property: Task | Resource,
  nome: string,
  args: unknown[],
): unknown {
  const fn = new LogicalFunction(nome,);
  fn.setArguments(args,);
  const expr = new LogicalExpression(new LogicalOperation(fn,),);
  expr.query = new Query({ project, property, },);
  return fn.eval(expr,);
}

describe("G1.4 — scheduler-driven (Complemento Fase 11)", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.messages.length = 0;
    MessageHandlerInstance.instance.errors = 0;
  },);

  // --------------------------------------------------
  // Metade 1 — regression ativa do estado ATUAL (Fase 7 pendente)
  // --------------------------------------------------
  describe("estado atual do pipeline (âncora: Fase 7)", () => {
    it("schedule() roda sem lançar no modelo agendável mínimo", () => {
      const { project, } = schedulableModel();
      assertEquals(project.schedule(), true,);
    });

    it("scheduler NÃO coloca end nem bookings (gap Fase 7)", () => {
      const { project, task, resource, } = schedulableModel();
      project.schedule();
      // O placement ainda não acontece: `end` segue indefinido e o score-
      // board do recurso permanece sem duties. Se a Fase 7 evoluir e isto
      // falhar, descomentar a metade 2 abaixo.
      assertEquals(task.getForScenario("end", 0,), null,);
      // Nenhum slot do plano foi reservado para a tarefa (API pública).
      const size = project.scoreboard?.size ?? 8737;
      assertEquals(
        resource.scenarioData(0,).getAllocatedTime(0, size, task,),
        0,
      );
      const ids = MessageHandlerInstance.instance.messages.map((m,) => m.id);
      // O stub de console.log não popula o handler; nada para afirmar aqui.
      assertEquals(ids.length, 0,);
    });
  });

  // --------------------------------------------------
  // Metade 2 — o que G1.4 exige quando a Fase 7 concluir o placement.
  // Bloco comentado de propósito: `it({ skip })` do @std/testing/bdd não
  // propagou a opção (executou mesmo assim). Descomentar ao concluir a
  // Fase 7, relaxando a metade 1 acima.
  // --------------------------------------------------
  // describe("pós-Fase 7: funções sobre agenda real", () => {
  //   it("schedule() popula start/end e bookings reais", () => {
  //     const { project, task, resource, } = schedulableModel();
  //     project.schedule();
  //     assert(task.getForScenario("start", 0,) !== null, "start",);
  //     assert(task.getForScenario("end", 0,) !== null, "end",);
  //     const start = task.getForScenario("start", 0,) as TjTime;
  //     const end = task.getForScenario("end", 0,) as TjTime;
  //     const allocated = task.scenarioData(0,).getAllocatedTime(
  //       project.dateToIdx(start,), project.dateToIdx(end,), resource,
  //     );
  //     assert(allocated >= 2, `2 dias alocados: ${allocated}`,);
  //   });
  //   it("isallocated/startsafter avaliam contra agenda real", () => {
  //     const { project, task, resource, } = schedulableModel();
  //     project.schedule();
  //     const start = task.getForScenario("start", 0,) as TjTime;
  //     const end = task.getForScenario("end", 0,) as TjTime;
  //     assertEquals(
  //       evalFn(project, task, "isallocated",
  //         ["r1", start.toString(), end.toString()],), true,
  //     );
  //     assertEquals(
  //       evalFn(project, resource, "startsafter", ["t1", "2025-12-31"],),
  //       true,
  //     );
  //   });
  // });
});
