/**
 * Fase 24 (24.2.32) — `MemoryFileStore`: o `FileStore` em memória que permite
 * rodar os apps de sheet sobre **dados** (`request.files` → store → snapshot).
 *
 * Prova a conformidade estrutural (ADR 037) e a semântica que os handlers
 * esperam de um disco: `list` com basenames, `mkdir` idempotente, `delete`
 * exigindo existência.
 */
import { assert, assertEquals, assertRejects, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import type { FileStore, } from "../../src/interfaces/file-store.ts";
import {
  MemoryFileStore,
  normalizeStorePath,
} from "../../src/interfaces/memory-file-store.ts";

describe("MemoryFileStore — contrato FileStore (24.2.32)", () => {
  it("é estrutural: satisfaz FileStore sem implementação nominal extra", async () => {
    const store: FileStore = new MemoryFileStore();
    await store.write("a/b.txt", "alpha",);
    assertEquals(await store.read("a/b.txt",), "alpha",);
    assertEquals(await store.exists("a/b.txt",), true,);
    assertEquals(await store.list("a",), ["b.txt",],);
    await store.delete("a/b.txt",);
    assertEquals(await store.exists("a/b.txt",), false,);
  });

  it("mkdir é idempotente e cria os ancestrais", async () => {
    const store = new MemoryFileStore();
    await store.mkdir("TimeSheets/2026-05-18",);
    await store.mkdir("TimeSheets/2026-05-18",);
    assert(await store.exists("TimeSheets",),);
    assert(await store.exists("TimeSheets/2026-05-18",),);
    assertEquals(await store.list("TimeSheets",), ["2026-05-18",],);
  });

  it("write cria os diretórios-pai ausentes", async () => {
    const store = new MemoryFileStore();
    await store.write("outbox/x.eml", "raw",);
    assertEquals(await store.read("outbox/x.eml",), "raw",);
  });

  it("read e delete de arquivo inexistente rejeitam", async () => {
    const store = new MemoryFileStore();
    await assertRejects(() => store.read("nada.txt",), Error, "ENOENT",);
    await assertRejects(() => store.delete("nada.txt",), Error, "ENOENT",);
    await assertRejects(() => store.list("nada",), Error, "ENOENT",);
  });

  it("list devolve arquivos e subdiretórios como basenames ordenados", async () => {
    const store = new MemoryFileStore({
      "root/b.tji": "b",
      "root/a.tji": "a",
      "root/sub/c.tji": "c",
    },);
    assertEquals(await store.list("root",), ["a.tji", "b.tji", "sub",],);
    assertEquals(await store.list("root/sub",), ["c.tji",],);
  });
});

describe("MemoryFileStore — semente e saída como dados", () => {
  it("aceita semente em mapa, criando diretórios implícitos", async () => {
    const store = new MemoryFileStore({
      "templates/report.tji": "texto",
    },);
    assertEquals(await store.read("templates/report.tji",), "texto",);
    assertEquals(await store.list("templates",), ["report.tji",],);
  });

  it("aceita semente em lista `{path, content}` e chaves com barra final", async () => {
    const store = new MemoryFileStore([
      { path: "a/x.tji", content: "x", },
      { path: "empty/", content: "", },
    ],);
    assertEquals(await store.read("a/x.tji",), "x",);
    assertEquals(await store.list("empty",), [],);
  });

  it("toFiles/snapshot devolvem a saída ordenada e sem instâncias", async () => {
    const store = new MemoryFileStore({ "b.txt": "2", "a.txt": "1", },);
    await store.write("c.txt", "3",);

    assertEquals(store.toFiles(), [
      { path: "a.txt", content: "1", },
      { path: "b.txt", content: "2", },
      { path: "c.txt", content: "3", },
    ],);
    assertEquals(store.snapshot(), {
      "a.txt": "1",
      "b.txt": "2",
      "c.txt": "3",
    },);
    // Dado puro: o snapshot atravessa `structuredClone`.
    assertEquals(structuredClone(store.snapshot(),), store.snapshot(),);
  });

  it("normalizeStorePath remove `./`, barras repetidas e barra final", () => {
    assertEquals(normalizeStorePath("./a//b/",), "a/b",);
    assertEquals(normalizeStorePath("a",), "a",);
  });
});
