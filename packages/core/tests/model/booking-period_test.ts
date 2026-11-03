/**
 * Onda D3 — `booking-period.ts`: matemática calendar-based do booking
 * temporal (fase-14-c-onda-d-booking-sintaxe-nomenclatura.md §3.D3).
 *
 * Convenção de intervalos do parser: fim **exclusivo** (`d + 24h` = 1 dia;
 * `01 - 04` = 3 dias). O período-alvo fecha ao fim do último dia.
 *
 * @see packages/core/src/model/booking-period.ts
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import {
  isTemporalTail,
  legacyTail,
  overlapDays,
  tailOverlaps,
  valueInPeriod,
} from "../../src/model/booking-period.ts";
import type { BookingTail, } from "../../src/model/booking-period.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";

const D = (s: string,): TjTime => TjTime.fromString(s,);

/** Intervalo `[start, end)` no estilo do parser: `a - b` ⇒ fim em `b` 00:00. */
const IV = (a: string, b: string,): TimeInterval =>
  new TimeInterval(D(a,), D(b,),);

const tail = (
  modifier: BookingTail["modifier"],
  intervals: TimeInterval[],
): BookingTail => ({ modifier, intervals, });

describe("Onda D3 legacyTail (on <data> degenerado)", () => {
  it("é um intervalo de 1 dia com modifier onstart", () => {
    const t = legacyTail(D("2026-02-15",),);
    assertEquals(t.modifier, "onstart",);
    assertEquals(t.intervals.length, 1,);
    assertEquals(
      t.intervals[0]!.start.toSeconds(),
      D("2026-02-15",).toSeconds(),
    );
    assertEquals(isTemporalTail(t,), false, "tail legado não é temporal",);
  });
});

describe("Onda D3 overlapDays / tailOverlaps", () => {
  it("sem período soma os dias dos próprios intervalos", () => {
    assertEquals(
      overlapDays([IV("2026-01-01", "2026-01-04",),], null, null,),
      3,
    );
    // Data despida (d + 24h) = 1 dia.
    assertEquals(
      overlapDays(
        [
          new TimeInterval(
            D("2026-01-01",),
            D("2026-01-01",).sameTimeNextDay(),
          ),
        ],
        null,
        null,
      ),
      1,
    );
  });

  it("sobreposição parcial com o período (fim do período inclui o dia)", () => {
    const ivs = [IV("2026-01-02", "2026-01-06",),]; // dias 02..05
    // Período Jan1–Jan2 (inclusivo): só o dia 02 está nos dois lados.
    assertEquals(overlapDays(ivs, D("2026-01-01",), D("2026-01-02",),), 1,);
    assertEquals(overlapDays(ivs, D("2026-01-05",), D("2026-01-10",),), 1,);
    assertEquals(overlapDays(ivs, D("2026-01-06",), D("2026-01-10",),), 0,);
    assertEquals(overlapDays(ivs, D("2026-01-01",), D("2026-01-31",),), 4,);
  });

  it("múltiplos intervalos somam sobreposições", () => {
    const ivs = [
      IV("2026-01-01", "2026-01-04",),
      IV("2026-02-01", "2026-02-03",),
    ];
    assertEquals(overlapDays(ivs, D("2026-01-01",), D("2026-02-28",),), 5,);
    assertEquals(
      tailOverlaps(tail("perday", ivs,), D("2026-02-15",), D("2026-02-20",),),
      false,
    );
    assertEquals(
      tailOverlaps(tail("perday", ivs,), D("2026-02-02",), D("2026-02-20",),),
      true,
    );
  });
});

describe("Onda D3 isTemporalTail", () => {
  it("onstart pontual não é temporal; onstart multi-dia é", () => {
    assertEquals(
      isTemporalTail(tail("onstart", [IV("2026-01-01", "2026-01-02",),],),),
      false, // 1 dia
    );
    assertEquals(
      isTemporalTail(tail("onstart", [IV("2026-01-01", "2026-01-05",),],),),
      true,
    );
    assertEquals(
      isTemporalTail(tail("distributed", [IV("2026-01-01", "2026-01-02",),],),),
      true, // modifier ≠ onstart já basta
    );
  });
});

describe("Onda D3 valueInPeriod por modifier", () => {
  const period = [D("2026-01-01",), D("2026-01-31",),] as const;

  it("sem período ⇒ valor cheio", () => {
    const t = tail("perday", [IV("2026-01-01", "2026-01-04",),],);
    assertEquals(valueInPeriod(100, t, null, null,), 100,);
  });

  it("onstart: integral no primeiro dia do período", () => {
    const t = tail("onstart", [IV("2026-01-01", "2026-01-11",),],);
    assertEquals(valueInPeriod(100, t, ...period,), 100,);
    // Fora do período (começa depois do fim): 0.
    assertEquals(
      valueInPeriod(100, t, D("2026-02-01",), D("2026-02-28",),),
      0,
    );
  });

  it("onend: integral no último dia do intervalo", () => {
    const t = tail("onend", [IV("2026-01-01", "2026-01-11",),],);
    // O intervalo termina em 2026-01-11 00:00 (fim exclusivo ⇒ dia 10 é o
    // último coberto; a exportação usa end-1s, então o ponto onend é 01-10).
    assertEquals(
      valueInPeriod(100, t, D("2026-01-10",), D("2026-01-31",),),
      100,
    );
    assertEquals(
      valueInPeriod(100, t, D("2026-01-01",), D("2026-01-05",),),
      0,
    );
  });

  it("perday / perhour escalonam pelos dias sobrepostos", () => {
    const t = tail("perday", [IV("2026-01-01", "2026-01-04",),],);
    assertEquals(valueInPeriod(100, t, ...period,), 300,);
    assertEquals(
      valueInPeriod(100, t, D("2026-01-02",), D("2026-01-31",),),
      200,
    );
    const hourly = tail("perhour", [IV("2026-01-01", "2026-01-03",),],);
    assertEquals(valueInPeriod(10, hourly, ...period,), 480,);
  });

  it("perweek / permonth dividem os dias sobrepostos", () => {
    const weekly = tail("perweek", [IV("2026-01-01", "2026-01-15",),],);
    assertEquals(valueInPeriod(700, weekly, ...period,), 1400,); // 14 dias
    const monthly = tail("permonth", [IV("2026-01-01", "2026-01-31",),],);
    assertEquals(valueInPeriod(3000, monthly, ...period,), 3000,); // 30 dias
  });

  it("distributed: proporcional aos dias do período sobre o total", () => {
    const ivs = [
      IV("2026-01-01", "2026-01-06",),
      IV("2026-02-01", "2026-02-06",),
    ];
    const t = tail("distributed", ivs,); // 5 + 5 = 10 dias
    assertEquals(valueInPeriod(1000, t, ...period,), 500,);
    // Jan3–Jan5 (3) + Fev1–Fev3 (3) = 6 de 10 dias ⇒ 600.
    assertEquals(
      valueInPeriod(1000, t, D("2026-01-03",), D("2026-02-03",),),
      600,
    );
  });

  it("legado: ponto dentro/fora do período ⇒ cheio/zero", () => {
    const t = legacyTail(D("2026-02-15",),);
    assertEquals(
      valueInPeriod(48000, t, D("2026-02-01",), D("2026-02-28",),),
      48000,
    );
    assertEquals(
      valueInPeriod(48000, t, D("2026-03-01",), D("2026-03-31",),),
      0,
    );
    assert(isTemporalTail(t,) === false,);
  });
});
