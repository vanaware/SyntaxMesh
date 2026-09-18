import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { setCurrentTimeZone, } from "../../src/time/timezone.ts";
import { compat, } from "../../src/compat.ts";
import { TjArgumentError, TjTime, } from "../../src/time/tj-time.ts";

describe("TjTime aritmética", () => {
  it("soma segundos", () => {
    const t1 = TjTime.fromString("2026-01-01",);
    const t2 = t1.addSeconds(86400,);
    const expected = TjTime.fromString("2026-01-02",);
    assertEquals(t2.toSeconds(), expected.toSeconds(),);
  });

  it("subtrai segundos", () => {
    const t1 = TjTime.fromString("2026-01-02",);
    const t2 = t1.subSeconds(86400,);
    const expected = TjTime.fromString("2026-01-01",);
    assertEquals(t2.toSeconds(), expected.toSeconds(),);
  });

  it("diferença entre dois TjTime em segundos", () => {
    const t1 = TjTime.fromString("2026-01-01",);
    const t2 = TjTime.fromString("2026-01-03",);
    assertEquals(t2.diff(t1,), 172800,);
    assertEquals(t1.diff(t2,), -172800,);
  });

  it("módulo", () => {
    const t = TjTime.fromString("2026-01-01",);
    assertEquals(t.modulo(86400,), t.toSeconds() % 86400,);
    assertEquals(t.modulo(3600,), t.toSeconds() % 3600,);
  });
});

describe("TjTime.align", () => {
  it("alinhamento em America/Sao_Paulo (UTC-3)", () => {
    const oldTz = setCurrentTimeZone("America/Sao_Paulo",);
    try {
      // 2026-01-15 14:30:00 BRT (UTC-3) -> UTC 17:30:00
      // align(3600) -> floor((utc + offset)/3600)*3600 - offset
      // offset = -10800, utc = 1768474200
      // floor((1768474200 - 10800)/3600)*3600 - (-10800) = 1768464000
      const t = TjTime.fromString("2026-01-15-14:30:00",);
      const result = t.align(3600,);
      assertEquals(
        result.toSeconds(),
        TjTime.fromString("2026-01-15-14:00:00",).toSeconds(),
      );
    } finally {
      setCurrentTimeZone(oldTz,);
    }
  });

  it("alinhamento com clock maior que o dia em America/Sao_Paulo", () => {
    const oldTz = setCurrentTimeZone("America/Sao_Paulo",);
    try {
      // align(86400) -> floor((utc - 10800)/86400)*86400 + 10800
      // 2026-01-15 14:30 BRT -> UTC 17:30 -> floor((1768474200-10800)/86400)*86400 + 10800 = 1768425600 + 10800 = 1768436400
      // 1768436400 UTC -> 2026-01-15 00:00 BRT
      const t = TjTime.fromString("2026-01-15-14:30:00",);
      const result = t.align(86400,);
      assertEquals(
        result.toSeconds(),
        TjTime.fromString("2026-01-15-00:00:00",).toSeconds(),
      );
    } finally {
      setCurrentTimeZone(oldTz,);
    }
  });
});

describe("TjTime.compareTo(null)", () => {
  it("compareTo(null) retorna -1", () => {
    const t = TjTime.fromString("2026-01-01",);
    assertEquals(t.compareTo(null,), -1,);
  });
});

describe("TjTime.lessThan(null)", () => {
  it("lessThan(null) retorna false", () => {
    const t = TjTime.fromString("2026-01-01",);
    assertEquals(t.lessThan(null,), false,);
  });
});

describe("TjTime.greaterThan(null)", () => {
  it("greaterThan(null) retorna true", () => {
    const t = TjTime.fromString("2026-01-01",);
    assertEquals(t.greaterThan(null,), true,);
  });
});

describe("TjTime.equals(null)", () => {
  it("equals(null) retorna false", () => {
    const t = TjTime.fromString("2026-01-01",);
    assertEquals(t.equals(null,), false,);
  });
});

describe("TjTime comparação", () => {
  it("menor", () => {
    const t1 = TjTime.fromString("2026-01-01",);
    const t2 = TjTime.fromString("2026-01-02",);
    assertEquals(t1.lessThan(t2,), true,);
    assertEquals(t2.lessThan(t1,), false,);
  });

  it("maior", () => {
    const t1 = TjTime.fromString("2026-01-01",);
    const t2 = TjTime.fromString("2026-01-02",);
    assertEquals(t1.greaterThan(t2,), false,);
    assertEquals(t2.greaterThan(t1,), true,);
  });

  it("igual", () => {
    const t1 = TjTime.fromString("2026-01-01",);
    const t2 = TjTime.fromString("2026-01-01",);
    assertEquals(t1.equals(t2,), true,);
    assertEquals(t1.equals(t2.addSeconds(1,),), false,);
  });

  it("menor ou igual", () => {
    const t1 = TjTime.fromString("2026-01-01",);
    const t2 = TjTime.fromString("2026-01-02",);
    assertEquals(t1.lessThanOrEqual(t2,), true,);
    assertEquals(t2.lessThanOrEqual(t1,), false,);
    assertEquals(t1.lessThanOrEqual(t1,), true,);
  });

  it("maior ou igual", () => {
    const t1 = TjTime.fromString("2026-01-01",);
    const t2 = TjTime.fromString("2026-01-02",);
    assertEquals(t1.greaterThanOrEqual(t2,), false,);
    assertEquals(t2.greaterThanOrEqual(t1,), true,);
    assertEquals(t1.greaterThanOrEqual(t1,), true,);
  });

  it("compareTo retorna -1, 0, 1", () => {
    const t1 = TjTime.fromString("2026-01-01",);
    const t2 = TjTime.fromString("2026-01-02",);
    assertEquals(t1.compareTo(t2,), -1,);
    assertEquals(t2.compareTo(t1,), 1,);
    assertEquals(t1.compareTo(t1,), 0,);
  });

  it("compareTo(null) retorna -1", () => {
    const t = TjTime.fromString("2026-01-01",);
    assertEquals(t.compareTo(null,), -1,);
  });

  it("lessThan(null) retorna false", () => {
    const t = TjTime.fromString("2026-01-01",);
    assertEquals(t.lessThan(null,), false,);
  });

  it("greaterThan(null) retorna true", () => {
    const t = TjTime.fromString("2026-01-01",);
    assertEquals(t.greaterThan(null,), true,);
  });

  it("equals(null) retorna false", () => {
    const t = TjTime.fromString("2026-01-01",);
    assertEquals(t.equals(null,), false,);
  });
});

describe("TjTime.upto", () => {
  it("itera de A a B com step", () => {
    const results: number[] = [];
    const start = TjTime.fromString("2026-01-01",);
    const end = TjTime.fromString("2026-01-04",);
    start.upto(end, 86400, (t,) => {
      results.push(t.toSeconds(),);
    },);
    assertEquals(results.length, 3,);
    assertEquals(results[0], start.toSeconds(),);
    assertEquals(results[1], TjTime.fromString("2026-01-02",).toSeconds(),);
    assertEquals(results[2], TjTime.fromString("2026-01-03",).toSeconds(),);
  });

  it("não itera se A >= B", () => {
    const results: number[] = [];
    const start = TjTime.fromString("2026-01-02",);
    const end = TjTime.fromString("2026-01-01",);
    start.upto(end, 1, (t,) => {
      results.push(t.toSeconds(),);
    },);
    assertEquals(results.length, 0,);
  });
});

describe("TjTime.order", () => {
  it("retorna [menor, maior]", () => {
    const t1 = TjTime.fromString("2026-01-01",);
    const t2 = TjTime.fromString("2026-01-03",);
    const [smaller, larger,] = t1.order(t2,);
    assertEquals(smaller.toSeconds(), t1.toSeconds(),);
    assertEquals(larger.toSeconds(), t2.toSeconds(),);
  });

  it("retorna [this, other] quando this < other", () => {
    const t1 = TjTime.fromString("2026-01-01",);
    const t2 = TjTime.fromString("2026-01-02",);
    const [smaller, larger,] = t1.order(t2,);
    assertEquals(smaller.toSeconds(), t1.toSeconds(),);
    assertEquals(larger.toSeconds(), t2.toSeconds(),);
  });

  it("retorna [other, this] quando other < this", () => {
    const t1 = TjTime.fromString("2026-01-02",);
    const t2 = TjTime.fromString("2026-01-01",);
    const [smaller, larger,] = t1.order(t2,);
    assertEquals(smaller.toSeconds(), t2.toSeconds(),);
    assertEquals(larger.toSeconds(), t1.toSeconds(),);
  });
});

describe("TjTime.countIntervals", () => {
  it("conta intervalos de 1 dia", () => {
    const start = TjTime.fromString("2026-01-01",);
    const end = TjTime.fromString("2026-01-04",);
    const t = TjTime.fromString("2026-01-01",);
    const count = t.countIntervals(
      start,
      end,
      (x: TjTime,) => x.addSeconds(86400,),
    );
    assertEquals(count, 3,);
  });

  it("retorna 0 se start >= end", () => {
    const start = TjTime.fromString("2026-01-02",);
    const end = TjTime.fromString("2026-01-01",);
    const t = TjTime.fromString("2026-01-01",);
    const count = t.countIntervals(
      start,
      end,
      (x: TjTime,) => x.addSeconds(1,),
    );
    assertEquals(count, 0,);
  });
});

describe("TjTime.nextDayOfWeek", () => {
  it("retorna próxima segunda a partir de quarta", () => {
    // 2026-01-14 é quarta-feira (wday=3)
    const t = TjTime.fromString("2026-01-14-10:00:00",);
    const result = t.nextDayOfWeek(1,); // Monday
    assertEquals(result.wday(), 1,);
    assertEquals(result.hour(), 10,);
  });

  it("retorna próximo domingo a partir de sábado", () => {
    // 2026-01-17 é sábado (wday=6)
    const t = TjTime.fromString("2026-01-17-10:00:00",);
    const result = t.nextDayOfWeek(0,); // Sunday
    assertEquals(result.wday(), 0,);
    assertEquals(result.hour(), 10,);
  });

  it("retorna próximo dia da semana nunca hoje", () => {
    // 2026-01-12 é segunda-feira (wday=1)
    const t = TjTime.fromString("2026-01-12-10:00:00",);
    const result = t.nextDayOfWeek(1,); // Monday
    // Deve ser a próxima segunda, não hoje
    assertEquals(
      result.toSeconds(),
      TjTime.fromString("2026-01-19-10:00:00",).toSeconds(),
    );
  });
});
