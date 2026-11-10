/**
 * Component — port of `ICalendar::Component` (Phase 17.5).
 *
 * Base class of every VTODO/VEVENT/VJOURNAL component. `to_s` emits the
 * mandatory fields in the exact Ruby order and then **hands the word** to the
 * subclass (`str += yield if block_given?`) before the `END:` — in TypeScript
 * Ruby's `yield` becomes an optional callback.
 *
 * Fidelities checked against Ruby:
 *   - `@type` comes from the **class name** (`self.class.to_s.split('::').last
 *     .upcase`): `Todo` → `TODO`, hence `BEGIN:VTODO`. Here we use
 *     `this.constructor.name`, which is only safe because the build runs with
 *     `minify: false` + `keepNames: true` (scripts/esbuild.jsonc).
 *   - `@uid = uid + "-#{@type}"` — the suffix is the upper-cased type.
 *   - `DTSTAMP` is the **serialization time**, not the document's
 *     (`TjTime.new.utc` in Ruby), which makes the output non-deterministic by
 *     nature — the tests compare by prefix/suffix, never the DTSTAMP.
 *   - We do **not** call `.utc()` here nor in `creationDate`/`lastModified`.
 *     In Ruby `TjTime#utc` preserves the instant (`Time#gmtime` only changes the
 *     rendering zone) and the document's `dateTime` already formats with
 *     `'UTC'`, so `.utc` is redundant. In our port `TjTime.utc()` **shifts** the
 *     epoch to simulate the zone; combining it with `to_s(fmt, 'UTC')` would
 *     shift twice. Keeping the instant and formatting in UTC gives the same
 *     result as Ruby.
 *   - `DESCRIPTION` and `RELATED-TO` are emitted when the value **is not null**:
 *     in Ruby the empty string is *truthy*, so `description = ''` prints the
 *     empty line. The port preserves that with `!== null`.
 *   - `quoted` escapes `;` `,` `"` `\` with a backslash and replaces real
 *     newlines with the literal `\n` (RFC 5545 §3.3.11).
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:32-94
 */

import { TjTime, } from "../time/tj-time.ts";
import type { ICalendar, } from "./i-calendar.ts";
import { Person, } from "./person.ts";

/** Callback that reproduces Ruby's `yield` inside `Component#to_s`. */
export type ComponentBlock = () => string;

/** Optional field in the style of Ruby's `attr_accessor` (accepts empty string). */
export type OptionalText = string | null;

/**
 * Base class of the iCalendar components (VTODO, VEVENT, VJOURNAL).
 *
 * Subclasses only contribute the extra properties of their kind; every shared
 * field and the mandatory RFC 5545 lines are emitted here.
 */
export abstract class Component {
  /** `attr_accessor :description` */
  description: OptionalText = null;
  /** `attr_accessor :relatedTo` */
  relatedTo: OptionalText = null;
  /** `attr_accessor :organizer` */
  organizer: Person | null = null;
  /** `attr_reader :uid` — already carrying the type suffix. */
  readonly uid: string;

  /** Document that owns this component. */
  protected readonly ical: ICalendar;
  /** Component type in upper case (`TODO`, `EVENT`, `JOURNAL`). */
  protected readonly type: string;
  /** Summary line of the component. */
  protected readonly summary: string;
  /** Start instant (`DTSTART`). */
  protected readonly startDate: TjTime;
  /** `@attendees = []` */
  protected readonly attendees: Person[] = [];

  /**
   * Creates a component and registers its UID.
   *
   * @param ical Document that owns the component.
   * @param uid Base UID; the type suffix is appended.
   * @param summary Summary line of the component.
   * @param startDate Start instant of the component.
   */
  constructor(
    ical: ICalendar,
    uid: string,
    summary: string,
    startDate: TjTime,
  ) {
    this.ical = ical;
    // Ruby: self.class.to_s.split('::').last.upcase
    this.type = this.constructor.name.toUpperCase();
    this.uid = `${uid}-${this.type}`;
    this.summary = summary;
    this.startDate = startDate;
  }

  /** Ruby `setOrganizer(name, email)`. */
  setOrganizer(name: string, email: string,): void {
    this.organizer = new Person(name, email,);
  }

  /** Ruby `addAttendee(name, email)`. */
  addAttendee(name: string, email: string,): void {
    this.attendees.push(new Person(name, email,),);
  }

  /** Component serialization (`block` reproduces Ruby's `yield`). */
  to_s(block?: ComponentBlock,): string {
    const str = `BEGIN:V${this.type}\n` +
      `DTSTAMP:${this.dateTime(TjTime.now(),)}\n` +
      `CREATED:${this.dateTime(this.ical.creationDate,)}\n` +
      `UID:${this.uid}\n` +
      `LAST-MODIFIED:${this.dateTime(this.ical.lastModified,)}\n` +
      `SUMMARY:${quoted(this.summary,)}\n` +
      `DTSTART:${this.dateTime(this.startDate,)}\n`;

    let out = str;
    if (this.description !== null) {
      out += `DESCRIPTION:${quoted(this.description,)}\n`;
    }
    if (this.relatedTo !== null) out += `RELATED-TO:${this.relatedTo}\n`;

    if (this.organizer) {
      out += `ORGANIZER;CN=${this.organizer.name}:mailto:` +
        `${this.organizer.email}\n`;
    }
    for (const attendee of this.attendees) {
      out += `ATTENDEE;CN=${attendee.name}:mailto:${attendee.email}\n`;
    }

    if (block) out += block();

    out += `END:V${this.type}\n\n`;
    return out;
  }

  /** Ruby `dateTime(date)` — delegates formatting to the document. */
  protected dateTime(date: TjTime,): string {
    return this.ical.dateTime(date,);
  }
}

/** Ruby `Component#quoted`: RFC 5545 escaping of free text. */
export function quoted(str: string,): string {
  return str
    .replace(/([;,"\\])/g, "\\$1",)
    .replace(/\n/g, "\\n",);
}
