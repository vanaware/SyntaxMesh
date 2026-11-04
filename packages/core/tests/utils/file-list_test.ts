/**
 * 16.7 — `FileList` + `FileRecord` (Ruby `FileList.rb`, arquivo completo).
 *
 * `modified?` é sempre `false` no browser (Category B): não há `File.mtime`
 * para arquivos escolhidos pelo usuário.
 *
 * @see docs/taskjuggler/lib/taskjuggler/FileList.rb
 * @see docs/syntaxmesh/fases/fase-16-apoio-tarefas.md (16.7)
 */

import { beforeEach, describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, } from "@std/assert";
import { FileList, FileRecord, } from "../../src/utils/file-list.ts";

describe("FileRecord (16.7.1–16.7.4)", () => {
  it("guarda o nome recebido", () => {
    const r = new FileRecord("project.tjp",);
    assertEquals(r.name, "project.tjp",);
  });

  it("não duplica a referência do nome (cópia do Ruby)", () => {
    const name = "a.tjp";
    const r = new FileRecord(name,);
    assertEquals(r.name, name,);
    assertEquals(r.name === name, true,);
  });

  it("modified é sempre false no browser", () => {
    assertEquals(new FileRecord("x.tjp",).modified(), false,);
  });

  it("modified continua false mesmo após passar o tempo", () => {
    const r = new FileRecord("x.tjp",);
    const before = Date.now();
    while (Date.now() - before < 2) {
      // espera o relógio andar (o Ruby compararia mtime > @mtime)
    }
    assertEquals(r.modified(), false,);
  });
});

describe("FileList (16.7.5–16.7.8)", () => {
  let list: FileList;

  beforeEach(() => {
    list = new FileList();
  },);

  it("começa vazia", () => {
    assertEquals(list.length, 0,);
    assertEquals(list.masterFile, null,);
    assertEquals([...list,], [],);
  });

  it("add registra arquivos únicos", () => {
    list.add("a.tjp",);
    list.add("b.inc",);
    assertEquals(list.length, 2,);
    assertEquals([...list,], ["a.tjp", "b.inc",],);
  });

  it("add ignora duplicatas", () => {
    list.add("a.tjp",);
    list.add("a.tjp",);
    assertEquals(list.length, 1,);
    assertEquals([...list,], ["a.tjp",],);
  });

  it("add ignora o diretório corrente ('.')", () => {
    list.add(".",);
    assertEquals(list.length, 0,);
    assertEquals(list.has(".",), false,);
  });

  it("push delega para add", () => {
    list.push("a.tjp",);
    list.push("a.tjp",);
    assertEquals(list.length, 1,);
  });

  it("get devolve o registro e null quando ausente", () => {
    list.add("a.tjp",);
    assert(list.get("a.tjp",) instanceof FileRecord,);
    assertEquals(list.get("a.tjp",)!.name, "a.tjp",);
    assertEquals(list.get("b.tjp",), null,);
  });

  it("masterFile é o primeiro .tjp na ordem de inserção", () => {
    list.add("common.inc",);
    list.add("master.tjp",);
    list.add("other.tjp",);
    assertEquals(list.masterFile, "master.tjp",);
  });

  it("masterFile é null sem nenhum .tjp", () => {
    list.add("common.inc",);
    list.add("include.tji",);
    assertEquals(list.masterFile, null,);
  });

  it("masterFile só considera nomes com 4+ caracteres (fiel ao Ruby)", () => {
    // `".tjp"[-4, 4]` devolve ".tjp" no Ruby moderno, mas nomes curtos
    // nunca chegam a 4 caracteres — caso de borda documentado.
    list.add(".tjp",);
    assertEquals(list.masterFile, ".tjp",);
    list.add("x",);
    assertEquals(list.masterFile, ".tjp",);
  });

  it("modified é false no browser", () => {
    list.add("a.tjp",);
    assertEquals(list.modified(), false,);
    assertEquals(new FileList().modified(), false,);
  });

  it("itera os nomes na ordem de inserção", () => {
    list.add("c",);
    list.add("a",);
    list.add("b",);
    assertEquals([...list,], ["c", "a", "b",],);
  });

  it("records expõe um FileRecord por nome", () => {
    list.add("a.tjp",);
    list.add("b.tjp",);
    assertEquals(list.records.length, 2,);
    assertEquals(list.records.map((r,) => r.name), ["a.tjp", "b.tjp",],);
  });
});
