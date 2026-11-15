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
import {
  getLocalParts,
  getOffsetSeconds,
  getTimeZoneAbbr,
} from "../../src/time/timezone.ts";

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

/**
 * Instantes representativos: época, negativo, virada de ano, dia bissexto,
 * transições de DST (em outros fusos) e futuro. Para UTC todos são estáveis;
 * comparar com a referência ICU prova que o fast path nativo é idêntico.
 */
const INSTANTS = [
  0, // 1970-01-01T00:00:00Z (quinta)
  -1, // 1969-12-31T23:59:59Z
  86399, // 1970-01-01T23:59:59Z
  utc(2000, 1, 1,), // virada Y2K
  utc(2024, 2, 29,) + 12 * 3600 + 34 * 60 + 56, // dia bissexto
  utc(2024, 3, 10, 7,), // spring-forward EUA (02h→03h EST/EDT)
  utc(2024, 11, 3, 6,), // fall-back EUA
  utc(2025, 12, 31, 23,) + 59 * 60 + 59, // última hora do ano
  utc(2026, 1, 1,), // virada de ano
  utc(2030, 6, 15, 8,) + 30 * 60, // futuro
];

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

/** Referência ICU de `getLocalParts` (caminho lento original, sem fast path). */
function intlParts(epochSecs: number, timeZone: string,) {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
    hourCycle: "h23",
    weekday: "long",
  },);
  const parts = fmt.formatToParts(new Date(epochSecs * 1000,),);
  const num = (type: string,) =>
    parseInt(parts.find((p,) => p.type === type)?.value ?? "0", 10,);
  const wd = parts.find((p,) => p.type === "weekday")?.value ?? "";
  return {
    year: num("year",),
    month: num("month",),
    day: num("day",),
    hour: num("hour",) % 24,
    minute: num("minute",),
    second: num("second",),
    weekday: Math.max(0, WEEKDAY_NAMES.indexOf(wd,),),
  };
}

/** Referência ICU de `getOffsetSeconds` (via `shortOffset`). */
function intlOffset(epochSecs: number, timeZone: string,): number {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "shortOffset",
  },);
  const name = fmt.formatToParts(new Date(epochSecs * 1000,),)
    .find((p,) => p.type === "timeZoneName")?.value ?? "";
  const m = name.match(/GMT?([+-])(\d{1,2})(?::(\d{2}))?/,);
  if (!m) return 0;
  const sign = m[1] === "-" ? -1 : 1;
  return sign * (parseInt(m[2] ?? "0",) * 3600 + parseInt(m[3] ?? "0",) * 60);
}

/** Referência ICU de `getTimeZoneAbbr` (via `short`). */
function intlAbbr(epochSecs: number, timeZone: string,): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "short",
  },);
  return fmt.formatToParts(new Date(epochSecs * 1000,),)
    .find((p,) => p.type === "timeZoneName")?.value || timeZone;
}

describe("UTC fast path (26.14)", () => {
  it("getLocalParts(UTC) é idêntico ao caminho Intl", () => {
    for (const secs of INSTANTS) {
      assertEquals(
        getLocalParts(secs, "UTC",),
        intlParts(secs, "UTC",),
        `instante ${secs}`,
      );
    }
  });

  it("getOffsetSeconds(UTC) é 0 e coincide com o Intl", () => {
    for (const secs of INSTANTS) {
      assertEquals(getOffsetSeconds(secs, "UTC",), 0, `instante ${secs}`,);
      assertEquals(
        getOffsetSeconds(secs, "UTC",),
        intlOffset(secs, "UTC",),
        `instante ${secs}`,
      );
    }
  });

  it("getTimeZoneAbbr(UTC) é 'UTC' como renderiza o ICU", () => {
    for (const secs of INSTANTS) {
      assertEquals(getTimeZoneAbbr(secs, "UTC",), "UTC", `instante ${secs}`,);
      assertEquals(
        getTimeZoneAbbr(secs, "UTC",),
        intlAbbr(secs, "UTC",),
        `instante ${secs}`,
      );
    }
  });
});
