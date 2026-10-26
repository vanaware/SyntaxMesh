/**
 * Leave, LeaveList, LeaveAllowance e LeaveAllowanceList.
 * Port de LeaveList.rb.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LeaveList.rb
 */
import { TjTime, } from "../time/tj-time.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { ScoreboardInterval, } from "../time/scoreboard-interval.ts";

/**
 * Tipos de licença suportados com sua prioridade (ordem importa: um tipo de
 * índice maior sobrepõe-se ao anterior no mesmo período).
 */
export const LeaveTypes: Record<string, number> = {
  project: 1,
  annual: 2,
  special: 3,
  sick: 4,
  unpaid: 5,
  holiday: 6,
  unemployed: 7,
};

/** Uma ausência (férias, licença, feriado...) em um intervalo. */
export class Leave {
  readonly type: string;
  readonly interval: TimeInterval | ScoreboardInterval;
  readonly reason: string | null;

  constructor(
    type: string,
    interval: TimeInterval | ScoreboardInterval,
    reason: string | null = null,
  ) {
    if (!LeaveTypes[type]) {
      throw new Error(`Unsupported leave type ${type}`,);
    }
    this.type = type;
    this.interval = interval;
    this.reason = reason;
  }

  get typeIdx(): number {
    return LeaveTypes[this.type]!;
  }

  toString(): string {
    return `${this.type} ${this.reason ? `"${this.reason}"` : ""} ` +
      `${this.interval}`;
  }
}

/** Lista de Leaves (Ruby: subclass de Array). */
export class LeaveList extends Array<Leave> {}

/** Provisão anual de licenças, em slots (horas) — pode ser negativa. */
export class LeaveAllowance {
  constructor(
    readonly type: string,
    readonly date: TjTime,
    readonly slots: number,
  ) {
    if (!LeaveTypes[type]) {
      throw new Error(`Unsupported leave type ${type}`,);
    }
  }
}

/** Lista de LeaveAllowance com cálculo de saldo por período. */
export class LeaveAllowanceList extends Array<LeaveAllowance> {
  /** Soma dos slots do tipo _type_ entre _startDate_ e _endDate_. */
  balance(
    type: string,
    startDate: TjTime,
    endDate: TjTime,
  ): number {
    if (!LeaveTypes[type]) {
      throw new Error(`Unsupported leave type ${type}`,);
    }
    let balance = 0.0;
    for (const al of this) {
      if (
        al.type === type && al.date.compareTo(startDate,) >= 0 &&
        al.date.compareTo(endDate,) < 0
      ) {
        balance += al.slots;
      }
    }
    return balance;
  }
}
