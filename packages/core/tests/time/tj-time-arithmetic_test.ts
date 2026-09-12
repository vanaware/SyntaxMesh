import { describe, it } from "@std/testing/bdd";
import { assertEquals, assertThrows } from "@std/assert";
import { TjTime, TjArgumentError } from "../../src/time/tj-time.ts";

describe("TjTime aritmética", () => {
  it("soma segundos", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = t1.addSeconds(86400);
    const expected = TjTime.fromString("2026-01-02");
    assertEquals(t2.toSeconds(), expected.toSeconds());
  });

  it("subtrai segundos", () => {
    const t1 = TjTime.fromString("2026-01-02");
    const t2 = t1.subSeconds(86400);
    const expected = TjTime.fromString("2026-01-01");
    assertEquals(t2.toSeconds(), expected.toSeconds());
  });

  it("diferença entre dois TjTime em segundos", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-03");
    assertEquals(t2.diff(t1), 172800);
    assertEquals(t1.diff(t2), -172800);
  });

  it("módulo", () => {
    const t = TjTime.fromString("2026-01-01");
    assertEquals(t.modulo(86400), t.toSeconds() % 86400);
    assertEquals(t.modulo(3600), t.toSeconds() % 3600);
  });
});

describe("TjTime comparação", () => {
  it("menor", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-02");
    assertEquals(t1.lessThan(t2), true);
    assertEquals(t2.lessThan(t1), false);
  });

  it("maior", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-02");
    assertEquals(t1.greaterThan(t2), false);
    assertEquals(t2.greaterThan(t1), true);
  });

  it("igual", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-01");
    assertEquals(t1.equals(t2), true);
    assertEquals(t1.equals(t2.addSeconds(1)), false);
  });

  it("menor ou igual", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-02");
    assertEquals(t1.lessThanOrEqual(t2), true);
    assertEquals(t2.lessThanOrEqual(t1), false);
    assertEquals(t1.lessThanOrEqual(t1), true);
  });

  it("maior ou igual", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-02");
    assertEquals(t1.greaterThanOrEqual(t2), false);
    assertEquals(t2.greaterThanOrEqual(t1), true);
    assertEquals(t1.greaterThanOrEqual(t1), true);
  });

  it("compareTo retorna -1, 0, 1", () => {
    const t1 = TjTime.fromString("2026-01-01");
    const t2 = TjTime.fromString("2026-01-02");
    assertEquals(t1.compareTo(t2), -1);
    assertEquals(t2.compareTo(t1), 1);
    assertEquals(t1.compareTo(t1), 0);
  });
});

describe("TjTime.upto", () => {
  it("itera de A a B com step", () => {
    const results: number[] = [];
    const start = TjTime.fromString("2026-01-01");
    const end = TjTime.fromString("2026-01-04");
    start.upto(end, 86400, (t) => {
      results.push(t.toSeconds());
    });
    assertEquals(results.length, 3);
    assertEquals(results[0], start.toSeconds());
    assertEquals(results[1], TjTime.fromString("2026-01-02").toSeconds());
    assertEquals(results[2], TjTime.fromString("2026-01-03").toSeconds());
  });

  it("não itera se A >= B", () => {
    const results: number[] = [];
    const start = TjTime.fromString("2026-01-02");
    const end = TjTime.fromString("2026-01-01");
    start.upto(end, 1, (t) => {
      results.push(t.toSeconds());
    });
    assertEquals(results.length, 0);
  });
});