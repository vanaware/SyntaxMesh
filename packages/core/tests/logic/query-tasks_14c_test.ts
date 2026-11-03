/**
 * Onda B (bt) — query_* portáveis de `TaskScenario` (TaskScenario.rb:1290-1557),
 * exercitados ponta-a-ponta com `project.schedule()` real e o dispatch do
 * `Query.process` (etapa i: `data[scIdx].query_X`). Cobre o núcleo temporal,
 * de status/completude, de limites de data e de listas de dependência.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TaskScenario.rb:1290-1557
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Allocation, } from "../../src/scheduling/allocation.ts";
import { TaskDependency, } from "../../src/scheduling/task-dependency.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { Query, } from "../../src/query/query.ts";

Deno.env.set("TZ", "UTC",);
TjTime.setTimeZone("UTC",);

const D = (s: string,) => TjTime.fromString(s,);

/** Project agendado: container com 2 folhas alocadas a recursos + dependência. */
function scheduledFixture(): {
  project: Project;
  container: Task;
  leafA: Task;
  leafB: Task;
} {
  const project = createTestProject(1,);
  const ra = new Resource(project, "ra", "RA", null,);
  const rb = new Resource(project, "rb", "RB", null,);

  const container = new Task(project, "c", "Container", null,);
  const leafA = new Task(project, "a", "Leaf A", container,);
  const leafB = new Task(project, "b", "Leaf B", container,);

  leafA.setForScenario("effort", 8, 0,);
  leafA.setForScenario("start", D("2026-01-02",), 0,);
  leafA.setForScenario("allocate", [new Allocation([ra,],),], 0,);
  leafB.setForScenario("effort", 8, 0,);
  leafB.setForScenario("allocate", [new Allocation([rb,],),], 0,);
  // leafB depende do fim de leafA (end->start).
  leafB.setForScenario("depends", [new TaskDependency(leafA.id, true,),], 0,);

  project.schedule();
  return { project, container, leafA, leafB, };
}

/** Query de task para um atributo `query_<attributeId>`. */
function tq(
  project: Project,
  task: Task,
  attributeId: string,
  start = "2026-01-01",
  end = "2026-06-30",
): Query {
  return new Query({
    project,
    property: task,
    attributeId,
    scenarioIdx: 0,
    start: D(start,),
    end: D(end,),
  },);
}

describe("query_* TaskScenario (Onda B2)", () => {
  it("duration é um número não-negativo para uma folha agendada", () => {
    const { project, leafA, } = scheduledFixture();
    const q = tq(project, leafA, "duration",);
    assert(q.process(), q.errorMessage ?? "",);
    assert(typeof q.to_num() === "number" && q.to_num()! >= 0, "duration<0",);
    assert(q.string!.length > 0, "sem string de duration",);
  });

  it("effort devolve carga alocada no intervalo (numérico + scaleLoad)", () => {
    const { project, leafA, } = scheduledFixture();
    const q = tq(project, leafA, "effort",);
    assert(q.process(), q.errorMessage ?? "",);
    assert(typeof q.to_num() === "number", "effort não-numérico",);
  });

  it("complete é percentagem e status/gauge não vazios após scheduling", () => {
    const { project, leafA, } = scheduledFixture();
    const complete = tq(project, leafA, "complete",);
    assert(complete.process(), complete.errorMessage ?? "",);
    assert(
      /^\d+%$/.test(complete.string ?? "",),
      `complete inválido: ${complete.string}`,
    );

    const status = tq(project, leafA, "status",);
    assert(status.process(), status.errorMessage ?? "",);
    assert((status.string ?? "").length > 0, "status vazio",);

    const gauge = tq(project, leafA, "gauge",);
    assert(gauge.process(), gauge.errorMessage ?? "",);
    assert((gauge.string ?? "").length > 0, "gauge vazio",);
  });

  it("headcount é numérico e scheduling='ASAP' para folha", () => {
    const { project, leafA, } = scheduledFixture();
    const head = tq(project, leafA, "headcount",);
    assert(head.process(), head.errorMessage ?? "",);
    assert(typeof head.to_num() === "number", "headcount não-numérico",);

    const sched = tq(project, leafA, "scheduling",);
    assert(sched.process(), sched.errorMessage ?? "",);
    assertEquals(sched.string, "ASAP",);
  });

  it("maxstart/minend sem limite viram sentinela -1 (queryDateLimit)", () => {
    const { project, leafA, } = scheduledFixture();
    const q = tq(project, leafA, "maxstart",);
    assert(q.process(), q.errorMessage ?? "",);
    assertEquals(q.to_sort(), -1,);
    assertEquals(q.string, "",);

    const minend = tq(project, leafA, "minend",);
    assert(minend.process(), minend.errorMessage ?? "",);
    assertEquals(minend.to_sort(), -1,);
  });

  it("competitorcount é 0 sem concorrentes", () => {
    const { project, leafA, } = scheduledFixture();
    const q = tq(project, leafA, "competitorcount",);
    assert(q.process(), q.errorMessage ?? "",);
    assertEquals(q.to_num(), 0,);
  });

  it("precursors/followers refletem a dependência end->start", () => {
    const { project, leafA, leafB, } = scheduledFixture();
    const followers = tq(project, leafA, "followers",);
    assert(followers.process(), followers.errorMessage ?? "",);
    assert(
      (followers.string ?? "").includes("Leaf B",),
      `followers sem Leaf B: ${followers.string}`,
    );

    const precursors = tq(project, leafB, "precursors",);
    assert(precursors.process(), precursors.errorMessage ?? "",);
    assert(
      (precursors.string ?? "").includes("Leaf A",),
      `precursors sem Leaf A: ${precursors.string}`,
    );
  });

  it("activetasks/closedtasks/opentasks são contagens numéricas", () => {
    const { project, container, } = scheduledFixture();
    for (const attr of ["activetasks", "closedtasks", "opentasks",]) {
      const q = tq(project, container, attr,);
      assert(q.process(), q.errorMessage ?? "",);
      assert(typeof q.to_num() === "number", `${attr} não-numérico`,);
    }
  });

  it("children (compartilhado PTN) lista as duas folhas do container", () => {
    const { project, container, } = scheduledFixture();
    const q = tq(project, container, "children",);
    assert(q.process(), q.errorMessage ?? "",);
    assert((q.string ?? "").includes("Leaf A",), "sem Leaf A",);
    assert((q.string ?? "").includes("Leaf B",), "sem Leaf B",);
  });
});
