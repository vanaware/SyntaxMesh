/**
 * LogicalOperation — nó de avaliação de expressões lógicas (Fase 11.1).
 *
 * Port fiel de `LogicalOperation.rb`. É o bloco de construção das
 * `LogicalExpression`: tem um `operand1`, um `operator` opcional e um
 * `operand2` opcional. Os operandos podem ser outros `LogicalOperation`,
 * folhas (`LogicalAttribute`/`LogicalFlag`/`LogicalFunction`) ou valores
 * primitivos (`TjTime`/number/string) embrulhados numa operação sem operador.
 *
 * Convenções (ADR 024):
 *  - Sem precedência: a árvore é associativa à esquerda.
 *  - `&` e `|` são lazy (short-circuit) — usamos `&&`/`||` do TS.
 *  - Coerção de comparação binária é feita pelo tipo do `operand1`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb
 */
import { TjTime, } from "../time/tj-time.ts";
import type { RichTextIntermediate, } from "../attributes/rich/rich-text-port.ts";
import type { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "./logical-expression.ts";

/** Valor resultante da coerção para comparação binária ordenável. */
type Ordered = number | string | TjTime;

/** Folhas/ramos que sabem se auto-avaliar dentro de uma expressão. */
interface Evaluable {
  eval(expr: LogicalExpression,): unknown;
}

/** Node é avaliável quando expõe um método `eval`. */
function isEvaluable(x: unknown,): x is Evaluable {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { eval?: unknown }).eval === "function"
  );
}

/** Objeto com `to_s()` e `richText` — detecta RichTextIntermediate duck-typed. */
function isRichTextIntermediate(x: unknown,): x is RichTextIntermediate {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { to_s?: unknown }).to_s === "function" &&
    "richText" in (x as Record<string, unknown>)
  );
}

/** Comparação de três vias para os tipos ordenáveis suportados. */
function compareOrdered(a: Ordered, b: Ordered,): -1 | 0 | 1 {
  if (a instanceof TjTime && b instanceof TjTime) {
    return a.compareTo(b,);
  }
  if (typeof a === "number" && typeof b === "number") {
    return a < b ? -1 : a > b ? 1 : 0;
  }
  const as = String(a,);
  const bs = String(b,);
  return as < bs ? -1 : as > bs ? 1 : 0;
}

/** Nó de operação de uma expressão lógica. */
export class LogicalOperation {
  readonly operand1: unknown;
  operand2: unknown | null;
  operator: string | null;

  constructor(
    opnd1: unknown,
    operator: string | null = null,
    opnd2: unknown | null = null,
  ) {
    this.operand1 = opnd1;
    this.operator = operator;
    this.operand2 = opnd2;
  }

  /** Auto-avaliação (sobrescrita pelas subclasses-folha). */
  eval(expr: LogicalExpression,): unknown {
    switch (this.operator) {
      case null: {
        // Operando solto: nó se auto-avalia; primitivo passa direto.
        return isEvaluable(this.operand1,)
          ? this.operand1.eval(expr,)
          : this.operand1;
      }
      case "~": {
        return !this.coerceBoolean(this.evalNode(this.operand1, expr,), expr,);
      }
      case ">":
      case ">=":
      case "=":
      case "<":
      case "<=":
      case "!=": {
        const opnd1 = this.evalNode(this.operand1, expr,);
        const opnd2 = this.evalNode(this.operand2, expr,);
        if (opnd1 instanceof TjTime) {
          return this.evalBinaryOperation(
            opnd1,
            this.operator,
            opnd2,
            (o,) => this.coerceTime(o, expr,),
          );
        } else if (typeof opnd1 === "number") {
          return this.evalBinaryOperation(
            opnd1,
            this.operator,
            opnd2,
            (o,) => this.coerceNumber(o, expr,),
          );
        } else if (isRichTextIntermediate(opnd1,)) {
          return this.evalBinaryOperation(
            opnd1.to_s(),
            this.operator,
            opnd2,
            (o,) => this.coerceString(o, expr,),
          );
        } else if (typeof opnd1 === "string") {
          return this.evalBinaryOperation(
            opnd1,
            this.operator,
            opnd2,
            (o,) => this.coerceString(o, expr,),
          );
        } else {
          return expr.error(
            "First operand of a binary operation must be a date, a number " +
              `or a string: ${typeof opnd1}`,
          );
        }
      }
      case "&": {
        // Lazy: segundo operando só é avaliado se o primeiro for true.
        return (
          this.coerceBoolean(this.evalNode(this.operand1, expr,), expr,) &&
          this.coerceBoolean(this.evalNode(this.operand2, expr,), expr,)
        );
      }
      case "|": {
        // Lazy: segundo operando só é avaliado se o primeiro for false.
        return (
          this.coerceBoolean(this.evalNode(this.operand1, expr,), expr,) ||
          this.coerceBoolean(this.evalNode(this.operand2, expr,), expr,)
        );
      }
      default: {
        return expr.error(
          `Unknown operator ${this.operator} in logical expression`,
        );
      }
    }
  }

  /** Representação textual. Sem `query`, mostra nomes; com, mostra valores. */
  to_s(query: Query | null,): string {
    if (this.operator === null) {
      return this.operandToS(this.operand1, query,);
    } else if (this.operand2 === null) {
      return this.operator + this.operandToS(this.operand1, query,);
    }
    return `(${this.operandToS(this.operand1, query,)} ${this.operator} ${
      this.operandToS(this.operand2, query,)
    })`;
  }

  toString(): string {
    if (this.operator === null) return String(this.operand1,);
    if (this.operator === "~") return `~${String(this.operand1,)}`;
    return `${String(this.operand1,)} ${this.operator} ${
      String(this.operand2,)
    }`;
  }

  /** Avalia um operando (nó com `eval`) ou devolve o valor primitivo. */
  private evalNode(node: unknown, expr: LogicalExpression,): unknown {
    return isEvaluable(node,) ? node.eval(expr,) : node;
  }

  /** Converte um operando para texto no `to_s`. */
  private operandToS(operand: unknown, query: Query | null,): string {
    if (operand instanceof LogicalOperation) {
      return operand.to_s(query,);
    } else if (typeof operand === "string") {
      return `'${operand}'`;
    } else if (
      typeof operand === "object" && operand !== null &&
      "to_s" in (operand as Record<string, unknown>)
    ) {
      return (operand as { to_s(q: Query | null,): string }).to_s(query,);
    }
    return String(operand,);
  }

  /** Avaliação de operador binário com coerção fornecida pelo chamador. */
  private evalBinaryOperation(
    opnd1: unknown,
    operator: string | null,
    opnd2: unknown,
    coerce: (v: unknown,) => Ordered,
  ): boolean {
    const a = coerce(opnd1,);
    const b = coerce(opnd2,);
    const c = compareOrdered(a, b,);
    switch (operator) {
      case ">":
        return c > 0;
      case ">=":
        return c >= 0;
      case "=":
        return c === 0;
      case "<":
        return c < 0;
      case "<=":
        return c <= 0;
      case "!=":
        return c !== 0;
      default:
        throw new Error("Operator error",);
    }
  }

  /** Força um valor para booleano (ADR 024 / 11.1.3.7). */
  private coerceBoolean(val: unknown, expr: LogicalExpression,): boolean {
    if (val === null || val === undefined) return false;
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val !== 0;
    if (typeof val === "string") return val.length > 0;
    if (val instanceof TjTime) return true;
    return expr.error(`Operand ${String(val,)} can't be evaluated to boolean`,);
  }

  /** Força um valor para número (11.1.3.8). */
  private coerceNumber(val: unknown, expr: LogicalExpression,): number {
    if (val === null || val === undefined) return 0;
    if (typeof val === "number") return val;
    if (typeof val === "string") {
      const n = parseFloat(val,);
      if (Number.isNaN(n,)) {
        return expr.error(
          `Operand ${val} of type string must be a number`,
        ) as never;
      }
      return n;
    }
    return expr.error(
      `Operand ${String(val,)} of type ${typeof val} must be a number`,
    );
  }

  /** Força um valor para string (11.1.3.9). */
  private coerceString(val: unknown, expr: LogicalExpression,): string {
    if (val === null || val === undefined) return "";
    if (typeof val === "string") return val;
    if (typeof val === "number") return String(val,);
    if (val instanceof TjTime) return val.to_s();
    if (
      typeof val === "object" && val !== null &&
      typeof (val as { to_s?: unknown }).to_s === "function"
    ) {
      return (val as { to_s(): string }).to_s();
    }
    return expr.error(
      `Operand ${String(val,)} of type ${typeof val} can't be converted ` +
        "into a string",
    );
  }

  /** Força um valor para TjTime (11.1.3.10). */
  private coerceTime(val: unknown, expr: LogicalExpression,): TjTime {
    if (val instanceof TjTime) return val;
    if (typeof val === "string") {
      try {
        return TjTime.fromString(val,);
      } catch {
        return expr.error(
          `Operand ${val} can't be converted into a date`,
        ) as never;
      }
    }
    return expr.error(
      `Operand ${String(val,)} of type ${typeof val} can't be converted ` +
        "into a date",
    );
  }
}
