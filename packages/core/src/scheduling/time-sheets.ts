/**
 * TimeSheets — gerenciamento de folhas de ponto (Fase 18).
 *
 * Stub para Fase 9. O `Project` precisa de um `TimeSheets` instance,
 * mas a implementação completa vem na Fase 18.
 *
 * @see docs/taskjuggler/lib/taskjuggler/TimeSheets.rb
 */
export class TimeSheets {
  readonly sheets: import("./time-sheet.ts").TimeSheet[] = [];

  /** Adiciona uma folha de ponto (Ruby `@project.timeSheets << ts`). */
  push(sheet: import("./time-sheet.ts").TimeSheet,): void {
    this.sheets.push(sheet,);
  }

  warnOnDelta(): void {
    // Fase 18: implementação real
  }

  check(): void {
    // Stub para Fase 9. A implementação completa vem na Fase 18.
  }
}
