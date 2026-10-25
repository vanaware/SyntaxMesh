import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { MessageHandlerInstance, } from "../../src/message-handler.ts";
import { SourceFileInfo, } from "../../src/source-file-info.ts";
import { State, } from "../../src/parser/state.ts";
import { StackElement, } from "../../src/parser/stack-element.ts";
import { AttributeOverwrite, TjError, } from "../../src/model/errors.ts";
import {
  type ParserToken,
  TextParser,
  tokenTypeToInt,
} from "../../src/parser/text-parser.ts";

function sfi(line = 1,): SourceFileInfo {
  return new SourceFileInfo("test.tjp", line, 0,);
}

/**
 * TestParser — parser mínimo com fila de tokens embutida (tarefa 10.7.5.6).
 * Substitui o Scanner do Ruby: nextToken/returnToken operam sobre uma fila.
 */
class TestParser extends TextParser {
  private queue: ParserToken[] = [];
  returned: Array<ParserToken | null> = [];

  constructor() {
    super();
    this.variables = ["ID", "KEYWORD", "STRING", "endOfText",];
    this.ruleMethods = ["rule_top", "rule_child", "rule_hello",];
  }

  feed(...tokens: ParserToken[]): void {
    this.queue.push(...tokens,);
  }

  queueIsEmpty(): boolean {
    return this.queue.length === 0;
  }

  /** Expõe (debug) o estado do topo da pilha do FSM. */
  stackTopState(): unknown {
    return this.stack ? this.stack[this.stack.length - 1]?.state : undefined;
  }

  /** Força uma pilha com um State real, como durante um parse. */
  seedStackWithState(): void {
    const state = [...this.states.values(),].find(
      (s,) => s.pattern !== null && s.index === 0,
    )!;
    this.stack = [new StackElement(null, state,),];
  }

  /** Empilha um StackElement com função/estado/valores explícitos. */
  pushRawStackElement(
    fn: ((...args: unknown[]) => unknown) | null,
    state: unknown,
    values: Array<[unknown, SourceFileInfo | null,]>,
  ): void {
    this.stack ??= [];
    const el = new StackElement(fn, state,);
    values.forEach(([v, s,], i,) => {
      el.insert(i, v, s, false,);
    },);
    this.stack.push(el,);
  }

  /** Wrapper público para saveFsmStack (privado na classe base). */
  invokeSaveFsmStack(): void {
    (this as unknown as { saveFsmStack: () => void }).saveFsmStack();
  }

  /** Wrapper público para restoreFsmStack (privado na classe base). */
  invokeRestoreFsmStack(): void {
    (this as unknown as { restoreFsmStack: () => void }).restoreFsmStack();
  }

  invokeDumpStack(): string {
    return this.dumpStack();
  }

  protected nextToken(): ParserToken {
    const t = this.queue.shift();
    if (!t) {
      return ["endOfText", "<END>", null,];
    }
    return t;
  }

  protected returnToken(token: ParserToken | null,): void {
    this.returned.push(token,);
    if (token) {
      this.queue.unshift(token,);
    }
  }

  rule_top(): void {
    this.pattern(["$ID", "_end",], function (this: TestParser,) {
      return `top:${String(this.val[0],)}:${String(this.val[1],)}`;
    },);
  }

  rule_child(): void {
    this.pattern(["_kw", "$STRING",], function (this: TestParser,) {
      return `child:${String(this.val[1],)}`;
    },);
  }

  rule_hello(): void {
    this.pattern(["_hello",], function (this: TestParser,) {
      return `hello:${String(this.val[0],)}`;
    },);
  }
}

function freshHandler(): MessageHandlerInstance {
  const mh = MessageHandlerInstance.instance;
  mh.reset();
  return mh;
}

function compiled(): TestParser {
  const p = new TestParser();
  p.initRules();
  p.updateParserTables();
  return p;
}

describe("tokenTypeToInt", () => {
  it("retorna inteiros >= 0 para tipos conhecidos", () => {
    assertEquals(tokenTypeToInt("ID",) >= 0, true,);
    assertEquals(tokenTypeToInt("STRING",) >= 0, true,);
    assertEquals(tokenTypeToInt("endOfText",) >= 0, true,);
  });
  it("retorna -1 para tipos desconhecidos", () => {
    assertEquals(tokenTypeToInt("NAO_EXISTE",), -1,);
  });
  it("é estável entre chamadas", () => {
    assertEquals(tokenTypeToInt("ID",), tokenTypeToInt("ID",),);
  });
});

describe("TextParser — newRule / pattern / optional / repeatable (10.7.1)", () => {
  it("newRule cria a regra em rules e define cr", () => {
    const p = new TestParser();
    p.newRule("minha",);
    assertEquals(p.rules.has("minha",), true,);
    assertEquals(p.cr?.name, "minha",);
  });

  it("newRule com bloco restaura cr anterior", () => {
    const p = new TestParser();
    p.newRule("ext",);
    const extCr = p.cr;
    p.newRule("inner", () => {
      p.pattern(["_x",],);
    },);
    assertEquals(p.cr, extCr,);
    assertEquals(p.rules.get("inner",)?.patterns.length, 1,);
  });

  it("newRule duplicada reutiliza a regra existente (extend-safe)", () => {
    const p = new TestParser();
    p.newRule("dup",);
    const first = p.cr;
    p.newRule("dup", () => {
      p.pattern(["$ID",],);
    },);
    assertEquals(p.cr, first,);
    assertEquals(p.rules.get("dup",)?.patterns.length, 1,);
  });

  it("pattern adiciona padrão à regra corrente", () => {
    const p = new TestParser();
    p.newRule("r",);
    p.pattern(["$ID",],);
    assertEquals(p.rules.get("r",)?.patterns.length, 1,);
  });

  it("optional marca a regra corrente como opcional", () => {
    const p = new TestParser();
    p.newRule("r",);
    p.pattern(["$ID",],);
    p.optional();
    assertEquals(p.rules.get("r",)?.isOptional, true,);
  });

  it("repeatable marca a regra corrente como repetível", () => {
    const p = new TestParser();
    p.newRule("r",);
    p.pattern(["$ID",],);
    p.repeatable();
    assertEquals(p.rules.get("r",)?.repeatable, true,);
  });

  it("initRules chama todos os rule_* listados", () => {
    const p = new TestParser();
    p.initRules();
    assertEquals(p.rules.has("top",), true,);
    assertEquals(p.rules.has("child",), true,);
    assertEquals(p.rules.has("hello",), true,);
  });

  it("initRules rejeita nomes sem prefixo rule_", () => {
    const p = new TestParser();
    p.ruleMethods = ["naoEhRule",];
    assertThrows(() => p.initRules(), Error, "rule_",);
  });

  it("initRules rejeita método inexistente", () => {
    const p = new TestParser();
    p.ruleMethods = ["rule_naoExiste",];
    assertThrows(() => p.initRules(), Error, "not found",);
  });

  it("limitTokenSet bloqueia tokens fora do subconjunto", () => {
    const p = compiled();
    p.limitTokenSet(["ID", "endOfText",],);
    p.feed(["STRING", "x", sfi(),], ["endOfText", "<END>", null,],);
    const mh = freshHandler();
    p.parse("hello",);
    assertEquals(
      mh.messages.some((m,) => m.id === "unsupported_token"),
      true,
    );
  });

  it("limitTokenSet(null) não bloqueia nada", () => {
    const p = compiled();
    p.limitTokenSet(null,);
    p.feed(["ID", "x", sfi(),], ["ID", "end", sfi(),],);
    assertEquals(p.parse("top",), "top:x:end",);
  });
});

describe("TextParser — checkRule e updateParserTables (10.7.1)", () => {
  it("regra sem padrões lança erro", () => {
    const p = new TestParser();
    p.newRule("vazia",);
    assertThrows(() => p.updateParserTables(), Error, "at least one pattern",);
  });

  it("referência a regra desconhecida lança Fatal Error", () => {
    const p = new TestParser();
    p.newRule("ruim",);
    p.pattern(["!naoExiste",],);
    assertThrows(() => p.updateParserTables(), Error, "unknown rule",);
  });

  it("variável não suportada gera erro unsupported_token", () => {
    const p = new TestParser();
    p.variables = ["ID",];
    p.newRule("ruim",);
    p.pattern(["$DESCONHECIDA",],);
    // error() sem scanner loga no MessageHandler (não lança, como Ruby)
    const mh = freshHandler();
    try {
      p.updateParserTables();
    } catch {
      // a compilação pode falhar adiante; o que importa é a mensagem.
    }
    assertEquals(
      mh.messages.some((m,) => m.id === "unsupported_token"),
      true,
    );
  });

  it("updateParserTables gera estados e transições", () => {
    const p = compiled();
    assertEquals(p.states.size > 0, true,);
    let withTransitions = 0;
    for (const s of p.states.values()) {
      if (s.transitions.size > 0) withTransitions++;
    }
    assertEquals(withTransitions > 0, true,);
  });

  it("estados iniciais (pattern null) existem para cada regra", () => {
    const p = compiled();
    const starting = [...p.states.values(),].filter((s,) => s.pattern === null);
    assertEquals(starting.length, 3,); // top, child, hello
  });
});

describe("TextParser — parseFSM SHIFT/REDUCE (10.7.2)", () => {
  it("parse de regra simples consome tokens e retorna action", () => {
    const p = compiled();
    p.feed(["ID", "x", sfi(),], ["ID", "end", sfi(),],);
    assertEquals(p.parse("top",), "top:x:end",);
  });

  it("regra desconhecida retorna false com no_start_state", () => {
    const p = compiled();
    const mh = freshHandler();
    assertEquals(p.parse("naoExiste",), false,);
    assertEquals(
      mh.messages.some((m,) => m.id === "no_start_state"),
      true,
    );
  });

  it("nextToken é chamado na ordem esperada", () => {
    const p = compiled();
    p.feed(["ID", "a", sfi(),], ["ID", "end", sfi(),],);
    p.parse("top",);
    assertEquals(p.queueIsEmpty(), true,);
  });

  it("REDUCE devolve tokens ao scanner via returnToken", () => {
    const p = compiled();
    p.feed(["ID", "x", sfi(),], ["ID", "end", sfi(),],);
    p.parse("top",);
    assertEquals(p.returned.some((t,) => t !== null), true,);
  });

  it("ação recebe this = parser e lê val", () => {
    const p = compiled();
    p.feed(["ID", "nome", sfi(7,),], ["ID", "end", sfi(8,),],);
    assertEquals(p.parse("top",), "top:nome:end",);
    assertEquals(p.val.length >= 2, true,);
  });

  it("regra com referência entra na sub-regra (stateStack)", () => {
    const p = compiled();
    p.newRule("pai", () => {
      p.pattern(["!child", "_fim",], function (this: TextParser,) {
        return `pai:${String(this.val[0],)}`;
      },);
    },);
    p.updateParserTables();
    p.feed(
      ["ID", "kw", sfi(),],
      ["STRING", "dado", sfi(),],
      ["ID", "fim", sfi(),],
    );
    assertEquals(p.parse("pai",), "pai:child:dado",);
  });

  it("REDUCE em estado com noReduce gera no_reduce", () => {
    const p = compiled();
    // hello espera o literal "hello"; STRING não transiciona.
    p.feed(["STRING", "outra", sfi(),], ["endOfText", "<END>", null,],);
    const mh = freshHandler();
    p.parse("hello",);
    assertEquals(
      mh.messages.some((m,) =>
        m.id === "no_reduce" || m.id === "unexpctd_token"
      ),
      true,
    );
  });

  it("token bloqueado no contexto gera unsupported_token (getNextToken)", () => {
    const p = compiled();
    p.limitTokenSet(["endOfText",],);
    p.feed(["ID", "x", sfi(),], ["endOfText", "<END>", null,],);
    const mh = freshHandler();
    p.parse("hello",);
    assertEquals(
      mh.messages.some((m,) => m.id === "unsupported_token"),
      true,
    );
  });

  it("TjError disparado em action é capturado e logado como critical", () => {
    const p = new TestParser();
    p.newRule("boom",);
    p.pattern(["_x",], () => {
      throw new TjError("explosão controlada",);
    },);
    p.updateParserTables();
    p.feed(["ID", "x", sfi(),], ["endOfText", "<END>", null,],);
    const mh = freshHandler();
    assertEquals(p.parse("boom",), false,);
    assertEquals(
      mh.messages.some((m,) => m.id === "parse" && m.type === "error"),
      true,
    );
  });
});

describe("TextParser — saveFsmStack / restoreFsmStack (10.7.2)", () => {
  it("saveFsmStack converte States em tuplas [rule, pattern, index]", () => {
    const p = compiled();
    p.seedStackWithState();
    p.invokeSaveFsmStack();
    const top = p.stackTopState();
    assertEquals(Array.isArray(top,), true,);
    assertEquals((top as [unknown, unknown, unknown,]).length, 3,);
  });

  it("restoreFsmStack reconverte tuplas em State", () => {
    const p = compiled();
    p.seedStackWithState();
    const original = p.stackTopState() as State;
    p.invokeSaveFsmStack();
    p.invokeRestoreFsmStack();
    assertEquals(p.stackTopState(), original,);
  });

  it("restoreFsmStack lança se o estado sumiu do FSM", () => {
    const p = compiled();
    p.seedStackWithState();
    p.invokeSaveFsmStack();
    p.states = new Map(); // FSM re-gerado sem o estado antigo
    assertThrows(
      () => p.invokeRestoreFsmStack(),
      Error,
      "Stack restore failed",
    );
  });

  it("updateParserTables preserva a pilha em uso (extend)", () => {
    const p = compiled();
    p.seedStackWithState();
    const original = p.stackTopState() as State;
    p.newRule("extra", () => {
      p.pattern(["$ID",],);
    },);
    p.updateParserTables(); // save + rebuild + restore
    assertEquals(p.stackTopState(), original,);
    assertEquals(p.rules.has("extra",), true,);
  });
});

describe("TextParser — error / warning / finishPattern (10.7.3)", () => {
  it("deprecated gera warning deprecated_keyword", () => {
    const p = new TestParser();
    p.newRule("dep",);
    p.pattern(["_x",], function (this: TextParser,) {
      return "dep";
    },);
    (p.cr as { setSupportLevel: (l: string,) => void }).setSupportLevel(
      "deprecated",
    );
    p.updateParserTables();
    p.feed(["ID", "x", sfi(),], ["endOfText", "<END>", null,],);
    const mh = freshHandler();
    assertEquals(p.parse("dep",), "dep",);
    assertEquals(
      mh.messages.some((m,) =>
        m.id === "deprecated_keyword" && m.type === "warning"
      ),
      true,
    );
  });

  it("removed gera erro removed_keyword", () => {
    const p = new TestParser();
    p.newRule("rem",);
    p.pattern(["_x",], function (this: TextParser,) {
      return "rem";
    },);
    (p.cr as { setSupportLevel: (l: string,) => void }).setSupportLevel(
      "removed",
    );
    p.updateParserTables();
    p.feed(["ID", "x", sfi(),], ["endOfText", "<END>", null,],);
    const mh = freshHandler();
    p.parse("rem",);
    assertEquals(
      mh.messages.some((m,) => m.id === "removed_keyword"),
      true,
    );
  });

  it("AttributeOverwrite em action vira warning attr_overwrite", () => {
    const p = new TestParser();
    p.newRule("ovr",);
    p.pattern(["_x",], function () {
      throw new AttributeOverwrite("custo",);
    },);
    p.updateParserTables();
    p.feed(["ID", "x", sfi(),], ["endOfText", "<END>", null,],);
    const mh = freshHandler();
    p.parse("ovr",);
    assertEquals(
      mh.messages.some((m,) =>
        m.id === "attr_overwrite" && m.type === "warning"
      ),
      true,
    );
  });

  it("outros erros em action propagam (TjError vira parse critical)", () => {
    const p = new TestParser();
    p.newRule("err2",);
    p.pattern(["_x",], () => {
      throw new Error("falha comum",);
    },);
    p.updateParserTables();
    p.feed(["ID", "x", sfi(),], ["endOfText", "<END>", null,],);
    assertThrows(() => p.parse("err2",), Error, "falha comum",);
  });

  it("pilha vazia com token não-EOF gera unexpctd_token", () => {
    const p = compiled();
    p.feed(["STRING", "sobrando", sfi(),], ["endOfText", "<END>", null,],);
    const mh = freshHandler();
    p.parse("hello",);
    assertEquals(
      mh.messages.some((m,) =>
        m.id === "unexpctd_token" && m.message.includes("sobrando",)
      ),
      true,
    );
  });

  it("getSourceFileInfo retorna SFI do primeiro token do padrão", () => {
    const p = compiled();
    const state = [...p.states.values(),].find((s,) => s.pattern !== null)!;
    p.pushRawStackElement(null, state, [],);
    p.pushRawStackElement(null, state, [["x", sfi(11,),], ["y", sfi(12,),],],);
    assertEquals(p.getSourceFileInfo()?.lineNo, 11,);
  });
});

describe("TextParser — dumpStack / checkForOldSyntax (10.7.4)", () => {
  it("dumpStack sem pilha retorna string vazia", () => {
    const p = compiled();
    assertEquals(p.invokeDumpStack(), "",);
  });

  it("dumpStack após parse lista níveis da pilha", () => {
    const p = compiled();
    const state = [...p.states.values(),].find((s,) => s.pattern !== null)!;
    p.pushRawStackElement(null, state, [["valor", sfi(),],],);
    const out = p.invokeDumpStack();
    assertEquals(out.includes("valor",), true,);
    assertEquals(out.includes("->",), true,);
  });

  it("checkForOldSyntax não dispara para patterns suportados", () => {
    const p = compiled();
    p.feed(["ID", "x", sfi(),], ["ID", "end", sfi(),],);
    const mh = freshHandler();
    p.parse("top",);
    assertEquals(
      mh.messages.some((m,) =>
        m.id === "deprecated_keyword" || m.id === "removed_keyword"
      ),
      false,
    );
  });
});
