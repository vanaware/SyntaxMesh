/**
 * Testes e2e de expressões lógicas complexas (Fase 11.5).
 *
 * Valida as Convenções CRÍTICAS (ADR 024): avaliação left-to-right sem
 * precedência, `&`/`|` lazy (short-circuit) e coerção pelo tipo do `operand1`.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, } from "@std/assert";
import { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { Query, } from "../../src/query/query.ts";

const q = (): Query => new Query();
const leaf = (v: unknown,): LogicalOperation => new LogicalOperation(v,);

/** Folga com contador para provar short-circuit. */
class CountingLeaf {
  calls = 0;
  constructor(private readonly value: boolean,) {}
  eval(_e: LogicalExpression,): boolean {
    this.calls++;
    return this.value;
  }
}

function evalExpr(op: LogicalOperation,): boolean {
  return new LogicalExpression(op,).eval(q(),);
}

describe("Expressões e2e (11.5)", () => {
  it("11.5.2 sem precedência: a | b & c = (a | b) & c", () => {
    // a=true, b=false, c=false → (true|false)&false = true&false = false
    // Com precedência conventional seria true|(false&false) = true.
    const a = leaf(true,);
    const b = leaf(false,);
    const c = leaf(false,);
    const orAb = new LogicalOperation(a, "|", b,);
    const andC = new LogicalOperation(orAb, "&", c,);
    assertEquals(evalExpr(andC,), false,);
  });

  it("11.5.3 sem precedência: a & b | c = (a & b) | c", () => {
    // a=true, b=false, c=true → (true&false)|true = false|true = true
    const a = leaf(true,);
    const b = leaf(false,);
    const c = leaf(true,);
    const andAb = new LogicalOperation(a, "&", b,);
    const orC = new LogicalOperation(andAb, "|", c,);
    assertEquals(evalExpr(orC,), true,);
  });

  it("11.5.4 lazy &: operand2 não é avaliado se operand1 é false", () => {
    const a = new CountingLeaf(false,);
    const b = new CountingLeaf(true,);
    const and = new LogicalOperation(a, "&", b,);
    assertEquals(evalExpr(and,), false,);
    assertEquals(a.calls, 1,);
    assertEquals(b.calls, 0,);
  });

  it("11.5.5 lazy |: operand2 não é avaliado se operand1 é true", () => {
    const a = new CountingLeaf(true,);
    const b = new CountingLeaf(false,);
    const or = new LogicalOperation(a, "|", b,);
    assertEquals(evalExpr(or,), true,);
    assertEquals(a.calls, 1,);
    assertEquals(b.calls, 0,);
  });

  it("11.5.6 aninhada: ~(a | b)", () => {
    const a = leaf(true,);
    const b = leaf(false,);
    const or = new LogicalOperation(a, "|", b,);
    const not = new LogicalOperation(or, "~",);
    assertEquals(evalExpr(not,), false,);
  });

  it("11.5.7 associativo à esquerda: a & b & c", () => {
    const left = new LogicalOperation(leaf(true,), "&", leaf(true,),);
    const all = new LogicalOperation(left, "&", leaf(false,),);
    assertEquals(evalExpr(all,), false,);
    const allTrue = new LogicalOperation(
      new LogicalOperation(leaf(true,), "&", leaf(true,),),
      "&",
      leaf(true,),
    );
    assertEquals(evalExpr(allTrue,), true,);
  });

  it("11.5.8 coerção number: (a > 5) & (b < 10)", () => {
    const cmp1 = new LogicalOperation(6, ">", 5,);
    const cmp2 = new LogicalOperation(8, "<", 10,);
    const and = new LogicalOperation(cmp1, "&", cmp2,);
    assertEquals(evalExpr(and,), true,);
    // false quando uma das comparações falha
    const cmp3 = new LogicalOperation(2, ">", 5,);
    assertEquals(evalExpr(new LogicalOperation(cmp3, "&", cmp2,),), false,);
  });
});
