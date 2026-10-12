import { describe, it } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows } from "@std/assert";
import { TrackingScenario, } from "../../src/model/tracking-scenario.ts";

describe("TrackingScenario", () => {
  it("plan", () => {
    const tracking = new TrackingScenario("plan", "plan",);
    assertEquals(tracking.role, "plan");
    assertEquals(tracking.scenarioId, "plan");
  });

  it("real", () => {
    const tracking = new TrackingScenario("real", "real",);
    assertEquals(tracking.role, "real");
    assertEquals(tracking.scenarioId, "real");
  });

  it("optimistic", () => {
    const tracking = new TrackingScenario("optimistic", "optimistic",);
    assertEquals(tracking.role, "optimistic");
    assertEquals(tracking.scenarioId, "optimistic");
  });
});