/**
 * template-arguments — reading and typing of the named arguments of a template
 * call (phase 23, subphase 23.4; ADR 033).
 *
 * Accepted grammar (plan §4.2):
 *
 * ```
 * args  := ( ws ident ws "=" ws value )*
 * value := string | number | boolean | "!" ident | list | object | call | expr
 * list  := "[" ( value ( "," value )* )? "]"
 * object:= "{" ( ident ":" value ( "," … )* )? "}"
 * call  := ident "(" … ")"        → optional evaluator of phase 11
 * expr  := arithmetic with numbers and already-read argument names
 * ```
 *
 * **No `eval`**: arithmetic expressions are resolved by a small, explicit
 * recursive parser; logical expressions are only evaluated when the caller
 * injects an evaluator (the phase 11 engine). Nothing here knows about Vento.
 *
 * The split between one argument and the next is done by *depth*: a `name=`
 * only starts a new pair when it is outside strings, `[]`, `{}` and `()`.
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md §4.2, §4.5, §5
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md §23.4
 */

/** Value accepted by a template parameter. */
export type TemplateArgumentValue =
  | string
  | number
  | boolean
  | TemplateArgumentValue[]
  | { [key: string]: TemplateArgumentValue };

/** Result of evaluating an external logical expression (phase 11). */
export interface ExpressionEvaluation {
  /** Whether the expression could be evaluated. */
  ok: boolean;
  /** Value produced by the evaluator, when `ok` is true. */
  value?: unknown;
}

/** External dependencies of the argument parser. */
export interface ArgumentParseContext {
  /**
   * Optional logical-expression evaluator (`isMilestone(!m1)`). Without it, the
   * call stays as text.
   */
  evaluateExpression?: (text: string,) => ExpressionEvaluation;
}

/** Reason for refusing to read the argument list. */
export type ArgumentParseFailure =
  /** The text is not `name=value` (e.g. a colon, a stray comma). */
  | { reason: "invalid_pair"; at: string }
  /** `name=` without a value. */
  | { reason: "missing_value"; key: string }
  /** A quoted string was not closed. */
  | { reason: "unterminated_string"; key: string }
  /** `[`/`{`/`(` were not closed. */
  | { reason: "unbalanced"; key: string };

/** Outcome of reading the whole argument list. */
export type ArgumentsParseResult =
  | { ok: true; args: Record<string, TemplateArgumentValue> }
  | (ArgumentParseFailure & { ok: false });

const IDENT_AT = /^([A-Za-z_]\w*)\s*=/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const CALL = /^([A-Za-z_]\w*)\s*\(([^]*)\)$/;

/**
 * Splits `raw` into `name=value` pairs, respecting strings and balanced
 * delimiters. Returns the list in text order.
 */
function splitPairs(
  raw: string,
):
  | Array<{ key: string; value: string }>
  | (ArgumentParseFailure & { at?: string }) {
  const pairs: Array<{ key: string; value: string }> = [];
  let i = 0;
  const n = raw.length;

  const skipWs = (): void => {
    while (i < n && /\s/.test(raw[i]!,)) i++;
  };

  skipWs();
  while (i < n) {
    const head = IDENT_AT.exec(raw.slice(i,),);
    if (!head) {
      return { reason: "invalid_pair", at: raw.slice(i,).trim(), };
    }
    const key = head[1]!;
    i += head[0].length;
    skipWs();

    const start = i;
    let depth = 0;
    let quote = "";
    while (i < n) {
      const ch = raw[i]!;
      if (quote !== "") {
        if (ch === "\\" && i + 1 < n) {
          i += 2;
          continue;
        }
        if (ch === quote) quote = "";
        i++;
        continue;
      }
      if (ch === '"' || ch === "'") {
        quote = ch;
        i++;
        continue;
      }
      if (ch === "[" || ch === "{" || ch === "(") depth++;
      else if (ch === "]" || ch === "}" || ch === ")") depth--;
      if (depth < 0) return { reason: "unbalanced", key, };
      if (depth === 0) {
        // End of the value: an `ident=` at level 0 starts the next pair.
        if (/\s/.test(ch,)) {
          const rest = raw.slice(i,);
          const next = /^\s+([A-Za-z_]\w*)\s*=/.exec(rest,);
          if (next) break;
        }
      }
      i++;
    }
    if (quote !== "" || depth !== 0) {
      return {
        reason: quote !== "" ? "unterminated_string" : "unbalanced",
        key,
      };
    }
    const value = raw.slice(start, i,).trim();
    if (value === "") return { reason: "missing_value", key, };
    pairs.push({ key, value, },);
    skipWs();
  }
  return pairs;
}

/** Splits a list/object on level-0 commas. */
function splitTopLevel(body: string,): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quote = "";
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]!;
    if (quote !== "") {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "[" || ch === "{" || ch === "(") depth++;
    else if (ch === "]" || ch === "}" || ch === ")") depth--;
    else if (ch === "," && depth === 0) {
      parts.push(body.slice(start, i,),);
      start = i + 1;
    }
  }
  const tail = body.slice(start,);
  if (tail.trim() !== "") parts.push(tail,);
  return parts.map((p,) => p.trim()).filter((p,) => p !== "");
}

/** Removes the quotes of a string and unescapes `\"` / `\\`. */
function unquote(text: string,): string {
  const quote = text[0]!;
  let out = "";
  for (let i = 1; i < text.length; i++) {
    const ch = text[i]!;
    if (ch === "\\" && i + 1 < text.length) {
      const next = text[i + 1]!;
      out += next === '"' || next === "\\" || next === quote
        ? next
        : `\\${next}`;
      i++;
      continue;
    }
    if (ch === quote) break;
    out += ch;
  }
  return out;
}

/**
 * Evaluates a simple arithmetic expression (`1 + 2`, `effort * 2`, `(1+2)/3`).
 *
 * Names are resolved in _scope_ (numeric values already read). Returns `null`
 * when the text is not valid arithmetic — the caller keeps the raw text.
 * Grammar: `expr := term (("+"|"-") term)*`,
 * `term := unary (("*"|"/"|"%") unary)*`, `unary := ("-"|"+")? primary`,
 * `primary := number | ident | "(" expr ")"`.
 *
 * @param text Expression to evaluate.
 * @param scope Numeric values of the names already read.
 * @returns The result, or `null` when the text is not arithmetic.
 */
export function evaluateArithmetic(
  text: string,
  scope: Record<string, unknown> = {},
): number | null {
  const tokens: Array<string | number> = [];
  let i = 0;
  const src = text.trim();
  while (i < src.length) {
    const ch = src[i]!;
    if (/\s/.test(ch,)) {
      i++;
      continue;
    }
    if ("+-*/%()".includes(ch,)) {
      tokens.push(ch,);
      i++;
      continue;
    }
    const num = /^(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/.exec(src.slice(i,),);
    if (num) {
      tokens.push(Number(num[0],),);
      i += num[0].length;
      continue;
    }
    const id = /^[A-Za-z_]\w*/.exec(src.slice(i,),);
    if (id) {
      tokens.push(id[0],);
      i += id[0].length;
      continue;
    }
    return null;
  }
  if (tokens.length === 0) return null;

  let pos = 0;
  const peek = (): string | number | undefined => tokens[pos];
  const next = (): string | number | undefined => tokens[pos++];

  const primary = (): number | null => {
    const tok = next();
    if (tok === undefined) return null;
    if (typeof tok === "number") return tok;
    if (tok === "(") {
      const inner = expr();
      if (inner === null || next() !== ")") return null;
      return inner;
    }
    if (tok === "-" || tok === "+") {
      const operand = primary();
      if (operand === null) return null;
      return tok === "-" ? -operand : operand;
    }
    const value = scope[tok];
    if (typeof value === "number" && Number.isFinite(value,)) return value;
    return null;
  };

  const term = (): number | null => {
    let left = primary();
    if (left === null) return null;
    for (;;) {
      const op = peek();
      if (op !== "*" && op !== "/" && op !== "%") return left;
      next();
      const right = primary();
      if (right === null) return null;
      if (op === "*") left *= right;
      else if (op === "/") {
        if (right === 0) return null;
        left /= right;
      } else {
        if (right === 0) return null;
        left %= right;
      }
    }
  };

  const expr = (): number | null => {
    let left = term();
    if (left === null) return null;
    for (;;) {
      const op = peek();
      if (op !== "+" && op !== "-") return left;
      next();
      const right = term();
      if (right === null) return null;
      left = op === "+" ? left + right : left - right;
    }
  };

  const result = expr();
  if (result === null || pos !== tokens.length) return null;
  return Number.isFinite(result,) ? result : null;
}

/**
 * Classifies the raw text of a value (§4.2). `scope` holds the arguments already
 * read (for arithmetic) and `ctx.evaluateExpression` enables the phase 11
 * engine.
 *
 * @param raw Raw text of the value.
 * @param scope Values of the arguments already read.
 * @param ctx Optional external evaluator.
 * @returns The typed value.
 */
export function parseArgumentValue(
  raw: string,
  scope: Record<string, TemplateArgumentValue> = {},
  ctx: ArgumentParseContext = {},
): TemplateArgumentValue {
  const text = raw.trim();

  // String between double or single quotes.
  if (
    text.length >= 2 && (text[0] === '"' || text[0] === "'") &&
    text[text.length - 1] === text[0]
  ) {
    return unquote(text,);
  }
  if (text === "true") return true;
  if (text === "false") return false;
  if (NUMBER.test(text,)) return Number(text,);
  // Native TaskJuggler reference: preserved as text.
  if (text.startsWith("!",)) return text;
  // List.
  if (text.startsWith("[",) && text.endsWith("]",)) {
    return splitTopLevel(text.slice(1, -1,),).map((item,) =>
      parseArgumentValue(item, scope, ctx,)
    );
  }
  // Object literal `{ k: v }`.
  if (text.startsWith("{",) && text.endsWith("}",)) {
    const obj: { [key: string]: TemplateArgumentValue } = {};
    for (const part of splitTopLevel(text.slice(1, -1,),)) {
      const pair = /^([A-Za-z_]\w*)\s*:\s*([^]*)$/.exec(part,);
      if (!pair) continue;
      obj[pair[1]!] = parseArgumentValue(pair[2]!, scope, ctx,);
    }
    return obj;
  }
  // Function call → phase 11 engine, when injected.
  if (CALL.test(text,)) {
    const evaluated = ctx.evaluateExpression?.(text,);
    if (evaluated?.ok) return normalizeEvaluated(evaluated.value,);
    return text;
  }
  // Arithmetic with numbers and arguments already read.
  const numeric = evaluateArithmetic(text, scope as Record<string, unknown>,);
  if (numeric !== null) return numeric;

  return text;
}

/** Boolean → boolean; finite number → number; anything else → text. */
function normalizeEvaluated(value: unknown,): TemplateArgumentValue {
  if (typeof value === "boolean" || typeof value === "number") return value;
  return String(value ?? "",);
}

/**
 * Reads the whole list of named arguments, typing each value and resolving
 * references to previous arguments.
 *
 * @param raw Raw text of the argument list.
 * @param ctx Optional external evaluator.
 * @returns The typed arguments, or the reason of the failure.
 */
export function parseTemplateArguments(
  raw: string,
  ctx: ArgumentParseContext = {},
): ArgumentsParseResult {
  const split = splitPairs(raw,);
  if (!Array.isArray(split,)) {
    return { ok: false, ...split, } as ArgumentsParseResult;
  }
  const args: Record<string, TemplateArgumentValue> = {};
  for (const { key, value, } of split) {
    args[key] = parseArgumentValue(value, args, ctx,);
  }
  return { ok: true, args, };
}
