/**
 * Utilitário de cópia profunda para o sistema de atributos.
 *
 * Replica o comportamento de `deep_copy.rb` do TaskJuggler: primitivos e
 * objetos frozen são devolvidos por referência; Array/Hash são copiados
 * recursivamente; qualquer outro objeto recebe cópia rasa dos seus instance
 * variables com clonagem profunda recursiva (protótipo preservado). Classes
 * que definem `deepClone()`/`deep_clone()` (PropertyTreeNode, Project,
 * ScenarioData …) controlam a própria cópia — tipicamente devolvendo `self`
 * para que referências a propriedades permaneçam referências.
 *
 * O fallback genérico NÃO usa `structuredClone`: ele lança em objetos que
 * alcançam funções/classes (ex.: Account → PropertySet → Project → mapas com
 * construtores de atributos) e descarta o protótipo — ambos divergentes do
 * Ruby.
 *
 * @see docs/taskjuggler/lib/taskjuggler/deep_copy.rb
 */

/**
 * Copia profunda genérica de qualquer valor.
 *
 * @param value - Valor a ser clonado (primitivo, array, map, set, objeto, etc.)
 * @returns Cópia profunda do valor
 */
export function deepClone<T,>(value: T,): T {
  return deepCloneInner(value, new Map<unknown, unknown>(),);
}

function deepCloneInner<T,>(
  value: T,
  seen: Map<unknown, unknown>,
): T {
  // Primitivos (number, string, boolean, bigint, symbol, null, undefined) e
  // funções são devolvidos como referência — Ruby: frozen?/Integer/Float/…
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  // Date e RegExp são imutáveis no nosso uso (Ruby: frozen → self).
  if (value instanceof Date || value instanceof RegExp) {
    return value;
  }

  // Objetos já visitados no caminho de ciclo: devolver a cópia parcial.
  // (Ruby usa o ivar temporário @clonedObject para o mesmo fim.)
  if (seen.has(value,)) {
    return seen.get(value,) as T;
  }

  // Array
  if (Array.isArray(value,)) {
    const copy: unknown[] = [];
    seen.set(value, copy,);
    for (const item of value) {
      copy.push(deepCloneInner(item, seen,),);
    }
    return copy as unknown as T;
  }

  // Map
  if (value instanceof Map) {
    const copy = new Map<unknown, unknown>();
    seen.set(value, copy,);
    for (const [key, val,] of value.entries()) {
      copy.set(deepCloneInner(key, seen,), deepCloneInner(val, seen,),);
    }
    return copy as unknown as T;
  }

  // Set
  if (value instanceof Set) {
    const copy = new Set<unknown>();
    seen.set(value, copy,);
    for (const item of value) {
      copy.add(deepCloneInner(item, seen,),);
    }
    return copy as unknown as T;
  }

  // Objetos customizados que implementam método deepClone()
  if (
    typeof (value as unknown as { deepClone?: () => T }).deepClone ===
      "function"
  ) {
    return (value as unknown as { deepClone(): T }).deepClone();
  }

  // Compatibilidade com método deep_clone() (compat.keepRubyBugs)
  if (
    typeof (value as unknown as { deep_clone?: () => T }).deep_clone ===
      "function"
  ) {
    return (value as unknown as { deep_clone(): T }).deep_clone();
  }

  // TjTime e RealFormat — retornar referência (sem cópia profunda)
  if (
    value.constructor?.name === "TjTime" ||
    value.constructor?.name === "RealFormat"
  ) {
    return value;
  }

  // Caso genérico (plain Object e qualquer instância de classe): cópia rasa
  // das propriedades próprias + recursão, preservando o protótipo.
  // Equivale ao Object#deep_clone do Ruby (clone + ivars recursivos).
  const copy = Object.create(Object.getPrototypeOf(value,),);
  seen.set(value, copy,);
  for (const [key, val,] of Object.entries(value,)) {
    (copy as Record<string, unknown>)[key] = deepCloneInner(val, seen,);
  }
  return copy as T;
}
