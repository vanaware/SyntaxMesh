/// <reference lib="deno.ns" />

// ============================================================================
// 📦 Validation — Validação de entidades do Core
// ============================================================================

/**
 * Resultado de uma validação
 */
export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
}

/**
 * Erro de validação individual
 */
export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

/**
 * Adiciona um erro ao array de resultados
 */
export function addError(
  result: ValidationResult,
  field: string,
  message: string,
  severity: "error" | "warning" = "error",
): void {
  result.errors.push({ field, message, severity });
  if (severity === "error") {
    result.isValid = false;
  }
}

/**
 * Cria um novo resultado de validação vazio (válido)
 */
export function createValidationResult(): ValidationResult {
  return {
    isValid: true,
    errors: [],
  };
}