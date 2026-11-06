/**
 * TimeSheet / TimeSheets — 18.3.
 *
 * Cobre o port de `TimeSheets.rb` (classes `TimeSheet` e `TimeSheets`):
 * construção, registro de duplicatas, totais de slots, conversões de unidade
 * e as validações de `check()` (eficiência, tracking scenario, total ±1).
 */
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { JournalEntry, } from "../../src/model/journal.ts";
import type { Resource, } from "../../src/model/resource.ts";
import { Percent, } from "../../src/time/percent.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TimeSheet, } from "../../src/timesheet/time-sheet.ts";
import { TimeSheetRecord, } from "../../src/timesheet/time-sheet-record.ts";
import { TimeSheets, } from "../../src/timesheet/time-sheets.ts";
import { parseProject, } from "../parser/parse-helper.ts";
import type { Project, } from "../../src/model/project.ts";
import {
  buildFixture,
  intervalOf,
  messageIdsOf,
  TS_PROJECT,
  type TsFixture,
} from "./fixture.ts";

const JAN = "2026-01-01";

function janSheet(f: TsFixture, resource?: Resource,): TimeSheet {
  return new TimeSheet(resource ?? f.dev, intervalOf(JAN, 28,), 0,);
}

/** Status válido (headline preenchido, sem alerta) para o registro. */
function okStatus(f: TsFixture,): JournalEntry {
  return new JournalEntry(
    f.project.journal,
    TjTime.fromString("2026-01-31",),
    "Progresso normal",
    f.effortTask,
  );
}

describe("TimeSheet — construção (18.3.2–18.3.4)", () => {
  it("valida que o recurso é um Resource", () => {
    const f = buildFixture();
    assertThrows(
      () => new TimeSheet({} as Resource, intervalOf(JAN, 28,), 0,),
      Error,
      "Illegal resource",
    );
  });

  it("valida que o intervalo existe", () => {
    const f = buildFixture();
    assertThrows(
      () => new TimeSheet(f.dev, undefined as unknown as TimeInterval, 0,),
      Error,
      "Interval undefined",
    );
  });

  it("valida que o índice de cenário existe", () => {
    const f = buildFixture();
    assertThrows(
      () =>
        new TimeSheet(
          f.dev,
          intervalOf(JAN, 28,),
          undefined as unknown as number,
        ),
      Error,
      "Sceneario index undefined",
    );
  });

  it("guardar registro duplicado da mesma tarefa emite ts_duplicate_task", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    new TimeSheetRecord(ts, f.effortTask,);
    assertEquals(
      messageIdsOf(() => new TimeSheetRecord(ts, f.effortTask,)),
      ["ts_duplicate_task",],
    );
    assertEquals(ts.records.length, 2,);
  });

  it("registros de tarefas diferentes convivem", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    new TimeSheetRecord(ts, f.effortTask,);
    assertEquals(
      messageIdsOf(() => new TimeSheetRecord(ts, f.durationTask,)),
      [],
    );
  });
});

describe("TimeSheet#check (18.3.5–18.3.10)", () => {
  it("checa cada registro", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    new TimeSheetRecord(ts, f.effortTask,);
    assert(messageIdsOf(() => ts.check()).includes("ts_no_work",),);
  });

  it("total igual aos slots líquidos passa", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = 160;
    rec.remaining = 0;
    rec.status = okStatus(f,);
    assertEquals(messageIdsOf(() => ts.check()), [],);
  });

  it("tolerância de 1 slot: 159 e 161 passam", () => {
    const f = buildFixture();
    for (const slots of [159, 161,]) {
      const ts = janSheet(f,);
      const rec = new TimeSheetRecord(ts, f.effortTask,);
      rec.work = slots;
      rec.remaining = 0;
      rec.status = okStatus(f,);
      assertEquals(messageIdsOf(() => ts.check()), [], `slots=${slots}`,);
    }
  });

  it("total abaixo do líquido emite ts_work_too_low em dias", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = 80;
    rec.remaining = 0;
    rec.status = okStatus(f,);
    assertEquals(messageIdsOf(() => ts.check()), ["ts_work_too_low",],);
    const msg = MessageHandlerInstance.instance.messages.find((m,) =>
      m.id === "ts_work_too_low"
    )!;
    assert(msg.message.includes("20 days",), msg.message,);
    assert(msg.message.includes("10 days",), msg.message,);
  });

  it("total acima do líquido emite ts_work_too_high", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = 200;
    rec.remaining = 0;
    rec.status = okStatus(f,);
    assertEquals(messageIdsOf(() => ts.check()), ["ts_work_too_high",],);
  });

  it("total percentual é reportado em %", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = new Percent(0.25,); // 40 slots de 160
    rec.remaining = 0;
    rec.status = okStatus(f,);
    assertEquals(messageIdsOf(() => ts.check()), ["ts_work_too_low",],);
    const msg = MessageHandlerInstance.instance.messages.find((m,) =>
      m.id === "ts_work_too_low"
    )!;
    assert(msg.message.includes("100%",), msg.message,);
    assert(msg.message.includes("25%",), msg.message,);
  });

  it("recurso com efficiency 0 exige total zero", () => {
    const f = buildFixture();
    const ts = janSheet(f, f.idle,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = 8;
    rec.remaining = 0;
    rec.status = okStatus(f,);
    assertEquals(messageIdsOf(() => ts.check()), ["ts_work_not_null",],);
  });

  it("sem trackingScenarioIdx emite ts_no_tracking_scenario", () => {
    const out = parseProject(
      TS_PROJECT.replace("  trackingscenario plan\n", "",),
    );
    assert(out.threw === null,);
    const project = out.result as Project;
    assert(project.schedule(),);
    const dev = project.resource("dev",) as Resource;
    const ts = new TimeSheet(dev, intervalOf(JAN, 28,), 0,);
    const rec = new TimeSheetRecord(ts, null,);
    // O total também acusa o período vazio — o alvo é a falta do cenário.
    assert(
      messageIdsOf(() => ts.check()).includes("ts_no_tracking_scenario",),
    );
  });
});

describe("TimeSheet — deltas e conversões (18.3.11–18.3.18)", () => {
  it("warnOnDelta delega para os registros", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = 40;
    rec.remaining = 0;
    assertEquals(messageIdsOf(() => ts.warnOnDelta()), ["ts_res_work_delta",],);
  });

  it("totalGrossWorkingSlots são 20 dias úteis de 8h", () => {
    const f = buildFixture();
    assertEquals(janSheet(f,).totalGrossWorkingSlots(), 160,);
  });

  it("totalNetWorkingSlots soma alocados e livres", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    const startIdx = f.project.dateToIdx(ts.interval.start,);
    const endIdx = f.project.dateToIdx(ts.interval.end,);
    const scenario = f.dev.scenarioData(0,);
    assertEquals(
      ts.totalNetWorkingSlots(),
      scenario.getAllocatedSlots(startIdx, endIdx, null,) +
        scenario.getFreeSlots(startIdx, endIdx,),
    );
    // O período não tem feriados: 28 dias corridos = 20 dias úteis.
    assertEquals(ts.totalNetWorkingSlots(), 160,);
  });

  it("percentToSlots marca percentageUsed e converte frações", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    assertEquals(ts.percentageUsed, false,);
    assertEquals(ts.percentToSlots(0.5,), 80,);
    assertEquals(ts.percentageUsed, true,);
  });

  it("slotsToPercent devolve a fração do total bruto", () => {
    const f = buildFixture();
    assertEquals(janSheet(f,).slotsToPercent(40,), 0.25,);
  });

  it("slotsToDays e daysToSlots são inversos", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    assertEquals(ts.slotsToDays(80,), 10,);
    assertEquals(ts.daysToSlots(10,), 80,);
    assertEquals(ts.daysToSlots(0.5,), 4,);
  });

  it("error e warning usam o recurso da folha como contexto", () => {
    const f = buildFixture();
    const ts = janSheet(f,);
    messageIdsOf(() => {
      ts.error("ts_x", "erro",);
      ts.warning("ts_y", "aviso",);
    },);
    const [err, warn,] = MessageHandlerInstance.instance.messages;
    assertEquals(err!.data, f.dev,);
    assertEquals(warn!.data, f.dev,);
  });
});

describe("TimeSheets (18.3.19–18.3.22)", () => {
  it("é uma coleção de folhas com alias `sheets`", () => {
    const f = buildFixture();
    const sheets = new TimeSheets();
    const ts = janSheet(f,);
    sheets.push(ts,);
    assertEquals(sheets.length, 1,);
    assertEquals(sheets.sheets.length, 1,);
    assertEquals([...sheets,], [ts,],);
  });

  it("check() checa cada folha", () => {
    const f = buildFixture();
    const sheets = new TimeSheets();
    const ts = janSheet(f,);
    sheets.push(ts,);
    new TimeSheetRecord(ts, f.effortTask,);
    assert(messageIdsOf(() => sheets.check()).includes("ts_no_work",),);
  });

  it("warnOnDelta() delega para cada folha", () => {
    const f = buildFixture();
    const sheets = new TimeSheets();
    const ts = janSheet(f,);
    sheets.push(ts,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = 40;
    rec.remaining = 0;
    assertEquals(
      messageIdsOf(() => sheets.warnOnDelta()),
      ["ts_res_work_delta",],
    );
  });
});
