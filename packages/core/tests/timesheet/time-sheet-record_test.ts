/**
 * TimeSheetRecord — 18.2.
 *
 * Cobre o port de `TimeSheets.rb` (classe `TimeSheetRecord`): conversão de
 * `work` (slots vs percentual), as validações de `check()` e os warnings de
 * delta de `warnOnDelta()`, além das métricas de reportado vs planejado.
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import { Journal, JournalEntry, } from "../../src/model/journal.ts";
import { Percent, } from "../../src/time/percent.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeSheet, } from "../../src/timesheet/time-sheet.ts";
import { TimeSheetRecord, } from "../../src/timesheet/time-sheet-record.ts";
import {
  buildFixture,
  intervalOf,
  messageIdsOf,
  type TsFixture,
} from "./fixture.ts";

/** Intervalo que cobre a janela real das tarefas da fixture. */
const JAN = "2026-01-01";
const FEB = "2026-02-02";

function fixture(): TsFixture {
  return buildFixture();
}

/** Folha do recurso `dev` sobre a janela de janeiro. */
function janSheet(f: TsFixture,): TimeSheet {
  return new TimeSheet(f.dev, intervalOf(JAN, 28,), 0,);
}

/** Entrada de journal usada como status do registro. */
function statusOf(
  f: TsFixture,
  headline = "Progresso normal",
): JournalEntry {
  return new JournalEntry(
    f.project.journal as Journal,
    TjTime.fromString("2026-01-31",),
    headline,
    f.effortTask,
  );
}

describe("TimeSheetRecord — construção (18.2.2–18.2.6)", () => {
  it("construtor registra o registro na folha", () => {
    const f = fixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    assertEquals(ts.records.length, 1,);
    assertEquals(ts.records[0], rec,);
  });

  it("taskId de uma Task existente é o fullId", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    assertEquals(rec.taskId, "effortTask",);
  });

  it("taskId de uma tarefa nova é o próprio ID", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), "nova.tarefa",);
    assertEquals(rec.taskId, "nova.tarefa",);
    assert(rec.isNewTask,);
  });

  it("work inteiro é atribuído direto em slots", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 8;
    assertEquals(rec.work, 8,);
    assertEquals(rec.timeSheet.percentageUsed, false,);
  });

  it("work percentual passa por percentToSlots e marca percentageUsed", () => {
    const f = fixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = new Percent(0.5,);
    // 50% de 160 slots (20 dias de 8h).
    assertEquals(rec.work, 80,);
    assertEquals(ts.percentageUsed, true,);
  });

  it("work 100% equivale ao total bruto e não a 1 slot", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = new Percent(1.0,);
    assertEquals(rec.work, 160,);
  });

  it("work null volta ao estado não informado", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 8;
    rec.work = null;
    assertEquals(rec.work, null,);
  });
});

describe("TimeSheetRecord#check (18.2.7–18.2.15)", () => {
  it("sem 'work' emite ts_no_work", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.remaining = 10;
    assertEquals(messageIdsOf(() => rec.check()), ["ts_no_work",],);
  });

  it("task de esforço sem 'remaining' emite ts_no_remaining", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 4;
    assertEquals(messageIdsOf(() => rec.check()), ["ts_no_remaining",],);
  });

  it("task de esforço com 'remaining' passa", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 4;
    rec.remaining = 40;
    assertEquals(messageIdsOf(() => rec.check()), [],);
  });

  it("task de duração sem 'end' emite ts_no_expected_end", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.durationTask,);
    rec.work = 4;
    assertEquals(messageIdsOf(() => rec.check()), ["ts_no_expected_end",],);
  });

  it("task de duração com 'end' passa", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.durationTask,);
    rec.work = 4;
    rec.expectedEnd = TjTime.fromString("2026-02-05",);
    assertEquals(messageIdsOf(() => rec.check()), [],);
  });

  it("newtask sem 'remaining' nem 'end' emite ts_no_rem_or_end", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), "nova",);
    rec.work = 4;
    assertEquals(messageIdsOf(() => rec.check()), ["ts_no_rem_or_end",],);
  });

  it("newtask com 'remaining' passa", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), "nova",);
    rec.work = 4;
    rec.remaining = 16;
    assertEquals(messageIdsOf(() => rec.check()), [],);
  });

  it("trabalho de um dia ou mais exige status (ts_no_status_work)", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 8;
    rec.remaining = 40;
    assertEquals(messageIdsOf(() => rec.check()), ["ts_no_status_work",],);
  });

  it("status com headline vazio emite ts_no_headline", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 4;
    rec.remaining = 40;
    rec.status = statusOf(f, "",);
    assertEquals(messageIdsOf(() => rec.check()), ["ts_no_headline",],);
  });

  it("summary default 'A summary text' emite ts_default_summary", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 4;
    rec.remaining = 40;
    const status = statusOf(f,);
    status.summary = "A summary text\n";
    rec.status = status;
    assertEquals(messageIdsOf(() => rec.check()), ["ts_default_summary",],);
  });

  it("alerta de nível 1 sem summary/details emite ts_alert1_more_details", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 4;
    rec.remaining = 40;
    const status = statusOf(f,);
    status.alertLevel = 1;
    rec.status = status;
    assertEquals(messageIdsOf(() => rec.check()), ["ts_alert1_more_details",],);
  });

  it("alerta de nível 1 com summary passa", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 4;
    rec.remaining = 40;
    const status = statusOf(f,);
    status.alertLevel = 1;
    status.summary = "Andamento ok";
    rec.status = status;
    assertEquals(messageIdsOf(() => rec.check()), [],);
  });

  it("alerta de nível 2 sem details emite ts_alert2_more_details", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 4;
    rec.remaining = 40;
    const status = statusOf(f,);
    status.alertLevel = 2;
    status.summary = "Andamento ok";
    rec.status = status;
    assertEquals(messageIdsOf(() => rec.check()), ["ts_alert2_more_details",],);
  });

  it("alerta de nível 2 com details passa", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 4;
    rec.remaining = 40;
    const status = statusOf(f,);
    status.alertLevel = 2;
    status.summary = "Andamento ok";
    status.details = "Detalhes do andamento";
    rec.status = status;
    assertEquals(messageIdsOf(() => rec.check()), [],);
  });
});

describe("TimeSheetRecord#warnOnDelta (18.2.16–18.2.19)", () => {
  /** Executa warnOnDelta sobre a janela de janeiro (índices do plano). */
  function warn(f: TsFixture, ts: TimeSheet,): string[] {
    const startIdx = f.project.dateToIdx(ts.interval.start,);
    const endIdx = f.project.dateToIdx(ts.interval.end,);
    return messageIdsOf(() => {
      for (const record of ts.records) record.warnOnDelta(startIdx, endIdx,);
    },);
  }

  it("ignora registros sem task (entrada pessoal)", () => {
    const f = fixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, null,);
    rec.work = 8;
    assertEquals(warn(f, ts,), [],);
  });

  it("tarefa nova emite ts_res_new_task com ID, nome e trabalho", () => {
    const f = fixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, "nova",);
    rec.name = "Nova Tarefa";
    rec.work = 16;
    rec.remaining = 24;
    assertEquals(warn(f, ts,), ["ts_res_new_task",],);
  });

  it("trabalho fora do plano emite ts_res_work_delta", () => {
    const f = fixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = 40; // 5 dias, o plano tem 10
    rec.remaining = 0;
    assertEquals(warn(f, ts,), ["ts_res_work_delta",],);
  });

  it("trabalho igual ao plano não emite delta", () => {
    const f = fixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = 80; // 10 dias, exatamente o esforço planejado
    rec.remaining = 0;
    assertEquals(warn(f, ts,), [],);
  });

  it("remaining fora do plano emite ts_res_remain_delta", () => {
    const f = fixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    rec.work = 80;
    rec.remaining = 40; // 5 dias restantes, o plano tem 0
    assertEquals(warn(f, ts,), ["ts_res_remain_delta",],);
  });

  it("fim esperado diferente do plano emite ts_res_end_delta", () => {
    const f = fixture();
    const ts = new TimeSheet(f.dev, intervalOf(FEB, 28,), 0,);
    const rec = new TimeSheetRecord(ts, f.durationTask,);
    rec.work = 24; // 3 dias, o plano da tarefa de duração
    rec.expectedEnd = TjTime.fromString("2026-03-10",);
    assertEquals(warn(f, ts,), ["ts_res_end_delta",],);
  });

  it("fim esperado igual ao plano não emite delta", () => {
    const f = fixture();
    const ts = new TimeSheet(f.dev, intervalOf(FEB, 28,), 0,);
    const rec = new TimeSheetRecord(ts, f.durationTask,);
    rec.work = 24;
    rec.expectedEnd = f.durationTask.getForScenario("end", 0,) as TjTime;
    assertEquals(warn(f, ts,), [],);
  });
});

describe("TimeSheetRecord — métricas (18.2.20–18.2.24)", () => {
  it("actualWorkPercent é a fração do total bruto", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.work = 80;
    assertEquals(rec.actualWorkPercent(), 50,);
  });

  it("planWorkPercent usa os slots alocados do recurso", () => {
    const f = fixture();
    const ts = janSheet(f,);
    const rec = new TimeSheetRecord(ts, f.effortTask,);
    // 10 dias de esforço em 20 dias úteis do período.
    assertEquals(rec.planWorkPercent(), 50,);
  });

  it("actualRemaining converte os slots restantes em dias", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    rec.remaining = 64;
    assertEquals(rec.actualRemaining(), 8,);
  });

  it("planRemaining usa o esforço efetivo do plano até o fim da tarefa", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.effortTask,);
    assertEquals(rec.planRemaining(), 10,);
  });

  it("actualEnd devolve o fim reportado e planEnd o planejado", () => {
    const f = fixture();
    const rec = new TimeSheetRecord(janSheet(f,), f.durationTask,);
    const reported = TjTime.fromString("2026-02-06",);
    rec.expectedEnd = reported;
    assertEquals(rec.actualEnd(), reported,);
    const planned = rec.planEnd();
    assert(planned !== null,);
    assertEquals(planned!.toString(), "2026-02-05",);
  });
});
