/**
 * Benchmark de Gantt (F21¹, 26.11.4).
 *
 * Gera o taskreport com coluna `chart` (Gantt HTML+CSS, Fase 15) sobre 500
 * tarefas já scheduled. Setup único; o loop mede só a geração do chart.
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.11)
 */
import { scheduledProject, } from "./workloads.ts";
import { ReportContext, } from "../packages/core/src/reports/report-context.ts";
import "../packages/core/src/reports/mod.ts";
import type { Report, } from "../packages/core/src/model/report.ts";

const project = scheduledProject(500, { gantt: true, },);
const gantt = (project.reports.toArray() as Report[]).find((r,) =>
  r.id === "gantt"
)!;

Deno.bench({ name: "gantt_500_html", group: "gantt", }, () => {
  project.reportContexts.push(new ReportContext(project, gantt,),);
  try {
    gantt.generate(["html",],);
  } finally {
    project.reportContexts.pop();
  }
},);
