/**
 * Benchmark de Query (F21¹, 26.11.6).
 *
 * Avalia 10k queries de `effort` (Fase 11) round-robin sobre as tarefas de um
 * projeto de 100 tarefas já scheduled. Setup único; o loop mede só o
 * `Query.process()` + `to_num()`.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.11)
 */
import { scheduledProject, } from "./workloads.ts";
import { Query, } from "../packages/core/src/query/query.ts";
import type { Task, } from "../packages/core/src/model/task.ts";

const project = scheduledProject(100,);
const tasks = project.tasks.toArray().filter((t,) =>
  t.parent !== null
) as Task[];

Deno.bench({ name: "query_10k_effort", group: "query", }, () => {
  for (let i = 0; i < 10000; i++) {
    const task = tasks[i % tasks.length]!;
    const query = new Query({
      project,
      property: task,
      attributeId: "effort",
      scenarioIdx: 0,
    },);
    if (query.process()) {
      query.to_num();
    }
  }
},);
