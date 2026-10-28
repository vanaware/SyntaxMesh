/**
 * G1.4 (Complemento Fase 11 §6.1, 2ª onda) — integração com o scheduler.
 *
 * O plano pedia: rodar `Project.schedule()` para popular `start`/`end` +
 * bookings reais e então avaliar as funções da 2ª onda sobre eles.
 *
 * Estado atual (2026-10-28): o placement da Fase 7 FUNCIONA. Três bugs de
 * port foram corrigidos e permitem que o scheduler coloque datas e reservas:
 *  1. `PropertyList` construído a partir de `PropertySet` populava `items =
 *     []` em vez de `arg.to_ary` — o loop de scheduling nunca via tarefa
 *     alguma (prepareScenario/scheduleScenario ficavam com listas vazias).
 *  2. `doneEffort()` lia o atributo de usuário `effortdone` (sempre 0 no
 *     scheduling) em vez do contador interno `_doneEffort` — effortTasks
 *     nunca encerravam e não propagavam `end`.
 *  3. `Xref()` empurrava todo sucessor para `_startsuccs`/`_endpreds`
 *     ignorando `onEnd`, e `checkDependency` não atribuía `dependency.task`
 *     (equivalente ao `TaskDependency#resolve` do Ruby) — a cadeia de
 *     dependências (t1 → t2 → t3) nunca propagava o start aos dependentes.
 *
 * `propagateDate` era ainda um stub que gravava apenas `@startIdx`/`@endIdx`;
 * agora escreve os atributos `start`/`end` no bag e propaga a dependentes,
 * filhos herdeiros e containers (port fiel de TaskScenario.rb#propagateDate).
 *
 * Este arquivo fixa agora o COMPORTAMENTO PÓS-Fase-7: modelo agendável
 * mínimo recebe start/end reais e bookings; as funções `isallocated`/
 * `startsafter` avaliam contra essa agenda.
 *
 * Nota de unidade: o parser/armazenamento usa effort em HORAS-slot (1 unidade
 * por slot de `scheduleGranularity`), não em segundos. Um esforço de 2 dias
 * úteis de 8h = 16. O valor 2 * 8 * 3600 (segundos) era o motivo de o modelo
 * antigo nunca completar (corria até o limite do projeto — runaway).
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

/** Modelo agendável mínimo: 1 recurso full-time, 1 tarefa de 2 dias (16h). */
function schedulableModel(): {
  project: Project;
  task: Task;
  resource: Resource;
} {
  const project = createTestProject(1,);
  const resource = new Resource(project, "r1", "R1", null,);
  const task = new Task(project, "t1", "T1", null,);
  // Esforço em horas-slot: 2 dias úteis de 8h = 16 (não 2 * 8 * 3600).
  task.setForScenario("effort", 16, 0,);
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

  describe("pipeline pós-Fase 7: placement real", () => {
    it("schedule() roda sem lançar no modelo agendável mínimo", () => {
      const { project, } = schedulableModel();
      assertEquals(project.schedule(), true,);
    });

    it("scheduler coloca start/end e bookings reais", () => {
      const { project, task, resource, } = schedulableModel();
      project.schedule();
      assert(task.getForScenario("start", 0,) !== null, "start definido",);
      assert(task.getForScenario("end", 0,) !== null, "end definido",);
      // A tarefa consomeu todo o esforço planejado (16 horas-slot).
      const done = (task.scenarioData(0,) as { doneEffort(): number })
        .doneEffort();
      assertEquals(done, 16, "effort concluído",);
      // Ao menos um slot do plano foi reservado para a tarefa (API pública).
      const size = project.scoreboard?.size ?? 8737;
      const allocated = resource.scenarioData(0,).getAllocatedTime(
        0,
        size,
        task,
      );
      assert(allocated > 0, `slots reservados: ${allocated}`,);
    });

    it("isallocated/startsafter avaliam contra agenda real", () => {
      const { project, task, resource, } = schedulableModel();
      project.schedule();
      // Recurso nu (sem workinghours) fica disponível 24h/dia, então as 16h
      // de esforço caem dentro de 2026-01-01 e `end.toString()` colapsa para
      // o mesmo dia. Usa-se a janela [01-01, 01-02) para cobrir a agenda.
      const start = task.getForScenario("start", 0,) as TjTime;
      assertEquals(
        evalFn(
          project,
          task,
          "isallocated",
          ["r1", start.toString(), "2026-01-02",],
        ),
        true,
      );
      assertEquals(
        evalFn(project, resource, "startsafter", ["t1", "2025-12-31",],),
        true,
      );
    });
  });
});
