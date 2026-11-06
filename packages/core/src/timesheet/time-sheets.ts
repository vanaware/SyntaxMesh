/**
 * TimeSheets — todas as folhas de ponto de um projeto.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/TimeSheets.rb` — classe
 * `TimeSheets < Array` (l.389-403).
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets.md (18.3)
 */
import type { TimeSheet, } from "./time-sheet.ts";

export class TimeSheets extends Array<TimeSheet> {
  /**
   * Alias de coleção mantido do stub da Fase 9 (`project.timeSheets.sheets`).
   * Em Ruby a própria instância **é** o Array; aqui expomos os dois acessos.
   */
  get sheets(): TimeSheet[] {
    return this;
  }

  /**
   * Descarta as folhas carregadas (Ruby `Array#clear`), usado pelo
   * `TaskJuggler#checkTimeSheet` para não reusar dados de folhas antigas.
   */
  clear(): void {
    this.length = 0;
  }

  /** Ruby `TimeSheets#check`: checa cada folha. */
  check(): void {
    for (const sheet of this) {
      sheet.check();
    }
  }

  /** Ruby `TimeSheets#warnOnDelta`: compara cada folha com o plano. */
  warnOnDelta(): void {
    for (const sheet of this) {
      sheet.warnOnDelta();
    }
  }
}
