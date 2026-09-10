/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Semantic — Análise semântica e validação
// ============================================================================

import type { AstNode, } from "../ast/mod.ts";
import type { Diagnostic, } from "../mod.ts";

/**
 * Tabela de símbolos para referência de IDs/nomes
 */
export interface SymbolTable {
  entries: Map<string, { type: string; node: AstNode }>;
}

/**
 * Cria uma nova tabela de símbolos vazia
 */
export function createSymbolTable(): SymbolTable {
  return {
    entries: new Map(),
  };
}

/**
 * Insere um símbolo na tabela
 */
export function insertSymbol(
  table: SymbolTable,
  name: string,
  type: string,
  node: AstNode,
): void {
  table.entries.set(name, { type, node, },);
}

/**
 * Busca um símbolo na tabela
 */
export function lookupSymbol(
  table: SymbolTable,
  name: string,
): { type: string; node: AstNode } | undefined {
  return table.entries.get(name,);
}

/**
 * Valida referências cruzadas (ex: depends "Task A" deve existir)
 */
export function validateDependencies(
  ast: AstNode,
  diagnostics: Diagnostic[],
): void {
  // TODO: Implementar validação completa de dependências
  // Por enquanto, stub funcional que não adiciona erros
  void ast;
  void diagnostics;
}
