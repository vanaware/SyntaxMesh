import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { TjTime, TjArgumentError } from "../../src/time/tj-time.ts";

describe("TjTime.fromSeconds", () => {
  it("retorna instância com os segundos", () => {
    const t = TjTime.fromSeconds(1000000000);
    assertEquals(t.toSeconds(), 1000000000);
  });
});

describe("TjTime.now", () => {
  it("retorna tempo próximo ao atual", () => {
    const before = Math.floor(Date.now() / 1000);
    const t = TjTime.now();
    const after = Math.floor(Date.now() / 1000);
    const seconds = t.toSeconds();
    assertEquals(seconds >= before && seconds <= after, true);
  });
});

describe("TjTime.fromDate", () => {
  it("converte Date para TjTime", () => {
    const date = new Date("2026-01-15T12:30:45Z");
    const t = TjTime.fromDate(date);
    assertEquals(t.toSeconds(), Math.floor(date.getTime() / 1000));
  });
});

describe("TjTime.fromString", () => {
  it("parseia YYYY-MM-DD", () => {
    const t = TjTime.fromString("2026-01-15");
    assertEquals(t.toSeconds(), TjTime.fromParts(2026, 1, 15).toSeconds());
  });

  it("parseia YYYY-MM-DD-HH:MM", () => {
    const t = TjTime.fromString("2026-01-15-14:30");
    assertEquals(t.toSeconds(), TjTime.fromParts(2026, 1, 15, 14, 30).toSeconds());
  });

  it("parseia YYYY-MM-DD-HH:MM:SS", () => {
    const t = TjTime.fromString("2026-01-15-14:30:45");
    assertEquals(t.toSeconds(), TjTime.fromParts(2026, 1, 15, 14, 30, 45).toSeconds());
  });

  it("parseia com timezone +HHMM", () => {
    const t = TjTime.fromString("2026-01-15-14:30-0300");
    // -0300 means 3 hours behind UTC, so 14:30 local = 17:30 UTC
    const expected = TjTime.fromParts(2026, 1, 15, 17, 30);
    assertEquals(t.toSeconds(), expected.toSeconds());
  });

  it("parseia com timezone -HHMM", () => {
    const t = TjTime.fromString("2026-01-15-14:30+0300");
    // +0300 means 3 hours ahead of UTC, so 14:30 local = 11:30 UTC
    const expected = TjTime.fromParts(2026, 1, 15, 11, 30);
    assertEquals(t.toSeconds(), expected.toSeconds());
  });

  it("parseia com timezone +0000", () => {
    const t = TjTime.fromString("2026-01-15-14:30+0000");
    assertEquals(t.toSeconds(), TjTime.fromParts(2026, 1, 15, 14, 30).toSeconds());
  });

  it("rejeita ano < 1970", () => {
    assertThrows(() => TjTime.fromString("1969-01-01"), TjArgumentError);
  });

  it("rejeita ano > 2035", () => {
    assertThrows(() => TjTime.fromString("2036-01-01"), TjArgumentError);
  });

  it("rejeita mês inválido", () => {
    assertThrows(() => TjTime.fromString("2026-00-01"), TjArgumentError);
    assertThrows(() => TjTime.fromString("2026-13-01"), TjArgumentError);
  });

  it("rejeita dia inválido para o mês", () => {
    assertThrows(() => TjTime.fromString("2026-02-30"), TjArgumentError);
    assertThrows(() => TjTime.fromString("2026-04-31"), TjArgumentError);
  });

  it("rejeita hora inválida", () => {
    assertThrows(() => TjTime.fromString("2026-01-01-24:00"), TjArgumentError);
    assertThrows(() => TjTime.fromString("2026-01-01-25:00"), TjArgumentError);
  });

  it("rejeita minuto inválido", () => {
    assertThrows(() => TjTime.fromString("2026-01-01-14:60"), TjArgumentError);
  });

  it("rejeita timezone fora do range", () => {
    assertThrows(() => TjTime.fromString("2026-01-01-14:00+1500"), TjArgumentError);
    assertThrows(() => TjTime.fromString("2026-01-01-14:00-1300"), TjArgumentError);
  });

  it("rejeita timezone mal formatado", () => {
    assertThrows(() => TjTime.fromString("2026-01-01-14:00-03"), TjArgumentError);
    assertThrows(() => TjTime.fromString("2026-01-01-14:00-03000"), TjArgumentError);
  });

  it("rejeita formato geral inválido", () => {
    assertThrows(() => TjTime.fromString("01-01-2026"), TjArgumentError);
    assertThrows(() => TjTime.fromString("abc"), TjArgumentError);
  });
});

describe("TjTime.fromParts", () => {
  it("constrói a partir de partes básicas", () => {
    const t = TjTime.fromParts(2026, 1, 15, 14, 30, 45);
    assertEquals(t.toSeconds(), TjTime.fromString("2026-01-15-14:30:45").toSeconds());
  });

  it("usa valores padrão para hora, minuto, segundo", () => {
    const t = TjTime.fromParts(2026, 1, 15);
    assertEquals(t.toSeconds(), TjTime.fromString("2026-01-15").toSeconds());
  });

  it("valida ano fora do range", () => {
    assertThrows(() => TjTime.fromParts(1969, 1, 1), TjArgumentError);
    assertThrows(() => TjTime.fromParts(2036, 1, 1), TjArgumentError);
  });

  it("valida mês fora do range", () => {
    assertThrows(() => TjTime.fromParts(2026, 0, 1), TjArgumentError);
    assertThrows(() => TjTime.fromParts(2026, 13, 1), TjArgumentError);
  });

  it("valida dia para fevereiro em ano bissexto", () => {
    const t = TjTime.fromParts(2024, 2, 29);
    assertEquals(t.toSeconds(), TjTime.fromString("2024-02-29").toSeconds());
    assertThrows(() => TjTime.fromParts(2025, 2, 29), TjArgumentError);
  });
});