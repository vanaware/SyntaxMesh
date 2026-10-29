/**
 * 11.G.H.2 — Fuzz determinístico do scheduler (Fase 11-Gaps, Bloco H).
 *
 * Gera N=20 projetos pseudo-aleatórios com seed fixa (42) e verifica que
 * todos satisfazem as 7 invariantes de `scheduler_invariants_test.ts` após
 * `Project.schedule()`. Seed fixa ⇒ resultado reprodutível em CI.
 *
 * Cada projeto gerado tem:
 *  - 3–10 tasks de folha (identificadores t1..tN)
 *  - 0–2 dependências por task (apontam para uma task anterior na ordem)
 *  - 1–3 recursos, cada task alocada a um recurso escolhido pela PRNG
 *  - effort ∈ {4, 8, 16, 24} horas-slot
 *  - start da task raiz variado em 2026-01-XX
 *
 * Não usamos `Math.random()`: a PRNG é Mulberry32 — determinística por seed.
 *
 * @see docs/syntaxmesh/fases/fase-11-logical-gaps-tarefas.md §11.G.H.2
 */
import { assert, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { createTestProject, } from "../fixtures/create-test-project.ts";
import { Task, } from "../../src/model/task.ts";
import { Resource, } from "../../src/model/resource.ts";
import { Allocation, } from "../../src/scheduling/allocation.ts";
import { TaskDependency, } from "../../src/scheduling/task-dependency.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import {
  checkInvariants,
  isoDate,
} from "../invariants/scheduler_invariants_test.ts";
import type { Project, } from "../../src/model/project.ts";

/** Mulberry32 — PRNG determinística, 32-bit state. */
function mulberry32(seed: number,): () => number {
  let a = seed | 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a,);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t,)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface GenSpec {
  numTasks: number;
  numResources: number;
  /** effort de cada task (horas-slot). */
  efforts: number[];
  /** Para cada task i, lista de índices j < i dos predecessores. */
  deps: number[][];
  /** Índice do recurso para cada task. */
  allocations: number[];
  /** Dia de início (1–20) do projeto. */
  startDay: number;
}

function generateProject(seed: number,): { project: Project; spec: GenSpec } {
  const rng = mulberry32(seed,);
  const numTasks = 3 + Math.floor(rng() * 8,); // 3..10
  const numResources = 1 + Math.floor(rng() * 3,); // 1..3
  const efforts: number[] = [];
  const deps: number[][] = [];
  const allocations: number[] = [];
  const pickEffort = [4, 8, 16, 24,];
  for (let i = 0; i < numTasks; i++) {
    efforts.push(pickEffort[Math.floor(rng() * pickEffort.length,)]!,);
    allocations.push(Math.floor(rng() * numResources,),);
    const d: number[] = [];
    // 0–2 dependências, só para índices anteriores (evita ciclos).
    for (let j = 0; j < i; j++) {
      if (rng() < 0.15) d.push(j,);
    }
    deps.push(d.slice(0, 2,),);
  }
  const startDay = 1 + Math.floor(rng() * 20,);

  const project = createTestProject(1,);
  const month = 1 + Math.floor(rng() * 5,); // 1..5
  project.set(
    "start",
    TjTime.fromString(
      `2026-${String(month,).padStart(2, "0",)}-01`,
    ),
  );
  const devResources: Resource[] = [];
  for (let r = 0; r < numResources; r++) {
    devResources.push(
      new Resource(project, `r${r}`, `R${r}`, null,),
    );
  }
  const tasks: Task[] = [];
  for (let i = 0; i < numTasks; i++) {
    const t = new Task(project, `t${i}`, `T${i}`, null,);
    t.setForScenario("effort", efforts[i]!, 0,);
    t.setForScenario(
      "allocate",
      [new Allocation([devResources[allocations[i]!]!,],),],
      0,
    );
    tasks.push(t,);
  }
  // Liga dependências (fullId é `test.tN` — o prefixo do projeto).
  for (let i = 0; i < numTasks; i++) {
    if (deps[i]!.length === 0) continue;
    const list = deps[i]!.map((j,) => new TaskDependency(`t${j}`, true,));
    tasks[i]!.setForScenario("depends", list, 0,);
  }
  // Start explícito na primeira task para dar um anchor.
  tasks[0]!.setForScenario(
    "start",
    TjTime.fromString(
      `2026-${String(month,).padStart(2, "0",)}-${
        String(startDay,).padStart(2, "0",)
      }`,
    ),
    0,
  );
  return {
    project,
    spec: {
      numTasks,
      numResources,
      efforts,
      deps,
      allocations,
      startDay,
    },
  };
}

describe("H.2 — fuzz determinístico do scheduler (seed=42, N=20)", () => {
  const prevTz = Deno.env.get("TZ",);
  Deno.env.set("TZ", "UTC",);
  TjTime.setTimeZone("UTC",);

  it("20 projetos pseudo-aleatórios satisfazem todas as invariantes", () => {
    const failures: string[] = [];
    for (let k = 0; k < 20; k++) {
      const seed = 42 + k;
      MessageHandlerInstance.instance.messages.length = 0;
      MessageHandlerInstance.instance.errors = 0;
      let project: Project;
      try {
        ({ project, } = generateProject(seed,));
      } catch (e) {
        failures.push(
          `seed=${seed} gerou exceção: ${
            (e as Error).stack ??
              (e as Error).message
          }`,
        );
        continue;
      }
      try {
        const ok = project.schedule();
        assert(ok, `seed=${seed}: schedule() devolveu false`,);
      } catch (e) {
        failures.push(
          `seed=${seed}: schedule lançou ${(e as Error).message}`,
        );
        continue;
      }
      const violations = checkInvariants(project,);
      if (violations.length > 0) {
        failures.push(
          `seed=${seed}: ${violations.length} violação(ões): ` +
            violations.join(" | ",),
        );
      }
      // sanity: ao menos uma task agendada com start != null
      const anyScheduled = project.tasks.toArray().some((n,) =>
        Boolean(n.getForScenario("scheduled", 0,),) &&
        isoDate(n.getForScenario("start", 0,),)
      );
      assert(anyScheduled, `seed=${seed}: nenhuma task agendada`,);
    }
    assert(
      failures.length === 0,
      `${failures.length} projeto(s) violaram invariantes:\n` +
        failures.join("\n",),
    );
  });

  // Restaura TZ.
  if (prevTz === undefined) Deno.env.delete("TZ",);
  else Deno.env.set("TZ", prevTz,);
});
