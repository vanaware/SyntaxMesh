/**
 * 17.6 — `Todo`, `Event`, `Journal`.
 *
 * Strings conferidas contra o Ruby real. O `DTSTAMP` é a hora de serialização
 * e por isso é filtrado nas comparações literais.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:97-174
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.6)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";

import { TjTime, } from "../../src/time/tj-time.ts";
import { Event, } from "../../src/ical/event.ts";
import { ICalendar, } from "../../src/ical/i-calendar.ts";
import { Journal, } from "../../src/ical/journal.ts";
import { Todo, } from "../../src/ical/todo.ts";

const START = TjTime.fromSeconds(1767283200,); // 2026-01-01T16:00:00Z
const END = TjTime.fromSeconds(1767369600,); // 2026-01-02T16:00:00Z

function doc(): ICalendar {
  const ical = new ICalendar("p",);
  ical.creationDate = TjTime.fromSeconds(1767312240,);
  ical.lastModified = ical.creationDate;
  return ical;
}

/** Corpo do componente sem as linhas DTSTAMP. */
function corpo(s: string,): string {
  return s.split("\n",)
    .filter((l,) => !l.startsWith("DTSTAMP:",))
    .join("\n",);
}

describe("Todo (17.6.1)", () => {
  it("defaults: priority 0 e percentComplete -1", () => {
    const t = new Todo(doc(), "u", "s", START, END,);
    assertEquals(t.priority, 0,);
    assertEquals(t.percentComplete, -1,);
  });

  it("se auto-registra no documento", () => {
    const ical = doc();
    new Todo(ical, "u", "s", START, END,);
    assert(ical.to_s().includes("BEGIN:VTODO",),);
  });

  it("serializa o corpo padrão com DUE e PERCENT-COMPLETE:-1", () => {
    const t = new Todo(doc(), "u", "s", START, END,);
    assertEquals(
      corpo(t.to_s(),),
      "BEGIN:VTODO\n" +
        "CREATED:20260102T000400Z\n" +
        "UID:u-TODO\n" +
        "LAST-MODIFIED:20260102T000400Z\n" +
        "SUMMARY:s\n" +
        "DTSTART:20260101T160000Z\n" +
        "DUE:20260102T160000Z\n" +
        "PERCENT-COMPLETE:-1\n" +
        "END:VTODO\n\n",
    );
  });

  it("percentComplete 50 mantém DUE", () => {
    const t = new Todo(doc(), "u", "s", START, END,);
    t.percentComplete = 50;
    const s = t.to_s();
    assert(s.includes("DUE:20260102T160000Z\nPERCENT-COMPLETE:50\n",), s,);
    assert(!s.includes("COMPLETED",), s,);
  });

  it("percentComplete 99.9 ainda é DUE (`< 100.0`)", () => {
    const t = new Todo(doc(), "u", "s", START, END,);
    t.percentComplete = 99.9;
    assert(t.to_s().includes("DUE:",),);
  });

  it("percentComplete 100 troca DUE por COMPLETED", () => {
    const t = new Todo(doc(), "u", "s", START, END,);
    t.percentComplete = 100;
    const s = t.to_s();
    assert(
      s.includes("COMPLETED:20260102T160000Z\nPERCENT-COMPLETE:100\n",),
      s,
    );
    assert(!s.includes("DUE:",), s,);
  });

  it("description + organizer + attendees antes do DUE", () => {
    const t = new Todo(doc(), "u", 'Resumo; com "virgulas"', START, END,);
    t.description = "linha1\nlinha2";
    t.setOrganizer("Ana Silva", "ana@example.com",);
    t.addAttendee("Bob", "bob@example.com",);
    const s = t.to_s();
    assert(
      s.includes(
        'SUMMARY:Resumo\\; com \\"virgulas\\"\n' +
          "DTSTART:20260101T160000Z\n" +
          "DESCRIPTION:linha1\\nlinha2\n" +
          "ORGANIZER;CN=Ana Silva:mailto:ana@example.com\n" +
          "ATTENDEE;CN=Bob:mailto:bob@example.com\n" +
          "DUE:20260102T160000Z\n",
      ),
      s,
    );
  });
});

describe("Event (17.6.2)", () => {
  it("priority default 1 (diferente do Todo)", () => {
    assertEquals(new Event(doc(), "u", "s", START, END,).priority, 1,);
  });

  it("se auto-registra no documento", () => {
    const ical = doc();
    new Event(ical, "u", "s", START, END,);
    assert(ical.to_s().includes("BEGIN:VEVENT",),);
  });

  it("acrescenta PRIORITY, DTEND e TRANSP:TRANSPARENT", () => {
    const e = new Event(doc(), "u", "Milestone", START, END,);
    assertEquals(
      corpo(e.to_s(),),
      "BEGIN:VEVENT\n" +
        "CREATED:20260102T000400Z\n" +
        "UID:u-EVENT\n" +
        "LAST-MODIFIED:20260102T000400Z\n" +
        "SUMMARY:Milestone\n" +
        "DTSTART:20260101T160000Z\n" +
        "PRIORITY:1\n" +
        "DTEND:20260102T160000Z\n" +
        "TRANSP:TRANSPARENT\n" +
        "END:VEVENT\n\n",
    );
  });

  it("respeita a priority alterada", () => {
    const e = new Event(doc(), "u", "s", START, END,);
    e.priority = 5;
    assert(e.to_s().includes("PRIORITY:5\n",),);
  });

  it("não emite DUE nem PERCENT-COMPLETE", () => {
    const s = new Event(doc(), "u", "s", START, END,).to_s();
    assert(!s.includes("DUE:",), s,);
    assert(!s.includes("PERCENT-COMPLETE",), s,);
  });
});

describe("Journal (17.6.3)", () => {
  it("só leva os campos obrigatórios (sem endDate)", () => {
    const j = new Journal(doc(), "u", "Diario", START,);
    assertEquals(
      corpo(j.to_s(),),
      "BEGIN:VJOURNAL\n" +
        "CREATED:20260102T000400Z\n" +
        "UID:u-JOURNAL\n" +
        "LAST-MODIFIED:20260102T000400Z\n" +
        "SUMMARY:Diario\n" +
        "DTSTART:20260101T160000Z\n" +
        "END:VJOURNAL\n\n",
    );
  });

  it("se auto-registra no documento", () => {
    const ical = doc();
    new Journal(ical, "u", "s", START,);
    assert(ical.to_s().includes("BEGIN:VJOURNAL",),);
  });

  it("aceita description e relatedTo herdados do Component", () => {
    const j = new Journal(doc(), "u", "s", START,);
    j.description = "nota";
    j.relatedTo = "other-JOURNAL";
    const s = j.to_s();
    assert(
      s.includes(
        "DTSTART:20260101T160000Z\nDESCRIPTION:nota\n" +
          "RELATED-TO:other-JOURNAL\nEND:VJOURNAL",
      ),
      s,
    );
  });
});
