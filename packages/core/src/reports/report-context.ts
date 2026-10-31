/**
 * ReportContext — contexto de geração de relatórios (Fase 14.2).
 *
 * Port fiel de `reports/ReportContext.rb`. Um `ReportContext` é empilhado pelo
 * `Project` para cada relatório em geração; relatórios podem ser aninhados, mas
 * só o do topo (`project.reportContexts.last`) é o contexto corrente. Ele carrega
 * a `Query` derivada das configurações do report e as listas de `tasks`/
 * `resources` sobre as quais o relatório trabalha.
 *
 * No Ruby, `@project.tasks` é uma `PropertyList`; aqui `project.tasks` é um
 * `PropertySet`, então o `.dup` vira `new PropertyList(set)` (cópia dos itens).
 *
 * @see docs/taskjuggler/lib/taskjuggler/reports/ReportContext.rb
 * @see docs/syntaxmesh/fases/fase-14-relatorios.md (14.2)
 */
import { type Project, } from "../model/project.ts";
import { type Report, } from "../model/report.ts";
import { type Task, } from "../model/task.ts";
import { type Resource, } from "../model/resource.ts";
import { PropertyList, } from "../model/property-list.ts";
import { Query, } from "../query/query.ts";
import type { AttributeBase, } from "../attributes/attribute-base.ts";
import type { RealFormat, } from "../format/real-format.ts";

/** Backup de atributos para relatórios dinâmicos (Fase 14.11). */
export type AttributeBackup = [
  Map<string, AttributeBase<unknown>>,
  Map<string, AttributeBase<unknown>>[],
] | null;

export class ReportContext {
  readonly project: Project;
  readonly report: Report;
  readonly query: Query;
  readonly dynamicReportId: string;
  childReportCounter: number;
  tasks: PropertyList<Task>;
  resources: PropertyList<Resource>;
  attributeBackup: AttributeBackup;

  constructor(project: Project, report: Report,) {
    this.project = project;
    this.report = report;
    this.childReportCounter = 0;
    this.attributeBackup = null;

    this.query = new Query({
      project,
      loadUnit: report.get("loadUnit",) as string | null,
      numberFormat: report.get("numberFormat",) as RealFormat | null,
      timeFormat: report.get("timeFormat",) as string | null,
      currencyFormat: report.get("currencyFormat",) as RealFormat | null,
      start: report.get("start",) as never,
      end: report.get("end",) as never,
      hideJournalEntry: report.get("hideJournalEntry",),
      journalMode: report.get("journalMode",) as string | null,
      journalAttributes: report.get("journalAttributes",) as string[] | null,
      sortJournalEntries: report.get("sortJournalEntries",),
      costAccount: report.get("costaccount",) as string | null,
      revenueAccount: report.get("revenueaccount",) as string | null,
    },);

    const parent = project.reportContexts.at(-1,) ?? null;
    if (parent) {
      // ID único dentro do relatório composto: concatenção dos contadores da
      // raiz à folha, separados por '.'.
      this.dynamicReportId = parent.dynamicReportId + "." +
        parent.childReportCounter;
      parent.childReportCounter += 1;
      // Herda as listas do contexto-pai como valores iniciais.
      this.tasks = new PropertyList<Task>(parent.tasks,);
      this.resources = new PropertyList<Resource>(parent.resources,);
    } else {
      // A raiz é sempre "0"; o primeiro filho "0.0", o segundo "0.1", …
      this.dynamicReportId = "0";
      this.tasks = new PropertyList<Task>(project.tasks,);
      this.resources = new PropertyList<Resource>(project.resources,);
    }
  }
}
