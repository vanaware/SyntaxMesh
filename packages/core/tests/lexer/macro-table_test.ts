import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { Macro, MacroTable, } from "../../src/lexer/macro-table.ts";
import { SourceFileInfo, } from "../../src/source-file-info.ts";

const sfi = new SourceFileInfo("test.tjp", 1, 1,);

describe("Macro", () => {
  it("armazena name, value e sourceFileInfo", () => {
    const macro = new Macro("greeting", "Hello ${1}!", sfi,);
    assertEquals(macro.name, "greeting",);
    assertEquals(macro.value, "Hello ${1}!",);
    assertEquals(macro.sourceFileInfo, sfi,);
  });

  it("rejeita name vazio", () => {
    assertThrows(() => new Macro("", "x", sfi,), Error, "empty",);
  });

  it("rejeita name null-ish (undefined como any-free)", () => {
    assertThrows(
      () => new Macro(undefined as unknown as string, "x", sfi,),
      Error,
    );
  });
});

describe("MacroTable", () => {
  it("add armazena macro por nome", () => {
    const table = new MacroTable();
    table.add(new Macro("a", "A", sfi,),);
    assertEquals(table.includes("a",), true,);
  });

  it("add substitui macro de mesmo nome", () => {
    const table = new MacroTable();
    table.add(new Macro("a", "A1", sfi,),);
    table.add(new Macro("a", "A2", sfi,),);
    const resolved = table.resolve(["a",], sfi,);
    assertEquals(resolved?.[1], "A2",);
  });

  it("clear remove todas as macros", () => {
    const table = new MacroTable();
    table.add(new Macro("a", "A", sfi,),);
    table.clear();
    assertEquals(table.includes("a",), false,);
  });

  it("include retorna false para macro inexistente", () => {
    const table = new MacroTable();
    assertEquals(table.includes("zz",), false,);
  });

  it("include retorna true para macro existente", () => {
    const table = new MacroTable();
    table.add(new Macro("ok", "V", sfi,),);
    assertEquals(table.includes("ok",), true,);
  });

  it("resolve retorna null para macro inexistente", () => {
    const table = new MacroTable();
    assertEquals(table.resolve(["nao_existe",], sfi,), null,);
  });

  it("resolve com prefixo '?' retorna [nil, ''] se macro não existe", () => {
    // Ruby MacroTable#resolve (l.63-66): macro opcional indefinida → [nil, '']
    // (o expandMacro do Scanner ignora silenciosamente texto vazio).
    const table = new MacroTable();
    assertEquals(table.resolve(["?opcional",], sfi,), [null, "",],);
  });

  it("resolve com prefixo '?' retorna macro com texto vazio se existe", () => {
    const table = new MacroTable();
    table.add(new Macro("existe", "X", sfi,),);
    const result = table.resolve(["?existe",], sfi,);
    assertEquals(result?.[0]?.name, "existe",);
    assertEquals(result?.[1], "",);
  });

  it("resolve retorna a macro e o valor quando não opcional", () => {
    const table = new MacroTable();
    table.add(new Macro("a", "valor", sfi,),);
    const result = table.resolve(["a",], sfi,);
    assertEquals(result?.[0]?.value, "valor",);
    assertEquals(result?.[1], "valor",);
  });

  it("resolve substitui ${1} pelo primeiro argumento", () => {
    const table = new MacroTable();
    table.add(new Macro("greet", "Hello ${1}!", sfi,),);
    const result = table.resolve(["greet", "Mundo",], sfi,);
    assertEquals(result?.[1], "Hello Mundo!",);
  });

  it("resolve substitui múltiplos argumentos ${1}, ${2}", () => {
    const table = new MacroTable();
    table.add(new Macro("dois", "${1} e ${2}", sfi,),);
    const result = table.resolve(["dois", "pao", "queijo",], sfi,);
    assertEquals(result?.[1], "pao e queijo",);
  });

  it("resolve desescapa $${ para ${", () => {
    const table = new MacroTable();
    table.add(new Macro("lit", "$${naoExpandir}", sfi,),);
    const result = table.resolve(["lit",], sfi,);
    assertEquals(result?.[1], "${naoExpandir}",);
  });
});
