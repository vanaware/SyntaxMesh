/**
 * Deep-copy utility for the attribute system.
 *
 * Replicates the behavior of TaskJuggler's `deep_copy.rb`: primitives and
 * frozen objects come back by reference; Array/Hash are copied recursively;
 * any other object gets a shallow copy of its instance variables with
 * recursive deep cloning (prototype preserved). Classes that define
 * `deepClone()`/`deep_clone()` (PropertyTreeNode, Project, ScenarioData …)
 * control their own copy — typically returning `self` so that property
 * references stay references.
 *
 * The generic fallback does NOT use `structuredClone`: it throws on objects
 * reaching functions/classes (e.g. Account → PropertySet → Project → maps with
 * attribute constructors) and drops the prototype — both diverge from Ruby.
 *
 * @see docs/taskjuggler/lib/taskjuggler/deep_copy.rb
 */

/**
 * Generic deep copy of any value.
 *
 * @param value - Value to clone (primitive, array, map, set, object, etc.)
 * @returns Deep copy of the value
 */
export function deepClone<T,>(value: T,): T {
  return deepCloneInner(value, new Map<unknown, unknown>(),);
}

function deepCloneInner<T,>(
  value: T,
  seen: Map<unknown, unknown>,
): T {
  // Primitives (number, string, boolean, bigint, symbol, null, undefined) and
  // functions are returned by reference — Ruby: frozen?/Integer/Float/…
  if (value === null || value === undefined || typeof value !== "object") {
    return value;
  }
  // Date and RegExp are immutable in our usage (Ruby: frozen → self).
  if (value instanceof Date || value instanceof RegExp) {
    return value;
  }

  // Objects already visited on the cycle path: return the partial copy.
  // (Ruby uses the temporary ivar @clonedObject for the same purpose.)
  if (seen.has(value,)) {
    return seen.get(value,) as T;
  }

  // Array (prototype preserved: `LeaveList`, `JournalEntryList`… are Array
  // subclasses in the port — Ruby `clone` + `collect!` keeps the class)
  if (Array.isArray(value,)) {
    const copy: unknown[] = [];
    Object.setPrototypeOf(copy, Object.getPrototypeOf(value,),);
    seen.set(value, copy,);
    for (const item of value) {
      copy.push(deepCloneInner(item, seen,),);
    }
    return copy as unknown as T;
  }

  // Map
  if (value instanceof Map) {
    const copy = new Map<unknown, unknown>();
    Object.setPrototypeOf(copy, Object.getPrototypeOf(value,),);
    seen.set(value, copy,);
    for (const [key, val,] of value.entries()) {
      copy.set(deepCloneInner(key, seen,), deepCloneInner(val, seen,),);
    }
    return copy as unknown as T;
  }

  // Set
  if (value instanceof Set) {
    const copy = new Set<unknown>();
    Object.setPrototypeOf(copy, Object.getPrototypeOf(value,),);
    seen.set(value, copy,);
    for (const item of value) {
      copy.add(deepCloneInner(item, seen,),);
    }
    return copy as unknown as T;
  }

  // Custom objects implementing a deepClone() method
  if (
    typeof (value as unknown as { deepClone?: () => T }).deepClone ===
      "function"
  ) {
    return (value as unknown as { deepClone(): T }).deepClone();
  }

  // Compatibility with the deep_clone() method (compat.keepRubyBugs)
  if (
    typeof (value as unknown as { deep_clone?: () => T }).deep_clone ===
      "function"
  ) {
    return (value as unknown as { deep_clone(): T }).deep_clone();
  }

  // TjTime and RealFormat — return the reference (no deep copy)
  if (
    value.constructor?.name === "TjTime" ||
    value.constructor?.name === "RealFormat"
  ) {
    return value;
  }

  // Generic case (plain Object and any class instance): shallow copy of the
  // own properties + recursion, preserving the prototype.
  // Equivalent to Ruby's Object#deep_clone (clone + recursive ivars).
  const copy = Object.create(Object.getPrototypeOf(value,),);
  seen.set(value, copy,);
  for (const [key, val,] of Object.entries(value,)) {
    (copy as Record<string, unknown>)[key] = deepCloneInner(val, seen,);
  }
  return copy as T;
}
