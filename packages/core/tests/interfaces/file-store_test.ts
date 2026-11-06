/**
 * Conformidade da interface `FileStore` (ADR 037, tarefas 18.1/18.14).
 *
 * O ponto central é que a interface é **estrutural**: qualquer objeto com os
 * seis métodos assíncronos serve, sem `implements`. O fake em memória
 * (`tests/helpers/fake-opfs.ts`) faz o papel do `fakeOpfs()` de
 * `@syntaxmesh/worker-db` enquanto esse pacote não existe (Fase 19).
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { FileStore, } from "../../src/interfaces/file-store.ts";
import type { KeyValueStore, } from "../../src/interfaces/key-value-store.ts";
import { fakeOpfs, normalizePath, } from "../helpers/fake-opfs.ts";

/** Consumidor genérico: só conhece o contrato, nunca a implementação. */
async function exercise(fs: FileStore,): Promise<string> {
  await fs.mkdir("docs",);
  await fs.write("docs/a.txt", "alpha",);
  const content = await fs.read("docs/a.txt",);
  assert(await fs.exists("docs/a.txt",),);
  const names = await fs.list("docs",);
  await fs.delete("docs/a.txt",);
  return `${content}:${names.join(",",)}:${await fs.exists("docs/a.txt",)}`;
}

/** Consumidor genérico do contrato chave/valor. */
async function exerciseKv(kv: KeyValueStore,): Promise<unknown> {
  await kv.set("k", { v: 1, },);
  const value = await kv.get<{ v: number }>("k",);
  const keys = await kv.keys();
  await kv.del("k",);
  return [value, keys, await kv.get("k",),];
}

describe("FileStore", () => {
  it("interface é estrutural (qualquer objeto com a forma serve)", async () => {
    // O fake não declara `implements FileStore`; o type-checker o aceita.
    const fs: FileStore = fakeOpfs();
    assertEquals(await exercise(fs,), "alpha:a.txt:false",);
  });

  it("write/read fazem round-trip do conteúdo UTF-8", async () => {
    const fs = fakeOpfs();
    await fs.write("nota.txt", "ação — ok",);
    assertEquals(await fs.read("nota.txt",), "ação — ok",);
  });

  it("read de arquivo inexistente rejeita", async () => {
    const fs = fakeOpfs();
    let failed = false;
    try {
      await fs.read("nada.txt",);
    } catch {
      failed = true;
    }
    assert(failed,);
  });

  it("mkdir + list devolvem as entradas do diretório (arquivos e subdirs)", async () => {
    const fs = fakeOpfs({ "a/1.tji": "x", "a/b/2.tji": "y", },);
    assertEquals(await fs.list("a",), ["1.tji", "b",],);
    assertEquals(await fs.list("a/b",), ["2.tji",],);
  });

  it("mkdir é idempotente e cria ancestrais", async () => {
    const fs = fakeOpfs();
    await fs.mkdir("TimeSheets/2026-01-05",);
    await fs.mkdir("TimeSheets/2026-01-05",);
    assert(await fs.exists("TimeSheets",),);
    assert(await fs.exists("TimeSheets/2026-01-05",),);
  });

  it("write exige diretório-pai existente (como File.open)", async () => {
    const fs = fakeOpfs();
    let failed = false;
    try {
      await fs.write("sem/dir/x.txt", "x",);
    } catch {
      failed = true;
    }
    assert(failed,);
  });

  it("delete de arquivo inexistente rejeita", async () => {
    const fs = fakeOpfs();
    let failed = false;
    try {
      await fs.delete("nada.txt",);
    } catch {
      failed = true;
    }
    assert(failed,);
  });

  it("normalizePath remove ./, barras finais e duplicadas", () => {
    assertEquals(normalizePath("./a//b/",), "a/b",);
    assertEquals(normalizePath("a",), "a",);
  });
});

// ---------------------------------------------------------------------------
// 18.14.4 — o core não conhece o provedor concreto (ADR 037)
// ---------------------------------------------------------------------------

/** Todos os arquivos `.ts` de `packages/core/src` (recursivo). */
function coreSources(
  dir: URL = new URL("../../src/", import.meta.url,),
): URL[] {
  const found: URL[] = [];
  for (const entry of Deno.readDirSync(dir,)) {
    // Diretório precisa de barra final na URL, senão os filhos resolvem ao
    // lado e não dentro dele.
    const child = new URL(
      entry.isDirectory ? entry.name + "/" : entry.name,
      dir,
    );
    if (entry.isDirectory) {
      found.push(...coreSources(child,),);
    } else if (entry.name.endsWith(".ts",)) {
      found.push(child,);
    }
  }
  return found;
}

describe("FileStore — isolamento do core (18.14.4)", () => {
  it("nenhum arquivo de src/ importa o provedor concreto worker-db", () => {
    const offenders = coreSources()
      .filter((file,) =>
        Deno.readTextFileSync(file,).includes("@syntaxmesh/worker-db",)
      )
      .map((file,) => file.pathname);
    assertEquals(offenders, [],);
  });

  it("src/ só toca no contrato via interfaces/file-store.ts", () => {
    // O contrato é a única porta: os handlers importam o **tipo**, nunca uma
    // implementação de disco.
    const contract = new URL(
      "../../src/interfaces/file-store.ts",
      import.meta.url,
    );
    assert(Deno.statSync(contract,).isFile,);
  });
});

describe("KeyValueStore", () => {
  it("satisfaz a interface estruturalmente", async () => {
    const map = new Map<string, unknown>();
    const kv: KeyValueStore = {
      get: <T,>(key: string,) =>
        Promise.resolve(map.get(key,) as T | undefined,),
      set: <T,>(key: string, value: T,) => {
        map.set(key, value,);
        return Promise.resolve();
      },
      del: (key: string,) => {
        map.delete(key,);
        return Promise.resolve();
      },
      keys: () => Promise.resolve([...map.keys(),],),
    };
    assertEquals(
      await exerciseKv(kv,),
      [{ v: 1, }, ["k",], undefined,],
    );
  });
});
