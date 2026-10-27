/**
 * Type guards para o motor lógico (Fase 11.2.3.1).
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb (Query vs Journal)
 */
import { Query, } from "../query/query.ts";

/** Narrowing: o contexto de avaliação é uma `Query` (não um Journal). */
export function isQuery(x: unknown,): x is Query {
  return x instanceof Query;
}
