/**
 * Leave, LeaveList, LeaveAllowance e LeaveAllowanceList.
 *
 * Port de `docs/taskjuggler/lib/taskjuggler/LeaveList.rb` (arquivo completo).
 * A ordem de {@link LeaveTypes} é semântica: um tipo de índice maior
 * sobrepõe-se ao anterior no mesmo slot (é assim que o scoreboard de
 * `ResourceScenario` codifica a ausência).
 *
 * Divergências do Ruby (Category A/C — ver `cheat-sheet-ruby-ts.md` §12):
 * • `typeIdx` é **método** (`typeIdx()`), como no Ruby, e não getter;
 * • `LeaveAllowance#to_s` imprime `tipo data slots` (o `Struct#to_s` do Ruby
 *   devolve o `inspect` da struct, inútil para `to_tjp`);
 * • erros usam `Error` com a mesma mensagem do `ArgumentError` do Ruby.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LeaveList.rb
 * @see docs/syntaxmesh/decisoes/029-journal-alertlevel.md
 */

import { TjTime, } from "../time/tj-time.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { ScoreboardInterval, } from "../time/scoreboard-interval.ts";

/**
 * Tipos de licença suportados (`Leave::Types` do Ruby).
 *
 * A ordem importa: um tipo de índice maior sobrepõe-se ao anterior no mesmo
 * período.
 */
export const LeaveTypes = {
  project: 1,
  annual: 2,
  special: 3,
  sick: 4,
  unpaid: 5,
  holiday: 6,
  unemployed: 7,
} as const;

/** Nome de um tipo de licença (`:project`, `:annual`, … no Ruby). */
export type LeaveType = keyof typeof LeaveTypes;

/** Tipo aceito pelas APIs (string aberta na borda — parser/diretivas). */
export type LeaveTypeLike = LeaveType | (string & {});

/** `true` quando `type` é um tipo de licença conhecido. */
export function isLeaveType(type: string,): type is LeaveType {
  // `hasOwnProperty` e não `in`: `in` aceitaria "constructor"/"toString".
  return Object.prototype.hasOwnProperty.call(LeaveTypes, type,);
}

/** Intervalo aceito por uma ausência (data ou índice de slot). */
export type LeaveInterval = TimeInterval | ScoreboardInterval;

/** Uma ausência (férias, licença, feriado…) em um intervalo. */
export class Leave {
  /** Mesmos tipos do Ruby, expostos como constante da classe. */
  static readonly Types = LeaveTypes;

  readonly type: LeaveType;
  readonly interval: LeaveInterval;
  readonly reason: string | null;

  constructor(
    type: LeaveTypeLike,
    interval: LeaveInterval,
    reason: string | null = null,
  ) {
    if (!isLeaveType(type,)) {
      throw new Error(`Unsupported leave type ${String(type,)}`,);
    }
    this.type = type;
    this.interval = interval;
    this.reason = reason;
  }

  /** Índice do tipo (1–7), usado no bit-encoding do scoreboard. */
  typeIdx(): number {
    return LeaveTypes[this.type];
  }

  /**
   * Representação TJP (Ruby `Leave#to_s`): `tipo "motivo" intervalo`.
   *
   * A ausência de motivo mantém os dois espaços do Ruby
   * (`"#{type} #{reason ? … : ""} #{interval}"`).
   */
  to_s(): string {
    return `${this.type} ${this.reason ? `"${this.reason}"` : ""} ` +
      this.interval.to_s();
  }

  /** Alias idiomático de {@link to_s} (`join`/template string). */
  toString(): string {
    return this.to_s();
  }

  /**
   * Ausência é um objeto-valor imutável (16.13.1): a cópia devolve `this`,
   * como os demais tipos frozen do Ruby em `deep_copy.rb`.
   */
  deepClone(): this {
    return this;
  }
}

/** Lista de `Leave` (Ruby `LeaveList < Array`). */
export class LeaveList extends Array<Leave> {}

/** Provisão anual de licenças, em slots (horas) — pode ser negativa. */
export class LeaveAllowance {
  readonly type: LeaveType;
  readonly date: TjTime;
  readonly slots: number;

  constructor(type: LeaveTypeLike, date: TjTime, slots: number,) {
    if (!isLeaveType(type,)) {
      throw new Error(`Unsupported leave type ${String(type,)}`,);
    }
    this.type = type;
    this.date = date;
    this.slots = slots;
  }

  /**
   * Formato `tipo data slots`.
   *
   * O Ruby não define `to_s`: como `LeaveAllowance < Struct`, `to_s` devolve o
   * `inspect` da struct, que não serve para `to_tjp`. Este formato é o
   * consumido por {@link LeaveAllowanceList#to_tjp}.
   */
  to_s(): string {
    return `${this.type} ${this.date.to_s()} ${this.slots}`;
  }

  /** Alias idiomático de {@link to_s}. */
  toString(): string {
    return this.to_s();
  }

  /** Provisão é imutável: a cópia devolve `this` (16.13.1). */
  deepClone(): this {
    return this;
  }
}

/** Lista de `LeaveAllowance` com cálculo de saldo por período. */
export class LeaveAllowanceList extends Array<LeaveAllowance> {
  /**
   * Saldo do tipo `type` no intervalo `[startDate, endDate)` (Ruby
   * `LeaveAllowanceList#balance`). `slots` negativos subtraem (expiração).
   */
  balance(type: LeaveTypeLike, startDate: TjTime, endDate: TjTime,): number {
    if (!isLeaveType(type,)) {
      throw new Error(`Unsupported leave type ${String(type,)}`,);
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

  /** Uma provisão por linha (`leaveallowance <tipo> <data> <slots>`). */
  to_tjp(): string {
    return this.map((al,) => al.to_s()).join(",\n",);
  }
}
