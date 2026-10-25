import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { Pattern, } from "../../src/parser/pattern.ts";
import { Rule, } from "../../src/parser/rule.ts";
import { TokenDoc, } from "../../src/lexer/token-doc.ts";

describe("Pattern — estrutura", () => {
  it("parseia tokens com prefixos ! $ _ .", () => {
    const p = new Pattern(["!optionalID", "$STRING", "_accept", ".",],);
    assertEquals(p.tokens[0], ["reference", "optionalID",],);
    assertEquals(p.tokens[1], ["variable", "STRING",],);
    assertEquals(p.tokens[2], ["literal", "accept",],);
    assertEquals(p.tokens[3], ["eof", "<END>",],);
    assertEquals(p.length(), 4,);
  });

  it("lastSyntaxToken inicia no último token", () => {
    const p = new Pattern(["!a", "!b",],);
    assertEquals(p.lastSyntaxToken, 1,);
  });

  it("constructor preserva function passada (bind explícito, não arrow)", () => {
    function action(this: Pattern,) {
      return this === p ? "ok" : "sem bind";
    }
    const p = new Pattern(["!a",], action,);
    assertEquals(p.function, action,);
  });

  it("rejeita token sem prefixo de tipo", () => {
    assertThrows(
      () => new Pattern(["invalid",],),
      Error,
      "must start with a type identifier",
    );
  });

  it("rejeita string vazia como token", () => {
    assertThrows(() => new Pattern(["",],), Error,);
  });

  it("constructor sem function define function null", () => {
    const p = new Pattern(["!a",],);
    assertEquals(p.function, null,);
  });
});

describe("Pattern — documentação", () => {
  it("setDoc define keyword e doc", () => {
    const p = new Pattern(["!a",],);
    p.setDoc("task", "A task definition",);
    assertEquals(p.keyword, "task",);
    assertEquals(p.doc, "A task definition",);
  });

  it("setArg define TokenDoc no índice", () => {
    const p = new Pattern(["$STRING", "_task",],);
    const doc = new TokenDoc("text", "<text>",);
    p.setArg(0, doc,);
    assertEquals(p.args[0], doc,);
    assertEquals(p.args[1], null,);
  });

  it("setLastSyntaxToken redefine o último token sintático", () => {
    const p = new Pattern(["!a", "!b", "!c",],);
    p.setLastSyntaxToken(1,);
    assertEquals(p.lastSyntaxToken, 1,);
  });

  it("setSupportLevel e setSeeAlso e setExample", () => {
    const p = new Pattern(["!a",],);
    p.setSupportLevel("experimental",);
    p.setSeeAlso(["flag", "spec",],);
    p.setExample("mwe001", "task",);
    assertEquals(p.supportLevel, "experimental",);
    assertEquals(p.seeAlso, ["flag", "spec",],);
    assertEquals(p.exampleFile, "mwe001",);
    assertEquals(p.exampleTag, "task",);
  });
});

describe("Pattern — acessores", () => {
  it("get retorna token no índice", () => {
    const p = new Pattern(["!a", "$B",],);
    assertEquals(p.get(1,), ["variable", "B",],);
  });

  it("get lança para índice fora da faixa", () => {
    const p = new Pattern(["!a",],);
    assertThrows(() => p.get(5,), Error, "out of range",);
  });

  it("each itera os tokens", () => {
    const p = new Pattern(["!a", "!b",],);
    assertEquals([...p.each(),], [["reference", "a",], ["reference", "b",],],);
  });

  it("empty e length", () => {
    assertEquals(new Pattern([],).empty(), true,);
    assertEquals(new Pattern(["!a",],).empty(), false,);
    assertEquals(new Pattern(["!a", "!b",],).length(), 2,);
  });
});

describe("Pattern — análise estrutural", () => {
  it("isOptional: literal torna o pattern não-opcional", () => {
    const p = new Pattern(["_foo",],);
    assertEquals(p.optional(new Map(),), false,);
  });

  it("isOptional: variável torna o pattern não-opcional", () => {
    const p = new Pattern(["$STRING",],);
    assertEquals(p.optional(new Map(),), false,);
  });

  it("isOptional: referências opcionais tornam o pattern opcional", () => {
    const opt = new Rule("opt",);
    opt.setOptional();
    const rules = new Map<string, Rule>([["opt", opt,],],);
    const p = new Pattern(["!opt", "!opt",],);
    assertEquals(p.optional(rules,), true,);
  });

  it("terminalSymbol identifica variável e literal", () => {
    const p = new Pattern(["$STRING", "_task", "!ref",],);
    assertEquals(p.terminalSymbol(0,), true,);
    assertEquals(p.terminalSymbol(1,), true,);
    assertEquals(p.terminalSymbol(2,), false,);
  });

  it("terminalSymbol retorna false fora da faixa", () => {
    const p = new Pattern(["$STRING",],);
    assertEquals(p.terminalSymbol(3,), false,);
  });

  it("terminalTokens: literal retorna par [nome, pattern]", () => {
    const p = new Pattern(["_task",],);
    assertEquals(p.terminalTokens(new Map(),), [["task", p,],],);
  });

  it("terminalTokens: variável retorna lista vazia", () => {
    const p = new Pattern(["$STRING",],);
    assertEquals(p.terminalTokens(new Map(),), [],);
  });

  it("terminalTokens: referência expande recursivamente", () => {
    const inner = new Rule("inner",);
    inner.addPattern(new Pattern(["_a",],),);
    inner.addPattern(new Pattern(["_b",],),);
    const rules = new Map<string, Rule>([["inner", inner,],],);
    const p = new Pattern(["!inner",],);
    const tts = p.terminalTokens(rules,);
    assertEquals(tts.map((t,) => t[0]), ["a", "b",],);
  });

  it("generateStates cria um State por token", () => {
    const rule = new Rule("r",);
    const p = new Pattern(["$A", "$B",],);
    rule.addPattern(p,);
    const states = p.generateStates(rule, new Map(),);
    assertEquals(states.length, 2,);
    assertEquals(states[0]!.index, 0,);
    assertEquals(states[1]!.pattern, p,);
  });

  it("generateStates marca cauda reducionista com noReduce=false (Ruby l.129)", () => {
    const opt = new Rule("opt",);
    opt.setOptional();
    const rules = new Map<string, Rule>([["opt", opt,],],);
    const rule = new Rule("r",);
    const p = new Pattern(["$A", "!opt",],);
    rule.addPattern(p,);
    const states = p.generateStates(rule, rules,);
    // token 1 (!opt) é opcional da cauda e o token 0 passa a ser o primeiro
    // redutível → ambos os estados recebem noReduce=false (fiel ao Ruby)
    assertEquals(states[1]!.noReduce, false,);
    assertEquals(states[0]!.noReduce, false,);
  });
});

describe("Pattern — serialização", () => {
  it("to_s renderiza prefixos Ruby", () => {
    const p = new Pattern(["!ref", "$var", "_lit", ".",],);
    assertEquals(p.to_s(), "!ref $var lit . ",);
  });

  it("to_syntax renderiza variáveis entre <>", () => {
    const rule = new Rule("r",);
    const p = new Pattern(["_task", "$STRING",],);
    rule.addPattern(p,);
    const rules = new Map<string, Rule>([["r", rule,],],);
    assertEquals(p.to_syntax([], rules,), "task <STRING>",);
  });

  it("to_syntax com TokenDoc usa <name> e popula argDocs", () => {
    const rule = new Rule("r",);
    const p = new Pattern(["$STRING",],);
    p.setArg(0, new TokenDoc("taskName", "<text>",),);
    rule.addPattern(p,);
    const rules = new Map<string, Rule>([["r", rule,],],);
    const argDocs: TokenDoc[] = [];
    assertEquals(p.to_syntax(argDocs, rules,), "<taskName>",);
    assertEquals(argDocs.length, 1,);
  });

  it("addArgDoc via setArg não duplica (to_syntax dedupe por name)", () => {
    const rule = new Rule("r",);
    const p = new Pattern(["$STRING", "$ID",],);
    // Dois TokenDocs com o mesmo name: dedupe por name em argDocs
    p.setArg(0, new TokenDoc("x", "<x>",),);
    p.setArg(1, new TokenDoc("x", "<x dup>",),);
    rule.addPattern(p,);
    const rules = new Map<string, Rule>([["r", rule,],],);
    const argDocs: TokenDoc[] = [];
    p.to_syntax(argDocs, rules,);
    assertEquals(argDocs.length, 1,);
  });
});
