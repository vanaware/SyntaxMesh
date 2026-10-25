import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import {
  State,
  stateKeyOf,
  type StateKeys,
  StateTransition,
} from "../../src/parser/state.ts";
import { Rule, } from "../../src/parser/rule.ts";
import { Pattern, } from "../../src/parser/pattern.ts";

/** Compila um mini-FSM para um conjunto de regras (como updateParserTables). */
function buildFSM(rules: Map<string, Rule>,): {
  states: Map<string, State>;
  keys: StateKeys;
} {
  const keys: StateKeys = new Map();
  const states = new Map<string, State>();
  for (const rule of rules.values()) {
    for (const s of rule.generateStates(rules,)) {
      states.set(stateKeyOf(rule, s.pattern, s.index, keys,), s,);
    }
  }
  for (const s of states.values()) {
    s.addTransitions(states, rules, keys,);
  }
  return { states, keys, };
}

/** Chave de um estado específico, usando o mesmo mapa de identidade. */
function keyOf(
  keys: StateKeys,
  rule: Rule,
  pattern: Pattern | null,
  index: number,
): string {
  return stateKeyOf(rule, pattern, index, keys,);
}

describe("StateTransition", () => {
  it("constructor rejeita descriptor inválido", () => {
    const rule = new Rule("r",);
    const s = new State(rule,);
    assertThrows(
      () =>
        new StateTransition(
          ["literal",] as unknown as [string, string,],
          s,
          [],
          false,
        ),
      Error,
      "Bad parameter descriptor",
    );
  });

  it("constructor rejeita state que não é State", () => {
    assertThrows(
      () =>
        new StateTransition(
          ["variable", "STRING",],
          {} as unknown as State,
          [],
          false,
        ),
      Error,
      "Bad parameter state",
    );
  });

  it("constructor rejeita stateStack não-array", () => {
    const rule = new Rule("r",);
    const s = new State(rule,);
    assertThrows(
      () =>
        new StateTransition(
          ["variable", "STRING",],
          s,
          "x" as unknown as State[],
          false,
        ),
      Error,
      "Bad parameter stateStack",
    );
  });

  it("descriptor eof mapeia tokenType para 'eof'", () => {
    const rule = new Rule("r",);
    const s = new State(rule,);
    const tr = new StateTransition(["eof", "<END>",], s, [], false,);
    assertEquals(tr.tokenType, "eof",);
  });

  it("guarda cópia do stateStack e loopBack", () => {
    const rule = new Rule("r",);
    const s = new State(rule,);
    const stack = [new State(rule,),];
    const tr = new StateTransition(["literal", "x",], s, stack, true,);
    assertEquals(tr.stateStack.length, 1,);
    assertEquals(tr.loopBack, true,);
  });
});

describe("State — estrutura", () => {
  it("constructor com rule apenas (starting node) tem noReduce false", () => {
    const rule = new Rule("r",);
    const s = new State(rule,);
    assertEquals(s.rule, rule,);
    assertEquals(s.pattern, null,);
    assertEquals(s.index, 0,);
    assertEquals(s.noReduce, false,);
  });

  it("constructor com pattern tem noReduce true por padrão", () => {
    const rule = new Rule("r",);
    const p = new Pattern(["!a",],);
    const s = new State(rule, p, 2,);
    assertEquals(s.pattern, p,);
    assertEquals(s.index, 2,);
    assertEquals(s.noReduce, true,);
  });

  it("to_s(short) retorna descrição compacta", () => {
    const rule = new Rule("r",);
    assertEquals(new State(rule,).to_s(true,), "r (Starting Node)",);
    const p = new Pattern(["!a",],);
    rule.addPattern(p,);
    assertEquals(new State(rule, p, 1,).to_s(true,), "r 0 1",);
  });

  it("to_s retorna texto legível com rule, pattern e transições", () => {
    const rule = new Rule("r",);
    const p = new Pattern(["$STRING",],);
    rule.addPattern(p,);
    const s = new State(rule, p, 0,);
    const out = s.to_s();
    assertEquals(out.includes("State: r",), true,);
    assertEquals(out.includes("Pattern:",), true,);
  });
});

describe("State — transições", () => {
  it("addTransition registra por tokenType do descriptor", () => {
    const rule = new Rule("r",);
    const from = new State(rule,);
    const to = new State(rule,);
    from.addTransition(["variable", "STRING",], to, [], false,);
    assertEquals(from.transition(["STRING", "abc",],)?.state, to,);
  });

  it("addTransition detecta transição ambígua (TjError)", () => {
    const rule = new Rule("r",);
    const from = new State(rule,);
    const to1 = new State(rule,);
    const to2 = new State(rule,);
    from.addTransition(["literal", "x",], to1, [], false,);
    assertThrows(
      () => from.addTransition(["literal", "x",], to2, [], false,),
      Error,
      "Ambiguous transition",
    );
  });

  it("transition para ID prefere literal e cai para ID", () => {
    const rule = new Rule("r",);
    const from = new State(rule,);
    const litState = new State(rule,);
    const idState = new State(rule,);
    from.addTransition(["literal", "accept",], litState, [], false,);
    from.addTransition(["variable", "ID",], idState, [], false,);
    assertEquals(from.transition(["ID", "accept",],)?.state, litState,);
    assertEquals(from.transition(["ID", "qualquer",],)?.state, idState,);
  });

  it("transition para LITERAL busca pelo nome do token", () => {
    const rule = new Rule("r",);
    const from = new State(rule,);
    const to = new State(rule,);
    from.addTransition(["literal", "{",], to, [], false,);
    assertEquals(from.transition(["LITERAL", "{",],)?.state, to,);
    assertEquals(from.transition(["LITERAL", "}",],), null,);
  });

  it("transition retorna null para token desconhecido", () => {
    const rule = new Rule("r",);
    assertEquals(new State(rule,).transition(["variable", "ZZ",],), null,);
  });

  it("expectedTokens lista os tokens aceitos entre aspas", () => {
    const rule = new Rule("r",);
    const from = new State(rule,);
    const to = new State(rule,);
    from.addTransition(["variable", "STRING",], to, [], false,);
    from.addTransition(["literal", "x",], to, [], false,);
    assertEquals(from.expectedTokens().sort(), ["'STRING'", "'x'",],);
  });
});

describe("State — integração FSM (addTransitions)", () => {
  it("FSM de 'a b' encadeia starting → 0 → 1 → eof", () => {
    const rule = new Rule("ab",);
    rule.addPattern(new Pattern(["_a", "_b",],),);
    const rules = new Map<string, Rule>([["ab", rule,],],);
    const { states, keys, } = buildFSM(rules,);

    const start = states.get(keyOf(keys, rule, null, 0,),)!;
    const trA = start.transition(["LITERAL", "a",],)!;
    assertEquals(trA.state.index, 0,);

    const trB = trA.state.transition(["LITERAL", "b",],)!;
    assertEquals(trB.state.index, 1,);
    // Ruby não cria transição explícita para eof no último token; o EOF é
    // tratado pelo parseFSM via reduce (finishPattern). O último estado é
    // redutível (noReduce=false).
    assertEquals(trB.state.transition(["eof", "<END>",],), null,);
    assertEquals(trB.state.noReduce, false,);
  });

  it("FSM com referência !word expande transições da regra referenciada", () => {
    const word = new Rule("word",);
    word.addPattern(new Pattern(["_hello",],),);
    const sentence = new Rule("sentence",);
    sentence.addPattern(new Pattern(["!word", "_end",],),);
    const rules = new Map(
      [["word", word,], ["sentence", sentence,],],
    );
    const { states, keys, } = buildFSM(rules,);

    const start = states.get(keyOf(keys, sentence, null, 0,),)!;
    assertEquals(start.transition(["LITERAL", "hello",],)?.state.index, 0,);
  });

  it("ambiguidade é detectada na compilação do FSM", () => {
    const r = new Rule("amb",);
    r.addPattern(new Pattern(["_x", "_a",],),);
    r.addPattern(new Pattern(["_x", "_b",],),);
    const rules = new Map<string, Rule>([["amb", r,],],);
    assertThrows(() => buildFSM(rules,), Error, "Ambiguous",);
  });
});
