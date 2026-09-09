/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Expressions — Avaliação de expressões de projeto
// ============================================================================

/**
 * Operadores matemáticos suportados
 */
export type ArithmeticOperator = "+" | "-" | "*" | "/";

/**
 * Representa uma expressão simples
 */
export interface Expression {
  left: number;
  operator: ArithmeticOperator;
  right: number;
}

/**
 * Avalia uma expressão aritmética básica
 */
export function evaluate(expression: Expression): number {
  const { left, operator, right } = expression;

  switch (operator) {
    case "+":
      return left + right;
    case "-":
      return left - right;
    case "*":
      return left * right;
    case "/":
      if (right === 0) {
        throw new Error("Divisão por zero");
      }
      return left / right;
    default:
      throw new Error(`Operador desconhecido: ${operator}`);
  }
}