/**
 * Component — port de `ICalendar::Component` (Fase 17.5).
 *
 * Classe base de todo componente VTODO/VEVENT/VJOURNAL. O `to_s` emite os
 * campos obrigatórios na ordem exata do Ruby e depois **cede** a palavra à
 * subclasse (`str += yield if block_given?`) antes do `END:` — no TypeScript o
 * `yield` do Ruby vira um callback opcional.
 *
 * Fidelidades conferidas contra o Ruby:
 *   - `@type` vem do **nome da classe** (`self.class.to_s.split('::').last
 *     .upcase`): `Todo` → `TODO`, daí `BEGIN:VTODO`. Aqui usamos
 *     `this.constructor.name`, que só é seguro porque o build roda com
 *     `minify: false` + `keepNames: true` (scripts/esbuild.jsonc).
 *   - `@uid = uid + "-#{@type}"` — o sufixo é o tipo em maiúsculas.
 *   - `DTSTAMP` é a **hora da serialização**, não a do documento
 *     (`TjTime.new.utc` no Ruby), o que torna a saída não determinística por
 *     natureza — os testes comparam por prefixo/sufixo, nunca o DTSTAMP.
 *   - **Não** chamamos `.utc()` aqui nem em `creationDate`/`lastModified`.
 *     No Ruby `TjTime#utc` preserva o instante (`Time#gmtime` só troca a zona
 *     de renderização) e o `dateTime` do documento já formata com `'UTC'`, então
 *     o `.utc` é redundante. No nosso port `TjTime.utc()` **desloca** o epoch
 *     para simular a zona; combiná-lo com `to_s(fmt, 'UTC')` deslocaria duas
 *     vezes. Manter o instante e formatar em UTC dá o mesmo resultado do Ruby.
 *   - `DESCRIPTION` e `RELATED-TO` entram quando o valor **não é nulo**: em
 *     Ruby a string vazia é *truthy*, então `description = ''` imprime a
 *     linha vazia. O port preserva isso com `!== null`.
 *   - `quoted` escapa `;` `,` `"` `\` com contra-barra e troca newline real
 *     por `\n` literal (RFC 5545 §3.3.11).
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:32-94
 */

import { TjTime, } from "../time/tj-time.ts";
import type { ICalendar, } from "./i-calendar.ts";
import { Person, } from "./person.ts";

/** Callback que reproduz o `yield` do Ruby dentro de `Component#to_s`. */
export type ComponentBlock = () => string;

/** Campo opcional estilo `attr_accessor` do Ruby (aceita string vazia). */
export type OptionalText = string | null;

export abstract class Component {
  /** `attr_accessor :description` */
  description: OptionalText = null;
  /** `attr_accessor :relatedTo` */
  relatedTo: OptionalText = null;
  /** `attr_accessor :organizer` */
  organizer: Person | null = null;
  /** `attr_reader :uid` — já com o sufixo do tipo. */
  readonly uid: string;

  protected readonly ical: ICalendar;
  protected readonly type: string;
  protected readonly summary: string;
  protected readonly startDate: TjTime;
  /** `@attendees = []` */
  protected readonly attendees: Person[] = [];

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

  /** Serialização do componente (`block` reproduz o `yield` do Ruby). */
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

  /** Ruby `dateTime(date)` — delega a formatação ao documento. */
  protected dateTime(date: TjTime,): string {
    return this.ical.dateTime(date,);
  }
}

/** Ruby `Component#quoted`: escape RFC 5545 de texto livre. */
export function quoted(str: string,): string {
  return str
    .replace(/([;,"\\])/g, "\\$1",)
    .replace(/\n/g, "\\n",);
}
