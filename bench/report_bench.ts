/**
 * Benchmark de relatórios (F21¹, 26.11.3).
 *
 * Gera 10 taskreports HTML sobre um projeto de 50 tarefas já scheduled. O
 * schedule é feito uma única vez (setup); o loop mede só a geração dos reports
 * em memória (ADR 027).
 *
 * @see docs/syntaxmesh/fases/fase-21-compatibilidade-qualidade-tarefas.md (26.11)
 */
import { scheduledProject, } from "./workloads.ts";
import { ReportContext, } from "../packages/core/src/reports/report-context.ts";
import "../packages/core/src/reports/mod.ts";
import type { Report, } from "../packages/core/src/model/report.ts";

const project = scheduledProject(50, { reports: 10, },);
const reports = project.reports.toArray() as Report[];

Deno.bench({ name: "report_10_html", group: "report", }, () => {
  for (const report of reports) {
    project.reportContexts.push(new ReportContext(project, report,),);
    try {
      report.generate(["html",],);
    } finally {
      project.reportContexts.pop();
    }
  }
},);
