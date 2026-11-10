/**
 * ICalendar — port of `ICalendar.rb` (Phase 17.5), the RFC 5545 generator.
 *
 * Structure identical to Ruby: the document keeps three lists (todos, events,
 * journals), serializes the `BEGIN:VCALENDAR` / `PRODID` / `VERSION:2.0`
 * envelope, concatenates the components in the order todos → events → journals
 * and **folds** the result through `foldLines`, converting the line breaks to
 * CRLF.
 *
 * Fidelities checked against Ruby:
 *   - `@uid = "#{AppConfig.packageName}-#{uid}"` — the prefix comes from the
 *     package.
 *   - `@creationDate = @lastModified = TjTime.new.utc` — **a single** instance
 *     shared by both fields (not two `now()` calls). Ruby's `.utc` is redundant
 *     here (`dateTime` already formats in UTC) and is not replicated — see the
 *     note in `component.ts` about the port's `TjTime.utc()`.
 *   - `dateTime` formats in UTC with `%Y%m%dT%H%M%SZ`.
 *   - `foldLines` counts **octets** (UTF-8 bytes), not characters, and keeps
 *     the original behaviour of restarting the count at 0 on a fold without
 *     adding the bytes of the character that caused the fold (Category C:
 *     replicated because that is how `tj3` writes the real files).
 *   - Ruby's `END:VCALENDAR` ends with `"\n"`, which `foldLines` converts to
 *     `"\r\n"` — the last line of the file is CRLF.
 *
 * Organizational divergence: `foldLines` is `private` in Ruby and here it is an
 * exported module function, so it can be tested directly (17.5.4.3-8).
 * `ICalendar#to_s` remains the only internal caller.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb
 * @see docs/syntaxmesh/decisoes/038-substituicao-xml.md
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.5)
 */

import { AppConfig, } from "../app-config.ts";
import { TjTime, } from "../time/tj-time.ts";
import { eachUtf8Char, } from "../utils/utf8.ts";
import type { Event, } from "./event.ts";
import type { Journal, } from "./journal.ts";
import type { Todo, } from "./todo.ts";

/** Maximum number of octets per content line, not counting the line ending. */
const LINE_LENGTH = 75;

/** UTF-8 bytes of a code point (Ruby `String#bytesize` of one character). */
function utf8ByteLen(cp: number,): number {
  if (cp <= 0x7f) return 1;
  if (cp <= 0x7ff) return 2;
  if (cp <= 0xffff) return 3;
  return 4;
}

/** Ruby `String#each_line`: keeps the `\n` at the end of each line. */
function eachLine(str: string,): string[] {
  const lines: string[] = [];
  let cur = "";
  for (const ch of eachUtf8Char(str,)) {
    cur += ch;
    if (ch === "\n") {
      lines.push(cur,);
      cur = "";
    }
  }
  if (cur !== "") lines.push(cur,);
  return lines;
}

/**
 * Folds lines longer than `LINE_LENGTH` octets by inserting `\n` + space and
 * converts every line break to CRLF (RFC 5545 §3.1).
 *
 * @param str Unfolded iCalendar text.
 * @returns The folded text with CRLF line endings.
 */
export function foldLines(str: string,): string {
  let newStr = "";
  for (const line of eachLine(str,)) {
    let bytes = 0;
    for (const ch of eachUtf8Char(line,)) {
      const cBytes = utf8ByteLen(ch.codePointAt(0,) ?? 0,);
      if (bytes + cBytes > LINE_LENGTH && ch !== "\n") {
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

/**
 * iCalendar document: aggregator of the VTODO/VEVENT/VJOURNAL components.
 */
export class ICalendar {
  /** Ruby `LINELENGTH = 75` (class constant). */
  static readonly LINELENGTH: number = LINE_LENGTH;

  /** `attr_reader :uid` — already carrying the package prefix. */
  readonly uid: string;
  /** `attr_accessor :creationDate` */
  creationDate: TjTime;
  /** `attr_accessor :lastModified` */
  lastModified: TjTime;

  private todos: Todo[] = [];
  private events: Event[] = [];
  private journals: Journal[] = [];

  /**
   * Creates an empty calendar document.
   *
   * @param uid Base UID; the package name is prepended.
   */
  constructor(uid: string,) {
    this.uid = `${AppConfig.packageName}-${uid}`;
    // Ruby: @creationDate = @lastModified = TjTime.new.utc — the SAME instance.
    this.creationDate = this.lastModified = TjTime.now();
  }

  /** Ruby `addTodo(todo)` — internal use: whoever creates the `Todo` registers it. */
  addTodo(todo: Todo,): void {
    this.todos.push(todo,);
  }

  /** Ruby `addEvent(event)`. */
  addEvent(event: Event,): void {
    this.events.push(event,);
  }

  /** Ruby `addJournal(journal)`. */
  addJournal(journal: Journal,): void {
    this.journals.push(journal,);
  }

  /** Ruby `dateTime(date)` — UTC timestamp in the RFC 5545 basic format. */
  dateTime(date: TjTime,): string {
    return date.to_s("%Y%m%dT%H%M%SZ", "UTC",);
  }

  /** Serializes the whole document, with line folding and CRLF. */
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
