/**
 * Browser-safe logging runtime tests (Fase 22 P8, 22.12.20).
 *
 * Progress output must depend on injected capabilities, never on an unbound
 * runtime global. The Deno namespace is removed in the browser-like case while
 * console writes are captured to prove that no fallback output is emitted.
 */
import { afterEach, beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { Log, type LogRuntime, } from "../src/log.ts";

describe("Log runtime", () => {
  let originalRuntime: LogRuntime;

  beforeEach(() => {
    originalRuntime = Log.runtime;
    Log.reset();
  },);

  afterEach(() => {
    Log.runtime = originalRuntime;
    Log.reset();
  },);

  it("treats missing runtime capabilities as a browser-like no-op", () => {
    const denoDescriptor = Object.getOwnPropertyDescriptor(globalThis, "Deno",);
    const originalConsoleError = console.error;
    const writes: string[] = [];
    try {
      assert(Reflect.deleteProperty(globalThis, "Deno",),);
      console.error = (...args: unknown[]) => {
        writes.push(args.map(String,).join(" ",),);
      };
      Log.runtime = {};

      Log.startProgressMeter("Reading file",);
      Log.activity();
      Log.progress(42,);
    } finally {
      console.error = originalConsoleError;
      if (denoDescriptor !== undefined) {
        Object.defineProperty(globalThis, "Deno", denoDescriptor,);
      }
    }

    assertEquals(writes, [],);
    assertEquals(Log.progressPct, 42,);
    assertEquals(Log.progressMeter, "",);
  });

  it("writes the progress-meter lifecycle through an injected terminal", () => {
    const writes: string[] = [];
    Log.runtime = {
      isTerminal: () => true,
      write: (text,) => writes.push(text,),
    };

    Log.startProgressMeter("Report summary",);
    Log.stopProgressMeter();

    assertEquals(writes.length, 2,);
    assert(writes[0]?.includes("[Report summary]",),);
    assert(writes[1]?.includes("concluído",),);
    assertEquals(Log.progressMeter, "",);
  });

  it("writes activity and explicit progress through an injected terminal", () => {
    const writes: string[] = [];
    Log.runtime = {
      isTerminal: () => true,
      write: (text,) => writes.push(text,),
    };

    Log.activity();
    Log.progress(42,);

    assertEquals(writes, ["\rProgress: 1%", "\rProgress: 42%",],);
    assertEquals(Log.progressPct, 42,);
  });

  it("suppresses activity while silent", () => {
    const writes: string[] = [];
    Log.runtime = {
      isTerminal: () => true,
      write: (text,) => writes.push(text,),
    };
    Log.silent = true;

    Log.activity();

    assertEquals(writes, [],);
    assertEquals(Log.progressPct, 0,);
  });

  it("writes nothing when the injected runtime is not a terminal", () => {
    const writes: string[] = [];
    Log.runtime = {
      isTerminal: () => false,
      write: (text,) => writes.push(text,),
    };

    Log.startProgressMeter("Report summary",);
    Log.activity();
    Log.progress(42,);
    Log.stopProgressMeter();

    assertEquals(writes, [],);
    assertEquals(Log.progressPct, 42,);
    assertEquals(Log.progressMeter, "",);
  });

  it("keeps the injected runtime when resetting log state", () => {
    const writes: string[] = [];
    Log.runtime = {
      isTerminal: () => true,
      write: (text,) => writes.push(text,),
    };

    Log.reset();
    Log.progress(25,);

    assertEquals(writes, ["\rProgress: 25%",],);
  });
});
