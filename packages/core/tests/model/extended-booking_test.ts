import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TimeInterval, } from "../../src/time/time-interval.ts";
import { ExtendedBooking, } from "../../src/model/extended-booking.ts";

describe("ExtendedBooking", () => {
  it("effort", () => {
    const date = TjTime.fromString("2026-11-01",);
    const booking = new ExtendedBooking("effort", 20, date,);
    assertEquals(booking.type, "effort",);
    assertEquals(booking.value, 20,);
  });

  it("charge", () => {
    const date = TjTime.fromString("2026-11-03",);
    const booking = new ExtendedBooking("charge", 1200, date,);
    assertEquals(booking.type, "charge",);
    assertEquals(booking.value, 1200,);
  });

  it("material", () => {
    const date = TjTime.fromString("2026-11-03",);
    const booking = new ExtendedBooking("material", 550, date,);
    assertEquals(booking.type, "material",);
    assertEquals(booking.value, 550,);
  });

  it("com intervalo", () => {
    const start = TjTime.fromString("2026-11-01",);
    const end = TjTime.fromString("2026-11-05",);
    const interval = new TimeInterval(start, end,);
    const booking = new ExtendedBooking("effort", 20, start, interval,);
    assertEquals(booking.interval, interval,);
  });

  it("rejeita value negativo para effort", () => {
    assertThrows(
      () =>
        new ExtendedBooking("effort", -10, TjTime.fromString("2026-11-01",),),
      Error,
    );
  });

  it("rejeita value negativo para material", () => {
    assertThrows(
      () =>
        new ExtendedBooking("material", -10, TjTime.fromString("2026-11-01",),),
      Error,
    );
  });

  it("aceita charge negativo", () => {
    const booking = new ExtendedBooking(
      "charge",
      -1200,
      TjTime.fromString("2026-11-03",),
    );
    assertEquals(booking.value, -1200,);
  });
});
