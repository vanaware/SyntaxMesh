/**
 * Testes de ICalendar mínimo (Fase 14.19.1).
 *
 * Cobre `Person`, os componentes `Todo`/`Event`/`Journal`, o agregador
 * `ICalendar#to_s()` e o utilitário `foldLines` (RFC 5545 §3.1), incluindo a
 * conversão final para CRLF. As asserções usam `includes` em substrings
 * estruturais em vez de igualdade byte-a-byte porque DTSTAMP é função do
 * relógio do teste.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.19.1)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  Component,
  Event,
  foldLines,
  ICalendar,
  Journal,
  Person,
  Todo,
} from "../../src/reports/i-calendar.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { AppConfig, } from "../../src/app-config.ts";

const D1 = TjTime.fromString("2026-01-01",);
const D2 = TjTime.fromString("2026-01-02",);

describe("ICalendar mínimo (14.19.1)", () => {
  describe("Person (14.19.1.1)", () => {
    it("guarda nome e email", () => {
      const p = new Person("Alice", "alice@example.com",);
      assertEquals(p.name, "Alice",);
      assertEquals(p.email, "alice@example.com",);
    });
  });

  describe("Component base (14.19.1.2)", () => {
    it("UID é prefixado pelo type em maiúsculas", () => {
      const ical = new ICalendar("proj1",);
      const c = new Component(ical, "uid-x", "TODO", "Sum", D1,);
      assertEquals(c.uid, "uid-x-TODO",);
    });

    it("to_s emite BEGIN/END com SUMMARY e DTSTART", () => {
      const ical = new ICalendar("proj1",);
      ical.creationDate = D1;
      ical.lastModified = D2;
      const c = new Component(ical, "u", "FOO", "Sum", D1,);
      const s = c.to_s();
      assert(s.startsWith("BEGIN:VFOO\n",), s.slice(0, 40,),);
      assert(s.includes("\nUID:u-FOO\n",),);
      assert(s.includes("\nCREATED:20260101T000000Z\n",),);
      assert(s.includes("\nLAST-MODIFIED:20260102T000000Z\n",),);
      assert(s.includes("\nSUMMARY:Sum\n",),);
      assert(s.includes("\nDTSTART:20260101T000000Z\n",),);
      assert(s.endsWith("END:VFOO\n\n",),);
    });

    it("setOrganizer e addAttendee produzem linhas ORGANIZER/ATTENDEE", () => {
      const ical = new ICalendar("p",);
      const c = new Component(ical, "u", "X", "S", D1,);
      c.setOrganizer("Bob", "bob@ex.com",);
      c.addAttendee("Carol", "c@ex.com",);
      c.addAttendee("Dan", "d@ex.com",);
      const s = c.to_s();
      assert(s.includes("ORGANIZER;CN=Bob:mailto:bob@ex.com\n",), s,);
      assert(s.includes("ATTENDEE;CN=Carol:mailto:c@ex.com\n",),);
      assert(s.includes("ATTENDEE;CN=Dan:mailto:d@ex.com\n",),);
    });

    it('description sofre escaping `quoted` (`;`, `,`, `"`, `\\`)', () => {
      const ical = new ICalendar("p",);
      const c = new Component(ical, "u", "X", "S", D1,);
      c.description = 'a;b,c"d\\e';
      assert(c.to_s().includes('DESCRIPTION:a\\;b\\,c\\"d\\\\e\n',),);
    });

    it("description com nova linha vira `\\n` literal", () => {
      const ical = new ICalendar("p",);
      const c = new Component(ical, "u", "X", "S", D1,);
      c.description = "line1\nline2";
      assert(c.to_s().includes("DESCRIPTION:line1\\nline2\n",),);
    });

    it("relatedTo emite RELATED-TO", () => {
      const ical = new ICalendar("p",);
      const c = new Component(ical, "u", "X", "S", D1,);
      c.relatedTo = "another-uid";
      assert(c.to_s().includes("RELATED-TO:another-uid\n",),);
    });
  });

  describe("Todo (14.19.1.3)", () => {
    it("percentComplete < 100 emite DUE", () => {
      const ical = new ICalendar("p",);
      const t = new Todo(ical, "u", "S", D1, D2,);
      t.percentComplete = 50;
      const s = t.to_s();
      assert(s.includes("BEGIN:VTODO\n",),);
      assert(s.includes("DUE:20260102T000000Z\n",),);
      assert(!s.includes("COMPLETED:",),);
      assert(s.includes("PERCENT-COMPLETE:50\n",),);
    });

    it("percentComplete == 100 emite COMPLETED sem DUE", () => {
      const ical = new ICalendar("p",);
      const t = new Todo(ical, "u", "S", D1, D2,);
      t.percentComplete = 100;
      const s = t.to_s();
      assert(s.includes("COMPLETED:20260102T000000Z\n",),);
      assert(!s.includes("DUE:",),);
    });

    it("registrar-se no ICalendar via addTodo", () => {
      const ical = new ICalendar("p",);
      new Todo(ical, "u1", "S", D1, D2,);
      new Todo(ical, "u2", "S", D1, D2,);
      const str = ical.to_s();
      assertEquals(
        (str.match(/BEGIN:VTODO/g,) ?? []).length,
        2,
        "dois VTODO presentes",
      );
    });
  });

  describe("Event (14.19.1.4)", () => {
    it("emite PRIORITY/DTEND/TRANSP:TRANSPARENT", () => {
      const ical = new ICalendar("p",);
      const e = new Event(ical, "u", "S", D1, D2,);
      e.priority = 3;
      const s = e.to_s();
      assert(s.includes("BEGIN:VEVENT\n",),);
      assert(s.includes("PRIORITY:3\n",),);
      assert(s.includes("DTEND:20260102T000000Z\n",),);
      assert(s.includes("TRANSP:TRANSPARENT\n",),);
      assert(s.includes("END:VEVENT\n\n",),);
    });
  });

  describe("Journal (14.19.1.5)", () => {
    it("emite VJOURNAL sem campos extras de Todo/Event", () => {
      const ical = new ICalendar("p",);
      const j = new Journal(ical, "u", "Head", D1,);
      const s = j.to_s();
      assert(s.includes("BEGIN:VJOURNAL\n",),);
      assert(s.includes("END:VJOURNAL\n\n",),);
      assert(!s.includes("DTEND",),);
      assert(!s.includes("PERCENT-COMPLETE",),);
    });
  });

  describe("ICalendar agregador (14.19.1.6)", () => {
    it("prefixa o uid com AppConfig.packageName", () => {
      const ical = new ICalendar("myuid",);
      assertEquals(ical.uid, `${AppConfig.packageName}-myuid`,);
    });

    it("dateTime usa formato UTC compacto", () => {
      const ical = new ICalendar("p",);
      assertEquals(ical.dateTime(D1,), "20260101T000000Z",);
    });

    it("creationDate e lastModified default = agora (TjTime)", () => {
      const ical = new ICalendar("p",);
      assert(ical.creationDate instanceof TjTime,);
      assert(ical.lastModified instanceof TjTime,);
    });

    it("to_s de ICalendar vazio emite apenas envelope VCALENDAR", () => {
      const ical = new ICalendar("p",);
      const s = ical.to_s();
      assert(s.startsWith("BEGIN:VCALENDAR\r\n",), s.slice(0, 30,),);
      assert(s.includes(`PRODID:-//The ${AppConfig.softwareName} Project`,),);
      assert(s.includes("VERSION:2.0",),);
      assert(s.endsWith("END:VCALENDAR\r\n",),);
    });

    it("to_s com 1 todo contém VTODO e envelope (14.19.1.7)", () => {
      const ical = new ICalendar("p",);
      ical.creationDate = D1;
      ical.lastModified = D2;
      const t = new Todo(ical, "u", "MyTask", D1, D2,);
      t.percentComplete = 25;
      const s = ical.to_s();
      assert(s.includes("BEGIN:VCALENDAR",),);
      assert(s.includes("BEGIN:VTODO",),);
      assert(s.includes("SUMMARY:MyTask",),);
      assert(s.includes("PERCENT-COMPLETE:25",),);
      assert(s.includes("END:VTODO",),);
      assert(s.includes("END:VCALENDAR",),);
    });

    it("ordem: todos → eventos → journals", () => {
      const ical = new ICalendar("p",);
      new Event(ical, "e", "E", D1, D2,);
      new Journal(ical, "j", "J", D1,);
      new Todo(ical, "t", "T", D1, D2,);
      const s = ical.to_s();
      const iTodo = s.indexOf("BEGIN:VTODO",);
      const iEvent = s.indexOf("BEGIN:VEVENT",);
      const iJournal = s.indexOf("BEGIN:VJOURNAL",);
      assert(
        iTodo < iEvent && iEvent < iJournal,
        `${iTodo}/${iEvent}/${iJournal}`,
      );
    });
  });

  describe("foldLines (14.19.1.8 / 14.19.1.9)", () => {
    it("preserva linhas ≤ 75 bytes apenas convertendo \\n → \\r\\n", () => {
      const out = foldLines("short line\nsecond\n",);
      assertEquals(out, "short line\r\nsecond\r\n",);
    });

    it("quebra em 75 bytes e continua com CRLF + espaço", () => {
      // 80 caracteres ASCII + \n: deve virar 75 + "\r\n " + 5 + "\r\n".
      const long = "a".repeat(80,) + "\n";
      const out = foldLines(long,);
      const lines = out.split("\r\n",);
      assertEquals(lines[0]!.length, 75,);
      assertEquals(lines[1], " " + "a".repeat(5,),);
      assertEquals(lines[2], "", "termina com CRLF",);
    });

    it("conta bytes UTF-8 (acentos = 2 bytes, emoji = 4 bytes)", () => {
      // 40 á = 80 bytes UTF-8 → dobra após 74 bytes (37 á) + 1 char por vez.
      const s = "á".repeat(40,) + "\n";
      const out = foldLines(s,);
      // Primeira linha deve ter ≤ 75 bytes.
      const firstLine = out.split("\r\n",)[0]!;
      const bytes = new TextEncoder().encode(firstLine,).length;
      assert(bytes <= 75, `${bytes} ≤ 75`,);
      assert(firstLine.length < 40, "houve dobragem",);
    });

    it("converte todos os \\n em \\r\\n (CRLF) — 14.19.1.9", () => {
      const out = foldLines("a\nb\nc\n",);
      assertEquals(out, "a\r\nb\r\nc\r\n",);
      assert(!out.match(/(?<!\r)\n/,), "sem LF isolado",);
    });

    it("NUNCA insere dobragem antes de um \\n", () => {
      // Uma linha com 74 bytes + "\n": o \n não deve desencadear nova dobra.
      const line = "b".repeat(74,) + "\n";
      const out = foldLines(line,);
      assertEquals(out, "b".repeat(74,) + "\r\n",);
    });
  });
});
