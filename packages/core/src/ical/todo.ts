/**
 * Todo — port de `ICalendar::Todo` (Fase 17.6).
 *
 * O construtor **se auto-registra** no documento (`@ical.addTodo(self)`), como
 * no Ruby — quem cria o `Todo` nunca precisa chamá-lo no `ICalendar`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:97-130
 */

import { TjTime, } from "../time/tj-time.ts";
import { Component, } from "./component.ts";
import type { ICalendar, } from "./i-calendar.ts";

export class Todo extends Component {
  /** `attr_accessor :priority` — valor 0-9, default 0. */
  priority = 0;
  /** `attr_accessor :percentComplete` — default -1 (desconhecido). */
  percentComplete = -1;
  private readonly endDate: TjTime;

  constructor(
    ical: ICalendar,
    uid: string,
    summary: string,
    startDate: TjTime,
    endDate: TjTime,
  ) {
    super(ical, uid, summary, startDate,);
    ical.addTodo(this,);
    this.endDate = endDate;
  }

  /**
   * Ruby `to_s` com bloco: `< 100.0` dá `DUE`, `>= 100` dá `COMPLETED`, e
   * `PERCENT-COMPLETE` sai sempre (inclusive com o default `-1`).
   */
  override to_s(): string {
    return super.to_s(() => {
      let str = "";
      if (this.percentComplete < 100.0) {
        str += `DUE:${this.dateTime(this.endDate,)}\n`;
      } else {
        str += `COMPLETED:${this.dateTime(this.endDate,)}\n`;
      }
      str += `PERCENT-COMPLETE:${this.percentComplete}\n`;
      return str;
    },);
  }
}
