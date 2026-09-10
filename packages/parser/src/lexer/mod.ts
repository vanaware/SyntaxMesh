/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Lexer — Análise léxica do .tjp
// ============================================================================

/**
 * Tipos de token suportados pelo lexer
 */
export enum TokenType {
  // Palavras-chave principais
  PROJECT = "PROJECT",
  TASK = "TASK",
  RESOURCE = "RESOURCE",
  REPORT = "REPORT",
  DEPENDS = "DEPENDS",
  EFFORT = "EFFORT",
  DURATION = "DURATION",
  LANGUAGE = "LANGUAGE",

  // Símbolos
  LEFT_BRACE = "{",
  RIGHT_BRACE = "}",
  COMMA = ",",
  SEMICOLON = ";",
  QUOTE = "QUOTE",

  // Literais
  IDENTIFIER = "IDENTIFIER",
  NUMBER = "NUMBER",
  STRING = "STRING",
  DURATION_LITERAL = "DURATION_LITERAL", // ex: "10d", "5h"

  // Fim do arquivo
  EOF = "EOF",
}

/**
 * Token léxico gerado pelo lexer
 */
export interface Token {
  type: TokenType;
  value: string;
  line: number;
  column: number;
}

/**
 * Cria um novo token
 */
export function createToken(
  type: TokenType,
  value: string,
  line: number = 1,
  column: number = 1,
): Token {
  return { type, value, line, column, };
}

/**
 * Token EOF padrão
 */
export const EOF_TOKEN: Token = {
  type: TokenType.EOF,
  value: "",
  line: 0,
  column: 0,
};
