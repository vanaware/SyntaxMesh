/**
 * StatusSheetReport — gerador de templates de status sheet em sintaxe TJP.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/reports/StatusSheetReport.rb`.
 *
 * O relatório é o espelho do `TimeSheetReport`: em vez de coletar trabalho
 * planejado por recurso, ele coleta as **responsabilidades** de cada gerente
 * (tarefas de topo pelas quais o recurso é `responsible`) e as últimas entradas
 * de journal de cada uma — inclusive as que vieram de time sheets, via
 * `JournalEntry#timeSheetRecord` (Fase 18).
 *
 * ⚠️ Browser (ADR 027): nada é escrito em disco; o texto sai em `to_tjp()`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/reports/StatusSheetReport.rb
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.8/18.17)
 */

import type { Report, } from "../model/report.ts";
import type { Resource, } from "../model/resource.ts";
import type { Task, } from "../model/task.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { JournalEntry, } from "../model/journal.ts";
import { PropertyList, } from "../model/property-list.ts";
import { registerContentFactory, } from "../model/report-content.ts";
import { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "../logic/logical-expression.ts";
import type { AlertLevelDefinition, } from "../model/alert-levels.ts";
import type { Material, } from "../model/material.ts";
import type { MaterialAllocation, } from "../model/material-allocation.ts";
import type { TimeSheetRecord, } from "../timesheet/time-sheet-record.ts";
import type { TjTime, } from "../time/tj-time.ts";
import { ReportBase, } from "./report-base.ts";

/** Tarefas pelas quais um gerente responde (Ruby `ManagerResponsibilities`). */
export class ManagerResponsibilities {
  readonly task: Task;
  readonly journalEntries: JournalEntry[];

  constructor(task: Task, journalEntries: JournalEntry[],) {
    this.task = task;
    // Ruby `journalEntries.dup` — a lista do journal não é mutada.
    this.journalEntries = [...journalEntries,];
  }

  /** Ordena as entradas pela ordem da `taskList` original (Ruby `sort!`). */
  sort(taskList: PropertyList<Task>,): void {
    this.journalEntries.sort((e1, e2,) =>
      taskList.itemIndex(e1.property as Task,) -
      taskList.itemIndex(e2.property as Task,)
    );
  }
}

/** Um gerente e suas responsabilidades (Ruby `ManagerStatusRecord`). */
export class ManagerStatusRecord {
  readonly resource: Resource;
  readonly responsibilities: ManagerResponsibilities[] = [];

  constructor(resource: Resource,) {
    this.resource = resource;
  }

  /** Ordena responsabilidades e entradas (Ruby `sort!`). */
  sort(taskList: PropertyList<Task>,): void {
    this.responsibilities.sort((r1, r2,) =>
      taskList.itemIndex(r1.task,) - taskList.itemIndex(r2.task,)
    );
    for (const responsibility of this.responsibilities) {
      responsibility.sort(taskList,);
    }
  }
}

/**
 * Gerador de templates de status sheet (Ruby `StatusSheetReport`).
 */
export class StatusSheetReport extends ReportBase {
  private managers: ManagerStatusRecord[] = [];

  constructor(report: Report,) {
    super(report,);
  }

  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    this.managers = [];
    const project = this.project;

    // Recursos visíveis, na ordem pedida pelo relatório.
    let resourceList = new PropertyList<Resource>(project.resources,);
    resourceList.setSorting(
      this.a("sortResources",) as Array<[string, boolean, number,]>,
    );
    resourceList = this.filterResourceList(
      resourceList,
      null,
      this.a("hideResource",) as LogicalExpression | null,
      this.a("rollupResource",) as LogicalExpression | null,
      null,
    );

    // Modelo da Query usada para consultar todo mundo.
    const scenarioIdx = ((this.a("scenarios",) as number[]) ?? [0,])[0] ?? 0;
    const queryAttrs = {
      project,
      scopeProperty: null as unknown,
      scenarioIdx,
      loadUnit: "days",
      timeFormat: "%Y-%m-%d",
      currencyFormat: this.a("currencyFormat",),
      start: this.a("start",),
      end: this.a("end",),
      hideJournalEntry: this.a("hideJournalEntry",),
      journalMode: this.a("journalMode",),
      journalAttributes: this.a("journalAttributes",),
      sortJournalEntries: this.a("sortJournalEntries",),
      costAccount: this.a("costaccount",),
      revenueAccount: this.a("revenueaccount",),
    };
    resourceList.query = new Query(queryAttrs as never,);
    resourceList.sort();

    // Tarefas visíveis, na ordem pedida pelo relatório.
    let taskList = new PropertyList<Task>(project.tasks,);
    taskList.setSorting(
      this.a("sortTasks",) as Array<[string, boolean, number,]>,
    );
    taskList = this.filterTaskList(
      taskList,
      null,
      this.a("hideTask",) as LogicalExpression | null,
      this.a("rollupTask",) as LogicalExpression | null,
      null,
    );
    taskList.sort();

    const start = this.a("start",) as TjTime;
    const end = this.a("end",) as TjTime;

    for (const resource of resourceList.toArray()) {
      // Sheets de status só fazem sentido para recursos folha.
      if (!resource.leaf()) continue;

      // Tarefas pelas quais o recurso é responsável e cujo pai ele **não** é
      // responsável (as de topo da hierarquia dele).
      const topLevelTasks: Task[] = [];
      for (const task of taskList.toArray()) {
        if (!this.responsibleOf(task, scenarioIdx,).includes(resource,)) {
          continue;
        }
        const parent = task.parent as Task | null;
        if (
          parent === null ||
          !this.responsibleOf(parent, scenarioIdx,).includes(resource,)
        ) {
          topLevelTasks.push(task,);
        }
      }
      if (topLevelTasks.length === 0) continue;

      const manager = new ManagerStatusRecord(resource,);
      this.managers.push(manager,);

      for (const task of topLevelTasks) {
        // Entradas de journal correntes da tarefa e das sub-tarefas.
        const entries = project.journal.currentEntriesR(
          end,
          task,
          0,
          start.addSeconds(1,),
          resourceList.query!,
        );
        if (entries.length === 0) continue;
        manager.responsibilities.push(
          new ManagerResponsibilities(task, entries,),
        );
      }
      // Ordena as responsabilidades pela taskList original.
      manager.sort(taskList,);
    }
  }

  /** Templates em sintaxe TJP, um bloco `statussheet` por gerente. */
  to_tjp(): string {
    const levels = this.project.get("alertLevels",) as AlertLevelDefinition[];
    const timeFormat = (this.a("timeFormat",) as string | null) ?? "%Y-%m-%d";
    const start = this.a("start",) as TjTime;
    const end = this.a("end",) as TjTime;
    let file = "";

    for (const manager of this.managers) {
      const resource = manager.resource;
      file += "# --------8<--------8<--------\n";
      file +=
        `statussheet ${resource.fullId} ${start.to_s()} - ${end.to_s()} {\n\n`;

      if (manager.responsibilities.length === 0) {
        file += "  # This resource is not responsible for any task.\n\n";
      } else {
        for (const responsibility of manager.responsibilities) {
          file += `  # Task: ${responsibility.task.name}\n`;

          // Extensão 18.17.8: cada tarefa listada uma única vez (as entradas
          // de journal podem repetir a mesma tarefa).
          const tasksShown = new Set<Task>();
          for (const entry of responsibility.journalEntries) {
            const task = entry.property as Task;
            file += `  task ${task.fullId} {\n`;
            const alertLevel = levels[entry.alertLevel]?.id ??
              String(entry.alertLevel,);
            file += `    # status ${alertLevel} "${entry.headline}" {\n`;
            file += `    #   # Date: ${entry.date.to_s()}\n`;
            const tsRecord = entry.timeSheetRecord as TimeSheetRecord | null;
            if (tsRecord) {
              file += "    #   # ";
              file += `Work: ${Math.trunc(tsRecord.actualWorkPercent(),)}% `;
              if (tsRecord.actualWorkPercent() !== tsRecord.planWorkPercent()) {
                file += `(${Math.trunc(tsRecord.planWorkPercent(),)}%) `;
              }
              if (tsRecord.remaining !== null) {
                file += `   Remaining: ${tsRecord.actualRemaining()}d `;
                if (tsRecord.actualRemaining() !== tsRecord.planRemaining()) {
                  file += `(${tsRecord.planRemaining()}d) `;
                }
              } else {
                const actualEnd = tsRecord.actualEnd();
                file += `   End: ${actualEnd?.to_s(timeFormat,) ?? ""} `;
                if (!sameTime(actualEnd, tsRecord.planEnd(),)) {
                  file += `(${tsRecord.planEnd()?.to_s(timeFormat,) ?? ""}) `;
                }
              }
              file += "\n";
            }
            const author = entry.author as PropertyTreeNode | null;
            if (author) file += `    #   author ${author.fullId}\n`;
            if (entry.flags.length > 0) {
              file += `    #   flags ${entry.flags.join(", ",)}\n`;
            }
            if (entry.summary) {
              file += "    #   summary -8<-\n" +
                indentBlock(4, entry.summary,) +
                "    #   ->8-\n";
            }
            if (entry.details) {
              file += "    #   details -8<-\n" +
                indentBlock(4, entry.details,) +
                "    #   ->8-\n";
            }
            // Materiais da tarefa entram no bloco, uma vez por tarefa.
            if (!tasksShown.has(task,)) {
              tasksShown.add(task,);
              file += this.materialLines(task,);
            }
            file += "    # }\n  }\n\n";
          }
        }
      }
      file += "}\n# -------->8-------->8--------\n\n";
    }
    return file;
  }

  /**
   * Linhas comentadas com as alocações de material da tarefa e os
   * `effortdone`/`effortleft` do cenário de tracking (extensão 18.17.8).
   *
   * Mesmo formato do esqueleto do `TimeSheetReport`, então o que o gerente
   * descomenta volta pelo parser do status sheet.
   */
  private materialLines(task: Task,): string {
    const scenarioIdx = ((this.a("scenarios",) as number[]) ?? [0,])[0] ?? 0;
    const allocations =
      (task.getForScenario("materialallocations", scenarioIdx,) ??
        []) as MaterialAllocation[];
    // O realizado vive no cenário de tracking: é ele que a planilha mostra.
    const trackIdx = (this.project.get("trackingScenarioIdx",) as
      | number
      | null) ?? scenarioIdx;

    const materials = new Set<Material>(allocations.map((a,) => a.material),);
    let out = "";
    for (const material of materials) {
      const done = Number(
        material.getForScenario("effortdone", trackIdx,) ?? 0,
      );
      const left = Number(
        material.getForScenario("effortleft", trackIdx,) ?? 0,
      );
      out += `    # material ${material.fullId} {\n`;
      if (done !== 0) out += `    #   work ${rubyFloat(done,)}\n`;
      if (left !== 0) out += `    #   remaining ${rubyFloat(left,)}\n`;
      out += "    # }\n";
    }
    return out;
  }

  /** `task['responsible', scenarioIdx]`, tolerando `null`. */
  private responsibleOf(
    task: Task,
    scenarioIdx: number,
  ): Resource[] {
    return (task.getForScenario("responsible", scenarioIdx,) as Resource[]) ??
      [];
  }
}

/**
 * Indenta um bloco multi-linha com `' '.repeat(indent) + '#   '`,
 * reaplicando o prefixo após cada quebra (Ruby `indentBlock`, l.214-228).
 * Garante uma quebra final.
 */
export function indentBlock(indent: number, text: string,): string {
  const indentation = " ".repeat(indent,) + "#   ";
  let buffer = indentation;
  let out = "";
  for (const char of text) {
    if (buffer.length > 0) {
      out += buffer;
      buffer = "";
    }
    out += char;
    if (char === "\n") buffer = indentation;
  }
  if (!out.endsWith("\n",)) out += "\n";
  return out;
}

/** Comparação de `TjTime | null` (Ruby `==`). */
function sameTime(a: TjTime | null, b: TjTime | null,): boolean {
  if (a === null || b === null) return a === b;
  return a.equals(b,);
}

/** `Float#to_s` do Ruby: inteiros ganham `.0` (`20.0`, não `20`). */
function rubyFloat(value: number,): string {
  return Number.isInteger(value,) ? `${value}.0` : String(value,);
}

// Registra o conteúdo de `statussheet` na fábrica (14.11).
registerContentFactory(
  "statussheet",
  (report: unknown,): StatusSheetReport =>
    new StatusSheetReport(report as Report,),
);
