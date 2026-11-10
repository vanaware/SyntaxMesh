/**
 * LogicalOperation — evaluation node of logical expressions (phase 11.1).
 *
 * Faithful port of `LogicalOperation.rb`. It is the building block of
 * `LogicalExpression`: it holds an `operand1`, an optional `operator` and an
 * optional `operand2`. Operands may be other `LogicalOperation` nodes, leaves
 * (`LogicalAttribute`/`LogicalFlag`/`LogicalFunction`) or primitive values
 * (`TjTime`/number/string) wrapped in a node without an operator.
 *
 * Conventions (ADR 024):
 *  - No precedence: the tree is left-associative.
 *  - `&` and `|` are lazy (short-circuit) — implemented with `&&`/`||`.
 *  - The coercion of a binary comparison is driven by the type of `operand1`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/LogicalOperation.rb
 */
import { TjTime, } from "../time/tj-time.ts";
import type { RichTextIntermediate, } from "../attributes/rich/rich-text-port.ts";
import type { Query, } from "../query/query.ts";
import type { LogicalExpression, } from "./logical-expression.ts";

/** Result of the coercion used by ordered binary comparisons. */
type Ordered = number | string | TjTime;

/** Leaves and branches able to evaluate themselves inside an expression. */
interface Evaluable {
  /**
   * Evaluates the node inside the given expression context.
   *
   * @param expr Expression that owns the evaluation context.
   * @returns The evaluated value.
   */
  eval(expr: LogicalExpression,): unknown;
}

/**
 * Tells whether a value is evaluable, i.e. exposes an `eval` method.
 *
 * @param x Value to test.
 * @returns `true` when `x` exposes `eval`.
 */
function isEvaluable(x: unknown,): x is Evaluable {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { eval?: unknown }).eval === "function"
  );
}

/**
 * Detects a `RichTextIntermediate` by duck typing (`to_s()` plus `richText`).
 *
 * @param x Value to test.
 * @returns `true` when `x` looks like a rich text intermediate.
 */
function isRichTextIntermediate(x: unknown,): x is RichTextIntermediate {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { to_s?: unknown }).to_s === "function" &&
    "richText" in (x as Record<string, unknown>)
  );
}

/**
 * Three-way comparison of the supported ordered types.
 *
 * @param a Left value.
 * @param b Right value.
 * @returns `-1`, `0` or `1` when `a` is lower than, equal to or greater
 *   than `b`.
 */
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

/** Operation node of a logical expression. */
export class LogicalOperation {
  /** First operand — a node, a leaf or a primitive value. */
  readonly operand1: unknown;
  /** Second operand of a binary operation, or `null`. */
  operand2: unknown | null;
  /** Comparison or logical operator, or `null` for a bare operand. */
  operator: string | null;

  /**
   * Creates the operation node.
   *
   * @param opnd1 First operand.
   * @param operator Operator joining the operands, or `null`.
   * @param opnd2 Second operand of a binary operation.
   */
  constructor(
    opnd1: unknown,
    operator: string | null = null,
    opnd2: unknown | null = null,
  ) {
    this.operand1 = opnd1;
    this.operator = operator;
    this.operand2 = opnd2;
  }

  /**
   * Evaluates the node (overridden by the leaf subclasses).
   *
   * @param expr Expression that owns the evaluation context.
   * @returns The evaluated value.
   * @throws TjError Through `expr.error` on unsupported operators or operands.
   */
  eval(expr: LogicalExpression,): unknown {
    switch (this.operator) {
      case null: {
        // Bare operand: a node evaluates itself, a primitive passes through.
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
        // Lazy: the second operand is only evaluated when the first is true.
        return (
          this.coerceBoolean(this.evalNode(this.operand1, expr,), expr,) &&
          this.coerceBoolean(this.evalNode(this.operand2, expr,), expr,)
        );
      }
      case "|": {
        // Lazy: the second operand is only evaluated when the first is false.
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

  /**
   * Renders the operation as text.
   *
   * @param query Without a query it shows the names; with one it shows the
   *   evaluated values.
   * @returns The textual form of the operation.
   */
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

  /**
   * Default string conversion (name-based) required by the JS runtime.
   *
   * @returns The textual form of the operation.
   */
  toString(): string {
    if (this.operator === null) return String(this.operand1,);
    if (this.operator === "~") return `~${String(this.operand1,)}`;
    return `${String(this.operand1,)} ${this.operator} ${
      String(this.operand2,)
    }`;
  }

  /**
   * Evaluates an operand, or returns the primitive value untouched.
   *
   * @param node Operand to evaluate.
   * @param expr Expression that owns the evaluation context.
   * @returns The evaluated value, or the primitive itself.
   */
  private evalNode(node: unknown, expr: LogicalExpression,): unknown {
    return isEvaluable(node,) ? node.eval(expr,) : node;
  }

  /**
   * Converts an operand to text for `to_s`.
   *
   * @param operand Operand to render.
   * @param query Optional evaluation context.
   * @returns The textual form of the operand.
   */
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

  /**
   * Evaluates a binary comparison, coercing both operands with `coerce`.
   *
   * @param opnd1 Left operand.
   * @param operator Comparison operator.
   * @param opnd2 Right operand.
   * @param coerce Coercion applied to both operands.
   * @returns The boolean result of the comparison.
   * @throws Error When the operator is not a comparison operator.
   */
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

  /**
   * Forces a value to a boolean (ADR 024 / 11.1.3.7).
   *
   * @param val Value to coerce.
   * @param expr Expression used to report errors.
   * @returns The boolean value of `val`.
   */
  private coerceBoolean(val: unknown, expr: LogicalExpression,): boolean {
    if (val === null || val === undefined) return false;
    if (typeof val === "boolean") return val;
    if (typeof val === "number") return val !== 0;
    if (typeof val === "string") return val.length > 0;
    if (val instanceof TjTime) return true;
    return expr.error(`Operand ${String(val,)} can't be evaluated to boolean`,);
  }

  /**
   * Forces a value to a number (11.1.3.8).
   *
   * @param val Value to coerce.
   * @param expr Expression used to report errors.
   * @returns The numeric value of `val`.
   */
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

  /**
   * Forces a value to a string (11.1.3.9).
   *
   * @param val Value to coerce.
   * @param expr Expression used to report errors.
   * @returns The string value of `val`.
   */
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

  /**
   * Forces a value to a `TjTime` (11.1.3.10).
   *
   * @param val Value to coerce.
   * @param expr Expression used to report errors.
   * @returns The date value of `val`.
   */
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
