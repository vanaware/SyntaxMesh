/**
 * `time/timezone.ts` — partes locais por fuso (24.6.3).
 *
 * O caso da meia-noite é regressão de **multi-runtime**: o ICU do Node mapeia
 * `hour12: false` para o ciclo `h24` (meia-noite = 24), o que fazia
 * `TjTime.fromParts` lançar `Hour 24 out of range` só no bundle Node — o Deno
 * devolvia 0. `getLocalParts` usa `hourCycle: "h23"`.
 *
 * @see docs/syntaxmesh/fases/fase-24-cli-tarefas.md (24.6.3)
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { getLocalParts, } from "../../src/time/timezone.ts";

/** Segundos desde a época de uma data UTC. */
function utc(year: number, month: number, day: number, hour = 0,): number {
  return Date.UTC(year, month - 1, day, hour,) / 1000;
}

describe("getLocalParts (24.6.3)", () => {
  it("meia-noite é hora 0, nunca 24", () => {
    const parts = getLocalParts(utc(2024, 6, 1,), "UTC",);
    assertEquals(parts.year, 2024,);
    assertEquals(parts.month, 6,);
    assertEquals(parts.day, 1,);
    assertEquals(parts.hour, 0,);
    assertEquals(parts.minute, 0,);
    assertEquals(parts.second, 0,);
  });

  it("nenhuma hora do dia sai do intervalo 0..23", () => {
    const zones = ["UTC", "America/New_York", "Europe/Berlin", "Asia/Tokyo",];
    for (const zone of zones) {
      for (let hour = 0; hour < 24; hour++) {
        const parts = getLocalParts(utc(2024, 6, 1, hour,), zone,);
        assertEquals(
          parts.hour >= 0 && parts.hour <= 23,
          true,
          `${zone} ${hour}h → ${parts.hour}`,
        );
      }
    }
  });

  it("respeita o offset do fuso", () => {
    // 2024-06-01T00:00Z = 2024-05-31T20:00 em Nova York (UTC-4, DST).
    const parts = getLocalParts(utc(2024, 6, 1,), "America/New_York",);
    assertEquals(parts.day, 31,);
    assertEquals(parts.month, 5,);
    assertEquals(parts.hour, 20,);
  });

  it("fuso inválido devolve o objeto zerado", () => {
    const parts = getLocalParts(utc(2024, 6, 1,), "Not/AZone",);
    assertEquals(parts.year, 0,);
    assertEquals(parts.hour, 0,);
  });
});
