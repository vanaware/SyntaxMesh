/**
 * 17.5.1–2 — `Person` + `Component`.
 *
 * As strings esperadas vêm da saída literal do Ruby real (`ICalendar.rb`
 * executado com `AppConfig.packageName = 'syntaxmesh'`). O `DTSTAMP` é a hora
 * da serialização (no Ruby e aqui), portanto **nunca** entra nas comparações:
 * os testes filtram a linha antes de comparar o resto.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb:28-94
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.5)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";

import { TjTime, } from "../../src/time/tj-time.ts";
import { Component, } from "../../src/ical/component.ts";
import { ICalendar, } from "../../src/ical/i-calendar.ts";
import { Person, } from "../../src/ical/person.ts";
import { Todo, } from "../../src/ical/todo.ts";

/** Época fixa do oracle: 2026-01-02T00:04:00Z. */
const DOC_TIME = 1767312240;
const START = TjTime.fromSeconds(1767283200,); // 2026-01-01T16:00:00Z
const END = TjTime.fromSeconds(1767369600,); // 2026-01-02T16:00:00Z

/** Subclasse de teste: o Ruby também deriva o tipo do nome da classe. */
class Fake extends Component {}

function doc(): ICalendar {
  const ical = new ICalendar("p",);
  ical.creationDate = TjTime.fromSeconds(DOC_TIME,);
  ical.lastModified = ical.creationDate;
  return ical;
}

/** `to_s` sem a linha DTSTAMP (não determinística por construção). */
function semDtStamp(s: string,): string {
  return s.split("\n",).filter((l,) => !l.startsWith("DTSTAMP:",)).join("\n",);
}

describe("Person (17.5.1)", () => {
  it("guarda nome e email", () => {
    const p = new Person("Ana Silva", "ana@example.com",);
    assertEquals(p.name, "Ana Silva",);
    assertEquals(p.email, "ana@example.com",);
  });

  it("é usado por setOrganizer e addAttendee", () => {
    const c = new Fake(doc(), "u", "s", START,);
    c.setOrganizer("A", "a@x",);
    assertEquals(c.organizer?.name, "A",);
    c.addAttendee("B", "b@x",);
    assert(c.organizer instanceof Person,);
  });
});

describe("Component — construtor (17.5.2.4)", () => {
  it("deriva o tipo do nome da classe, como o Ruby", () => {
    const c = new Fake(doc(), "u", "s", START,);
    assert(c.to_s().startsWith("BEGIN:VFAKE\n",), c.to_s(),);
    assert(c.to_s().endsWith("END:VFAKE\n\n",),);
  });

  it("compõe o UID com o sufixo do tipo", () => {
    const ical = doc();
    assertEquals(new Fake(ical, "uid-base", "s", START,).uid, "uid-base-FAKE",);
    const ical2 = doc();
    assertEquals(
      new Todo(ical2, "uid-base", "s", START, END,).uid,
      "uid-base-TODO",
    );
  });

  it("expõe uid como leitura e os opcionais como escrita", () => {
    const c = new Fake(doc(), "u", "s", START,);
    assertEquals(c.description, null,);
    assertEquals(c.relatedTo, null,);
    assertEquals(c.organizer, null,);
  });
});

describe("Component#to_s — campos obrigatórios (17.5.2.7)", () => {
  it("emite a ordem exata do Ruby", () => {
    const c = new Fake(doc(), "u", "Resumo", START,);
    assertEquals(
      semDtStamp(c.to_s(),),
      "BEGIN:VFAKE\n" +
        "CREATED:20260102T000400Z\n" +
        "UID:u-FAKE\n" +
        "LAST-MODIFIED:20260102T000400Z\n" +
        "SUMMARY:Resumo\n" +
        "DTSTART:20260101T160000Z\n" +
        "END:VFAKE\n\n",
    );
  });

  it("DTSTAMP existe e está em formato UTC básico", () => {
    const line = new Fake(doc(), "u", "s", START,)
      .to_s()
      .split("\n",)
      .find((l,) => l.startsWith("DTSTAMP:",)) ?? "";
    assert(/^DTSTAMP:\d{8}T\d{6}Z$/.test(line,), line,);
  });

  it("usa CREATED/LAST-MODIFIED do documento e DTSTART da data", () => {
    const ical = doc();
    const c = new Fake(ical, "u", "s", START,);
    ical.lastModified = TjTime.fromSeconds(1767312300,);
    const s = c.to_s();
    assert(s.includes("CREATED:20260102T000400Z\n",), s,);
    assert(s.includes("LAST-MODIFIED:20260102T000500Z\n",), s,);
  });

  it("cria uma linha por campo, todas terminadas em \\n", () => {
    const s = new Fake(doc(), "u", "s", START,).to_s();
    assert(s.endsWith("\n\n",),);
    assertEquals(s.split("\n",).at(-3,), "END:VFAKE",);
  });
});

describe("Component#to_s — opcionais (17.5.2.8–9)", () => {
  it("omite DESCRIPTION e RELATED-TO quando nulos", () => {
    const s = new Fake(doc(), "u", "s", START,).to_s();
    assert(!s.includes("DESCRIPTION",), s,);
    assert(!s.includes("RELATED-TO",), s,);
  });

  it("string vazia é truthy no Ruby e aqui também imprime a linha", () => {
    const c = new Fake(doc(), "u", "s", START,);
    c.description = "";
    c.relatedTo = "";
    assert(c.to_s().includes("DESCRIPTION:\nRELATED-TO:\n",), c.to_s(),);
  });

  it("escapa DESCRIPTION mas não RELATED-TO", () => {
    const c = new Fake(doc(), "u", "s", START,);
    c.description = "a;b";
    c.relatedTo = "a;b";
    assert(
      c.to_s().includes("DESCRIPTION:a\\;b\nRELATED-TO:a;b\n",),
      c.to_s(),
    );
  });

  it("ORGANIZER e ATTENDEE na ordem de inserção", () => {
    const c = new Todo(doc(), "u", "s", START, END,);
    c.setOrganizer("Ana Silva", "ana@example.com",);
    c.addAttendee("Bob", "bob@example.com",);
    c.addAttendee("Eve", "eve@example.com",);
    const s = c.to_s();
    assert(
      s.includes(
        "ORGANIZER;CN=Ana Silva:mailto:ana@example.com\n" +
          "ATTENDEE;CN=Bob:mailto:bob@example.com\n" +
          "ATTENDEE;CN=Eve:mailto:eve@example.com\n",
      ),
      s,
    );
  });
});

describe("Component#to_s com bloco (17.5.2.10–11)", () => {
  it("o bloco entra depois dos opcionais e antes do END", () => {
    const c = new Fake(doc(), "u", "s", START,);
    const s = c.to_s(() => "X-EXTRA:1\n");
    assert(
      s.includes("DTSTART:20260101T160000Z\nX-EXTRA:1\nEND:VFAKE\n\n",),
      s,
    );
  });

  it("sem bloco não há linha extra", () => {
    const c = new Fake(doc(), "u", "s", START,);
    assert(c.to_s().includes("END:VFAKE",),);
    assert(!c.to_s().includes("X-EXTRA",),);
  });
});

describe("Component#quoted (17.5.2.13)", () => {
  const q = (s: string,): string => {
    const ical = doc();
    const c = new Fake(ical, "u", s, START,);
    const line =
      c.to_s().split("\n",).find((l,) => l.startsWith("SUMMARY:",)) ??
        "";
    return line.slice("SUMMARY:".length,);
  };

  it('escapa ; , " e \\', () => {
    assertEquals(q('a,b;c"d\\e',), 'a\\,b\\;c\\"d\\\\e',);
  });

  it("converte newline real em \\n literal", () => {
    assertEquals(q("li1\nli2",), "li1\\nli2",);
  });

  it("não escapa caracteres comuns", () => {
    assertEquals(q("Resumo normal: 100% (ok)",), "Resumo normal: 100% (ok)",);
  });

  it("aplica-se também a DESCRIPTION", () => {
    const c = new Fake(doc(), "u", "s", START,);
    c.description = "linha1\nlinha2";
    assert(c.to_s().includes("DESCRIPTION:linha1\\nlinha2\n",), c.to_s(),);
  });

  it("não altera o SUMMARY quando nada há escapar", () => {
    assertEquals(q("Milestone",), "Milestone",);
  });
});

describe("Component#dateTime (17.5.2.12)", () => {
  it("delega a formatação ao documento", () => {
    const ical = doc();
    const c = new Fake(ical, "u", "s", START,);
    assertEquals(ical.dateTime(START,), "20260101T160000Z",);
    assert(c.to_s().includes("DTSTART:20260101T160000Z\n",),);
  });

  it("renderiza em UTC independentemente da zona corrente", () => {
    const ical = doc();
    const t = TjTime.fromSeconds(0,);
    assertEquals(ical.dateTime(t,), "19700101T000000Z",);
  });
});
