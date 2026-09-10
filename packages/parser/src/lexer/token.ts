/// <reference lib="deno.ns" />

// ============================================================================
// 🔤 Tokens — Tipos de tokens do lexer
// ============================================================================

/**
 * Tipos de tokens suportados
 */
export type TokenType =
  // Palavras-chave
  | "LANGUAGE"
  | "PROJECT"
  | "TASK"
  | "RESOURCE"
  | "CALENDAR"
  | "SCENARIO"
  | "EFFORT"
  | "DURATION"
  | "DEPENDS"
  | "STARTS"
  | "ENDS"
  | "FROM"
  | "TO"
  | "AND"
  | "OR"
  // Identificadores e strings
  | "IDENTIFIER"
  | "STRING"
  // Números
  | "NUMBER"
  // Unidades de tempo
  | "TIME_UNIT"
  // Operadores
  | "PLUS"
  | "MINUS"
  | "MULTIPLY"
  | "DIVIDE"
  | "EQUALS"
  | "COLON"
  | "SEMICOLON"
  | "COMMA"
  | "LPAREN"
  | "RPAREN"
  | "LBRACE"
  | "RBRACE"
  | "LBRACKET"
  | "RBRACKET"
  // Comentários
  | "COMMENT"
  // Fim de arquivo
  | "EOF";

/**
 * Representação de um token no fluxo de lexing
 */
export interface Token {
  type: TokenType;
  value: string;
  position: number;
  line: number;
  column: number;
}

/**
 * Cria um token com os metadados de posição
 */
export function createToken(
  type: TokenType,
  value: string,
  position: number,
  line: number,
  column: number,
): Token {
  return { type, value, position, line, column, };
}

/**
 * Token de fim de arquivo
 */
export const EOF: Token = {
  type: "EOF",
  value: "",
  position: -1,
  line: -1,
  column: -1,
};
