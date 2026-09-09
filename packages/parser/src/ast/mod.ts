/// <reference lib="deno.ns" />

// ============================================================================
// 📦 AST — Nós da árvore sintática abstrata
// ============================================================================

/**
 * Tipo de nó AST principal
 */
export type AstNodeType =
  | "project"
  | "task"
  | "resource"
  | "report"
  | "dependency"
  | "effort"
  | "duration";

/**
 * Posição no código fonte
 */
export interface SourcePosition {
  line: number;
  column: number;
}

/**
 * Localização completa no arquivo
 */
export interface SourceLocation {
  start: SourcePosition;
  end: SourcePosition;
}

/**
 * Nó base da AST
 */
export interface AstNode {
  type: AstNodeType;
  location: SourceLocation;
  children?: AstNode[];
  attributes?: Record<string, string>;
}

/**
 * Cria um novo nó AST básico
 */
export function createAstNode(
  type: AstNodeType,
  options?: Partial<AstNode>,
): AstNode {
  return {
    type,
    location: options?.location || {
      start: { line: 0, column: 0 },
      end: { line: 0, column: 0 },
    },
    children: options?.children,
    attributes: options?.attributes,
  };
}