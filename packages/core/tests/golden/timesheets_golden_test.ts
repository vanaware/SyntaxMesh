/**
 * Golden de time sheets — 18.15.7.
 *
 * Replays cada caso de `timesheets.golden.json` (gerado por
 * `scripts/golden/timesheets.rb` sobre o tj3 real) contra o port:
 *
 *  - `kind: "check"`      → `TimeSheet#check()`
 *  - `kind: "warnOnDelta"` → `TimeSheet#warnOnDelta()`
 *
 * Duas coisas são comparadas: a lista de mensagens do `MessageHandler`
 * (`expected.messages`) e o estado observável das folhas
 * (`expected.sheets`: total de slots, records, `work`, `remaining`,
 * `expectedEnd` e o status). O segundo `assert` é o que garante que os
 * números (slots/dias) batem exatamente — a normalização textual abaixo não
 * esconde erro de cálculo, só diferenças de formatação.
 *
 * Divergências de **texto** normalizadas dos dois lados:
 *
 *  1. `@@DATE@@` — `ts_res_end_delta` interpola o fim esperado; o Ruby usa
 *     `TjTime#to_s` sem formato (`2026-02-10-00:00-+0000`) e o port usa
 *     `toString()` (`2026-02-10`).
 *  2. `4.0d` → `4d` — `Float#to_s` do Ruby sempre carrega o `.0`; em JS o
 *     número não carrega. Os valores em si já são verificados no snapshot
 *     das folhas.
 *
 * @see docs/syntaxmesh/fases/fase-18-time-status-sheets-tarefas.md §18.15
 */
import { assert, assertEquals, } from "@std/assert";
import { beforeAll, describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import type { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TimeSheet, } from "../../src/timesheet/time-sheet.ts";
import { TimeSheetRecord, } from "../../src/timesheet/time-sheet-record.ts";
import { buildFixture, type TsFixture, } from "../timesheet/fixture.ts";

interface StatusSpec {
  alertLevel?: number;
  headline?: string;
  summary?: string;
  details?: string;
}

interface RecordSpec {
  task?: string;
  newtask?: string;
  name?: string;
  workDays?: number;
  workPercent?: number;
  remainingDays?: number;
  expectedEnd?: string;
  status?: StatusSpec;
}

interface SheetSpec {
  resource: string;
  start: string;
  end: string;
  scenarioIdx?: number;
  records: RecordSpec[];
}

interface MessageSnapshot {
  type: string;
  id: string;
  message: string;
}

interface SheetSnapshot {
  resource: string;
  start: string;
  end: string;
  percentageUsed: boolean;
  totalSlots: number;
  records: Array<{
    task: string | null;
    work: number | null;
    remaining: number | null;
    expectedEnd: string | null;
    status: { alertLevel: number; headline: string } | null;
  }>;
}

interface GoldenCase {
  description: string;
  kind: "check" | "warnOnDelta";
  sheets: SheetSpec[];
  expected: { messages: MessageSnapshot[]; sheets: SheetSnapshot[] };
}

// Ruby: `2026-02-10-00:00-+0000` (TjTime#to_s sem formato); port: `2026-02-10`.
const DATE_RE = /\d{4}-\d{2}-\d{2}(?:-\d{2}:\d{2}-[+-]\d{4})?/g;
const FLOAT_RE = /(\d+)\.0(?=\D|$)/g;

/** Normaliza as duas divergências de texto documentadas no cabeçalho. */
function normalize(text: string,): string {
  return text.replace(DATE_RE, "@@DATE@@",).replace(FLOAT_RE, "$1",);
}

/** `JournalEntry` de status: alertLevel + summary/details opcionais. */
function buildStatus(
  f: TsFixture,
  sheet: TimeSheet,
  property: Task | null,
  spec: StatusSpec,
): JournalEntry {
  const entry = new JournalEntry(
    f.project.journal,
    sheet.interval.end,
    spec.headline ?? "",
    property ?? sheet.resource,
  );
  entry.alertLevel = spec.alertLevel ?? 0;
  if (spec.summary !== undefined) entry.summary = spec.summary;
  if (spec.details !== undefined) entry.details = spec.details;
  return entry;
}

/** Reconstrói a `TimeSheet` a partir do spec do golden (18.15.7). */
function buildSheet(f: TsFixture, spec: SheetSpec,): TimeSheet {
  const resource = f.project.resource(spec.resource,);
  assert(resource !== null, `recurso ausente: ${spec.resource}`,);
  const interval = new TimeInterval(
    TjTime.fromString(spec.start,),
    TjTime.fromString(spec.end,),
  );
  const sheet = new TimeSheet(resource, interval, spec.scenarioIdx ?? 0,);

  for (const rec of spec.records) {
    // `newtask` aponta para um id que ainda não existe (string).
    const target = rec.newtask ?? f.project.task(rec.task ?? "",) ?? null;
    const record = new TimeSheetRecord(sheet, target,);
    if (rec.name !== undefined) record.name = rec.name;
    if (rec.workPercent !== undefined) {
      record.work = sheet.percentToSlots(rec.workPercent / 100.0,);
    } else if (rec.workDays !== undefined) {
      record.work = sheet.daysToSlots(rec.workDays,);
    }
    if (rec.remainingDays !== undefined) {
      record.remaining = sheet.daysToSlots(rec.remainingDays,);
    }
    if (rec.expectedEnd !== undefined) {
      record.expectedEnd = TjTime.fromString(rec.expectedEnd,);
    }
    if (rec.status !== undefined) {
      record.status = buildStatus(
        f,
        sheet,
        target instanceof Task ? target : null,
        rec.status,
      );
    }
  }
  return sheet;
}

/** Estado observável da folha — espelho de `snapshot` no script Ruby. */
function snapshot(sheet: TimeSheet,): SheetSnapshot {
  return {
    resource: sheet.resource.id,
    start: sheet.interval.start.toString(),
    end: sheet.interval.end.toString(),
    percentageUsed: sheet.percentageUsed,
    totalSlots: sheet.records.reduce((sum, r,) => sum + (r.work ?? 0), 0,),
    records: sheet.records.map((r,) => ({
      task: r.task instanceof Task ? r.task.fullId : (r.task as string | null),
      work: r.work,
      remaining: r.remaining,
      expectedEnd: r.expectedEnd === null ? null : r.expectedEnd.toString(),
      status: r.status === null ? null : {
        alertLevel: r.status.alertLevel,
        headline: r.status.headline,
      },
    })),
  };
}

const golden = JSON.parse(
  Deno.readTextFileSync(new URL("./timesheets.golden.json", import.meta.url,),),
) as { cases: GoldenCase[] };

describe("timesheets golden (18.15)", () => {
  let f: TsFixture;

  beforeAll(() => {
    f = buildFixture();
  },);

  it("o golden tem pelo menos 20 casos", () => {
    assert(golden.cases.length >= 20, `só ${golden.cases.length} casos`,);
  });

  for (const c of golden.cases) {
    it(c.description, () => {
      const handler = MessageHandlerInstance.instance;
      handler.messages.length = 0;
      handler.errors = 0;

      const sheets = c.sheets.map((spec,) => buildSheet(f, spec,));
      for (const sheet of sheets) {
        if (c.kind === "check") sheet.check();
        else sheet.warnOnDelta();
      }

      const messages = handler.messages.map((m,) => ({
        type: m.type,
        id: m.id,
        message: normalize(m.message,),
      }));
      const expectedMessages = c.expected.messages.map((m,) => ({
        type: m.type,
        id: m.id,
        message: normalize(m.message,),
      }));

      // Mensagens: id + texto normalizado (a ordem é a de emissão).
      assertEquals(messages, expectedMessages,);
      // Estado das folhas: slots/dias/status comparados sem normalização.
      assertEquals(sheets.map((s,) => snapshot(s,)), c.expected.sheets,);
    },);
  }
});
