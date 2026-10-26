/**
 * TimeSheet / TimeSheetRecord — valor mínimo (Fase 10).
 *
 * O parser (subfase 10.14.1) constrói essas estruturas ao processar blocos
 * `timesheet`. A conversão em bookings, a verificação de deltas e a
 * projeção pertencem à Fase 18 (TimeSheets.rb); aqui guardamos apenas os
 * campos que o parser preenche, para que o parse seja fiel e verificável.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TimeSheet.rb
 * @see docs/taskjuggler/lib/taskjuggler/TimeSheetRecord.rb
 */
import type { TjTime, } from "../time/tj-time.ts";
import type { TimeInterval, } from "../time/time-interval.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { JournalEntry, } from "../model/journal.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";

export class TimeSheetRecord {
  readonly timeSheet: TimeSheet;
  readonly property: PropertyTreeNode | null;
  name: string | null = null;
  sourceFileInfo: SourceFileInfo | null = null;
  expectedEnd: TjTime | null = null;
  priority: number | null = null;
  remaining: unknown = null;
  work: unknown = null;
  status: JournalEntry | null = null;

  constructor(timeSheet: TimeSheet, property: PropertyTreeNode | null,) {
    this.timeSheet = timeSheet;
    this.property = property;
    // Ruby: `(@timeSheet = timeSheet) << self` (TimeSheets.rb l.35) — o
    // registro entra na folha já no construtor, com checagem de duplicata.
    timeSheet.appendRecord(this,);
  }

  /** Ruby TimeSheetRecord#taskId (TimeSheets.rb l.190-192). */
  get taskId(): string | null {
    return this.property ? this.property.fullId : null;
  }
}

export class TimeSheet {
  readonly resource: PropertyTreeNode;
  readonly interval: TimeInterval;
  readonly scenarioIdx: number;
  sourceFileInfo: SourceFileInfo | null = null;
  readonly records: TimeSheetRecord[] = [];
  shiftAssignment: unknown = null;

  constructor(
    resource: PropertyTreeNode,
    interval: TimeInterval,
    scenarioIdx: number,
  ) {
    this.resource = resource;
    this.interval = interval;
    this.scenarioIdx = scenarioIdx;
  }

  /**
   * Ruby `TimeSheet#<<(record)` (TimeSheets.rb l.265-274): rejeita
   * registros duplicados para a mesma tarefa.
   */
  appendRecord(record: TimeSheetRecord,): void {
    for (const r of this.records) {
      if (r.property === record.property) {
        // Ruby error(): sfi = @sourceFileInfo, data = @resource.
        MessageHandlerInstance.instance.error(
          "ts_duplicate_task",
          `Duplicate records for task ${r.taskId}`,
          this.sourceFileInfo,
          null,
          this.resource,
          null,
        );
      }
    }
    this.records.push(record,);
  }
}
