/// <reference lib="deno.ns" />

// ============================================================================
// 📦 @syntaxmesh/parser - Parser de Linguagem de Planejamento
// ============================================================================
// Este módulo converte arquivos .tjp (TaskJuggler-inspired) em AST canônico
// e modelo Core. O Parser produz apenas:
// - AST (estrutura de nós com localização de origem)
// - Core Model (tipos do @syntaxmesh/core)
// - Diagnostics (lista de erros com localização)
// Ele NÃO contém lógica de UI, Preact, BeerCSS, DOM.
//
// ARQUITETURA: Parser não pode conter lógica de UI.
export * from "./lexer/mod.ts";
export * from "./parser/mod.ts";
export * from "./ast/mod.ts";
export * from "./semantic/mod.ts";
export * from "./language/mod.ts";

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