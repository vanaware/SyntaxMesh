import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { Macro, MacroTable, Template, } from "../../src/lexer/macro-table.ts";
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

  it("resolve com prefixo '?' expande a macro definida (Ruby l.66-69)", () => {
    const table = new MacroTable();
    table.add(new Macro("existe", "X ${1}!", sfi,),);
    // Auditoria 23.1b: o Ruby, quando a macro existe, segue o fluxo normal e
    // devolve o corpo expandido (a versão anterior desta porta devolvia '' por
    // engano).
    assertEquals(table.resolve(["?existe",], sfi,)?.[1], "X ${1}!",);
    assertEquals(table.resolve(["?existe", "arg",], sfi,)?.[1], "X arg!",);
  });

  it("resolve com prefixo '?' de macro inexistente devolve texto vazio", () => {
    const table = new MacroTable();
    assertEquals(table.resolve(["?naoExiste",], sfi,), [null, "",],);
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

// ---------------------------------------------------------------------------
// Namespace unificado macro/template (Fase 23, 23.1.5–23.1.9)
// ---------------------------------------------------------------------------

const template = (name: string, params: string[] = [],) =>
  new Template(name, `body ${name}`, params, sfi,);

describe("Template (23.1.6)", () => {
  it("armazena name, body, params e sourceFileInfo", () => {
    const tpl = new Template("CARD", "task {{ id }}", ["id",], sfi,);
    assertEquals(tpl.name, "CARD",);
    assertEquals(tpl.body, "task {{ id }}",);
    assertEquals(tpl.params, ["id",],);
    assertEquals(tpl.sourceFileInfo, sfi,);
  });

  it("rejeita name vazio", () => {
    assertThrows(() => new Template("", "x", [], sfi,), Error, "empty",);
  });
});

describe("MacroTable — templates (23.1.7)", () => {
  it("addTemplate registra um template válido", () => {
    const table = new MacroTable();
    assertEquals(table.addTemplate(template("CARD",),), { ok: true, },);
    assertEquals(table.templateDefined("CARD",), true,);
    assertEquals(table.kindOf("CARD",), "template",);
  });

  it("addTemplate recusa nome com minúscula inicial (bad_name)", () => {
    const table = new MacroTable();
    assertEquals(table.addTemplate(template("card",),), {
      ok: false,
      reason: "bad_name",
    },);
    assertEquals(table.includes("card",), false,);
  });

  it("addTemplate preserva o corpo cru e a ordem dos params", () => {
    const table = new MacroTable();
    table.addTemplate(
      new Template("P", "  {{ a }}\n  ${MACRO}\n", ["a", "b",], sfi,),
    );
    const tpl = table.template("P",)!;
    assertEquals(tpl.body, "  {{ a }}\n  ${MACRO}\n",);
    assertEquals(tpl.params, ["a", "b",],);
  });
});

describe("MacroTable — namespace unificado (23.1.8)", () => {
  it("template + template colide citando 'template'", () => {
    const table = new MacroTable();
    table.addTemplate(template("CARD",),);
    assertEquals(table.addTemplate(template("CARD",),), {
      ok: false,
      reason: "collision",
      existing: "template",
    },);
  });

  it("macro + template colide citando 'macro' (primeiro registro)", () => {
    const table = new MacroTable();
    table.add(new Macro("ALLOCATE", "x", sfi,),);
    assertEquals(table.addTemplate(template("ALLOCATE",),), {
      ok: false,
      reason: "collision",
      existing: "macro",
    },);
  });

  it("template + macro: macroDefined é macro-only e não colide na tabela", () => {
    const table = new MacroTable();
    table.addTemplate(template("CARD",),);
    // O predicado de macro ignora o template (warning do Ruby continua
    // sendo o caminho da redefinição de macro; a colisão é detectada no
    // ramo de template e na regra de macro — ver parser tests).
    assertEquals(table.macroDefined("CARD",), false,);
    assertEquals(table.kindOf("CARD",), "template",);
    table.add(new Macro("CARD", "x", sfi,),);
    assertEquals(table.kindOf("CARD",), "macro",);
    assertEquals(table.template("CARD",), null,);
  });

  it("clear remove macros e templates", () => {
    const table = new MacroTable();
    table.add(new Macro("M", "x", sfi,),);
    table.addTemplate(template("T",),);
    table.clear();
    assertEquals(table.includes("M",), false,);
    assertEquals(table.includes("T",), false,);
  });
});

describe("MacroTable — lookup (23.1.9)", () => {
  it("lookup devolve a entrada crua por tipo", () => {
    const table = new MacroTable();
    const macro = new Macro("M", "x", sfi,);
    const tpl = template("T",);
    table.add(macro,);
    table.addTemplate(tpl,);
    assertEquals(table.lookup("M",) === macro, true,);
    assertEquals(table.lookup("T",) === tpl, true,);
    assertEquals(table.lookup("nada",), null,);
  });

  it("resolve nunca devolve template (caminho de macro congelado)", () => {
    const table = new MacroTable();
    table.addTemplate(template("CARD",),);
    assertEquals(table.resolve(["CARD",], sfi,), null,);
    assertEquals(table.resolve(["?CARD",], sfi,), [null, "",],);
  });

  it("templates() devolve apenas templates, na ordem de definição", () => {
    const table = new MacroTable();
    table.addTemplate(template("A",),);
    table.add(new Macro("M", "x", sfi,),);
    table.addTemplate(template("B",),);
    assertEquals(table.templates().map((t,) => t.name), ["A", "B",],);
  });
});
