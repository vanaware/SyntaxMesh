/**
 * LogicalAttribute — folha de operando que lê um atributo de propriedade
 * via `Query` (Fase 11.2.1).
 *
 * Port de `LogicalOperation.rb::LogicalAttribute`. O `operand1` é o
 * `attributeId`; o cenário vem de `@scenario.sequenceNo - 1` (não do índice
 * direto). A avaliação clona a `query` do contexto, fixa cenário+atributo e
 * chama `process()`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb
 */
import type { Scenario, } from "../model/scenario.ts";
import type { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "./logical-expression.ts";
import { LogicalOperation, } from "./logical-operation.ts";

export class LogicalAttribute extends LogicalOperation {
  readonly scenario: Scenario;

  constructor(attribute: string, scenario: Scenario,) {
    super(attribute,);
    this.scenario = scenario;
  }

  override eval(expr: LogicalExpression,): unknown {
    if (!expr.query) {
      return expr.error("LogicalAttribute requires a Query context",);
    }
    const query: Query = expr.query.dup();
    query.scenarioIdx = this.scenario.sequenceNo - 1;
    query.attributeId = this.operand1 as string;
    query.process();
    if (query.ok) {
      // Expressões comparam valores → usamos `result`; nil vira string vazia.
      return query.result() ?? "";
    }
    return expr.error(query.errorMessage ?? "Query failed",);
  }

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
