/**
 * LogicalExpression — root of a logical expression tree (phase 11.4).
 *
 * Faithful port of `LogicalExpression.rb`. Wraps a `LogicalOperation` and the
 * evaluation context (`query`). Evaluation always returns a boolean: `true`,
 * `false` and strings pass through the Ruby rule; numbers use `!== 0` (in TJP
 * 'non-zero' is compared against zero).
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalExpression.rb
 */
import { TjError, } from "../model/errors.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { Query, } from "../query/query.ts";
import type { LogicalOperation, } from "./logical-operation.ts";

/** Logical expression: root of a `LogicalOperation` tree. */
export class LogicalExpression {
  /** Root operation of the tree. */
  readonly operation: LogicalOperation;
  /** Source location where the expression was read, when known. */
  readonly sourceFileInfo: SourceFileInfo | null;
  /** Evaluation context; filled in by `eval`. */
  query: Query | null = null;

  /**
   * Creates the expression around its root operation.
   *
   * @param op Root operation of the tree.
   * @param sourceFileInfo Source location where the expression was read.
   */
  constructor(
    op: LogicalOperation,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    this.operation = op;
    this.sourceFileInfo = sourceFileInfo;
  }

  /**
   * Evaluates the expression against `query`, normalizing the result to a
   * boolean.
   *
   * @param query Evaluation context.
   * @returns The boolean result of the expression.
   */
  eval(query: Query,): boolean {
    this.query = query;
    const res = this.operation.eval(this,);
    if (typeof res === "boolean") return res;
    if (typeof res === "string") return res.length > 0;
    // Numbers and null: in TJP only 0 (and false) mean 'false'.
    return (res as unknown) !== 0;
  }

  /**
   * Renders the expression as text.
   *
   * @param query When given, shows the resolved values instead of the names.
   * @returns The textual form of the expression.
   */
  to_s(query: Query | null = null,): string {
    const body = this.operation.to_s(query,);
    return this.sourceFileInfo === null
      ? body
      : `${this.sourceFileInfo.to_s()} ${body}`;
  }

  /**
   * Default string conversion (name-based) required by the JS runtime.
   *
   * @returns The textual form of the root operation.
   */
  toString(): string {
    return this.operation.toString();
  }

  /**
   * Internal error raised by `LogicalOperation` implementations during
   * evaluation.
   *
   * @param text Description of the problem.
   * @throws TjError Always, prefixed with the textual form of the expression.
   */
  error(text: string,): never {
    throw new TjError(
      `${this.to_s()}\nLogical expression error: ${text}`,
    );
  }
}
