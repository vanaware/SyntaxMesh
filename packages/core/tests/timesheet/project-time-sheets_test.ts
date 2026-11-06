/**
 * Project.timeSheets / checkTimeSheets — 18.4.
 *
 * O `Project` já carrega a coleção desde a Fase 9 (stub); aqui garantimos que
 * ela agora é a `TimeSheets` real e que `checkTimeSheets()` delega a checagem.
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { JournalEntry, } from "../../src/model/journal.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeSheet, } from "../../src/timesheet/time-sheet.ts";
import { TimeSheetRecord, } from "../../src/timesheet/time-sheet-record.ts";
import { TimeSheets, } from "../../src/timesheet/time-sheets.ts";
import { buildFixture, intervalOf, messageIdsOf, } from "./fixture.ts";

const JAN = "2026-01-01";

describe("Project.timeSheets (18.4.1–18.4.2)", () => {
  it("o projeto nasce com uma coleção TimeSheets vazia", () => {
    const f = buildFixture();
    assert(f.project.timeSheets instanceof TimeSheets,);
    assertEquals(f.project.timeSheets.length, 0,);
  });
});

describe("Project.checkTimeSheets (18.4.3–18.4.6)", () => {
  it("sem folhas passa", () => {
    const f = buildFixture();
    assertEquals(messageIdsOf(() => f.project.checkTimeSheets()), [],);
  });

  it("com folha válida passa", () => {
    const f = buildFixture();
    const ts = new TimeSheet(f.dev, intervalOf(JAN, 28,), 0,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = 160;
    rec.remaining = 0;
    rec.status = new JournalEntry(
      f.project.journal,
      TjTime.fromString("2026-01-31",),
      "Progresso normal",
      f.effortTask,
    );
    f.project.timeSheets.push(ts,);
    assertEquals(messageIdsOf(() => f.project.checkTimeSheets()), [],);
  });

  it("com folha inconsistente emite o erro do total", () => {
    const f = buildFixture();
    const ts = new TimeSheet(f.dev, intervalOf(JAN, 28,), 0,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = 8;
    rec.remaining = 0;
    f.project.timeSheets.push(ts,);
    assert(
      messageIdsOf(() => f.project.checkTimeSheets())
        .includes("ts_work_too_low",),
    );
  });
});
