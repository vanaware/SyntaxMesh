import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { MessageHandlerInstance, } from "../src/message-handler.ts";
import { MessageType, } from "../src/message.ts";
import { TjRuntimeError, } from "../src/model/errors.ts";
import { SourceFileInfo, } from "../src/source-file-info.ts";
import { Scenario, } from "../src/model/scenario.ts";

describe("MessageHandlerInstance", () => {
  let mh: MessageHandlerInstance;

  beforeEach(() => {
    mh = new MessageHandlerInstance();
    mh.reset();
  },);

  it("reset limpa", () => {
    mh.warning("w1", "msg",);
    try {
      mh.error("e1", "msg",);
    } catch (_) {
      // Expected
    }
    assertEquals(mh.messages.length, 2,);
    assertEquals(mh.errors, 1,);

    mh.reset();
    assertEquals(mh.messages.length, 0,);
    assertEquals(mh.errors, 0,);
    assertEquals(mh.outputLevel, 2,);
    assertEquals(mh.logLevel, 2,);
    assertEquals(mh.logFile, null,);
    assertEquals(mh.hideScenario, false,);
    assertEquals(mh.abortOnWarning, false,);
    assertEquals(mh.baselineSFI, null,);
    assertEquals(mh.trapSetup, false,);
  });

  it("clear mantém config", () => {
    mh.outputLevel = 3;
    mh.abortOnWarning = true;
    mh.clear();
    assertEquals(mh.outputLevel, 3,);
    assertEquals(mh.abortOnWarning, true,);
    assertEquals(mh.messages.length, 0,);
    assertEquals(mh.errors, 0,);
    assertEquals(mh.logLevel, 2,);
    assertEquals(mh.logFile, null,);
    assertEquals(mh.hideScenario, false,);
    assertEquals(mh.baselineSFI, null,);
    assertEquals(mh.trapSetup, false,);
  });

  it("warning não incrementa errors", () => {
    mh.warning("w1", "msg",);
    assertEquals(mh.errors, 0,);
    assertEquals(mh.messages.length, 1,);
  });

  it("error com trapSetup lança TjRuntimeError", () => {
    // Ruby MessageHandler.rb l.294-296: raise só com trap do thread ativo.
    mh.trapSetup = true;
    assertThrows(
      () => mh.error("e1", "msg",),
      TjRuntimeError,
    );
    assertEquals(mh.errors, 1,);
    assertEquals(mh.messages.length, 1,);
    mh.trapSetup = false;
  });

  it("error sem trapSetup apenas acumula (CLI faria exit 1)", () => {
    mh.error("e1", "msg",);
    assertEquals(mh.errors, 1,);
    assertEquals(mh.messages.length, 1,);
  });

  it("fatal lança TjRuntimeError", () => {
    assertThrows(
      () => mh.fatal("f1", "msg",),
      TjRuntimeError,
    );
    assertEquals(mh.errors, 1,);
    assertEquals(mh.messages.length, 1,);
  });

  it("critical incrementa errors sem lançar", () => {
    mh.critical("c1", "msg",);
    assertEquals(mh.errors, 1,);
    assertEquals(mh.messages.length, 1,);
  });

  it("info não incrementa errors", () => {
    mh.info("i1", "msg",);
    assertEquals(mh.errors, 0,);
    assertEquals(mh.messages.length, 1,);
  });

  it("debug não incrementa errors", () => {
    mh.debug("d1", "msg",);
    assertEquals(mh.errors, 0,);
    assertEquals(mh.messages.length, 1,);
  });

  it("abortOnWarning faz warning lançar", () => {
    mh.abortOnWarning = true;
    assertThrows(
      () => mh.warning("w1", "msg",),
      TjRuntimeError,
    );
    assertEquals(mh.errors, 0,);
  });

  it("baselineSFI ajusta SourceFileInfo das mensagens", () => {
    const sfi = new SourceFileInfo("test.tjp", 10, 5,);
    mh.baselineSFI = sfi;
    mh.warning("w1", "msg",);
    assertEquals(mh.messages[0]?.sourceFileInfo, sfi,);
  });

  it("to_s concatena mensagens", () => {
    mh.warning("w1", "msg1",);
    mh.info("i1", "msg2",);
    assertEquals(mh.to_s().includes("w1: msg1",), true,);
    assertEquals(mh.to_s().includes("i1: msg2",), true,);
  });
});
