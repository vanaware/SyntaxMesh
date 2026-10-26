import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { ExtendedCharge, } from "../../src/model/extended-charge.ts";

describe("ExtendedCharge", () => {
  it("onstart", () => {
    const charge = new ExtendedCharge(1000, "onstart",);
    assertEquals(charge.amount, 1000,);
    assertEquals(charge.modifier, "onstart",);
  });

  it("onend", () => {
    const charge = new ExtendedCharge(1000, "onend",);
    assertEquals(charge.modifier, "onend",);
  });

  it("perhour", () => {
    const charge = new ExtendedCharge(10, "perhour",);
    assertEquals(charge.modifier, "perhour",);
  });

  it("perday", () => {
    const charge = new ExtendedCharge(100, "perday",);
    assertEquals(charge.modifier, "perday",);
  });

  it("perweek", () => {
    const charge = new ExtendedCharge(500, "perweek",);
    assertEquals(charge.modifier, "perweek",);
  });

  it("permonth", () => {
    const charge = new ExtendedCharge(1000, "permonth",);
    assertEquals(charge.modifier, "permonth",);
  });

  it("distributed", () => {
    const charge = new ExtendedCharge(1000, "distributed",);
    assertEquals(charge.modifier, "distributed",);
  });

  it("distribution { ... }", () => {
    const charge = new ExtendedCharge(1000, "distribution", [0.3, 0.5, 0.2,],);
    assertEquals(charge.distribution, [0.3, 0.5, 0.2,],);
  });

  it("rejeita distribution que não soma 1.0", () => {
    assertThrows(
      () => new ExtendedCharge(1000, "distribution", [0.3, 0.5,],),
      Error,
    );
  });
});
