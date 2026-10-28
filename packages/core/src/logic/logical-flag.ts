/**
 * LogicalFlag — folha de operando que testa uma flag declarada (Fase 11.2.2).
 *
 * Port de `LogicalOperation.rb::LogicalFlag`. Avalia para `true` quando a
 * propriedade do contexto tem a flag atribuída. O contexto pode ser uma
 * `Query` (projeto/PTN) ou um `Journal` (Fase 16) — aqui só o ramo `Query`
 * é implementado.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb
 */
import { NotYetImplementedError, } from "../model/errors.ts";
import type { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "./logical-expression.ts";
import { LogicalOperation, } from "./logical-operation.ts";
import { isQuery, } from "./type-guards.ts";

/** `flags` é scenario-specific; o Ruby lê com índice de cenário 0. */
function hasFlag(query: Query, flag: string,): boolean {
  const property = query.property;
  if (!property) return false;
  const flags =
    (property.getForScenario("flags", 0,) as string[] | undefined) ??
      [];
  return flags.includes(flag,);
}

export class LogicalFlag extends LogicalOperation {
  constructor(opnd: string,) {
    super(opnd,);
  }

  override eval(expr: LogicalExpression,): boolean {
    if (isQuery(expr.query,)) {
      return hasFlag(expr.query, this.operand1 as string,);
    }
    // Ramo Journal: completo na Fase 16.
    throw new NotYetImplementedError("16", "LogicalFlag (Journal)",);
  }

  override to_s(query: Query | null,): string {
    if (query) {
      return hasFlag(query, this.operand1 as string,) ? "true" : "false";
    }
    return String(this.operand1,);
  }
}
