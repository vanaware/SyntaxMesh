/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Parser — Análise sintática do .tjp
// ============================================================================

import { EOF_TOKEN, Token, TokenType, } from "../lexer/mod.ts";

/**
 * Parser básico que transforma tokens em AST
 */
export interface Parser {
  tokens: Token[];
  current: number;
}

/**
 * Cria uma nova instância de parser
 */
export function createParser(tokens: Token[],): Parser {
  return {
    tokens,
    current: 0,
  };
}

/**
 * Verifica se o token atual é do tipo esperado
 */
export function check(parser: Parser, type: TokenType,): boolean {
  const token = parser.tokens[parser.current];
  if (!token) {
    return false;
  }
  return token.type === type;
}

/**
 * Avança o parser para o próximo token
 */
export function advance(parser: Parser,): Token {
  if (!isAtEnd(parser,)) {
    const token = parser.tokens[parser.current];
    parser.current++;
    return token ?? EOF_TOKEN;
  }
  return EOF_TOKEN;
}

/**
 * Verifica se o parser está no final dos tokens
 */
export function isAtEnd(parser: Parser,): boolean {
  return parser.current >= parser.tokens.length;
}

/**
 * Consome o token atual ou lança erro se não corresponder
 */
export function match<T extends TokenType[],>(
  parser: Parser,
  ...types: T
): Token | undefined {
  for (const type of types) {
    if (check(parser, type,)) {
      return advance(parser,);
    }
  }
  return undefined;
}
