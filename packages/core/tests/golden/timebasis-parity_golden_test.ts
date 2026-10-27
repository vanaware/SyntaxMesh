/**
 * C2.12 — Golden de regressão: paridade `ExtendedCharge.turnover()` ↔
 * `Charge.turnover()` (tj3) no modo `duration`.
 *
 * Casos que batem exatamente: `onstart`/`onend` (são idênticos a tj3 —
 * só dependem de `period.contains(start)`).
 *
 * Casos com divergência documentada: `perday`/`perweek`/`permonth`/`perhour`
 * diferem de tj3 porque SyntaxMesh conta CALENDAR DAYS TOUCHED (inclusive
 * em ambos endpoints), enquanto tj3 usa `elapsed_seconds / 86400` (half-open).
 * A divergência é intencional (§3.4.1 — "5 dias úteis" é o comportamento
 * esperado). Registrada em `packages/core/tests/golden/known-divergences.json`.
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (C2.12)
 * @see docs/taskjuggler/lib/taskjuggler/Charge.rb (perDiem formula)
 * @see docs/taskjuggler/lib/taskjuggler/TjpSyntaxRules.rb:6292-6311 (aliases)
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertAlmostEquals, } from "@std/assert";
import { Project, } from "../../src/model/project.ts";
import { Task, } from "../../src/model/task.ts";
import { Charge, } from "../../src/finance/charge.ts";
import { ExtendedCharge, } from "../../src/model/extended-charge.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { type DistributionContext, } from "../../src/accounting/distribution.ts";

const TOL = 1e-9;

function day(y: number, m: number, d: number,): TjTime {
  return TjTime.fromDate(new Date(Date.UTC(y, m - 1, d,),),);
}
function durationCtx(): DistributionContext {
  return {
    timebasis: "duration",
    isWorkingCalendarDay: () => true,
    leaves: [],
    weekStartsMonday: true,
    workingHoursPerDay: 8,
  };
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
  // tj3's Charge lê os atributos de cenário `start`/`end`:
  t.setForScenario("start", from, 0,);
  t.setForScenario("end", to, 0,);
  return t;
}

describe("C2.12 Paridade tj3 ↔ ExtendedCharge em modo duration", () => {
  const project = new Project("p", "P", "2026-01-01", "2026-12-31",);

  // Tarefa [Mon 05/01, Fri 09/01] UTC 00:00 → tj3: 4 dias elapsed; SM: 5 dias
  // inclusive. Ver divergência documentada em known-divergences.json.
  const task = schedTask(project, "t1", day(2026, 1, 5,), day(2026, 1, 9,),);
  const fullPeriod = new TimeInterval(day(2026, 1, 1,), day(2026, 1, 31,),);

  it("onstart: SM == tj3 onStart (mesma condição contains)", () => {
    const tj3 = new Charge(500, "onStart", task, 0,);
    const sm = new ExtendedCharge(500, "onstart",);
    sm.attach(task, 0, durationCtx(),);
    assertAlmostEquals(
      sm.turnover(fullPeriod,),
      tj3.turnover(fullPeriod,),
      TOL,
    );
    assert(sm.turnover(fullPeriod,) === 500,);
  });

  it("onend: SM == tj3 onEnd", () => {
    const tj3 = new Charge(500, "onEnd", task, 0,);
    const sm = new ExtendedCharge(500, "onend",);
    sm.attach(task, 0, durationCtx(),);
    assertAlmostEquals(
      sm.turnover(fullPeriod,),
      tj3.turnover(fullPeriod,),
      TOL,
    );
    assert(sm.turnover(fullPeriod,) === 500,);
  });

  it("perday: SM (inclusive) == tj3 (half-open) + amount (diff 1 dia)", () => {
    // Divergência documentada: SM conta dias corridos INCLUSIVE (5 dias para
    // Mon-Fri), tj3 conta elapsed seconds / 86400 (4 dias).
    const tj3 = new Charge(100, "perDiem", task, 0,);
    const sm = new ExtendedCharge(100, "perday",);
    sm.attach(task, 0, durationCtx(),);
    const tj3v = tj3.turnover(fullPeriod,);
    const smv = sm.turnover(fullPeriod,);
    assertAlmostEquals(tj3v, 400, TOL, "tj3: 4 dias × 100",);
    assertAlmostEquals(smv, 500, TOL, "SM: 5 dias × 100",);
    assert(smv - tj3v === 100,);
  });

  it("perweek: SM (inclusive) vs tj3 amount/7 (half-open) — mesma razão /7", () => {
    // tj3 mapeia `perweek X → perDiem X/7`. Formula tj3 = elapsed_days × X/7.
    // SM duration: proporcional por semana = amount × elapsed_days / 7. Mesma
    // fórmula quando há apenas 1 semana no intervalo.
    const tj3 = new Charge(1000 / 7, "perDiem", task, 0,);
    const sm = new ExtendedCharge(1000, "perweek",);
    sm.attach(task, 0, durationCtx(),);
    const tj3v = tj3.turnover(fullPeriod,);
    const smv = sm.turnover(fullPeriod,);
    // tj3: 4 × 1000/7 ≈ 571.43; SM: 5 × 1000/7 ≈ 714.29 — mesma razão 5/4.
    assertAlmostEquals(smv / tj3v, 5 / 4, 1e-9,);
  });

  it("onend fora do período: ambos retornam 0", () => {
    const tj3 = new Charge(500, "onEnd", task, 0,);
    const sm = new ExtendedCharge(500, "onend",);
    sm.attach(task, 0, durationCtx(),);
    const julho = new TimeInterval(day(2026, 7, 1,), day(2026, 7, 31,),);
    assertAlmostEquals(sm.turnover(julho,), tj3.turnover(julho,), TOL,);
    assert(sm.turnover(julho,) === 0,);
  });
});

describe("C2.12 divergências registradas em known-divergences.json", () => {
  it(
    "arquivo de divergências existe e lista timebasis + modificadores SM",
    () => {
      const url = new URL("./known-divergences.json", import.meta.url,);
      const raw = JSON.parse(Deno.readTextFileSync(url,),) as {
        version: string;
        divergences: Array<{ id: string }>;
      };
      assert(raw.version, "version present",);
      const ids = raw.divergences.map((d,) => d.id);
      assert(ids.includes("perday_inclusive_semantics",),);
      assert(ids.includes("permonth_extension",),);
      assert(ids.includes("perhour_working_vs_elapsed",),);
    },
  );
});
