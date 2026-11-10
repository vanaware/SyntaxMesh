/**
 * Type guards for the logical engine (phase 11.2.3.1).
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb (Query vs Journal)
 */
import { Query, } from "../query/query.ts";

/**
 * Narrows the evaluation context to a `Query` (as opposed to a journal entry).
 *
 * @param x Value to test.
 * @returns `true` when `x` is a `Query` instance.
 */
export function isQuery(x: unknown,): x is Query {
  return x instanceof Query;
}
