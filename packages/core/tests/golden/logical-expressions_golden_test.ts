/**
 * Golden test de expressões lógicas (Fase 11.13).
 *
 * Reproduz as árvores de `LogicalOperation` descritas em
 * `logical-expressions.golden.json` (oracle Ruby) e valida que a
 * implementação TS produz o mesmo resultado booleano — ou o mesmo erro.
 *
 * Escopo: só casos cujo comportamento coincide entre Ruby e TS (comparações
 * de mesmo tipo, `&`/`|` lazy, `~`, avaliação left-to-right sem precedência,
 * erros). Ver comentário do script Ruby correspondente.
 */
import { describe, it, } from "@std/testing/bdd";
import { assertEquals, assertThrows, } from "@std/assert";
import { LogicalOperation, } from "../../src/logic/logical-operation.ts";
import { LogicalExpression, } from "../../src/logic/logical-expression.ts";
import { Query, } from "../../src/query/query.ts";
import { TjError, } from "../../src/model/errors.ts";

interface LeafSpec {
  lit: unknown;
}
interface NodeSpec {
  op1: TreeSpec;
  operator: string | null;
  op2: TreeSpec | null;
}
type TreeSpec = LeafSpec | NodeSpec;

interface GoldenCase {
  description: string;
  tree: TreeSpec;
  expected: unknown;
}

function isLeaf(spec: TreeSpec,): spec is LeafSpec {
  return "lit" in spec;
}

function build(spec: TreeSpec,): LogicalOperation {
  if (isLeaf(spec,)) return new LogicalOperation(spec.lit,);
  const op1 = build(spec.op1,);
  const op2 = spec.op2 ? build(spec.op2,) : null;
  if (spec.operator === null || spec.operator === undefined) return op1;
  return new LogicalOperation(op1, spec.operator, op2,);
}

function loadCases(): GoldenCase[] {
  const path = new URL("./logical-expressions.golden.json", import.meta.url,);
  const parsed = JSON.parse(Deno.readTextFileSync(path,),) as {
    cases: GoldenCase[];
  };
  return parsed.cases;
}

describe("logical-expressions golden (11.13)", () => {
  const cases = loadCases();

  it("tem pelo menos 20 casos", () => {
    assertEquals(cases.length >= 20, true,);
  });

  for (const c of cases) {
    it(c.description, () => {
      const expr = new LogicalExpression(build(c.tree,),);
      if (c.expected === "error") {
        assertThrows(() => expr.eval(new Query(),), TjError,);
      } else {
        assertEquals(expr.eval(new Query(),), c.expected,);
      }
    },);
  }
});
