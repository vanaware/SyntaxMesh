/**
 * Testes BDD do porto fiel de `RuntimeConfig.rb` (F21 1ª onda, 2026-11-10).
 *
 * Cobre:
 *  - `sectionNode`: caminhada por seções pontuadas com prefixo `_`,
 *    retorno `null` em falta/array/non-object.
 *  - `configureFromSection`: cópia apenas de chaves já existentes no alvo,
 *    retorno `false` quando a seção não existe, conversão `Date` →
 *    `YYYY-MM-DD`.
 *  - Integração com `MessageHandlerInstance`: `_global` + `_global._log`
 *    ajustam `outputLevel`, `logLevel`, `logFile`, `abortOnWarning`,
 *    `hideScenario`, `trapSetup` — mesmo seam que Ruby usa em `Tj3Daemon`.
 *
 * @see packages/core/src/runtime-config.ts
 * @see docs/taskjuggler/lib/taskjuggler/RuntimeConfig.rb
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { configureFromSection, sectionNode, } from "../src/runtime-config.ts";
import { MessageHandlerInstance, } from "../src/message-handler.ts";

describe("sectionNode", () => {
  it("retorna null para config nulo/undefined", () => {
    assertEquals(sectionNode(null, "global",), null,);
    assertEquals(sectionNode(undefined, "global",), null,);
  });

  it("resolve uma seção de nível único (_global)", () => {
    const config = { _global: { outputLevel: 4, }, };
    assertEquals(sectionNode(config, "global",), { outputLevel: 4, },);
  });

  it("resolve seção pontuada (_global._log)", () => {
    const config = {
      _global: {
        _log: { logLevel: 5, logFile: "/tmp/tj.log", },
      },
    };
    assertEquals(
      sectionNode(config, "global.log",),
      { logLevel: 5, logFile: "/tmp/tj.log", },
    );
  });

  it("retorna null quando qualquer nível falta", () => {
    const config = { _global: {/* no _log */}, };
    assertEquals(sectionNode(config, "global.log",), null,);
    assertEquals(sectionNode(config, "missing",), null,);
    assertEquals(sectionNode(config, "global.missing.deep",), null,);
  });

  it("retorna null quando o nó é array ou primitivo", () => {
    assertEquals(sectionNode({ _global: [1, 2,], }, "global",), null,);
    assertEquals(sectionNode({ _global: "x", }, "global",), null,);
    assertEquals(sectionNode({ _global: null, }, "global",), null,);
  });
});

describe("configureFromSection", () => {
  it("false quando a seção não existe (nada é alterado)", () => {
    const target = { a: 1, };
    assertEquals(
      configureFromSection(target, { _other: { a: 99, }, }, "global",),
      false,
    );
    assertEquals(target.a, 1,);
  });

  it("copia apenas chaves que já existem no alvo", () => {
    const target = { a: 1, b: 2, };
    const config = { _global: { a: 10, zzz: 99, }, };
    assertEquals(configureFromSection(target, config, "global",), true,);
    assertEquals(target.a, 10,);
    assertEquals(target.b, 2,);
    // Chaves novas não são injetadas no alvo.
    assertEquals("zzz" in target, false,);
  });

  it("retorna true mesmo quando nenhuma chave bate (a seção existia)", () => {
    // Ruby retorna `true` se a seção resolve para Hash; apenas a cópia é
    // silenciosa sobre chaves desconhecidas.
    const target = { a: 1, };
    const config = { _global: { unrelated: 5, }, };
    assertEquals(configureFromSection(target, config, "global",), true,);
    assertEquals(target.a, 1,);
  });

  it("converte Date para string YYYY-MM-DD (local)", () => {
    const target = { when: "", };
    const d = new Date(2026, 4, 18,); // 18 mai 2026, timezone local
    assertEquals(
      configureFromSection(target, { _global: { when: d, }, }, "global",),
      true,
    );
    assertEquals(target.when, "2026-05-18",);
  });

  it("aceita config nulo sem crash", () => {
    const target = { a: 1, };
    assertEquals(configureFromSection(target, null, "global",), false,);
    assertEquals(configureFromSection(target, undefined, "global",), false,);
    assertEquals(target.a, 1,);
  });
});

describe("configureFromSection × MessageHandlerInstance (F24 24.3.11)", () => {
  // Cada teste parte de um handler resetado para não vazar estado.
  const fresh = () => {
    const mhi = MessageHandlerInstance.instance;
    mhi.reset();
    return mhi;
  };

  it("aplica _global (outputLevel, abortOnWarning, hideScenario)", () => {
    const mhi = fresh();
    const config = {
      _global: {
        outputLevel: 5,
        abortOnWarning: true,
        hideScenario: true,
      },
    };
    assert(configureFromSection(mhi, config, "global",),);
    assertEquals(mhi.outputLevel, 5,);
    assertEquals(mhi.abortOnWarning, true,);
    assertEquals(mhi.hideScenario, true,);
    mhi.reset();
  });

  it("aplica _global._log (logLevel, logFile)", () => {
    const mhi = fresh();
    const config = {
      _global: {
        _log: { logLevel: 4, logFile: "/tmp/tj-test.log", },
      },
    };
    assert(configureFromSection(mhi, config, "global.log",),);
    assertEquals(mhi.logLevel, 4,);
    assertEquals(mhi.logFile, "/tmp/tj-test.log",);
    mhi.reset();
  });

  it("ignora chaves estranhas no YAML sem modificar o handler", () => {
    const mhi = fresh();
    const before = {
      outputLevel: mhi.outputLevel,
      logLevel: mhi.logLevel,
      logFile: mhi.logFile,
    };
    const config = {
      _global: { notAField: "x", anotherUnknown: 42, },
    };
    // A seção existe mas nenhuma chave bate → true (contrato fiel a Ruby);
    // nenhuma propriedade do handler é alterada.
    assertEquals(configureFromSection(mhi, config, "global",), true,);
    assertEquals(mhi.outputLevel, before.outputLevel,);
    assertEquals(mhi.logLevel, before.logLevel,);
    assertEquals(mhi.logFile, before.logFile,);
  });

  it("config sem _global é no-op (return false)", () => {
    const mhi = fresh();
    assertEquals(
      configureFromSection(mhi, { _timesheets: { foo: 1, }, }, "global",),
      false,
    );
    mhi.reset();
  });
});
