/**
 * Unit tests of the pure debouncer (22.4.3). BDD + `@std/assert` with
 * `FakeTime` — deterministic, no real waiting, no `vscode` runtime.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { FakeTime, } from "@std/testing/time";
import { createDebouncer, } from "../../src/client/debounce.ts";

describe("createDebouncer", () => {
  it("coalesces rapid calls into the last one", () => {
    using time = new FakeTime();
    const calls: number[] = [];
    const debounced = createDebouncer(100, (n: number,) => {
      calls.push(n,);
    },);
    debounced(1,);
    debounced(2,);
    debounced(3,);
    assertEquals(calls, [],);
    time.tick(100,);
    assertEquals(calls, [3,],);
  });

  it("cancels the pending call", () => {
    using time = new FakeTime();
    const calls: number[] = [];
    const debounced = createDebouncer(100, (n: number,) => {
      calls.push(n,);
    },);
    debounced(1,);
    assertEquals(debounced.pending(), true,);
    debounced.cancel();
    assertEquals(debounced.pending(), false,);
    time.tick(200,);
    assertEquals(calls, [],);
  });

  it("fires only after the quiet delay elapses", () => {
    using time = new FakeTime();
    const calls: string[] = [];
    const debounced = createDebouncer(50, (s: string,) => {
      calls.push(s,);
    },);
    debounced("a",);
    time.tick(49,);
    assertEquals(calls, [],);
    time.tick(1,);
    assertEquals(calls, ["a",],);
    assertEquals(debounced.pending(), false,);
  });

  it("flushes the pending call immediately without a later double fire", () => {
    using time = new FakeTime();
    const calls: number[] = [];
    const debounced = createDebouncer(100, (n: number,) => {
      calls.push(n,);
    },);
    debounced(7,);
    debounced.flush();
    assertEquals(calls, [7,],);
    assertEquals(debounced.pending(), false,);
    time.tick(200,);
    assertEquals(calls, [7,],);
  });
});
