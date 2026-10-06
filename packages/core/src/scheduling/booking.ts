import { ScoreboardInterval, } from "../time/scoreboard-interval.ts";
import { Resource, } from "../model/resource.ts";
import { Task, } from "../model/task.ts";
import { type SourceFileInfo, } from "../model/property-tree-node.ts";

/**
 * Tipo para o atributo `overtime` de um Booking.
 *
 * Corresponde ao Ruby `Booking#overtime`, que é um número inteiro (padrão 0).
 */
export type Overtime = number;

/**
 * Tipo para o atributo `sloppy` de um Booking.
 *
 * Corresponde ao Ruby `Booking#sloppy`, que é um número inteiro (padrão 0).
 */
export type Sloppy = number;

/**
 * Representa uma alocação de um recurso a uma tarefa em um ou mais intervalos
 * de tempo.
 *
 * Cada `Booking` associa um recurso a uma tarefa e armazena os intervalos de
 * tempo nos quais a alocação ocorre. Os atributos `overtime` e `sloppy`
 * controlam se o esforço alocado conta como hora extra e se a alocação pode
 * ser deslocada, respectivamente.
 *
 * Fonte Ruby: `docs/taskjuggler/lib/taskjuggler/Booking.rb`
 */
export class Booking {
  readonly resource: Resource;
  readonly task: Task;
  readonly intervals: ScoreboardInterval[];
  sourceFileInfo: SourceFileInfo | null;
  overtime: Overtime;
  sloppy: Sloppy;

  constructor(
    resource: Resource,
    task: Task,
    intervals: ScoreboardInterval[],
  ) {
    this.resource = resource;
    this.task = task;
    this.intervals = intervals;
    this.sourceFileInfo = null;
    this.overtime = 0;
    this.sloppy = 0;
  }

  /**
   * Retorna uma representação em texto da alocação.
   *
   * Exemplo: `r1 2024-01-01 - 2024-01-02, 2024-01-03 - 2024-01-04`
   */
  to_s(): string {
    let out = `${this.resource.fullId} `;
    let first = true;
    for (const iv of this.intervals) {
      if (!first) {
        out += ", ";
      }
      first = false;
      out += iv.to_s();
    }
    return out;
  }

  /**
   * Retorna uma representação no formato TJP (TaskJuggler Project).
   *
   * @param taskMode — se true, usa o ID da tarefa; caso contrário, o ID do recurso.
   */
  to_tjp(taskMode: boolean,): string {
    let out = taskMode ? `${this.task.fullId} ` : `${this.resource.fullId} `;
    let first = true;
    for (const iv of this.intervals) {
      if (!first) {
        out += ",\n";
      }
      first = false;
      out += `${iv.start} + ${iv.duration() / 3600}h`;
    }
    out += " { overtime 2 }";
    return out;
  }
}
