/**
 * ICalendar (Fase 14.19.1) — gerador mínimo de iCalendar (RFC 5545).
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/ICalendar.rb` apenas no
 * subconjunto usado pelo `ICalReport`: `VTODO`, `VEVENT`, `VJOURNAL`. O
 * `ICalendar` **completo** (com `XElement` rico, timezone, repeat rules, etc.)
 * é Fase 17.
 *
 * Formato de string puro: as classes produzem a saída final com CRLF e
 * `foldLines` conforme RFC.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.19.1)
 */
import { TjTime, } from "../time/tj-time.ts";
import { AppConfig, } from "../app-config.ts";

/** Máximo de bytes por linha (sem contar o CRLF), conforme RFC 5545. */
const LINELENGTH = 75;

/** Utilitário: par `[name, email]` para ORGANIZER/ATTENDEE. */
export class Person {
  constructor(public name: string, public email: string,) {}
}

/** Aplica o `quoted` de Ruby: escapa `; , " \` e converte quebras em `\n`. */
function quoted(str: string,): string {
  return str
    .replace(/([;,"\\])/g, "\\$1",)
    .replace(/\n/g, "\\n",);
}

/** Byte-length UTF-8 de um code point. */
function utf8ByteLen(cp: number,): number {
  if (cp <= 0x7f) return 1;
  if (cp <= 0x7ff) return 2;
  if (cp <= 0xffff) return 3;
  return 4;
}

/** Divide em linhas preservando o `\n` ao final de cada uma. */
function eachLine(str: string,): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of str) {
    cur += ch;
    if (ch === "\n") {
      lines.push(cur,);
      cur = "";
    }
  }
  if (cur !== "") lines.push(cur,);
  return lines;
}

/** Componente base (VTODO/VEVENT/VJOURNAL). */
export class Component {
  readonly uid: string;
  protected readonly ical: ICalendar;
  protected readonly type: string;
  protected readonly summary: string;
  protected readonly startDate: TjTime;

  description: string | null = null;
  relatedTo: string | null = null;
  organizer: Person | null = null;
  attendees: Person[] = [];

  constructor(
    ical: ICalendar,
    uid: string,
    type: string,
    summary: string,
    startDate: TjTime,
  ) {
    this.ical = ical;
    this.type = type.toUpperCase();
    this.uid = `${uid}-${this.type}`;
    this.summary = summary;
    this.startDate = startDate;
  }

  setOrganizer(name: string, email: string,): void {
    this.organizer = new Person(name, email,);
  }

  addAttendee(name: string, email: string,): void {
    this.attendees.push(new Person(name, email,),);
  }

  /** Serialização do componente; `extra` é o bloco específico do subtipo. */
  to_s(extra = "",): string {
    let str = `BEGIN:V${this.type}\n` +
      `DTSTAMP:${this.dateTime(TjTime.now(),)}\n` +
      `CREATED:${this.dateTime(this.ical.creationDate,)}\n` +
      `UID:${this.uid}\n` +
      `LAST-MODIFIED:${this.dateTime(this.ical.lastModified,)}\n` +
      `SUMMARY:${quoted(this.summary,)}\n` +
      `DTSTART:${this.dateTime(this.startDate,)}\n`;
    if (this.description) {
      str += `DESCRIPTION:${quoted(this.description,)}\n`;
    }
    if (this.relatedTo) str += `RELATED-TO:${this.relatedTo}\n`;
    if (this.organizer) {
      str += `ORGANIZER;CN=${this.organizer.name}:mailto:` +
        `${this.organizer.email}\n`;
    }
    for (const a of this.attendees) {
      str += `ATTENDEE;CN=${a.name}:mailto:${a.email}\n`;
    }
    str += extra;
    str += `END:V${this.type}\n\n`;
    return str;
  }

  protected dateTime(date: TjTime,): string {
    return this.ical.dateTime(date,);
  }
}

/** VTODO: tarefa com DUE/COMPLETED e PERCENT-COMPLETE. */
export class Todo extends Component {
  priority = 0;
  percentComplete = -1;
  private readonly endDate: TjTime;

  constructor(
    ical: ICalendar,
    uid: string,
    summary: string,
    startDate: TjTime,
    endDate: TjTime,
  ) {
    super(ical, uid, "TODO", summary, startDate,);
    ical.addTodo(this,);
    this.endDate = endDate;
  }

  override to_s(): string {
    let extra = "";
    if (this.percentComplete < 100.0) {
      extra += `DUE:${this.dateTime(this.endDate,)}\n`;
    } else {
      extra += `COMPLETED:${this.dateTime(this.endDate,)}\n`;
    }
    extra += `PERCENT-COMPLETE:${this.percentComplete}\n`;
    return super.to_s(extra,);
  }
}

/** VEVENT: tarefa-folha não-milestone. */
export class Event extends Component {
  priority = 1;
  private readonly endDate: TjTime;

  constructor(
    ical: ICalendar,
    uid: string,
    summary: string,
    startDate: TjTime,
    endDate: TjTime,
  ) {
    super(ical, uid, "EVENT", summary, startDate,);
    ical.addEvent(this,);
    this.endDate = endDate;
  }

  override to_s(): string {
    const extra = `PRIORITY:${this.priority}\n` +
      `DTEND:${this.dateTime(this.endDate,)}\n` +
      "TRANSP:TRANSPARENT\n";
    return super.to_s(extra,);
  }
}

/** VJOURNAL: entradas de journal de uma tarefa. */
export class Journal extends Component {
  constructor(
    ical: ICalendar,
    uid: string,
    summary: string,
    startDate: TjTime,
  ) {
    super(ical, uid, "JOURNAL", summary, startDate,);
    ical.addJournal(this,);
  }
}

/** Documento iCalendar: agrega os componentes e serializa com fold+CRLF. */
export class ICalendar {
  readonly uid: string;
  creationDate: TjTime;
  lastModified: TjTime;

  private todos: Todo[] = [];
  private events: Event[] = [];
  private journals: Journal[] = [];

  constructor(uid: string,) {
    this.uid = `${AppConfig.packageName}-${uid}`;
    this.creationDate = TjTime.now();
    this.lastModified = TjTime.now();
  }

  addTodo(todo: Todo,): void {
    this.todos.push(todo,);
  }
  addEvent(event: Event,): void {
    this.events.push(event,);
  }
  addJournal(journal: Journal,): void {
    this.journals.push(journal,);
  }

  dateTime(date: TjTime,): string {
    return date.to_s("%Y%m%dT%H%M%SZ", "UTC",);
  }

  to_s(): string {
    let str = "BEGIN:VCALENDAR\n" +
      `PRODID:-//The ${AppConfig.softwareName} Project/NONSGML ` +
      `${AppConfig.softwareName} ${AppConfig.version}//EN\n` +
      "VERSION:2.0\n\n";
    for (const todo of this.todos) str += todo.to_s();
    for (const event of this.events) str += event.to_s();
    for (const journal of this.journals) str += journal.to_s();
    str += "END:VCALENDAR\n";
    return foldLines(str,);
  }
}

/**
 * Dobra linhas com > LINELENGTH bytes (RFC 5545 §3.1) e converte finais de
 * linha para CRLF. Fiél a `ICalendar#foldLines`.
 */
export function foldLines(str: string,): string {
  let newStr = "";
  for (const line of eachLine(str,)) {
    let bytes = 0;
    for (const ch of line) {
      const cp = ch.codePointAt(0,) ?? 0;
      const cBytes = utf8ByteLen(cp,);
      if (bytes + cBytes > LINELENGTH && ch !== "\n") {
        newStr += "\n ";
        bytes = 0;
      } else {
        bytes += cBytes;
      }
      newStr += ch;
    }
  }
  return newStr.replace(/\n/g, "\r\n",);
}
