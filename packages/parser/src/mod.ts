/// <reference lib="deno.ns" />

// ============================================================================
// 📝 @syntaxmesh/parser — Parser Multilíngue para SyntaxMesh
// ============================================================================
// Este módulo converte arquivos .tjp (TaskJuggler-inspired) em AST canônico
// e modelo Core. O Parser produz apenas:
// - AST (estrutura de nós com localização de origem)
// - Core Model (tipos do @syntaxmesh/core)
// - Diagnostics (lista de erros com localização)
// Ele NÃO contém lógica de UI, Preact, BeerCSS, DOM.
//
// ARQUITETURA: Parser não pode conter lógica de UI.
export * from "./lexer/token.ts";
export * from "./lexer/lexer.ts";
export * from "./ast/ast.ts";
export * from "./parser/parser.ts";

// ============================================================================
// Tipos de diagnóstico
// ============================================================================

export interface Diagnostic {
  message: string;
  severity: "error" | "warning" | "info";
  line: number;
  column: number;
  length: number;
  source?: string;
}

export interface DiagnosticList {
  diagnostics: Diagnostic[];
  hasErrors: boolean;
  hasWarnings: boolean;
}

/**
 * Função convenience para parsing rápido
 */
export function parse(input: string, language?: "en" | "pt" | "es") {
  const langDef = language ? LANGUAGE_DEFINITIONS[language] : LANGUAGE_DEFINITIONS.en;
  const lexer = new Lexer(input, langDef);
  const tokens = lexer.tokenize();
  
  if (tokens.errors.length > 0) {
    return {
      ast: null,
      errors: tokens.errors,
      warnings: [],
      language: tokens.language,
    };
  }

  const parser = new Parser(tokens.tokens, langDef);
  return parser.parse();
}

export { Lexer, Parser, LANGUAGE_DEFINITIONS } from "./lexer/lexer.ts";