import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { LOG_LEVELS, MessageHandlerInstance, } from "../src/message-handler.ts";
import { MessageType, } from "../src/message.ts";
import { TjArgumentError, TjRuntimeError, } from "../src/model/errors.ts";
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

/**
 * `MessageHandler#checkLevel` (18.20) — espelho de `MessageHandler.rb:233-245`.
 *
 * `outputLevel`/`logLevel` viraram acessores validados: aceitam inteiro em
 * `0..5` ou um nome de `LogLevels` e lançam `TjArgumentError` (=`ArgumentError`
 * do Ruby) fora disso. Nos dois caminhos de erro o valor anterior é preservado
 * — a validação acontece antes da atribuição do ivar.
 */
describe("checkLevel (18.20)", () => {
  let mh: MessageHandlerInstance;

  beforeEach(() => {
    mh = new MessageHandlerInstance();
    mh.reset();
  },);

  it("aceita inteiros de 0 a 5 e nomes de LogLevels", () => {
    for (const level of [0, 1, 2, 3, 4, 5,]) {
      mh.outputLevel = level;
      assertEquals(mh.outputLevel, level,);
      mh.logLevel = level;
      assertEquals(mh.logLevel, level,);
    }
    // `LogLevels` do Ruby: critical compartilha o 2 com error.
    mh.outputLevel = "warning";
    assertEquals(mh.outputLevel, 3,);
    mh.logLevel = "debug";
    assertEquals(mh.logLevel, 5,);
    mh.logLevel = "critical";
    assertEquals(mh.logLevel, 2,);
  });

  it("inteiro fora da faixa lança TjArgumentError com o número", () => {
    // Ruby l.236: `raise ArgumentError, "Unsupported level #{level}"`.
    const high = assertThrows(() => {
      mh.outputLevel = 6;
    }, TjArgumentError,);
    assertEquals(high.message, "Unsupported level 6",);
    assertEquals(mh.outputLevel, 2,);

    const low = assertThrows(() => {
      mh.logLevel = -1;
    }, TjArgumentError,);
    assertEquals(low.message, "Unsupported level -1",);
    assertEquals(mh.logLevel, 2,);
  });

  it("nome desconhecido repete a redação do Ruby (sem o valor)", () => {
    // Ruby l.239: `unless (level = LogLevels[level])` zera `level`, então a
    // mensagem sai sem o nome.
    const error = assertThrows(() => {
      mh.outputLevel = "bogus" as keyof typeof LOG_LEVELS;
    }, TjArgumentError,);
    assertEquals(error.message, "Unsupported level ",);
    assertEquals(mh.outputLevel, 2,);
  });

  it("fracionário não é Integer e cai no caminho do nome", () => {
    const error = assertThrows(() => {
      mh.logLevel = 2.5;
    }, TjArgumentError,);
    assertEquals(error.message, "Unsupported level ",);
    assertEquals(mh.logLevel, 2,);
  });

  it("LOG_LEVELS espelha o hash do Ruby", () => {
    assertEquals(LOG_LEVELS, {
      none: 0,
      fatal: 1,
      error: 2,
      critical: 2,
      warning: 3,
      info: 4,
      debug: 5,
    },);
  });
});
