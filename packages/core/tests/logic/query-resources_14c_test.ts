/**
 * Onda B (bt) — query_* portáveis de `ResourceScenario` (ResourceScenario.rb:315-463)
 * via dispatch do `Query.process` (etapa i), sobre um projeto agendado real, e
 * o `query_fte` ainda ancorado na Fase 18 (`NotYetImplementedError`).
 *
 * As consultas de licença deixaram de ser stubs na 16.17 (Fase 16).
 *
 * @see docs/taskjuggler/lib/taskjuggler/ResourceScenario.rb:277-463
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Allocation, } from "../../src/scheduling/allocation.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { Query, } from "../../src/query/query.ts";

Deno.env.set("TZ", "UTC",);
TjTime.setTimeZone("UTC",);

const D = (s: string,) => TjTime.fromString(s,);

function scheduledFixture(): { project: Project; resource: Resource } {
  const project = createTestProject(1,);
  const ra = new Resource(project, "ra", "RA", null,);
  const task = new Task(project, "t", "T", null,);
  task.setForScenario("effort", 8, 0,);
  task.setForScenario("start", D("2026-01-02",), 0,);
  task.setForScenario("allocate", [new Allocation([ra,],),], 0,);
  project.schedule();
  return { project, resource: ra, };
}

function rq(
  project: Project,
  resource: Resource,
  attributeId: string,
): Query {
  return new Query({
    project,
    property: resource,
    attributeId,
    scenarioIdx: 0,
    start: D("2026-01-01",),
    end: D("2026-06-30",),
    // numberFormat/currencyFormat default para as strings formatadas.
    numberFormat: undefined,
    currencyFormat: undefined,
  },);
}

describe("query_* ResourceScenario (Onda B3/B4)", () => {
  it("effort/effortleft/headcount/rate são numéricos para um recurso agendado", () => {
    const { project, resource, } = scheduledFixture();
    for (
      const attr of [
        "effort",
        "effortleft",
        "headcount",
        "rate",
        "freework",
        "freetime",
      ]
    ) {
      const q = rq(project, resource, attr,);
      assert(q.process(), `${attr}: ${q.errorMessage ?? ""}`,);
      assert(typeof q.to_num() === "number", `${attr} não-numérico`,);
    }
  });

  it("duties lista a tarefa alocada ao recurso", () => {
    const { project, resource, } = scheduledFixture();
    const q = rq(project, resource, "duties",);
    assert(q.process(), q.errorMessage ?? "",);
    assert((q.string ?? "").includes("T",), `duties sem 'T': ${q.string}`,);
  });

  it("cost/revenue sem conta definida devolvem a mensagem 'No balance'", () => {
    const { project, resource, } = scheduledFixture();
    const cost = rq(project, resource, "cost",);
    assert(cost.process(), cost.errorMessage ?? "",);
    assert(
      (cost.string ?? "").includes("No 'balance'",),
      `cost: ${cost.string}`,
    );
  });

  it("query_fte fica ancorado (process falha com ok=false)", () => {
    const { project, resource, } = scheduledFixture();
    for (const attr of ["fte",]) {
      const q = rq(project, resource, attr,);
      // `NotYetImplementedError extends TjRuntimeError` e `Query.process()` o
      // captura (query.ts:429-434): em vez de propagar, marca `ok = false`,
      // grava `errorMessage` e devolve `false` — a âncora é observável assim.
      assertEquals(q.process(), false, `${attr} deveria falhar (ancorado)`,);
      assertEquals(q.ok, false, `${attr} deveria ter ok=false`,);
      assert(
        (q.errorMessage ?? "").length > 0,
        `${attr} sem errorMessage de âncora`,
      );
    }
  });

  it("consultas de licença portadas devolvem número (16.17)", () => {
    const { project, resource, } = scheduledFixture();
    for (
      const attr of [
        "annualleave",
        "sickleave",
        "specialleave",
        "unpaidleave",
        "timeoffdays",
      ]
    ) {
      const q = rq(project, resource, attr,);
      assert(q.process(), `${attr}: ${q.errorMessage ?? ""}`,);
      assertEquals(q.to_num(), 0, `${attr} sem licenças deveria ser 0`,);
    }
  });

  it("annualleavelist devolve lista vazia sem licenças (16.17)", () => {
    const { project, resource, } = scheduledFixture();
    const q = rq(project, resource, "annualleavelist",);
    assert(q.process(), q.errorMessage ?? "",);
    assertEquals(q.string, "",);
  });
});
