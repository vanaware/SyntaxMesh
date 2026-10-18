import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows } from "@std/assert";
import { Material, } from "../../src/model/material.ts";
import { MaterialAllocation, } from "../../src/model/material-allocation.ts";
import { MockProject, } from "./mock-project.ts";

describe("MaterialAllocation", () => {
  const project = new MockProject();
  const steel = new Material(project, "Steel", "kg", 25.0);

  it("onstart", () => {
    const alloc = new MaterialAllocation(steel, 500, "onstart",);
    assertEquals(alloc.quantity, 500);
    assertEquals(alloc.modifier, "onstart");
  });

  it("onend", () => {
    const alloc = new MaterialAllocation(steel, 500, "onend",);
    assertEquals(alloc.modifier, "onend");
  });

  it("perhour", () => {
    const alloc = new MaterialAllocation(steel, 10, "perhour",);
    assertEquals(alloc.modifier, "perhour");
  });

  it("perday", () => {
    const alloc = new MaterialAllocation(steel, 100, "perday",);
    assertEquals(alloc.modifier, "perday");
  });

  it("perweek", () => {
    const alloc = new MaterialAllocation(steel, 500, "perweek",);
    assertEquals(alloc.modifier, "perweek");
  });

  it("permonth", () => {
    const alloc = new MaterialAllocation(steel, 1000, "permonth",);
    assertEquals(alloc.modifier, "permonth");
  });

  it("distributed", () => {
    const alloc = new MaterialAllocation(steel, 1000, "distributed",);
    assertEquals(alloc.modifier, "distributed");
  });

  it("distribution { ... }", () => {
    const alloc = new MaterialAllocation(steel, 1000, "distribution", [0.3, 0.5, 0.2],);
    assertEquals(alloc.distribution, [0.3, 0.5, 0.2]);
  });

  it("rejeita quantity negativo", () => {
    assertThrows(() => new MaterialAllocation(steel, -100, "onstart",), Error);
  });

  it("rejeita distribution que não soma 1.0", () => {
    assertThrows(() => new MaterialAllocation(steel, 1000, "distribution", [0.3, 0.5],), Error);
  });
});
