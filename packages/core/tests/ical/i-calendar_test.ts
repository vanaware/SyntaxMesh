/**
 * 17.5.3–4 — `ICalendar` (contentor) + serialização + `foldLines`.
 *
 * Comparações tiradas da saída do Ruby real. Como `DTSTAMP` é a hora da
 * serialização, os testes do documento inteiro filtram essa linha.
 *
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.5)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";

import { AppConfig, } from "../../src/app-config.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { Event, } from "../../src/ical/event.ts";
import { foldLines, ICalendar, } from "../../src/ical/i-calendar.ts";
import { Journal, } from "../../src/ical/journal.ts";
import { Todo, } from "../../src/ical/todo.ts";

const DOC_TIME = 1767312240; // 2026-01-02T00:04:00Z
const START = TjTime.fromSeconds(1767283200,); // 2026-01-01T16:00:00Z
const END = TjTime.fromSeconds(1767369600,); // 2026-01-02T16:00:00Z

function doc(): ICalendar {
  const ical = new ICalendar("p",);
  ical.creationDate = TjTime.fromSeconds(DOC_TIME,);
  ical.lastModified = ical.creationDate;
  return ical;
}

/** Documento serializado sem as linhas DTSTAMP (não determinísticas). */
function semDtStamp(s: string,): string {
  return s.split("\r\n",)
    .filter((l,) => !l.startsWith("DTSTAMP:",))
    .join("\r\n",);
}

describe("ICalendar — construtor e campos (17.5.3.5)", () => {
  it("prefixa o UID com o nome do pacote", () => {
    assertEquals(
      new ICalendar("proj",).uid,
      `${AppConfig.packageName}-proj`,
    );
  });

  it("creationDate e lastModified partilham a MESMA instância (Ruby)", () => {
    const ical = new ICalendar("p",);
    assertEquals(ical.creationDate, ical.lastModified,);
    assert(ical.creationDate === ical.lastModified,);
  });

  it("começa sem componentes", () => {
    const s = semDtStamp(doc().to_s(),);
    assertEquals(
      s,
      "BEGIN:VCALENDAR\r\n" +
        `PRODID:-//The ${AppConfig.softwareName} Project/NONSGML ` +
        `${AppConfig.softwareName} ${AppConfig.version}//EN\r\n` +
        "VERSION:2.0\r\n" +
        "\r\n" +
        "END:VCALENDAR\r\n",
    );
  });
});

describe("ICalendar — addTodo/addEvent/addJournal (17.5.3.6)", () => {
  it("os componentes se auto-registram no construtor", () => {
    const ical = doc();
    new Todo(ical, "t", "Sum", START, END,);
    new Event(ical, "e", "Sum", START, END,);
    new Journal(ical, "j", "Sum", START,);
    const s = ical.to_s();
    assert(s.includes("UID:t-TODO",), s,);
    assert(s.includes("UID:e-EVENT",), s,);
    assert(s.includes("UID:j-JOURNAL",), s,);
  });

  it("a ordem do documento é todos → events → journals", () => {
    const ical = doc();
    new Journal(ical, "j", "Sum", START,);
    new Event(ical, "e", "Sum", START, END,);
    new Todo(ical, "t", "Sum", START, END,);
    const s = ical.to_s();
    assert(
      s.indexOf("UID:t-TODO",) < s.indexOf("UID:e-EVENT",) &&
        s.indexOf("UID:e-EVENT",) < s.indexOf("UID:j-JOURNAL",),
      s,
    );
  });

  it("addTodo explícito também funciona (API interna do Ruby)", () => {
    const ical = doc();
    const other = doc();
    const todo = new Todo(other, "t", "Sum", START, END,);
    ical.addTodo(todo,);
    assert(ical.to_s().includes("UID:t-TODO",),);
  });
});

describe("ICalendar#dateTime (17.5.4.2)", () => {
  it("formato básico UTC %Y%m%dT%H%M%SZ", () => {
    assertEquals(doc().dateTime(START,), "20260101T160000Z",);
  });

  it("época Unix", () => {
    assertEquals(doc().dateTime(TjTime.fromSeconds(0,),), "19700101T000000Z",);
  });

  it("ignora a zona corrente do TjTime (sempre UTC)", () => {
    const t = TjTime.fromSeconds(DOC_TIME,);
    assertEquals(doc().dateTime(t,), "20260102T000400Z",);
    assert(!doc().dateTime(t,).includes("-",),);
  });
});

describe("foldLines (17.5.4.3–4)", () => {
  it("quebra exatamente nos 75 octetos e continua com espaço", () => {
    const a = "A".repeat(100,);
    assertEquals(
      foldLines(`${a}\n`,),
      "A".repeat(75,) + "\r\n " + "A".repeat(25,) + "\r\n",
    );
  });

  it("não quebra linha com exatamente 75 octetos", () => {
    assertEquals(foldLines(`${"B".repeat(75,)}\n`,), "B".repeat(75,) + "\r\n",);
  });

  it("converte \\n em \\r\\n inclusive nas linhas curtas", () => {
    assertEquals(foldLines("um\ndois\n",), "um\r\ndois\r\n",);
    assertEquals(foldLines("x",), "x",);
    assertEquals(foldLines("",), "",);
  });

  it("conta octetos, não caracteres: 18 emoji de 4 bytes enchem a linha", () => {
    const vinte = "😀".repeat(20,);
    assertEquals(
      foldLines(`${vinte}\n`,),
      "😀".repeat(18,) + "\r\n " + "😀".repeat(2,) + "\r\n",
    );
  });

  it("não divide um caractere multibyte no limite", () => {
    // 8 (prefixo) + 66 'a' = 74 octetos; o emoji seguinte não cabe e desce.
    const s = foldLines(`SUMMARY:${"a".repeat(66,)}😀bc\n`,);
    assertEquals(
      s,
      `SUMMARY:${"a".repeat(66,)}` + "\r\n " + "😀bc\r\n",
    );
  });

  it("desfazer a dobra recupera a linha original", () => {
    const original = `SUMMARY:${"X".repeat(200,)}\n`;
    const folded = foldLines(original,);
    assertEquals(
      folded.replace(/\r\n /g, "",).replace(/\r\n/g, "\n",),
      original,
    );
  });

  it("linhas já terminadas em \\n não ganham quebra extra", () => {
    assertEquals(foldLines("a\nb\n",), "a\r\nb\r\n",);
  });
});

describe("ICalendar#to_s (17.5.4.1, 17.5.4.5–8)", () => {
  it("serializa um VTODO completo como o Ruby (menos o DTSTAMP)", () => {
    const ical = doc();
    new Todo(ical, "u", "s", START, END,);
    assertEquals(
      semDtStamp(ical.to_s(),),
      "BEGIN:VCALENDAR\r\n" +
        `PRODID:-//The ${AppConfig.softwareName} Project/NONSGML ` +
        `${AppConfig.softwareName} ${AppConfig.version}//EN\r\n` +
        "VERSION:2.0\r\n\r\n" +
        "BEGIN:VTODO\r\n" +
        "CREATED:20260102T000400Z\r\n" +
        "UID:u-TODO\r\n" +
        "LAST-MODIFIED:20260102T000400Z\r\n" +
        "SUMMARY:s\r\n" +
        "DTSTART:20260101T160000Z\r\n" +
        "DUE:20260102T160000Z\r\n" +
        "PERCENT-COMPLETE:-1\r\n" +
        "END:VTODO\r\n" +
        "\r\n" +
        "END:VCALENDAR\r\n",
    );
  });

  it("dobra o SUMMARY longo dentro do documento", () => {
    const ical = doc();
    new Todo(ical, "task2", "X".repeat(90,), START, END,);
    const s = ical.to_s();
    assert(
      s.includes(
        "SUMMARY:" + "X".repeat(67,) + "\r\n " + "X".repeat(23,) + "\r\n",
      ),
      s,
    );
  });

  it("as linhas dobradas respeitam o limite de octetos", () => {
    const ical = doc();
    new Todo(ical, "u", "😀".repeat(40,), START, END,);
    // O Ruby não conta nem o caractere que provocou a quebra nem o espaço de
    // continuação: o teto real é 75 + 4 (emoji) + 1 (espaço) = 80 octetos.
    for (const line of ical.to_s().split("\r\n",)) {
      assert(new TextEncoder().encode(line,).length <= 80, line,);
    }
    // E pelo menos uma linha sofreu dobra (a de 40 emoji não cabe em 75).
    assert(ical.to_s().includes("\r\n 😀",), ical.to_s(),);
  });

  it("o arquivo termina em CRLF", () => {
    assert(doc().to_s().endsWith("END:VCALENDAR\r\n",),);
  });
});
