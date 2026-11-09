/**
 * Golden test de iCalendar (Fase 17.16).
 *
 * Consome `ical.golden.json` (oracle `scripts/golden/ical.rb`) e reconstrói
 * cada documento com o port de `src/ical/` (17.5/17.6), comparando a saída
 * completa (envelope + componentes já dobrados) byte-a-byte, com TRÊS
 * normalizações documentadas:
 *   1. **DTSTAMP** — é a hora da serialização (`TjTime.new.utc` no Ruby,
 *      `TjTime.now()` no port), não determinística na natureza. O oracle a
 *      congela (`ICAL_FROZEN_NOW`, para o golden ser byte-idempotente) e o
 *      valor é substituído por `DTSTAMP:@@NOW@@` nos dois lados. A linha tem
 *      26 bytes (< 75), nunca é dobrada, então a substituição é segura.
 *   2. **Line endings** — aqui o CRLF É a carga útil (RFC 5545, convertido por
 *      `foldLines`); a normalização geral dos goldens é no-op de propósito.
 *   3. **Versão** — a definitiva só existe depois do bundle do buildit
 *      (`__APP_VERSION__`): em teste o port cai no fallback do fonte e o oracle
 *      Ruby lê o `deno.jsonc` da raiz. Neutralizar o trecho do `PRODID`
 *      (`SyntaxMesh @@VER@@//EN`, `@@VER@@` incluído) mantém o golden válido a
 *      cada bump, em vez de exigir regeneração a troco de nada.
 *
 * Determinismo replicado dos dois lados: fuso fixo por caso (`spec.tz`,
 * mesmo padrão dos goldens de reports — `TjTime.setTimeZone` antes de montar
 * as datas e restaurado depois), `creationDate`/`lastModified` fixos em
 * 2026-01-01 e AppConfig (packageName/softwareName/version) igualado aos
 * defaults do port — PRODID e UID saem byte-idênticos.
 *
 * @see scripts/golden/ical.rb
 * @see docs/taskjuggler/lib/taskjuggler/ICalendar.rb
 * @see docs/syntaxmesh/fases/fase-17-html-xml-tarefas.md (17.16)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { TjTime, } from "../../src/time/tj-time.ts";
import { Event, } from "../../src/ical/event.ts";
import { ICalendar, } from "../../src/ical/i-calendar.ts";
import { Journal, } from "../../src/ical/journal.ts";
import { Todo, } from "../../src/ical/todo.ts";

interface GoldenCase {
  id: string;
  kind: string;
  spec: Record<string, unknown>;
  expected: string;
}

/** Datas do builder: criadas DENTRO do fuso do caso (ver `runCase`). */
type Dates = { D0: TjTime; D1: TjTime };

/**
 * Espelho do `new_ical(tag)` do Ruby: datas fixas, um único ical. As datas
 * são as do caso (parse dependentes do fuso ativo), não constantes de módulo.
 */
function newIcal(dates: Dates, tag = "proj",): ICalendar {
  const ical = new ICalendar(tag,);
  ical.creationDate = dates.D0;
  ical.lastModified = dates.D0;
  return ical;
}

/**
 * Neutraliza a versão do `PRODID` (ver item 3 do header). O valor sai do
 * `AppConfig.version` em ambos os lados: fallback do fonte no port, `deno.jsonc`
 * da raiz no oracle.
 */
function normalizeVersion(str: string,): string {
  // Aceita versão vazia também: no fonte o `__APP_VERSION__` não foi injetado,
  // então o port emite `SyntaxMesh //EN` e o oracle, que lê o `deno.jsonc`,
  // emite `SyntaxMesh 0.0.2-mtvrt8od//EN`. Só o token muda de lado; o prefixo
  // ("The SyntaxMesh Project/NONSGML") não casa porque contém `/`.
  return str.replace(/(SyntaxMesh )([^\s\/]*)(\/\/EN)/g, "$1@@VER@@$3",);
}

/** Substitui os valores não determinísticos do envelope (ver header). */
function normalize(str: string,): string {
  return normalizeVersion(
    str.replace(/DTSTAMP:\d{8}T\d{6}Z/g, "DTSTAMP:@@NOW@@",),
  );
}

const builders: Record<string, (d: Dates,) => string> = {
  empty_doc: (d,) => newIcal(d,).to_s(),

  todo_default: (d,) => {
    const ical = newIcal(d, "t1",);
    new Todo(ical, ical.uid + "-task1", "Task um", d.D0, d.D1,);
    return ical.to_s();
  },

  todo_completed: (d,) => {
    const ical = newIcal(d, "t2",);
    const todo = new Todo(ical, ical.uid + "-task2", "Feita", d.D0, d.D1,);
    todo.percentComplete = 100;
    return ical.to_s();
  },

  todo_desc_escapes: (d,) => {
    const ical = newIcal(d, "t3",);
    const todo = new Todo(ical, ical.uid + "-task3", 'Esc; ap,"s', d.D0, d.D1,);
    todo.description = "line1\nline2; col, on \\ bar";
    todo.relatedTo = "other-uid-TODO";
    return ical.to_s();
  },

  todo_empty_description: (d,) => {
    const ical = newIcal(d, "t4",);
    const todo = new Todo(ical, ical.uid + "-task4", "Vazia", d.D0, d.D1,);
    todo.description = "";
    return ical.to_s();
  },

  todo_organizer_attendees: (d,) => {
    const ical = newIcal(d, "t5",);
    const todo = new Todo(ical, ical.uid + "-task5", "Gente", d.D0, d.D1,);
    todo.setOrganizer("Chefe", "chefe@ex.com",);
    todo.addAttendee("Ana", "ana@ex.com",);
    todo.addAttendee("Bob", "bob@ex.com",);
    return ical.to_s();
  },

  event_default: (d,) => {
    const ical = newIcal(d, "e1",);
    new Event(ical, ical.uid + "-task10", "Reunião", d.D0, d.D1,);
    return ical.to_s();
  },

  journal_basic: (d,) => {
    const ical = newIcal(d, "j1",);
    new Journal(ical, ical.uid + "-task20", "Nota 2026-01", d.D0,);
    return ical.to_s();
  },

  fold_ascii: (d,) => {
    const ical = newIcal(d, "f1",);
    new Todo(ical, ical.uid + "-task30", "X".repeat(90,), d.D0, d.D1,);
    return ical.to_s();
  },

  fold_utf8: (d,) => {
    const ical = newIcal(d, "f2",);
    new Todo(ical, ical.uid + "-task31", "é".repeat(40,), d.D0, d.D1,);
    return ical.to_s();
  },

  mixed_order: (d,) => {
    const ical = newIcal(d, "m1",);
    // Cria intercalado para provar que a serialização reordena por tipo.
    new Journal(ical, ical.uid + "-j0", "J0", d.D0,);
    new Event(ical, ical.uid + "-e0", "E0", d.D0, d.D1,);
    new Todo(ical, ical.uid + "-t0", "T0", d.D0, d.D1,);
    new Todo(ical, ical.uid + "-t1", "T1", d.D0, d.D1,);
    new Event(ical, ical.uid + "-e1", "E1", d.D0, d.D1,);
    return ical.to_s();
  },
};

function loadCases(): GoldenCase[] {
  const path = new URL("./ical.golden.json", import.meta.url,);
  const parsed = JSON.parse(Deno.readTextFileSync(path,),) as {
    cases: GoldenCase[];
  };
  return parsed.cases;
}

describe("ical golden (17.16)", () => {
  const cases = loadCases();

  it("tem pelo menos 11 casos", () => {
    assertEquals(cases.length >= 11, true, `${cases.length} casos`,);
  });

  it("todo caso do golden tem builder correspondente", () => {
    const missing = cases.filter((c,) => !builders[c.id]).map((c,) => c.id);
    assertEquals(missing, [],);
  });

  for (const c of cases) {
    it(c.id, () => {
      // Fuso do caso ativo DURANTE o parse das datas e a serialização;
      // restaurado no fim (mesma tática dos goldens de reports, mas com
      // try/finally para não vazar estado entre arquivos de teste).
      const prev = TjTime.setTimeZone(c.spec.tz as string,);
      try {
        // Mesmas datas fixas do oracle ('2026-01-01' / '2026-01-08').
        const dates: Dates = {
          D0: TjTime.fromString("2026-01-01",),
          D1: TjTime.fromString("2026-01-08",),
        };
        assertEquals(
          normalize(builders[c.id]!(dates,),),
          normalize(c.expected,),
        );
      } finally {
        TjTime.setTimeZone(prev ?? "UTC",);
      }
    },);
  }
});
