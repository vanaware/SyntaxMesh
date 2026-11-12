/**
 * `time/timezone.ts` — semantic guarantees of the shared formatter cache.
 *
 * Reusing `Intl.DateTimeFormat` instances is a pure performance refactor:
 * every observable result must stay identical to a freshly constructed
 * formatter — DST transitions, half-hour offsets, invalid zones and cache
 * eviction across many zones included. The offset oracle below uses the
 * independent `longOffset` ICU path to cross-check the `shortOffset` one.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import {
  formatTimezoneOffset,
  getLocalParts,
  getOffsetSeconds,
  getTimeZoneAbbr,
  isValidTimeZone,
} from "../../src/time/timezone.ts";

/** Seconds since the epoch of a UTC date. */
function utc(
  year: number,
  month: number,
  day: number,
  hour = 0,
  minute = 0,
  second = 0,
): number {
  return Date.UTC(year, month - 1, day, hour, minute, second,) / 1000;
}

/** Independent offset oracle: fresh formatter, `longOffset` ICU path. */
function oracleOffset(epochSecs: number, zone: string,): number {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    timeZoneName: "longOffset",
  },);
  const parts = formatter.formatToParts(new Date(epochSecs * 1000,),);
  const name = parts.find((p,) => p.type === "timeZoneName")?.value ?? "GMT";
  const match = name.match(/GMT([+-])(\d{2}):(\d{2})/,);
  if (!match) return 0;
  const sign = match[1] === "-" ? -1 : 1;
  return sign * (parseInt(match[2]!,) * 3600 + parseInt(match[3]!,) * 60);
}

describe("timezone formatter cache semantics", () => {
  it("offset varies with the date within the same zone (DST)", () => {
    const winter = utc(2026, 1, 15,);
    const summer = utc(2026, 7, 15,);
    // Interleave zones and seasons: a reused formatter must resolve the
    // offset per formatted date, never freeze the first one.
    for (let i = 0; i < 10; i++) {
      assertEquals(getOffsetSeconds(winter, "Europe/Berlin",), 3600,);
      assertEquals(getOffsetSeconds(winter, "America/New_York",), -18000,);
      assertEquals(getOffsetSeconds(summer, "Europe/Berlin",), 7200,);
      assertEquals(getOffsetSeconds(summer, "America/New_York",), -14400,);
    }
  });

  it("local parts follow the spring-forward instant", () => {
    // Berlin 2026-03-29: 02:00 → 03:00 local at 01:00 UTC.
    const before = getLocalParts(
      utc(2026, 3, 29, 0, 59, 59,),
      "Europe/Berlin",
    );
    assertEquals(before.hour, 1,);
    assertEquals(before.minute, 59,);
    assertEquals(before.second, 59,);
    const after = getLocalParts(utc(2026, 3, 29, 1, 0, 0,), "Europe/Berlin",);
    assertEquals(after.hour, 3,);
    assertEquals(after.minute, 0,);
    assertEquals(after.day, 29,);
  });

  it("offset matches the independent longOffset oracle", () => {
    const zones = [
      "UTC",
      "Europe/Berlin",
      "America/New_York",
      "America/Sao_Paulo",
      "Asia/Kathmandu",
      "Pacific/Marquesas",
    ];
    const instants = [
      utc(2026, 1, 15,),
      utc(2026, 3, 29, 1, 30,),
      utc(2026, 7, 15,),
      utc(2026, 10, 25, 1, 30,),
      0,
    ];
    // Two passes: the second one runs entirely on warm cache entries.
    for (let pass = 0; pass < 2; pass++) {
      for (const zone of zones) {
        for (const instant of instants) {
          assertEquals(
            getOffsetSeconds(instant, zone,),
            oracleOffset(instant, zone,),
            `${zone} @ ${instant} (pass ${pass})`,
          );
        }
      }
    }
  });

  it("formatTimezoneOffset follows DST and half-hour offsets", () => {
    assertEquals(
      formatTimezoneOffset(utc(2026, 1, 15,), "Europe/Berlin",),
      "+0100",
    );
    assertEquals(
      formatTimezoneOffset(utc(2026, 7, 15,), "Europe/Berlin",),
      "+0200",
    );
    assertEquals(
      formatTimezoneOffset(utc(2026, 1, 15,), "Asia/Kathmandu",),
      "+0545",
    );
  });

  it("invalid zones keep the documented fallbacks", () => {
    for (let i = 0; i < 3; i++) {
      assertEquals(isValidTimeZone("Not/AZone",), false,);
      assertEquals(isValidTimeZone("",), false,);
      assertEquals(getOffsetSeconds(utc(2026, 1, 15,), "Not/AZone",), 0,);
      const parts = getLocalParts(utc(2026, 1, 15,), "Not/AZone",);
      assertEquals(parts.year, 0,);
      assertEquals(parts.month, 0,);
      assertEquals(parts.day, 0,);
      assertEquals(parts.hour, 0,);
      assertEquals(parts.weekday, 0,);
    }
    assertEquals(isValidTimeZone("UTC",), true,);
    assertEquals(isValidTimeZone("Europe/Berlin",), true,);
  });

  it("eviction across many zones keeps results correct", () => {
    const zones = Intl.supportedValuesOf("timeZone",);
    // More zones than the cache bound: forces FIFO eviction while cycling.
    for (const zone of zones) {
      getLocalParts(utc(2026, 1, 15,), zone,);
      getOffsetSeconds(utc(2026, 7, 15,), zone,);
    }
    // Previously seen entries may have been evicted; results must not change.
    assertEquals(getOffsetSeconds(utc(2026, 1, 15,), "Europe/Berlin",), 3600,);
    assertEquals(getOffsetSeconds(utc(2026, 7, 15,), "Europe/Berlin",), 7200,);
    const midnight = getLocalParts(utc(2026, 6, 1,), "UTC",);
    assertEquals(midnight.hour, 0,);
    assertEquals(midnight.year, 2026,);
    const sample = zones[0]!;
    assertEquals(
      getOffsetSeconds(utc(2026, 1, 15,), sample,),
      oracleOffset(utc(2026, 1, 15,), sample,),
    );
  });

  it("abbreviation reflects the season and falls back to the zone name", () => {
    // ICU short names: Berlin renders as "GMT+1"/"GMT+2" (not "CET"/"CEST").
    assertEquals(
      getTimeZoneAbbr(utc(2026, 1, 15,), "Europe/Berlin",),
      "GMT+1",
    );
    assertEquals(
      getTimeZoneAbbr(utc(2026, 7, 15,), "Europe/Berlin",),
      "GMT+2",
    );
    assertEquals(getTimeZoneAbbr(utc(2026, 1, 15,), "UTC",), "UTC",);
    // Same contract as the previous inline formatter: invalid zone throws.
    assertThrows(() => getTimeZoneAbbr(utc(2026, 1, 15,), "Not/AZone",));
  });
});
