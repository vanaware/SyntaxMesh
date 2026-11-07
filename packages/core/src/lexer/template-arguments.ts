/**
 * template-arguments — leitura e tipagem dos argumentos nomeados de uma
 * chamada de template (Fase 23, subfase 23.4; ADR 033).
 *
 * Gramática aceita (§4.2 do plano):
 *
 * ```
 * args  := ( ws ident ws "=" ws value )*
 * value := string | number | boolean | "!" ident | list | object | call | expr
 * list  := "[" ( value ( "," value )* )? "]"
 * object:= "{" ( ident ":" value ( "," … )* )? "}"
 * call  := ident "(" … ")"        → avaliador opcional da Fase 11
 * expr  := aritmética com números e nomes de argumentos já lidos
 * ```
 *
 * **Sem `eval`**: expressões aritméticas são resolvidas por um parser
 * recursivo pequeno e explícito; expressões lógicas só são avaliadas quando o
 * chamador injeta um avaliador (motor da Fase 11). Nada aqui conhece Vento.
 *
 * O corte entre um argumento e o próximo é feito por *profundidade*: um
 * `nome=` só inicia novo par quando está fora de strings, `[]`, `{}` e `()`.
 *
 * @see docs/syntaxmesh/fases/fase-23-template.md §4.2, §4.5, §5
 * @see docs/syntaxmesh/fases/fase-23-template-tarefas.md §23.4
 */

/** Valor aceito por um parâmetro de template. */
export type TemplateArgumentValue =
  | string
  | number
  | boolean
  | TemplateArgumentValue[]
  | { [key: string]: TemplateArgumentValue };

/** Resultado da avaliação de uma expressão lógica externa (Fase 11). */
export interface ExpressionEvaluation {
  ok: boolean;
  value?: unknown;
}

/** Dependências externas do parser de argumentos. */
export interface ArgumentParseContext {
  /**
   * Avaliador opcional de expressão lógica (`isMilestone(!m1)`). Sem ele, a
   * chamada permanece texto.
   */
  evaluateExpression?: (text: string,) => ExpressionEvaluation;
}

/** Motivo de recusa ao ler a lista de argumentos. */
export type ArgumentParseFailure =
  /** Texto não é `nome=valor` (ex.: dois-pontos, vírgula solta). */
  | { reason: "invalid_pair"; at: string }
  /** `nome=` sem valor. */
  | { reason: "missing_value"; key: string }
  /** String entre aspas não fechou. */
  | { reason: "unterminated_string"; key: string }
  /** `[`/`{`/`(` não fecharam. */
  | { reason: "unbalanced"; key: string };

export type ArgumentsParseResult =
  | { ok: true; args: Record<string, TemplateArgumentValue> }
  | (ArgumentParseFailure & { ok: false });

const IDENT_AT = /^([A-Za-z_]\w*)\s*=/;
const NUMBER = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const CALL = /^([A-Za-z_]\w*)\s*\(([^]*)\)$/;

/**
 * Divide `raw` em pares `nome=valor` respeitando strings e delimitadores
 * balanceados. Devolve a lista na ordem do texto.
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
        // Fim do valor: `ident=` no nível 0 inicia o próximo par.
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

/** Divide uma lista/objeto por vírgulas de nível 0. */
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

/** Remove as aspas de uma string e desescapa `\"` / `\\`. */
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
 * Avalia uma expressão aritmética simples (`1 + 2`, `esforco * 2`, `(1+2)/3`).
 *
 * Nomes são resolvidos em _scope_ (valores numéricos já lidos). Devolve `null`
 * quando o texto não é aritmética válida — o chamador mantém o texto cru.
 * Gramática: `expr := term (("+"|"-") term)*`, `term := unary (("*"|"/"|"%") unary)*`,
 * `unary := ("-"|"+")? primary`, `primary := number | ident | "(" expr ")"`.
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
 * Classifica o texto cru de um valor (§4.2). `scope` tem os argumentos já
 * lidos (para aritmética) e `ctx.evaluateExpression` liga o motor da Fase 11.
 */
export function parseArgumentValue(
  raw: string,
  scope: Record<string, TemplateArgumentValue> = {},
  ctx: ArgumentParseContext = {},
): TemplateArgumentValue {
  const text = raw.trim();

  // String entre aspas duplas ou simples.
  if (
    text.length >= 2 && (text[0] === '"' || text[0] === "'") &&
    text[text.length - 1] === text[0]
  ) {
    return unquote(text,);
  }
  if (text === "true") return true;
  if (text === "false") return false;
  if (NUMBER.test(text,)) return Number(text,);
  // Referência nativa do TaskJuggler: preservada como texto.
  if (text.startsWith("!",)) return text;
  // Lista.
  if (text.startsWith("[",) && text.endsWith("]",)) {
    return splitTopLevel(text.slice(1, -1,),).map((item,) =>
      parseArgumentValue(item, scope, ctx,)
    );
  }
  // Objeto literal `{ k: v }`.
  if (text.startsWith("{",) && text.endsWith("}",)) {
    const obj: { [key: string]: TemplateArgumentValue } = {};
    for (const part of splitTopLevel(text.slice(1, -1,),)) {
      const pair = /^([A-Za-z_]\w*)\s*:\s*([^]*)$/.exec(part,);
      if (!pair) continue;
      obj[pair[1]!] = parseArgumentValue(pair[2]!, scope, ctx,);
    }
    return obj;
  }
  // Chamada de função → motor da Fase 11, quando injetado.
  if (CALL.test(text,)) {
    const evaluated = ctx.evaluateExpression?.(text,);
    if (evaluated?.ok) return normalizeEvaluated(evaluated.value,);
    return text;
  }
  // Aritmética com números e argumentos já lidos.
  const numeric = evaluateArithmetic(text, scope as Record<string, unknown>,);
  if (numeric !== null) return numeric;

  return text;
}

/** Booleano → booleano; número finito → número; resto → texto. */
function normalizeEvaluated(value: unknown,): TemplateArgumentValue {
  if (typeof value === "boolean" || typeof value === "number") return value;
  return String(value ?? "",);
}

/**
 * Lê a lista completa de argumentos nomeados, tipando cada valor e
 * resolvendo referências a argumentos anteriores.
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
