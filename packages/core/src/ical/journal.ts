/**
 * Journal — port de `ICalendar::Journal` (Fase 17.6).
 *
 * É o componente mais simples: não acrescenta nada ao corpo do `Component`.
 * No Ruby `def to_s; super; end` — sem bloco, então o `yield` do pai é
 * ignorado e só saem os campos obrigatórios.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:163-174
 */

import { TjTime, } from "../time/tj-time.ts";
import { Component, } from "./component.ts";
import type { ICalendar, } from "./i-calendar.ts";

export class Journal extends Component {
  constructor(
    ical: ICalendar,
    uid: string,
    summary: string,
    startDate: TjTime,
  ) {
    super(ical, uid, summary, startDate,);
    ical.addJournal(this,);
  }
}
