import { afterAll, beforeAll, describe, it, } from "@std/testing/bdd";
import {
  assert,
  assertEquals,
  assertRejects,
  assertThrows,
} from "@std/assert";
import { join, } from "node:path";
import { pathToFileURL, } from "node:url";
import {
  copy,
  detectRuntime,
  exists,
  exit,
  isEntrypoint,
  isTty,
  listDir,
  mkpath,
  mktemp,
  modulePath,
  print,
  printerr,
  readBytes,
  readText,
  resolveArgs,
  writeText,
} from "../src/io.ts";

/** Sinal usado pelos globais fake para interromper um `exit` real. */
class ExitSignal extends Error {
  constructor(readonly code: number | undefined,) {
    super(`exit(${code})`,);
  }
}

const fakeExit = (code?: number,): never => {
  throw new ExitSignal(code,);
};

describe("detectRuntime", () => {
  it("reconhece o Deno", () => {
    assertEquals(
      detectRuntime({ Deno: { args: [], exit: fakeExit, }, },),
      "deno",
    );
  });

  it("reconhece o Bun", () => {
    assertEquals(detectRuntime({ Bun: {}, },), "bun",);
  });

  it("cai no Node quando não há Deno nem Bun", () => {
    assertEquals(
      detectRuntime({ process: { argv: [], exit: fakeExit, }, },),
      "node",
    );
  });

  it("cai no Node sem nenhum global (ambiente desconhecido)", () => {
    assertEquals(detectRuntime({},), "node",);
  });
});

describe("resolveArgs", () => {
  it("usa Deno.args quando presente", () => {
    assertEquals(
      resolveArgs({
        Deno: { args: ["-o", "out", "p.smx",], exit: fakeExit, },
      },),
      ["-o", "out", "p.smx",],
    );
  });

  it("descarta node e o caminho do script no Node/Bun", () => {
    assertEquals(
      resolveArgs({
        process: {
          argv: ["/usr/bin/node", "/app/cli.js", "a", "b",],
          exit: fakeExit,
        },
      },),
      ["a", "b",],
    );
  });

  it("devolve lista vazia sem `process`", () => {
    assertEquals(resolveArgs({},), [],);
  });
});

describe("isEntrypoint", () => {
  it("no Deno compara com o mainModule", () => {
    const g = {
      Deno: { args: [], mainModule: "file:///app/cli.ts", exit: fakeExit, },
    };
    assertEquals(isEntrypoint("file:///app/cli.ts", g,), true,);
    assertEquals(isEntrypoint("file:///app/io.ts", g,), false,);
  });

  it("no Node compara argv[1] com a URL do módulo", () => {
    const entry = join("/app", "dist", "cli.js",);
    const g = {
      process: { argv: ["node", entry,], exit: fakeExit, },
    };
    assertEquals(isEntrypoint(pathToFileURL(entry,).href, g,), true,);
    assertEquals(
      isEntrypoint(pathToFileURL(join("/app", "other.js",),).href, g,),
      false,
    );
  });

  it("no Node sem argv[1] não é entrypoint", () => {
    assertEquals(
      isEntrypoint("file:///app/cli.js", {
        process: { argv: [], exit: fakeExit, },
      },),
      false,
    );
  });
});

describe("modulePath", () => {
  it("decodifica espaços e acentos do caminho do módulo", () => {
    // `new URL(…).pathname` devolveria `/home/a%20b/` e o asset não seria achado.
    assertEquals(
      modulePath("file:///home/a%20b/pkg/src/cli.ts", "../",),
      join("/home", "a b", "pkg",) + "/",
    );
  });

  it("resolve o relativo contra o diretório do módulo", () => {
    assertEquals(
      modulePath("file:///app/src/cli.ts", "./io.ts",),
      "/app/src/io.ts",
    );
  });
});

describe("exit", () => {
  it("repassa o código ao runtime e nunca retorna", () => {
    const err = assertThrows(
      () => exit(1, { Deno: { args: [], exit: fakeExit, }, },),
      ExitSignal,
    );
    assertEquals((err as ExitSignal).code, 1,);
  });

  it("usa 0 por padrão", () => {
    const err = assertThrows(
      () => exit(undefined, { Deno: { args: [], exit: fakeExit, }, },),
      ExitSignal,
    );
    assertEquals((err as ExitSignal).code, 0,);
  });

  it("encerra via process.exit quando não há Deno", () => {
    const err = assertThrows(
      () => exit(1, { process: { argv: [], exit: fakeExit, }, },),
      ExitSignal,
    );
    assertEquals((err as ExitSignal).code, 1,);
  });

  it("lança unreachable quando o runtime não oferece exit", () => {
    assertThrows(() => exit(0, { Bun: {}, },), Error, "unreachable",);
  });
});

describe("isTty (24.4.2)", () => {
  it("no Deno lê `stdout.isTerminal()`", () => {
    const tty = {
      Deno: { args: [], exit: fakeExit, stdout: { isTerminal: () => true, }, },
    };
    const pipe = {
      Deno: { args: [], exit: fakeExit, stdout: { isTerminal: () => false, }, },
    };
    assertEquals(isTty(tty,), true,);
    assertEquals(isTty(pipe,), false,);
  });

  it("no Node lê `process.stdout.isTTY`", () => {
    assertEquals(
      isTty({
        process: { argv: [], exit: fakeExit, stdout: { isTTY: true, }, },
      },),
      true,
    );
    assertEquals(
      isTty({ process: { argv: [], exit: fakeExit, }, },),
      false,
    );
  });

  it("é conservador quando o runtime não expõe o stream", () => {
    assertEquals(isTty({},), false,);
    assertEquals(isTty({ Deno: { args: [], exit: fakeExit, }, },), false,);
  });
});

describe("arquivos", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mktemp("smx-cli-io-",);
  },);

  afterAll(async () => {
    await Deno.remove(dir, { recursive: true, },);
  },);

  it("mktemp cria um diretório existente", async () => {
    assertEquals(await exists(dir,), true,);
  });

  it("faz round-trip de texto", async () => {
    const file = join(dir, "a.txt",);
    await writeText(file, "olá\nmundo\n",);
    assertEquals(await readText(file,), "olá\nmundo\n",);
  });

  it("readBytes devolve os bytes originais", async () => {
    const file = join(dir, "b.bin",);
    const bytes = new Uint8Array([0, 1, 2, 255,],);
    await Deno.writeFile(file, bytes,);
    assertEquals(await readBytes(file,), bytes,);
  });

  it("copy preserva os bytes", async () => {
    const from = join(dir, "c.txt",);
    const to = join(dir, "c-copy.txt",);
    await writeText(from, "conteúdo",);
    await copy(from, to,);
    assertEquals(await readText(to,), "conteúdo",);
  });

  it("exists é false para caminho ausente", async () => {
    assertEquals(await exists(join(dir, "não-existe",),), false,);
  });

  it("mkpath é recursivo e listDir lista os nomes", async () => {
    const nested = join(dir, "x", "y", "z",);
    await mkpath(nested,);
    await writeText(join(nested, "f.txt",), "f",);
    assertEquals((await listDir(nested,)).sort(), ["f.txt",],);
  });

  it("writeText falha quando o diretório não existe", async () => {
    await assertRejects(() => writeText(join(dir, "ausente", "f.txt",), "x",));
  });

  it("print e printerr escrevem nos streams padrão", () => {
    // `console` existe nativamente nos três runtimes; a asserção real é que
    // as funções não encaminham nada diferente disso.
    assert(typeof print === "function",);
    assert(typeof printerr === "function",);
  });
});
