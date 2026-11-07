/**
 * Argumentos nomeados de template (Fase 23, subfase 23.4).
 *
 * Cobre a tipagem dos valores do §4.2: string, número, booleano, referência
 * `!id`, lista, objeto, aritmética (sem `eval`) e chamada avaliada pelo motor
 * da Fase 11 (injetado). Nada aqui conhece Vento.
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md §4.2, §5
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md §23.4
 */
import { assert, assertEquals, } from "@std/assert";
import { describe, it, } from "@std/testing/bdd";
import {
  parseArgumentValue,
  parseTemplateArguments,
  type TemplateArgumentValue,
} from "../../src/lexer/template-arguments.ts";

function args(raw: string,): Record<string, TemplateArgumentValue> {
  const result = parseTemplateArguments(raw,);
  assert(result.ok, `falhou: ${JSON.stringify(result,)}`,);
  return result.args;
}

describe("parseTemplateArguments — pares e strings (23.4.1)", () => {
  it("lê pares nome=valor separados por espaço", () => {
    assertEquals(args('id="t1" nome="Design"',), {
      id: "t1",
      nome: "Design",
    },);
  });

  it("preserva espaços dentro das aspas", () => {
    assertEquals(args('nome="Alice Silva" cargo="Dev Sênior"',), {
      nome: "Alice Silva",
      cargo: "Dev Sênior",
    },);
  });

  it('aceita aspas simples e escape \\"', () => {
    assertEquals(args(`a='x y' b="diz \\"oi\\""`,), {
      a: "x y",
      b: 'diz "oi"',
    },);
  });

  it("recusa texto que não é par nome=valor", () => {
    const out = parseTemplateArguments('id "t1"',);
    assertEquals(out.ok, false,);
    if (!out.ok) assertEquals(out.reason, "invalid_pair",);
  });

  it("recusa valor ausente", () => {
    const out = parseTemplateArguments("id=",);
    assertEquals(out.ok, false,);
    if (!out.ok && out.reason === "missing_value") {
      assertEquals(out.key, "id",);
    }
  });
});

describe("parseTemplateArguments — tipos escalares (23.4.2/23.4.3)", () => {
  it("número inteiro e decimal viram number", () => {
    assertEquals(args("a=42 b=3.14 c=-7",), { a: 42, b: 3.14, c: -7, },);
  });

  it("true/false viram boolean", () => {
    assertEquals(args("a=true b=false",), { a: true, b: false, },);
  });

  it("referência !id é preservada como texto nativo", () => {
    assertEquals(args("dep=!t1 outra=!res.alice",), {
      dep: "!t1",
      outra: "!res.alice",
    },);
  });
});

describe("parseTemplateArguments — lista e objeto (23.4.4)", () => {
  it("lista de referências", () => {
    assertEquals(args("time=[!t1, !t2, !t3]",), {
      time: ["!t1", "!t2", "!t3",],
    },);
  });

  it("lista com strings e números", () => {
    assertEquals(args('agenda=["a b", 2, true]',), {
      agenda: ["a b", 2, true,],
    },);
  });

  it("objeto literal aninhado", () => {
    assertEquals(args('conf={ id: "t1", peso: 3 }',), {
      conf: { id: "t1", peso: 3, },
    },);
  });

  it("objeto dentro de lista mantém o balanceamento", () => {
    assertEquals(args("x=[{a: 1}, {b: 2}]",), {
      x: [{ a: 1, }, { b: 2, },],
    },);
  });
});

describe("parseArgumentValue — aritmética (23.4.5)", () => {
  it("soma literal", () => {
    assertEquals(parseArgumentValue("1 + 2",), 3,);
  });

  it("precedência e parênteses", () => {
    assertEquals(parseArgumentValue("(1 + 2) * 3",), 9,);
    assertEquals(parseArgumentValue("10 - 2 * 3",), 4,);
  });

  it("usa argumentos já lidos como variáveis", () => {
    assertEquals(args("esforco=5 total=esforco * 2",), {
      esforco: 5,
      total: 10,
    },);
  });

  it("texto não-aritmético permanece texto", () => {
    assertEquals(parseArgumentValue("5d",), "5d",);
  });
});

describe("parseArgumentValue — expressão lógica (23.4.6)", () => {
  it("usa o avaliador injetado (motor da Fase 11)", () => {
    const seen: string[] = [];
    const value = parseArgumentValue("isMilestone(!m1)", {}, {
      evaluateExpression: (text,) => {
        seen.push(text,);
        return { ok: true, value: true, };
      },
    },);
    assertEquals(value, true,);
    assertEquals(seen, ["isMilestone(!m1)",],);
  });

  it("sem avaliador a chamada fica texto", () => {
    assertEquals(parseArgumentValue("isMilestone(!m1)",), "isMilestone(!m1)",);
  });

  it("avaliador que recusa mantém o texto", () => {
    assertEquals(
      parseArgumentValue("naoExiste(1)", {}, {
        evaluateExpression: () => ({ ok: false, }),
      },),
      "naoExiste(1)",
    );
  });
});

describe("parseTemplateArguments — corte por profundidade (23.4.1)", () => {
  it("igual e vírgula dentro de aspas não quebram o par", () => {
    assertEquals(args('a="x = y, z" b=1',), { a: "x = y, z", b: 1, },);
  });

  it("parênteses de chamada não quebram o par", () => {
    assertEquals(
      parseArgumentValue("isMilestone(!m1)", {}, {
        evaluateExpression: () => ({ ok: true, value: false, }),
      },),
      false,
    );
  });
});
