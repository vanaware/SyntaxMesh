import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { Rule, } from "../../src/parser/rule.ts";
import { Pattern, } from "../../src/parser/pattern.ts";
import { TokenDoc, } from "../../src/lexer/token-doc.ts";

describe("Rule — estrutura", () => {
  it("constructor inicializa vazio", () => {
    const r = new Rule("myRule",);
    assertEquals(r.name, "myRule",);
    assertEquals(r.patterns.length, 0,);
    assertEquals(r.repeatable, false,);
    assertEquals(r.isOptional, false,);
    assertEquals(r.transitiveOptional, null,);
  });

  it("addPattern adiciona ao final", () => {
    const r = new Rule("r",);
    const p1 = new Pattern(["!a",],);
    const p2 = new Pattern(["!b",],);
    r.addPattern(p1,);
    r.addPattern(p2,);
    assertEquals(r.patterns, [p1, p2,],);
    assertEquals(r.pattern(1,), p2,);
  });

  it("pattern lança índice inexistente", () => {
    const r = new Rule("r",);
    assertThrows(() => r.pattern(0,), Error, "not found",);
  });

  it("flushCache reseta transitiveOptional", () => {
    const r = new Rule("r",);
    r.setOptional();
    r.optional(new Map(),);
    assertEquals(r.transitiveOptional, true,);
    r.flushCache();
    assertEquals(r.transitiveOptional, null,);
  });

  it("setOptional e setRepeatable", () => {
    const r = new Rule("r",);
    r.setOptional();
    r.setRepeatable();
    assertEquals(r.isOptional, true,);
    assertEquals(r.repeatable, true,);
  });
});

describe("Rule — include", () => {
  it("inclui apenas o 1º token de cada pattern (Ruby l.58)", () => {
    const r = new Rule("r",);
    r.addPattern(new Pattern(["!optionalID", "$STRING",],),);
    assertEquals(r.includes("optionalID",), true,);
    // STRING é o 2º token — Ruby só compara @patterns.each { |p| p[0][1] }
    assertEquals(r.includes("STRING",), false,);
  });

  it("não inclui token ausente", () => {
    const r = new Rule("r",);
    r.addPattern(new Pattern(["!a",],),);
    assertEquals(r.includes("b",), false,);
  });

  it("rule sem patterns nunca inclui", () => {
    assertEquals(new Rule("r",).includes("x",), false,);
  });
});

describe("Rule — optional recursivo com cache", () => {
  it("rule marcada optional retorna true", () => {
    const r = new Rule("r",);
    r.setOptional();
    assertEquals(r.optional(new Map(),), true,);
  });

  it("rule com pattern de token obrigatório retorna false", () => {
    const r = new Rule("r",);
    r.addPattern(new Pattern(["_task",],),);
    assertEquals(r.optional(new Map(),), false,);
  });

  it("rule com apenas referências opcionais retorna true", () => {
    const inner = new Rule("inner",);
    inner.setOptional();
    const rules = new Map<string, Rule>([["inner", inner,],],);
    const r = new Rule("r",);
    r.addPattern(new Pattern(["!inner",],),);
    assertEquals(r.optional(rules,), true,);
  });

  it("opcional transitivo em dois níveis", () => {
    const leaf = new Rule("leaf",);
    leaf.setOptional();
    const mid = new Rule("mid",);
    mid.addPattern(new Pattern(["!leaf",],),);
    const top = new Rule("top",);
    top.addPattern(new Pattern(["!mid",],),);
    const rules = new Map(
      [["leaf", leaf,], ["mid", mid,], ["top", top,],],
    );
    assertEquals(top.optional(rules,), true,);
  });

  it("cache: após computed, mudar patterns não atualiza até flushCache", () => {
    const r = new Rule("r",);
    r.addPattern(new Pattern(["_x",],),);
    assertEquals(r.optional(new Map(),), false,);
    // Cache negativo instalado
    assertEquals(r.transitiveOptional, false,);
    const rules = new Map<string, Rule>();
    assertEquals(r.optional(rules,), false,);
    r.flushCache();
    r.addPattern(new Pattern(["$STRING",],),);
    assertEquals(r.optional(new Map(),), false,);
  });
});

describe("Rule — delegação de documentação ao último pattern", () => {
  it("lança sem pattern definido", () => {
    const r = new Rule("r",);
    assertThrows(() => r.setDoc("k", "d",), Error, "No pattern",);
    assertThrows(() => r.setArg(0, null,), Error, "No pattern",);
    assertThrows(() => r.setExample("f", "t",), Error, "No pattern",);
  });

  it("setDoc delega ao último pattern", () => {
    const r = new Rule("r",);
    r.addPattern(new Pattern(["!a",],),);
    const p2 = new Pattern(["!b",],);
    r.addPattern(p2,);
    r.setDoc("kw", "doc",);
    assertEquals(p2.keyword, "kw",);
    assertEquals(r.pattern(0,).keyword, null,);
  });

  it("setArg / setLastSyntaxToken / setSupportLevel / setSeeAlso / setExample", () => {
    const r = new Rule("r",);
    const p = new Pattern(["$STRING", "!b",],);
    r.addPattern(p,);
    const doc = new TokenDoc("arg", "<arg>",);
    r.setArg(0, doc,);
    r.setLastSyntaxToken(0,);
    r.setSupportLevel("supported",);
    r.setSeeAlso(["x",],);
    r.setExample("mwe002", "t",);
    assertEquals(p.args[0], doc,);
    assertEquals(p.lastSyntaxToken, 0,);
    assertEquals(p.supportLevel, "supported",);
    assertEquals(p.seeAlso, ["x",],);
    assertEquals(p.exampleFile, "mwe002",);
  });
});

describe("Rule — generateStates", () => {
  it("gera estado inicial (nil pattern) + um por token de cada pattern", () => {
    const r = new Rule("r",);
    r.addPattern(new Pattern(["$A", "$B",],),);
    const states = r.generateStates(new Map(),);
    assertEquals(states.length, 3,);
    assertEquals(states[0]!.pattern, null,);
    assertEquals(states[0]!.rule, r,);
    assertEquals(states[1]!.index, 0,);
    assertEquals(states[2]!.index, 1,);
  });
});

describe("Rule — to_syntax", () => {
  it("pattern único obrigatório sem colchetes", () => {
    const r = new Rule("r",);
    r.addPattern(new Pattern(["_task", "$STRING",],),);
    const out = r.to_syntax(new Map(), [], new Map([["r", r,],],),);
    assertEquals(out, "task <STRING>",);
  });

  it("rule optional envolve em [ ... ]", () => {
    const r = new Rule("r",);
    r.addPattern(new Pattern(["_x",],),);
    r.setOptional();
    const out = r.to_syntax(new Map(), [], new Map([["r", r,],],),);
    assertEquals(out, "[x]",);
  });

  it("rule repeatable envolve em [ ... ... ]", () => {
    const r = new Rule("r",);
    r.addPattern(new Pattern(["_x",],),);
    r.setRepeatable();
    const out = r.to_syntax(new Map(), [], new Map([["r", r,],],),);
    assertEquals(out, "[x...]",);
  });

  it("múltiplos patterns são separados por | e agrupados", () => {
    const r = new Rule("r",);
    r.addPattern(new Pattern(["_a",],),);
    r.addPattern(new Pattern(["_b",],),);
    const out = r.to_syntax(new Map(), [], new Map([["r", r,],],),);
    assertEquals(out, "(a | b)",);
  });

  it("rule sem patterns retorna string vazia", () => {
    const r = new Rule("r",);
    assertEquals(r.to_syntax(new Map(), [], new Map([["r", r,],],),), "",);
  });
});
