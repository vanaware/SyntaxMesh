/**
 * 16.11 — `StdIoWrapper` (Ruby `StdIoWrapper.rb`, arquivo completo).
 *
 * No browser a troca de `$stdout`/`$stderr` vira troca de
 * `console.log`/`console.error`; `stdIn` é aceito e ignorado (Category B).
 *
 * @see docs/taskjuggler/lib/taskjuggler/StdIoWrapper.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.11)
 */

import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { type Results, stdIoWrapper, } from "../../src/utils/std-io-wrapper.ts";

describe("stdIoWrapper (16.11.2)", () => {
  it("devolve o valor de fn com saídas vazias quando nada é escrito", () => {
    const res = stdIoWrapper(null, () => 42,);
    assertEquals(res.returnValue, 42,);
    assertEquals(res.stdOut, "",);
    assertEquals(res.stdErr, "",);
  });

  it("devolve undefined quando fn não retorna nada", () => {
    const res = stdIoWrapper(null, () => {},);
    assertEquals(res.returnValue, undefined,);
  });

  it("tipo Results expõe returnValue/stdOut/stdErr", () => {
    const res: Results<string> = stdIoWrapper(null, () => "ok",);
    assertEquals(res.returnValue, "ok",);
    assert("stdOut" in res,);
    assert("stdErr" in res,);
  });
});

describe("stdIoWrapper — console original (16.11.3/16.11.6)", () => {
  it("restaura console.log e console.error após fn", () => {
    const log = console.log;
    const error = console.error;
    stdIoWrapper(null, () => undefined,);
    assertEquals(console.log, log,);
    assertEquals(console.error, error,);
  });

  it("restaura o console mesmo quando fn lança", () => {
    const log = console.log;
    const error = console.error;
    stdIoWrapper(null, () => {
      throw new Error("boom",);
    },);
    assertEquals(console.log, log,);
    assertEquals(console.error, error,);
  });

  it("durante fn o console está trocado", () => {
    const log = console.log;
    let swapped = false;
    stdIoWrapper(null, () => {
      swapped = console.log !== log;
    },);
    assertEquals(swapped, true,);
  });
});

describe("stdIoWrapper — captura (16.11.4)", () => {
  it("captura console.log em stdOut", () => {
    const res = stdIoWrapper(null, () => {
      console.log("hello",);
      console.log("world",);
      return 0;
    },);
    assertEquals(res.stdOut, "hello\nworld\n",);
    assertEquals(res.stdErr, "",);
  });

  it("captura console.error em stdErr", () => {
    const res = stdIoWrapper(null, () => {
      console.error("erro",);
      return 1;
    },);
    assertEquals(res.stdErr, "erro\n",);
    assertEquals(res.stdOut, "",);
  });

  it("separa os dois fluxos e junta argumentos com espaço", () => {
    const res = stdIoWrapper(null, () => {
      console.log("a", 1, true,);
      console.error("b", null,);
      return "fim";
    },);
    assertEquals(res.stdOut, "a 1 true\n",);
    assertEquals(res.stdErr, "b null\n",);
    assertEquals(res.returnValue, "fim",);
  });
});

describe("stdIoWrapper — stdIn e erros (16.11.5)", () => {
  it("aceita stdIn e o ignora (browser não tem stdin)", () => {
    const res = stdIoWrapper("linha digitada\n", () => {
      console.log("x",);
      return 0;
    },);
    assertEquals(res.stdOut, "x\n",);
    assertEquals(res.returnValue, 0,);
  });

  it("não ecoa stdIn na saída", () => {
    const res = stdIoWrapper("segredo", () => 0,);
    assertEquals(res.stdOut, "",);
  });

  it("retorna 1 quando fn lança (Ruby rescue RuntimeError)", () => {
    const res = stdIoWrapper(null, () => {
      console.log("antes",);
      throw new Error("falhou",);
    },);
    assertEquals(res.returnValue, 1,);
    assertEquals(res.stdOut, "antes\n",);
  });

  it("preserva a saída escrita antes da exceção", () => {
    const res = stdIoWrapper(null, () => {
      console.error("aviso",);
      throw new Error("falhou",);
    },);
    assertEquals(res.returnValue, 1,);
    assertEquals(res.stdErr, "aviso\n",);
  });
});
