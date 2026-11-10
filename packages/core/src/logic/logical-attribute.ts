/**
 * LogicalAttribute — leaf operand that reads a property attribute through a
 * `Query` (phase 11.2.1).
 *
 * Port of `LogicalOperation.rb::LogicalAttribute`. `operand1` holds the
 * `attributeId`; the scenario comes from `@scenario.sequenceNo - 1` (not the
 * direct index). Evaluation clones the `query` of the context, pins the
 * scenario and the attribute, then calls `process()`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb
 */
import type { Scenario, } from "../model/scenario.ts";
import type { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "./logical-expression.ts";
import { LogicalOperation, } from "./logical-operation.ts";

/** Operand leaf that resolves to the value of one attribute in one scenario. */
export class LogicalAttribute extends LogicalOperation {
  /** Scenario the attribute is read from. */
  readonly scenario: Scenario;

  /**
   * Creates the operand.
   *
   * @param attribute Identifier of the attribute to read.
   * @param scenario Scenario the attribute is read from.
   */
  constructor(attribute: string, scenario: Scenario,) {
    super(attribute,);
    this.scenario = scenario;
  }

  /**
   * Reads the attribute value in the pinned scenario.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns The attribute value, or an error result from the expression.
   */
  override eval(expr: LogicalExpression,): unknown {
    if (!expr.query) {
      return expr.error("LogicalAttribute requires a Query context",);
    }
    const query: Query = expr.query.dup();
    query.scenarioIdx = this.scenario.sequenceNo - 1;
    query.attributeId = this.operand1 as string;
    query.process();
    if (query.ok) {
      // Expressions compare values, so `result` is used; nil becomes "".
      return query.result() ?? "";
    }
    return expr.error(query.errorMessage ?? "Query failed",);
  }

  /**
   * Renders the operand as text.
   *
   * @param query Evaluation context; when present, shows the resolved value
   *   instead of the attribute name.
   * @returns The textual form of the operand.
   */
  override to_s(query: Query | null,): string {
    if (query) {
      const q = query.dup();
      q.scenarioIdx = this.scenario.sequenceNo - 1;
      q.attributeId = this.operand1 as string;
      q.process();
      if (!q.ok) {
        return `Error in conversion to String: ${q.errorMessage}`;
      }
      return q.to_s();
    }
    return `${this.scenario.fullId}.${String(this.operand1,)}`;
  }
}
