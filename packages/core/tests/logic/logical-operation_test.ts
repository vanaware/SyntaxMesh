/**
 * Testes BDD de `LogicalOperation` (Fase 11.1).
 *
 * Cobre estrutura, `eval` (dispatch por operador), coerções (pelo tipo do
 * `operand1`), lazy `&`/`|` e `to_s`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb
 */
import { describe, it, } from "@std/testing/bdd";
import { assert, assertEquals, assertThrows, } from "@std/assert";
import { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { TjTime, } from "../../src/time/tj-time.ts";
import { TjError, } from "../../src/model/errors.ts";

/** Avalia uma operação isolada dentro de uma `LogicalExpression` mínima. */
function evalOp(op: LogicalOperation,): unknown {
  const expr = new LogicalExpression(op,);
  return op.eval(expr,);
}

/** Folga que conta quantas vezes foi avaliada (teste de short-circuit). */
class CountingLeaf {
  calls = 0;
  constructor(private readonly value: unknown,) {}
  eval(_expr: LogicalExpression,): unknown {
    this.calls++;
    return this.value;
  }
  to_s(_query: unknown,): string {
    return String(this.value,);
  }
}

describe("LogicalOperation", () => {
  describe("estrutura (11.1.1)", () => {
    it("só operand1: operator/operand2 são null", () => {
      const op = new LogicalOperation(5,);
      assertEquals(op.operand1, 5,);
      assertEquals(op.operator, null,);
      assertEquals(op.operand2, null,);
    });
    it("operand1 + operator", () => {
      const op = new LogicalOperation(5, "~",);
      assertEquals(op.operator, "~",);
      assertEquals(op.operand2, null,);
    });
    it("operand1 + operator + operand2", () => {
      const op = new LogicalOperation(5, ">", 3,);
      assertEquals(op.operator, ">",);
      assertEquals(op.operand2, 3,);
    });
  });

  describe("eval: operator null (11.1.2.2)", () => {
    it("retorna primitivo direto", () => {
      assertEquals(evalOp(new LogicalOperation(7,),), 7,);
    });
    it("avalia nó com eval()", () => {
      const leaf = new CountingLeaf(42,);
      assertEquals(evalOp(new LogicalOperation(leaf,),), 42,);
      assertEquals(leaf.calls, 1,);
    });
    it("retorna string direto", () => {
      assertEquals(evalOp(new LogicalOperation("oi",),), "oi",);
    });
  });

  describe("eval: negação ~ (11.1.2.3)", () => {
    it("~ de número não-zero é false", () => {
      assertEquals(evalOp(new LogicalOperation(1, "~",),), false,);
    });
    it("~ de zero é true", () => {
      assertEquals(evalOp(new LogicalOperation(0, "~",),), true,);
    });
    it("~ de string vazia é true", () => {
      assertEquals(evalOp(new LogicalOperation("", "~",),), true,);
    });
  });

  describe("eval: comparações binárias (11.1.2.4)", () => {
    it("> numérica", () => {
      assertEquals(evalOp(new LogicalOperation(5, ">", 3,),), true,);
      assertEquals(evalOp(new LogicalOperation(3, ">", 5,),), false,);
    });
    it(">= numérica (igualdade)", () => {
      assertEquals(evalOp(new LogicalOperation(5, ">=", 5,),), true,);
      assertEquals(evalOp(new LogicalOperation(4, ">=", 5,),), false,);
    });
    it("= numérica", () => {
      assertEquals(evalOp(new LogicalOperation(5, "=", 5,),), true,);
      assertEquals(evalOp(new LogicalOperation(5, "=", 6,),), false,);
    });
    it("< numérica", () => {
      assertEquals(evalOp(new LogicalOperation(3, "<", 5,),), true,);
    });
    it("<= numérica", () => {
      assertEquals(evalOp(new LogicalOperation(5, "<=", 5,),), true,);
      assertEquals(evalOp(new LogicalOperation(6, "<=", 5,),), false,);
    });
    it("!= numérica", () => {
      assertEquals(evalOp(new LogicalOperation(5, "!=", 6,),), true,);
      assertEquals(evalOp(new LogicalOperation(5, "!=", 5,),), false,);
    });
  });

  describe("eval: lazy & / | (11.1.2.5-6)", () => {
    it("& não avalia operand2 se operand1 é false", () => {
      const left = new CountingLeaf(0,); // false
      const right = new CountingLeaf(1,);
      const op = new LogicalOperation(left, "&", right,);
      assertEquals(evalOp(op,), false,);
      assertEquals(left.calls, 1,);
      assertEquals(right.calls, 0,);
    });
    it("& avalia operand2 se operand1 é true", () => {
      const left = new CountingLeaf(1,);
      const right = new CountingLeaf(0,);
      assertEquals(evalOp(new LogicalOperation(left, "&", right,),), false,);
      assertEquals(right.calls, 1,);
    });
    it("| não avalia operand2 se operand1 é true", () => {
      const left = new CountingLeaf(1,);
      const right = new CountingLeaf(0,);
      assertEquals(evalOp(new LogicalOperation(left, "|", right,),), true,);
      assertEquals(right.calls, 0,);
    });
    it("| avalia operand2 se operand1 é false", () => {
      const left = new CountingLeaf(0,);
      const right = new CountingLeaf(1,);
      assertEquals(evalOp(new LogicalOperation(left, "|", right,),), true,);
      assertEquals(right.calls, 1,);
    });
  });

  describe("eval: operador desconhecido (11.1.2.7)", () => {
    it("lança erro via expr.error", () => {
      const op = new LogicalOperation(1, "?", 2,);
      assertThrows(
        () => evalOp(op,),
        TjError,
      );
    });
  });

  describe("coerções (11.1.3)", () => {
    it("coerção de comparação é pelo tipo do operand1", () => {
      // operand1 número, operand2 string "3" → coerceNumber("3")=3 → 3=3
      assertEquals(evalOp(new LogicalOperation(3, "=", "3",),), true,);
      // operand1 string, operand2 número 5 → coerceString(5)="5"
      assertEquals(evalOp(new LogicalOperation("5", "=", 5,),), true,);
    });
    it("coerceString aceita TjTime via to_s", () => {
      const t = TjTime.fromString("2026-01-01",);
      const op = new LogicalOperation("x", "=", t,);
      // operand1 string → coerção string do TjTime (não deve lançar)
      assertEquals(evalOp(op,), false,);
    });
    it("operand1 booleano em binária é erro", () => {
      assertThrows(
        () => evalOp(new LogicalOperation(true, "=", 1,),),
        TjError,
      );
    });
    it("coerceNumber de TjTime é erro", () => {
      const t = TjTime.fromString("2026-01-01",);
      assertThrows(
        () => evalOp(new LogicalOperation(1, "=", t,),),
        TjError,
      );
    });
    it("coerceTime compara TjTime com string-parseável", () => {
      const t = TjTime.fromString("2026-06-01",);
      assertEquals(
        evalOp(new LogicalOperation(t, ">", "2026-01-01",),),
        true,
      );
    });
  });

  describe("to_s (11.1.4)", () => {
    it("operand1 sem operador", () => {
      assertEquals(new LogicalOperation(5,).to_s(null,), "5",);
    });
    it("unário: operador + operand", () => {
      assertEquals(new LogicalOperation(5, "~",).to_s(null,), "~5",);
    });
    it("binário: (a op b)", () => {
      assertEquals(new LogicalOperation(5, ">", 3,).to_s(null,), "(5 > 3)",);
    });
    it("string é entre aspas", () => {
      assertEquals(
        new LogicalOperation("oi", "=", "oi",).to_s(null,),
        "('oi' = 'oi')",
      );
    });
  });

  describe("operações compostas", () => {
    it("(5 > 3) & (2 < 4) é true", () => {
      const a = new LogicalOperation(5, ">", 3,);
      const b = new LogicalOperation(2, "<", 4,);
      const and = new LogicalOperation(a, "&", b,);
      assert(evalOp(and,) === true,);
    });
  });
});
