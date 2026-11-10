/**
 * LogicalFlag — leaf operand that tests a declared flag (phase 11.2.2).
 *
 * Port of `LogicalOperation.rb::LogicalFlag` (l.233-262). Evaluates to `true`
 * when the context carries the flag: inside a `Query` (project/PTN) the list is
 * `property['flags', 0]`; inside a `JournalEntry` (phase 16, used by
 * `journal.hideJournalEntry`) it is the `entry.flags` array.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb:233-262
 */
import type { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "./logical-expression.ts";
import { LogicalOperation, } from "./logical-operation.ts";
import { isQuery, } from "./type-guards.ts";

/**
 * Flags of a `Query` context. `flags` is scenario-specific; the Ruby original
 * reads it with scenario index 0.
 *
 * @param query Evaluation context.
 * @returns The declared flags, or an empty list.
 */
function queryFlags(query: Query,): string[] {
  const property = query.property;
  if (!property) return [];
  const flags =
    (property.getForScenario("flags", 0,) as string[] | undefined) ?? [];
  return flags;
}

/**
 * Flags of the journal context (`expr.query.flags` in Ruby).
 *
 * `LogicalExpression.query` is typed as `Query`, but when the expression is
 * evaluated by `Journal.hidden` the runtime value is a `JournalEntry` — hence
 * the duck-typed read.
 *
 * @param context Evaluation context, possibly a journal entry.
 * @returns The flags of the entry, or an empty list.
 */
function entryFlags(context: unknown,): string[] {
  const flags = (context as { flags?: unknown } | null)?.flags;
  return Array.isArray(flags,) ? flags as string[] : [];
}

/** Operand leaf that evaluates to whether the context carries a flag. */
export class LogicalFlag extends LogicalOperation {
  /**
   * Creates the operand.
   *
   * @param opnd Name of the flag to test.
   */
  constructor(opnd: string,) {
    super(opnd,);
  }

  /**
   * Tests the flag against the evaluation context.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns `true` when the flag is present.
   */
  override eval(expr: LogicalExpression,): boolean {
    const flag = this.operand1 as string;
    // Branch 1: project/PTN (`Query`). Branch 2: journal entry (phase 16).
    if (isQuery(expr.query,)) return queryFlags(expr.query,).includes(flag,);
    return entryFlags(expr.query,).includes(flag,);
  }

  /**
   * Renders the operand as text.
   *
   * @param query Evaluation context; when present, shows `true`/`false`
   *   instead of the flag name.
   * @returns The textual form of the operand.
   */
  override to_s(query: Query | null,): string {
    if (query) {
      const flags = isQuery(query,)
        ? queryFlags(query,)
        : entryFlags(query as unknown,);
      return flags.includes(this.operand1 as string,) ? "true" : "false";
    }
    return String(this.operand1,);
  }
}
