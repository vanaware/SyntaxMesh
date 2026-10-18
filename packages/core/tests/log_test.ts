import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { Log, } from "../src/log.ts";

describe("Log", () => {
  beforeEach(() => {
    Log.reset();
  },);

  it("progressPct armazena progresso", () => {
    Log.progress(50,);
    assertEquals(Log.progressPct, 50,);
  });

  it("enter registra entrada sem alterar progressPct", () => {
    Log.progress(50,);
    Log.enter("test", "message",);
    assertEquals(Log.progressPct, 50,);
  });

  it("exit registra saída sem alterar progressPct", () => {
    Log.progress(50,);
    Log.exit("test",);
    assertEquals(Log.progressPct, 50,);
  });

  it("reset limpa todos os estáticos", () => {
    Log.progress(50,);
    Log.enter("test", "message",);
    Log.reset();
    assertEquals(Log.progressPct, 0,);
    assertEquals(Log.stack.length, 0,);
    assertEquals(Log.segments.length, 0,);
  });
});
