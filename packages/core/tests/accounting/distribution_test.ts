/**
 * Testes da regra unificada de distribuição temporal (#6a) — Fase 10
 * Complemento, C2.6–C2.11. Os números esperados vêm dos exemplos
 * formais §4.1–§4.9 de fase-10-complemento2.md.
 *
 * @see docs/syntaxmesh/fases/fase-10-complemento-tarefas.md (Bloco C2.b)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import {
  countEligibleDays,
  countWorkingHours,
  distributeDays,
  distributeFractions,
  type DistributionContext,
  perPeriod,
} from "../../src/accounting/distribution.ts";

/** Dias úteis de calendário = seg–sex (workinghours mon - fri). */
const monFri = (d: Date,): boolean => {
  const w = d.getUTCDay();
  return w >= 1 && w <= 5;
};

const utc = (y: number, m: number, d: number,): Date =>
  new Date(Date.UTC(y, m - 1, d,),);

/** leaves como intervalo fechado [start, end] em UTC. */
function leaves(
  ...ranges: Array<[Date, Date,]>
): Array<{ start: Date; end: Date }> {
  return ranges.map(([start, end,],) => ({ start, end, }));
}

function ctx(
  overrides: Partial<DistributionContext> = {},
): DistributionContext {
  return {
    timebasis: "duration",
    isWorkingCalendarDay: monFri,
    leaves: [],
    weekStartsMonday: true,
    workingHoursPerDay: 8,
    ...overrides,
  };
}

describe("perday (C2.6, exemplo §4.6)", () => {
  // 27/04/2026 (seg) – 08/05/2026 (sex); 01/05/2026 é sexta (feriado no exemplo)
  const start = utc(2026, 4, 27,);
  const end = utc(2026, 5, 8,);

  it("duration conta dias corridos (12 × 1000 = 12000)", () => {
    const c = ctx({ timebasis: "duration", },);
    assertEquals(
      perPeriod("perday", 1000, start, end, c,),
      12000,
    );
  });

  it("length exclui fins de semana e feriados (9 × 1000 = 9000)", () => {
    const c = ctx({
      timebasis: "length",
      leaves: leaves([utc(2026, 5, 1,), utc(2026, 5, 1,),],),
    },);
    assertEquals(
      perPeriod("perday", 1000, start, end, c,),
      9000,
    );
  });

  it("leaves de recurso NÃO influenciam — só as do contexto (C2.11)", () => {
    // Sem leaves no contexto: 10 dias úteis (sem o feriado de 01/05).
    const c = ctx({ timebasis: "length", },);
    assertEquals(
      perPeriod("perday", 1000, start, end, c,),
      10000,
    );
  });
});

describe("perhour sempre horas úteis (C2.6, exemplo §4.7)", () => {
  it("5 dias × 8h = 40 horas, independente do timebasis", () => {
    const start = utc(2026, 6, 1,); // segunda
    const end = utc(2026, 6, 5,); // sexta
    assertEquals(
      perPeriod("perhour", 10, start, end, ctx({ timebasis: "duration", },),),
      400,
    );
    assertEquals(
      perPeriod("perhour", 10, start, end, ctx({ timebasis: "length", },),),
      400,
    );
  });

  it("countWorkingHours exclui dias não úteis", () => {
    const start = utc(2026, 6, 1,); // seg
    const end = utc(2026, 6, 7,); // dom seguinte
    assertEquals(countWorkingHours(start, end, monFri, 8,), 40,);
  });
});

describe("perweek duration — bordas proporcionais (C2.7, exemplo §4.4)", () => {
  it("03/06–17/06 = 5/7 + 7/7 + 3/7 × 5000", () => {
    const c = ctx({ timebasis: "duration", },);
    const parts = perPeriod(
      "perweek",
      5000,
      utc(2026, 6, 3,),
      utc(2026, 6, 17,),
      c,
    );
    assertEquals(Math.round(parts * 100,) / 100, 10714.29,);
  });

  it("weekStartsMonday=false usa semanas domingo–sábado (C2.7)", () => {
    // 03/06/2026 é quarta; semana dom-qui? Não: semana que contém 03/06
    // (quarta) em modelo domingo-início = 31/05 (dom) – 06/06 (sáb).
    const c = ctx({ timebasis: "duration", weekStartsMonday: false, },);
    const parts = perPeriod(
      "perweek",
      5000,
      utc(2026, 6, 3,),
      utc(2026, 6, 6,),
      c,
    );
    // Cobertos 03,04,05,06 = 4 dias de 7 → 4/7 × 5000
    assertEquals(Math.round(parts * 100,) / 100, 2857.14,);
  });
});

describe("perweek length — semanas com feriado (C2.7, exemplo §4.5)", () => {
  // A tabela §4.5 usa valores aproximados (~) inconsistentes com a fórmula
  // formal §3.6 (denominador = dias úteis do calendário DENTRO da semana,
  // numerador = úteis ∩ não-leave ∩ cobertos). Os casos-limite §3.4.3 é que
  // são a norma: semana inteira em férias → 0; semana fora → 0.
  it("semana inteira em férias zera a contribuição (caso-limite §3.4.3)", () => {
    const c = ctx({
      timebasis: "length",
      leaves: leaves([utc(2026, 12, 21,), utc(2026, 12, 27,),],),
    },);
    // Semana 21–27/12 de 2026: úteis 21–25 (26/27 fim de semana); leave
    // cobre 21–25 → numerador 0, denominador 5 → valor 0.
    assertEquals(
      perWeekOfMonth(5000, utc(2026, 12, 21,), utc(2026, 12, 27,), c,),
      0,
    );
  });

  it("semana cheia sem feriado → amount cheio", () => {
    const c = ctx({ timebasis: "length", },);
    // 07–13/12/2026: seg–sex úteis cobertos, sem leave → 5/5 → 5000.
    assertEquals(
      perWeekOfMonth(5000, utc(2026, 12, 7,), utc(2026, 12, 13,), c,),
      5000,
    );
  });

  it("borda de semana proporcional em dias úteis (§4.5 linha 29–31/12)", () => {
    const c = ctx({ timebasis: "length", },);
    // Tarefa 29–31/12/2026 na semana 28/12–03/01: úteis da semana =
    // 28,29,30,31,01 (01/01/2027 é sexta; 02 sábado) = 5; cobertos
    // 29,30,31 = 3 → 3/5 × 5000 = 3000 (fecha com a tabela §4.5).
    const parts = perPeriod(
      "perweek",
      5000,
      utc(2026, 12, 29,),
      utc(2026, 12, 31,),
      c,
    );
    assertEquals(Math.round(parts * 100,) / 100, 3000,);
  });
});

/** Valor de uma única semana wholly dentro da tarefa (helper de teste). */
function perWeekOfMonth(
  amount: number,
  start: Date,
  end: Date,
  c: DistributionContext,
): number {
  return perPeriod("perweek", amount, start, end, c,);
}

describe("permonth — exemplos §4.1/§4.2/§4.3", () => {
  const start = utc(2026, 1, 15,);
  const end = utc(2026, 11, 15,);

  it("duration sem feriados: bordas 17/31 e 15/31, meses cheios 1000", () => {
    const c = ctx({ timebasis: "duration", },);
    const parts = perPeriod("permonth", 1000, start, end, c,);
    // jan 17/31=548.39 + fev..out cheios (9×1000) + nov 15/30=500.
    // Novembro tem 30 dias; tarefa cobre 1–15 → 15/30 (§4.1 fecha 10048.39).
    assertEquals(Math.round(parts * 100,) / 100, 10048.39,);
  });

  it("length com feriado em março: março proporcional 17/22", () => {
    const c = ctx({
      timebasis: "length",
      leaves: leaves([utc(2026, 3, 10,), utc(2026, 3, 14,),],),
    },);
    const parts = perPeriod("permonth", 1000, start, end, c,);
    // Março isolado: 22 úteis; leave 10–14/03 contém 4 úteis (10 ter–14 sex;
    // 14/03/2026 é domingo) → numerador 18 → 18/22 = 818.18.
    // (A tabela §4.2 assume o feriado "+5d" como 5 dias úteis; no calendário
    // seg–sex real são 4. A fórmula §3.6 é a norma.)
    const marco = perPeriod(
      "permonth",
      1000,
      utc(2026, 3, 1,),
      utc(2026, 3, 31,),
      c,
    );
    assertEquals(Math.round(marco * 100,) / 100, 818.18,);
    // Total no intervalo 15/01–15/11: jan 12/22 + fev 20/20 + mar 18/22 +
    // abr–out cheios + nov 10/21 = 9839.83 (fórmula §3.6 exata).
    assertEquals(Math.round(parts * 100,) / 100, 9839.83,);
  });

  it("length com julho inteiro de férias: mês contribui 0 (propriedade 7)", () => {
    const julio = perPeriod(
      "permonth",
      1000,
      utc(2026, 7, 1,),
      utc(2026, 7, 31,),
      ctx({
        timebasis: "length",
        leaves: leaves([utc(2026, 7, 1,), utc(2026, 7, 31,),],),
      },),
    );
    assertEquals(julio, 0,);
    // No intervalo grande, julho a menos que os demais meses: diferença
    // = contribuição de julho sem leave (23/23 = 1000) – 0 ajustado às
    // frações dos demais meses — asserted via diferença direta abaixo.
    const comFerias = perPeriod(
      "permonth",
      1000,
      start,
      end,
      ctx({
        timebasis: "length",
        leaves: leaves([utc(2026, 7, 1,), utc(2026, 7, 31,),],),
      },),
    );
    const semFerias = perPeriod(
      "permonth",
      1000,
      start,
      end,
      ctx({ timebasis: "length", },),
    );
    // Julho vale 1000 sem leave e 0 com; demais meses idênticos.
    assertEquals(Math.round((semFerias - comFerias) * 100,) / 100, 1000,);
  });

  it("duration ignora feriados (propriedade 4)", () => {
    const semLeaves = perPeriod(
      "permonth",
      1000,
      start,
      end,
      ctx({ timebasis: "duration", },),
    );
    const comLeaves = perPeriod(
      "permonth",
      1000,
      start,
      end,
      ctx({
        timebasis: "duration",
        leaves: leaves([utc(2026, 3, 10,), utc(2026, 3, 14,),],),
      },),
    );
    assertEquals(comLeaves, semLeaves,);
  });
});

describe("distributed — total preservado (C2.8, exemplo §4.8)", () => {
  const start = utc(2026, 6, 1,);
  const end = utc(2026, 6, 12,);

  it("duration: 12 dias corridos → 10000/12 por dia, total 10000", () => {
    const c = ctx({ timebasis: "duration", },);
    const days = distributeDays(10000, start, end, c,);
    assertEquals(days.length, 12,);
    assertEquals(Math.round(days[0]! * 1000,) / 1000, 833.333,);
    assertEquals(Math.round(days.reduce((a, b,) => a + b, 0,),), 10000,);
  });

  it("length: 10 dias úteis → 1000 por dia", () => {
    const c = ctx({ timebasis: "length", },);
    const days = distributeDays(10000, start, end, c,);
    assertEquals(days.length, 10,);
    assertEquals(days[0], 1000,);
  });
});

describe("distribution { frações } — exemplo §4.9 (C2.8)", () => {
  it("length com feriado: 6 dias úteis em 3 partes → 500/300/200 por bloco", () => {
    const c = ctx({
      timebasis: "length",
      leaves: leaves([utc(2026, 6, 3,), utc(2026, 6, 3,),],),
    },);
    const parts = distributeFractions(
      1000,
      [0.5, 0.3, 0.2,],
      utc(2026, 6, 1,),
      utc(2026, 6, 9,),
      c,
    );
    assertEquals(parts.length, 6,);
    // Parte 1 (dias 01,02): 2 × 250 = 500; parte 2 (04,05): 2 × 150 = 300;
    // parte 3 (08,09): 2 × 100 = 200.
    assertEquals(
      Math.round(parts.slice(0, 2,).reduce((a, b,) => a + b, 0,),),
      500,
    );
    assertEquals(
      Math.round(parts.slice(2, 4,).reduce((a, b,) => a + b, 0,),),
      300,
    );
    assertEquals(
      Math.round(parts.slice(4, 6,).reduce((a, b,) => a + b, 0,),),
      200,
    );
    assertEquals(Math.round(parts.reduce((a, b,) => a + b, 0,),), 1000,);
  });

  it("resto de dias não divisível absorvido pela última parte (§10.1)", () => {
    // 7 dias úteis (sem feriado), N=3 → blocos 2,2,3 (resto na última).
    const c = ctx({ timebasis: "length", },);
    const parts = distributeFractions(
      700,
      [0.5, 0.3, 0.2,],
      utc(2026, 6, 1,),
      utc(2026, 6, 9,),
      c,
    );
    assertEquals(parts.length, 7,);
    // Duração dos blocos: 2 (350), 2 (210), 3 (140 → 46.666/dia).
    assertEquals(
      Math.round(parts.slice(4, 7,).reduce((a, b,) => a + b, 0,) * 100,) / 100,
      140,
    );
  });

  it("duration conta dias corridos (9 dias ÷ 3 = 3 por parte)", () => {
    const c = ctx({ timebasis: "duration", },);
    const parts = distributeFractions(
      900,
      [0.5, 0.3, 0.2,],
      utc(2026, 6, 1,),
      utc(2026, 6, 9,),
      c,
    );
    assertEquals(parts.length, 9,);
    assertEquals(
      Math.round(parts.slice(0, 3,).reduce((a, b,) => a + b, 0,),),
      450,
    );
  });
});

describe("countEligibleDays (definições formais §5)", () => {
  it("duration: todos os dias contam", () => {
    assertEquals(
      countEligibleDays(
        utc(2026, 6, 1,),
        utc(2026, 6, 12,),
        ctx({ timebasis: "duration", },),
      ),
      12,
    );
  });

  it("length: só dias úteis do calendário não cobertos por leave", () => {
    const c = ctx({
      timebasis: "length",
      leaves: leaves([utc(2026, 6, 3,), utc(2026, 6, 3,),],),
    },);
    // 01–09/06: úteis 01,02,03,04,05,08,09 = 7; menos feriado 03 → 6.
    assertEquals(countEligibleDays(utc(2026, 6, 1,), utc(2026, 6, 9,), c,), 6,);
  });
});
