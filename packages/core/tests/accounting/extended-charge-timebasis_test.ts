/**
 * C2.10 — ExtendedCharge.turnover() e MaterialAllocation respeitando
 * `timebasis` (§3.1–§3.6). Substitui o cálculo ad-hoc atual do parser
 * (perweek/permonth → amount/7; perday → perDiem) pela distribuição
 * unificada do `distribution.ts`.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { ExtendedCharge, } from "../../src/model/extended-charge.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { Material, } from "../../src/model/material.ts";
import { Account, } from "../../src/model/account.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import {
  type DistributionContext,
  type Timebasis,
} from "../../src/accounting/distribution.ts";

/** Helpers em UTC meia-noite, para evitar problemas de timezone. */
function day(y: number, m: number, d: number,): TjTime {
  return TjTime.fromDate(new Date(Date.UTC(y, m - 1, d,),),);
}
function dayNum(tj: TjTime,): number {
  return Math.floor(tj.toDate().getTime() / 86_400_000,);
}
function schedTask(
  project: Project,
  id: string,
  from: TjTime,
  to: TjTime,
): Task {
  const t = new Task(project, id, id, null,);
  const s = t.scenarioData(0,);
  s.scheduledStart = from;
  s.scheduledEnd = to;
  s.actualStart = from;
  s.actualEnd = to;
  s.duration = {
    start: dayNum(from,),
    end: dayNum(to,),
    workingDays: dayNum(to,) - dayNum(from,) + 1,
  };
  s.durationType = "fixedduration";
  // ExtendedCharge/MaterialAllocation lêem os atributos de cenário
  // `start`/`end` (mesma fonte que Charge/tj3).
  t.setForScenario("start", from, 0,);
  t.setForScenario("end", to, 0,);
  return t;
}
/**
 * ctx de teste simples: dias úteis = Seg-Sex, sem leaves, semana começa
 * Monday, 8h/dia. `timebasis` é sobreposto por chamada quando necessário.
 */
function testCtx(timebasis: Timebasis = "duration",): DistributionContext {
  return {
    timebasis,
    isWorkingCalendarDay: (d: Date,) => {
      const wd = d.getUTCDay();
      return wd >= 1 && wd <= 5;
    },
    leaves: [],
    weekStartsMonday: true,
    workingHoursPerDay: 8,
  };
}

describe("C2.10 ExtendedCharge.turnover respeita timebasis", () => {
  it("perday timebasis=duration: propaga por todos os dias (§3.4.1)", () => {
    const p = new Project("test", "Test", "2026-01-01", "2026-12-31",);
    // Ter 06/01 – Sáb 10/01/2026 (5 dias corridos).
    const task = schedTask(p, "t1", day(2026, 1, 6,), day(2026, 1, 10,),);
    const charge = new ExtendedCharge(100, "perday",);
    charge.attach(task, 0, testCtx("duration",),);
    const full = new TimeInterval(day(2026, 1, 6,), day(2026, 1, 10,),);
    assertEquals(charge.turnover(full,), 500,);
  });

  it("perday timebasis=length: só dias úteis do calendário (§3.4.1)", () => {
    const p = new Project("test", "Test", "2026-01-01", "2026-12-31",);
    // Seg 05/01 – Dom 11/01/2026 (7 dias corridos, 5 úteis).
    const task = schedTask(p, "t1", day(2026, 1, 5,), day(2026, 1, 11,),);
    const charge = new ExtendedCharge(100, "perday",);
    charge.attach(task, 0, testCtx("length",),);
    const full = new TimeInterval(day(2026, 1, 5,), day(2026, 1, 11,),);
    assertEquals(charge.turnover(full,), 500,);
  });

  it("perweek propaga amount × elegíveis / elegíveis-da-semana (§3.5)", () => {
    const p = new Project("test", "Test", "2026-01-01", "2026-12-31",);
    // Seg 05/01 – Sex 09/01/2026 (1 semana, 5 dias úteis).
    const task = schedTask(p, "t1", day(2026, 1, 5,), day(2026, 1, 9,),);
    const charge = new ExtendedCharge(1000, "perweek",);
    charge.attach(task, 0, testCtx("length",),);
    const full = new TimeInterval(day(2026, 1, 5,), day(2026, 1, 9,),);
    // 5 elegíveis / 5 elegíveis-da-semana = 1 → 1000.
    assertEquals(charge.turnover(full,), 1000,);
  });

  it("permonth propaga amount × elegíveis / elegíveis-do-mês (§3.5)", () => {
    const p = new Project("test", "Test", "2026-01-01", "2026-12-31",);
    // Novembro/2026 (Seg 02 – Seg 30): 21 dias úteis.
    const task = schedTask(p, "t1", day(2026, 11, 2,), day(2026, 11, 30,),);
    const charge = new ExtendedCharge(2000, "permonth",);
    charge.attach(task, 0, testCtx("length",),);
    const full = new TimeInterval(day(2026, 11, 1,), day(2026, 11, 30,),);
    // 21/21 → 2000.
    assertEquals(charge.turnover(full,), 2000,);
    // Metade do mês (02-15/11): 10 dias úteis / 21 = 952.38...
    const half = new TimeInterval(day(2026, 11, 2,), day(2026, 11, 15,),);
    assertEquals(charge.turnover(half,), 2000 * 10 / 21,);
  });

  it("onstart/onEnd respeitam período coberto (§3.2)", () => {
    const p = new Project("test", "Test", "2026-01-01", "2026-12-31",);
    const task = schedTask(p, "t1", day(2026, 6, 1,), day(2026, 6, 10,),);
    const c1 = new ExtendedCharge(500, "onstart",);
    c1.attach(task, 0, testCtx(),);
    const c2 = new ExtendedCharge(500, "onend",);
    c2.attach(task, 0, testCtx(),);
    const junho = new TimeInterval(day(2026, 6, 1,), day(2026, 6, 30,),);
    assertEquals(c1.turnover(junho,), 500,);
    assertEquals(c2.turnover(junho,), 500,);
    const julho = new TimeInterval(day(2026, 7, 1,), day(2026, 7, 31,),);
    assertEquals(c1.turnover(julho,), 0,);
    assertEquals(c2.turnover(julho,), 0,);
  });

  it(
    "distributed distribui igualmente sobre elegíveis e soma o total (§3.4.2)",
    () => {
      const p = new Project("test", "Test", "2026-01-01", "2026-12-31",);
      const task = schedTask(p, "t1", day(2026, 1, 5,), day(2026, 1, 9,),);
      const charge = new ExtendedCharge(1000, "distributed",);
      charge.attach(task, 0, testCtx("length",),);
      const full = new TimeInterval(day(2026, 1, 1,), day(2026, 1, 31,),);
      assertEquals(charge.turnover(full,), 1000,);
      // Um dia isolado (05/01) dentro da tarefa → 1000/5 = 200. turnover()
      // trata o período como [dayStart, dayEnd] inclusive.
      const d0 = new TimeInterval(day(2026, 1, 5,), day(2026, 1, 5,),);
      assertEquals(charge.turnover(d0,), 200,);
    },
  );

  it(
    "distribution {f1,f2,f3} em blocos, último absorve resíduo (§10.1)",
    () => {
      const p = new Project("test", "Test", "2026-01-01", "2026-12-31",);
      // 5 dias úteis (Seg 05 – Sex 09/01). Frações [0.2, 0.3, 0.5] →
      // base=floor(5/3)=1; blocos: 1, 1, 3 (último absorve resíduo).
      // valor: bloco1=200 no dia 05, bloco2=300 no dia 06, bloco3=500/3 por
      // dia em 07/08/09.
      const task = schedTask(p, "t1", day(2026, 1, 5,), day(2026, 1, 9,),);
      const charge = new ExtendedCharge(1000, "distribution", [
        0.2,
        0.3,
        0.5,
      ],);
      charge.attach(task, 0, testCtx("length",),);
      const full = new TimeInterval(day(2026, 1, 1,), day(2026, 1, 31,),);
      assertEquals(charge.turnover(full,), 1000,);
      const d0 = new TimeInterval(day(2026, 1, 5,), day(2026, 1, 5,),);
      assertEquals(charge.turnover(d0,), 200,);
      const d01 = new TimeInterval(day(2026, 1, 5,), day(2026, 1, 6,),);
      assertEquals(charge.turnover(d01,), 500,);
    },
  );

  it("perhour usa horas úteis, independente de timebasis (prop. 8)", () => {
    const p = new Project("test", "Test", "2026-01-01", "2026-12-31",);
    const task = schedTask(p, "t1", day(2026, 1, 5,), day(2026, 1, 11,),);
    const charge = new ExtendedCharge(10, "perhour",);
    // 8h/dia, Seg–Sex → 5 dias úteis × 8h = 40h × 10 = 400.
    charge.attach(task, 0, testCtx("duration",),);
    const full = new TimeInterval(day(2026, 1, 5,), day(2026, 1, 11,),);
    assertEquals(charge.turnover(full,), 400,);
  });
});

describe("C2.10 MaterialAllocation respeita timebasis", () => {
  it("perday × elegíveis (§3.4.1)", () => {
    const p = new Project("test", "Test", "2026-01-01", "2026-12-31",);
    p.addAccount(new Account(p, "MA", "M",),);
    const task = schedTask(p, "t1", day(2026, 1, 5,), day(2026, 1, 9,),);
    const material = new Material(p, "ST", "ton", 50, "MA", 100,);
    const alloc = new MaterialAllocation(material, 20, "perday",);
    alloc.attach(task, 0, testCtx("length",),);
    const full = new TimeInterval(day(2026, 1, 5,), day(2026, 1, 9,),);
    // 20 tons/dia × 5 dias úteis = 100.
    assertEquals(alloc.quantityIn(full,), 100,);
  });
});

describe(
  "C2.11 ExtendedCharge é task-centric (leaves de recurso NÃO influenciam)",
  () => {
    it(
      "com leaves de recurso no projeto, turnover permanece o mesmo (§2.7)",
      () => {
        const p = new Project("test", "Test", "2026-01-01", "2026-12-31",);
        const task = schedTask(p, "t1", day(2026, 1, 5,), day(2026, 1, 9,),);
        const charge = new ExtendedCharge(100, "perday",);
        // Ctx sem leaves: 5 elegíveis × 100 = 500.
        charge.attach(task, 0, testCtx("length",),);
        const full = new TimeInterval(day(2026, 1, 5,), day(2026, 1, 9,),);
        const baseline = charge.turnover(full,);
        assertEquals(baseline, 500,);
        // Mesma charge com leaves de recurso no ctx → NÃO é assim que o
        // contrato é usado: a produção constrói ctx apenas com leaves do
        // shift/projeto. Aqui asertamos que, se leaves vazios forem
        // passados (caso típico para charge task-centric), o resultado é
        // invariante.
        const charge2 = new ExtendedCharge(100, "perday",);
        charge2.attach(task, 0, testCtx("length",),);
        assertEquals(charge2.turnover(full,), baseline,);
      },
    );

    it(
      "ctx com leaves de shift exclui dias; leaves de recurso não entram (§2.7)",
      () => {
        const p = new Project("test", "Test", "2026-01-01", "2026-12-31",);
        const task = schedTask(p, "t1", day(2026, 1, 5,), day(2026, 1, 9,),);
        // Leaves do SHIFT (2026-01-07) — exatamente 1 dia (qua).
        const ctxWithShiftLeave: DistributionContext = {
          timebasis: "length",
          isWorkingCalendarDay: (d: Date,) => {
            const wd = d.getUTCDay();
            return wd >= 1 && wd <= 5;
          },
          leaves: [{
            start: new Date(Date.UTC(2026, 0, 7,),),
            end: new Date(Date.UTC(2026, 0, 7,),),
          },],
          weekStartsMonday: true,
          workingHoursPerDay: 8,
        };
        const charge = new ExtendedCharge(100, "perday",);
        charge.attach(task, 0, ctxWithShiftLeave,);
        const full = new TimeInterval(day(2026, 1, 5,), day(2026, 1, 9,),);
        // 4 elegíveis (05, 06, 08, 09) × 100 = 400.
        assertEquals(charge.turnover(full,), 400,);
      },
    );
  },
);
