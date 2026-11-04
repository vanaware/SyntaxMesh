/**
 * LogicalFlag — folha de operando que testa uma flag declarada (Fase 11.2.2).
 *
 * Port de `LogicalOperation.rb::LogicalFlag` (l.233-262). Avalia para `true`
 * quando o contexto tem a flag: numa `Query` (projeto/PTN) a lista é
 * `property['flags', 0]`; num `JournalEntry` (Fase 16, usado por
 * `journal.hideJournalEntry`) é o array `entry.flags`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb:233-262
 */
import type { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "./logical-expression.ts";
import { LogicalOperation, } from "./logical-operation.ts";
import { isQuery, } from "./type-guards.ts";

/** `flags` é scenario-specific; o Ruby lê com índice de cenário 0. */
function queryFlags(query: Query,): string[] {
  const property = query.property;
  if (!property) return [];
  const flags =
    (property.getForScenario("flags", 0,) as string[] | undefined) ?? [];
  return flags;
}

/**
 * Flags do contexto de journal (`expr.query.flags` no Ruby).
 *
 * `LogicalExpression.query` é tipada como `Query`, mas quando a expressão é
 * avaliada por `Journal.hidden` o valor em tempo de execução é um
 * `JournalEntry` — daí a leitura por duck-typing.
 */
function entryFlags(context: unknown,): string[] {
  const flags = (context as { flags?: unknown } | null)?.flags;
  return Array.isArray(flags,) ? flags as string[] : [];
}

export class LogicalFlag extends LogicalOperation {
  constructor(opnd: string,) {
    super(opnd,);
  }

  override eval(expr: LogicalExpression,): boolean {
    const flag = this.operand1 as string;
    // Ramo 1: projeto/PTN (`Query`). Ramo 2: entrada de journal (Fase 16).
    if (isQuery(expr.query,)) return queryFlags(expr.query,).includes(flag,);
    return entryFlags(expr.query,).includes(flag,);
  }

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
