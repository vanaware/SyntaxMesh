import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { TjTime, TjArgumentError } from "../../src/time/tj-time.ts";

describe("TjTime.beginOfHour", () => {
  it("zera minutos e segundos", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    const result = t.beginOfHour();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-15-14:00:00").toSeconds());
  });

  it("mantém hora já no início da hora", () => {
    const t = TjTime.fromString("2026-01-15-14:00:00");
    const result = t.beginOfHour();
    assertEquals(result.toSeconds(), t.toSeconds());
  });

  it("funciona para 23:59:59", () => {
    const t = TjTime.fromString("2026-01-15-23:59:59");
    const result = t.beginOfHour();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-15-23:00:00").toSeconds());
  });
});

describe("TjTime.midnight", () => {
  it("zera horas, minutos e segundos", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    const result = t.midnight();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-15-00:00:00").toSeconds());
  });

  it("mantém midnight já no início do dia", () => {
    const t = TjTime.fromString("2026-01-15-00:00:00");
    const result = t.midnight();
    assertEquals(result.toSeconds(), t.toSeconds());
  });

  it("funciona para 23:59:59", () => {
    const t = TjTime.fromString("2026-01-15-23:59:59");
    const result = t.midnight();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-15-00:00:00").toSeconds());
  });
});

describe("TjTime.beginOfWeek", () => {
  it("segunda-feira com startMonday=true retorna mesma segunda", () => {
    // 2026-01-12 é segunda-feira
    const t = TjTime.fromString("2026-01-12-14:30:00");
    const result = t.beginOfWeek(true);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-12-00:00:00").toSeconds());
  });

  it("quarta-feira com startMonday=true retorna segunda anterior", () => {
    // 2026-01-14 é quarta-feira
    const t = TjTime.fromString("2026-01-14-10:00:00");
    const result = t.beginOfWeek(true);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-12-00:00:00").toSeconds());
  });

  it("sábado com startMonday=true retorna segunda anterior", () => {
    // 2026-01-17 é sábado
    const t = TjTime.fromString("2026-01-17-10:00:00");
    const result = t.beginOfWeek(true);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-12-00:00:00").toSeconds());
  });

  it("domingo com startMonday=true retorna segunda seguinte", () => {
    // 2026-01-18 é domingo
    const t = TjTime.fromString("2026-01-18-10:00:00");
    const result = t.beginOfWeek(true);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-19-00:00:00").toSeconds());
  });

  it("domingo com startMonday=false retorna domingo atual", () => {
    // 2026-01-18 é domingo
    const t = TjTime.fromString("2026-01-18-10:00:00");
    const result = t.beginOfWeek(false);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-18-00:00:00").toSeconds());
  });

  it("sábado com startMonday=false retorna domingo anterior", () => {
    // 2026-01-17 é sábado
    const t = TjTime.fromString("2026-01-17-10:00:00");
    const result = t.beginOfWeek(false);
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-11-00:00:00").toSeconds());
  });
});

describe("TjTime.beginOfMonth", () => {
  it("dia do meio do mês retorna dia 1", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    const result = t.beginOfMonth();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });

  it("já no dia 1 mantém dia 1", () => {
    const t = TjTime.fromString("2026-01-01-14:30:45");
    const result = t.beginOfMonth();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });

  it("último dia do mês retorna dia 1", () => {
    const t = TjTime.fromString("2026-01-31-23:59:59");
    const result = t.beginOfMonth();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });

  it("zera horas, minutos e segundos", () => {
    const t = TjTime.fromString("2026-03-20-14:30:45");
    const result = t.beginOfMonth();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-03-01-00:00:00").toSeconds());
  });
});

describe("TjTime.beginOfQuarter", () => {
  it("janeiro (Q1) retorna janeiro", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    const result = t.beginOfQuarter();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });

  it("abril (Q2) retorna abril", () => {
    const t = TjTime.fromString("2026-04-15-14:30:45");
    const result = t.beginOfQuarter();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-04-01-00:00:00").toSeconds());
  });

  it("agosto (Q3) retorna julho", () => {
    const t = TjTime.fromString("2026-08-15-14:30:45");
    const result = t.beginOfQuarter();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-07-01-00:00:00").toSeconds());
  });

  it("novembro (Q4) retorna outubro", () => {
    const t = TjTime.fromString("2026-11-15-14:30:45");
    const result = t.beginOfQuarter();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-10-01-00:00:00").toSeconds());
  });
});

describe("TjTime.beginOfYear", () => {
  it("meio do ano retorna janeiro 1", () => {
    const t = TjTime.fromString("2026-06-15-14:30:45");
    const result = t.beginOfYear();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });

  it("já em janeiro 1 mantém", () => {
    const t = TjTime.fromString("2026-01-01-00:00:00");
    const result = t.beginOfYear();
    assertEquals(result.toSeconds(), t.toSeconds());
  });

  it("último dia do ano retorna janeiro 1", () => {
    const t = TjTime.fromString("2026-12-31-23:59:59");
    const result = t.beginOfYear();
    assertEquals(result.toSeconds(), TjTime.fromString("2026-01-01-00:00:00").toSeconds());
  });
});

describe("TjTime acessores", () => {
  it("wday() retorna dia da semana correto", () => {
    // 2026-01-12 é segunda-feira (weekday=1)
    const t = TjTime.fromString("2026-01-12-14:30:00");
    assertEquals(t.wday(), 1);
  });

  it("hour() retorna hora local", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    assertEquals(t.hour(), 14);
  });

  it("day() retorna dia do mês", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    assertEquals(t.day(), 15);
  });

  it("month() retorna mês", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    assertEquals(t.month(), 1);
  });

  it("year() retorna ano", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    assertEquals(t.year(), 2026);
  });
});

describe("TjTime.to_a", () => {
  it("retorna array [ano, mes, dia, hora, min, seg, weekday]", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    const result = t.to_a();
    assertEquals(result, [2026, 1, 15, 14, 30, 45, 4]);
  });
});