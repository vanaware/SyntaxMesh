/**
 * Benchmark de scheduling (F21¹, 26.11.2).
 *
 * Mede parse + `Project.schedule()` em 100 e 1000 tarefas com `start` fixo
 * (caminho limitado). Inclui um caso de booking (`allocate`, 100 tarefas) que
 * exercita o slot-search de recurso — hotspot O(n²) alvo da 26.14.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.11)
 */
import { buildSource, parseSource, } from "./workloads.ts";

const src100 = buildSource(100,);
const src1000 = buildSource(1000,);
const srcBooking = buildSource(100, { allocate: true, },);

Deno.bench({ name: "schedule_100", group: "schedule", }, () => {
  parseSource(src100,).schedule();
},);

Deno.bench({ name: "schedule_1000", group: "schedule", }, () => {
  parseSource(src1000,).schedule();
},);

Deno.bench({ name: "schedule_booking_100", group: "schedule", }, () => {
  parseSource(srcBooking,).schedule();
},);
