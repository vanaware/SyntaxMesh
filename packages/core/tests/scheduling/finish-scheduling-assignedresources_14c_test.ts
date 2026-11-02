/**
 * 14C / Onda A1 — `TaskScenario#finishScheduling` mescla os
 * `assignedresources` dos filhos no pai (paridade fiel com
 * `TaskScenario.rb:410-430`). Fecha a divergência registrada na 14C.12.4.
 *
 * A asserção lê o atributo de cenário bruto (`getForScenario`), não
 * `Task#assignedResources()` — que, para containers, recalcula a união a partir
 * dos filhos e mascararia a ausência da mesclagem.
 *
 * Dois níveis de verificação:
 *  - casos determinísticos que acionam `finishScheduling` diretamente com
 *    `assignedresources` conhecidos (incluindo um recurso em comum), provando a
 *    mesclagem com dedupe e a transitividade bottom-up;
 *  - um caso ponta-a-ponta que roda `project.schedule()` de verdade e confere o
 *    invariante "pai ⊇ união dos filhos, sem duplicata", independente de quais
 *    recursos o scheduler escolheu reservar.
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

const D = (s: string,): TjTime => TjTime.fromString(s,);

/** Lê o `assignedresources` bruto do cenário 0 de uma tarefa. */
function rawAssigned(task: Task,): Resource[] {
  return (task.getForScenario("assignedresources", 0,) as Resource[]) ?? [];
}

/** Define `assignedresources` brutos e marca a tarefa como agendada. */
function seed(task: Task, resources: Resource[],): void {
  task.forceForScenario("assignedresources", [...resources,], 0,);
  task.scenarioData(0,).markAsScheduled();
}

function allocate(task: Task, resources: Resource[],): void {
  task.setForScenario("effort", 8, 0,);
  task.setForScenario("start", D("2026-01-01",), 0,);
  task.setForScenario("allocate", [new Allocation(resources,),], 0,);
}

Deno.env.set("TZ", "UTC",);
TjTime.setTimeZone("UTC",);

describe("A1 — finishScheduling mescla assignedresources no pai", () => {
  beforeEach(() => {
    MessageHandlerInstance.instance.messages.length = 0;
    MessageHandlerInstance.instance.errors = 0;
  },);

  it("container recebe a união dos recursos de dois filhos (sem duplicata)", () => {
    const project: Project = createTestProject(1,);
    const ra = new Resource(project, "ra", "RA", null,);
    const rb = new Resource(project, "rb", "RB", null,);
    const rc = new Resource(project, "rc", "RC", null,);

    const container = new Task(project, "c", "C", null,);
    const childA = new Task(project, "ca", "CA", container,);
    const childB = new Task(project, "cb", "CB", container,);
    // rb é comum aos dois filhos → deve aparecer uma única vez no pai.
    seed(childA, [ra, rb,],);
    seed(childB, [rb, rc,],);
    seed(container, [],);

    container.scenarioData(0,).finishScheduling();

    const parentList = rawAssigned(container,);
    // União exata, sem duplicatas.
    assertEquals(
      parentList.length,
      3,
      `esperado 3 recursos, veio ${parentList.length}`,
    );
    assert(parentList.includes(ra,), "ra no container",);
    assert(parentList.includes(rb,), "rb no container",);
    assert(parentList.includes(rc,), "rc no container",);
    assertEquals(new Set(parentList,).size, 3, "sem duplicatas",);
    // Cada filho mantém exatamente os seus.
    assertEquals(rawAssigned(childA,).length, 2,);
    assertEquals(rawAssigned(childB,).length, 2,);
  });

  it("união transita por container aninhado até a raiz (bottom-up)", () => {
    const project: Project = createTestProject(1,);
    const rd = new Resource(project, "rd", "RD", null,);

    const root = new Task(project, "root", "Root", null,);
    const mid = new Task(project, "mid", "Mid", root,);
    const leaf = new Task(project, "leaf", "Leaf", mid,);
    seed(leaf, [rd,],);
    seed(mid, [],);
    seed(root, [],);

    root.scenarioData(0,).finishScheduling();

    // leaf → mid → root (o merge sobe um nível por chamada, recursão bottom-up).
    assert(
      rawAssigned(mid,).includes(rd,),
      "rd subiu para o container intermediário",
    );
    assert(rawAssigned(root,).includes(rd,), "rd subiu até a raiz",);
  });

  it("tarefa leaf sem pai mantém os seus recursos e não lança", () => {
    const project: Project = createTestProject(1,);
    const re = new Resource(project, "re", "RE", null,);
    const solo = new Task(project, "solo", "Solo", null,);
    allocate(solo, [re,],);

    assert(project.schedule(), "schedule() deve retornar true",);
    assertEquals(rawAssigned(solo,), [re,],);
  });

  it("após schedule() real, cada pai ⊇ união dos filhos, sem duplicata", () => {
    const project: Project = createTestProject(1,);
    const ra = new Resource(project, "ra", "RA", null,);
    const rb = new Resource(project, "rb", "RB", null,);
    const rc = new Resource(project, "rc", "RC", null,);

    const container = new Task(project, "c", "C", null,);
    const childA = new Task(project, "ca", "CA", container,);
    const childB = new Task(project, "cb", "CB", container,);
    allocate(childA, [ra, rb,],);
    allocate(childB, [rb, rc,],);

    assert(project.schedule(), "schedule() deve retornar true",);

    const union = new Set([...rawAssigned(childA,), ...rawAssigned(childB,),],);
    const parentList = rawAssigned(container,);
    // Invariante do finishScheduling: todo recurso de um filho está no pai.
    for (const r of union) {
      assert(
        parentList.includes(r,),
        `recurso ${r.id} deveria subir ao container`,
      );
    }
    // Sem duplicatas no pai.
    assertEquals(
      new Set(parentList,).size,
      parentList.length,
      "pai sem duplicatas",
    );
    // O pai é exatamente a união dos filhos (aqui é raiz, sem pais próprios).
    assertEquals(parentList.length, union.size,);
  });
});
