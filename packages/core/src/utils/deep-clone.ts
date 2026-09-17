/**
 * Utilitário de cópia profunda para o sistema de atributos.
 *
 * Implementa o mesmo comportamento que `deep_copy.rb` do TaskJuggler.
 * Requer `structuredClone` nativo (disponível em Deno) e lida com
 * objetos customizados que implementam `deepClone()` ou `deep_clone()`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/deep_copy.rb
 */

/**
 * Copia profunda genérica de qualquer valor.
 *
 * @param value - Valor a ser clonado (primitivo, array, map, set, objeto, etc.)
 * @returns Cópia profunda do valor
 * @throws Se `structuredClone` não for suportado (Node.js sem flag global)
 */
export function deepClone<T>(value: T): T {
  // Primitivos (number, string, boolean, bigint, symbol, null, undefined)
  if (
    value === null ||
    value === undefined ||
    typeof value !== "object" ||
    value instanceof Date ||
    value instanceof RegExp
  ) {
    return value;
  }

  // Array
  if (Array.isArray(value)) {
    return value.map(item => deepClone(item)) as unknown as T;
  }

  // Map
  if (value instanceof Map) {
    return new Map(
      Array.from(value.entries(), ([key, val]) => [
        deepClone(key),
        deepClone(val),
      ]),
    ) as unknown as T;
  }

  // Set
  if (value instanceof Set) {
    return new Set(Array.from(value, item => deepClone(item))) as unknown as T;
  }

  // Objetos customizados que implementam método deepClone()
  if (typeof (value as any).deepClone === "function") {
    return (value as any).deepClone();
  }

  // Compatibilidade com método deep_clone() (compat.keepRubyBugs)
  if (typeof (value as any).deep_clone === "function") {
    return (value as any).deep_clone();
  }

  // Object (plain)
  if (value.constructor === Object) {
    const result = {} as Record<string, unknown>;
    for (const [key, val] of Object.entries(value)) {
      result[key] = deepClone(val);
    }
    return result as unknown as T;
  }

  // TjTime e RealFormat — retornar referência (sem cópia profunda)
  if (value.constructor?.name === "TjTime" || value.constructor?.name === "RealFormat") {
    return value;
  }

  // Fallback para outros tipos de objeto (incluindo classes do projeto)
  // Usar structuredClone se disponível, senão lançar
  if (typeof structuredClone === "function") {
    return structuredClone(value) as T;
  }

  throw new Error(
    `deepClone: não é possível clonar ${value.constructor?.name ?? typeof value} ` +
    `(structuredClone não disponível)`,
  );
}