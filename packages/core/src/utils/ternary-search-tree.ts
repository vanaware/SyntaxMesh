/**
 * TernarySearchTree — a ternary search tree over strings (22.1b.1).
 *
 * Faithful port of `docs/taskjuggler/lib/taskjuggler/TernarySearchTree.rb` (206
 * lines). Elements sharing a prefix share nodes, which makes it efficient for
 * large identifier lists; `find(str, true)` returns **every** element starting
 * with `str`.
 *
 * Consumers: `syntaxmesh man` uses `find(prefix, true)` for the keyword prefix
 * search (`Tj3Man.rb:30,76`) and `doc-core` uses the ordered `all()` for the
 * manual's navigation bar.
 *
 * Deliberate divergences (the runtime does not allow the original):
 * - Ruby's `inspect()` is debug-only (`puts` on the tree) and was **not** ported.
 * - `find` on an empty tree returns `null` instead of blowing up: in Ruby the
 *   `str[0] < nil` comparison raises `NoMethodError`.
 * - `sortForBalancedTree` uses JS `Array#sort` (UTF-16 code units); for the ASCII
 *   keywords that is equivalent to Ruby's `String#<=>`.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco C
 */

/** Error equivalent to Ruby's `ArgumentError` (name preserved). */
function argumentError(message: string,): Error {
  const error = new Error(message,);
  error.name = "ArgumentError";
  return error;
}

/**
 * Classic ternary search tree.
 *
 * Each node keeps **one character** (`value`) and three children: `smaller`/
 * `larger` for the lower/higher characters at the same index and `equal` for
 * the nodes of the next index. `last` marks the end of a stored word.
 */
export class TernarySearchTree<T extends string = string,> {
  /** Character of this node; `null` in an empty tree. */
  value: string | null = null;
  /** Child holding a lower character at the same index. */
  smaller: TernarySearchTree<T> | null = null;
  /** Child of the next index (when the character matches). */
  equal: TernarySearchTree<T> | null = null;
  /** Child holding a higher character at the same index. */
  larger: TernarySearchTree<T> | null = null;
  /** `true` when a word ends at this node. */
  last = false;

  /**
   * Creates the tree. `arg` may be a word, a list of words or `null` (empty
   * tree). Lists are inserted in balanced-tree order.
   */
  constructor(arg: T | readonly T[] | null = null,) {
    if (arg === null) return;
    if (typeof arg === "string") {
      this.insert(arg,);
      return;
    }
    for (const element of this.sortForBalancedTree([...arg,],)) {
      this.insert(element,);
    }
  }

  /**
   * Stores `str` in the tree. `index` is internal (recursion).
   *
   * @throws {Error} `ArgumentError` for `null`/empty and an out-of-range index.
   */
  insert(str: T, index = 0,): void {
    if (str === null || str === undefined || str.length === 0) {
      throw argumentError("Cannot insert nil or empty lists",);
    }
    const maxIdx = str.length - 1;
    if (index > maxIdx || index < 0) {
      throw argumentError(`index out of range [0..${maxIdx}]`,);
    }

    const char = str[index]!;
    this.value ??= char;

    if (char < this.value) {
      this.smaller ??= new TernarySearchTree<T>();
      this.smaller.insert(str, index,);
    } else if (char > this.value) {
      this.larger ??= new TernarySearchTree<T>();
      this.larger.insert(str, index,);
    } else if (index === maxIdx) {
      this.last = true;
    } else {
      this.equal ??= new TernarySearchTree<T>();
      this.equal.insert(str, index + 1,);
    }
  }

  /** Alias of {@link insert} (Ruby's `<<`). */
  add(str: T, index = 0,): void {
    this.insert(str, index,);
  }

  /** Inserts every element of `list`. */
  insertList(list: readonly T[],): void {
    for (const value of list) this.insert(value,);
  }

  /**
   * Searches `str`. With `partialMatch`, returns **every** element starting with
   * `str` (alphabetical order); otherwise returns `str` when it is a complete
   * word. `null` when there is no match.
   */
  find(
    str: string,
    partialMatch = false,
    index = 0,
  ): T | T[] | null {
    if (str === null || str === undefined) return null;
    const maxIdx = str.length - 1;
    if (index > maxIdx || this.value === null) return null;

    const char = str[index]!;
    if (char < this.value) {
      return this.smaller?.find(str, partialMatch, index,) ?? null;
    }
    if (char > this.value) {
      return this.larger?.find(str, partialMatch, index,) ?? null;
    }
    if (index === maxIdx) {
      if (partialMatch) {
        // Ruby's `str[0..-2]` — everything but the last character.
        const prefix = str.slice(0, -1,);
        return this.collect(null, (value,) => prefix + value,) as T[];
      }
      return this.last ? (str as T) : null;
    }
    return this.equal?.find(str, partialMatch, index + 1,) ?? null;
  }

  /**
   * Invokes `fn` for every word of the subtree, in alphabetical order
   * (`smaller` → `equal` → `larger`), accumulating `prefix`.
   */
  collect<U,>(prefix: string | null, fn: (value: string,) => U,): U[] {
    const result: U[] = [];

    if (this.smaller) {
      result.push(...this.smaller.collect(prefix, fn,),);
    }
    const newStr = prefix === null
      ? this.value ?? ""
      : prefix + (this.value ?? "");
    if (this.last) result.push(fn(newStr,),);
    if (this.equal) {
      result.push(...this.equal.collect(newStr, fn,),);
    }
    if (this.larger) {
      result.push(...this.larger.collect(prefix, fn,),);
    }
    return result;
  }

  /** Number of stored elements. */
  length(): number {
    let result = 0;
    if (this.smaller) result += this.smaller.length();
    if (this.last) result += 1;
    if (this.equal) result += this.equal.length();
    if (this.larger) result += this.larger.length();
    return result;
  }

  /** Maximum depth of the tree (0 in an empty tree). */
  maxDepth(depth = 0,): number {
    const next = depth + 1;
    const depths: number[] = [];
    if (this.smaller) depths.push(this.smaller.maxDepth(next,),);
    if (this.equal) depths.push(this.equal.maxDepth(next,),);
    if (this.larger) depths.push(this.larger.maxDepth(next,),);
    if (this.last) depths.push(next,);
    return depths.length === 0 ? 0 : Math.max(...depths,);
  }

  /** Every element, in alphabetical order. */
  toArray(): T[] {
    return this.collect(null, (value,) => value,) as T[];
  }

  /** Rewrites the tree in balanced form (Ruby's `balance!`). */
  balance(): void {
    const list = this.sortForBalancedTree(this.toArray(),);
    this.clear();
    for (const value of list) this.insert(value,);
  }

  /** Returns a new, balanced tree with the same elements. */
  balanced(): TernarySearchTree<T> {
    return new TernarySearchTree<T>(this.toArray(),);
  }

  /** Empties the node (used by construction and by `balance`). */
  private clear(): void {
    this.value = null;
    this.smaller = null;
    this.equal = null;
    this.larger = null;
    this.last = false;
  }

  /**
   * Splits the first element from the rest (`TernarySearchTree.rb:174-180`).
   *
   * No callers in the current Ruby — kept for fidelity to the port (rule zero,
   * ADR 011) and covered by its own test.
   */
  private split(str: string,): [string, string | null,] {
    if (str === null || str === undefined || str.length === 0) {
      throw argumentError("Cannot split nil or empty lists",);
    }
    return [str[0]!, str.length > 1 ? str.slice(1,) : null,];
  }

  /**
   * Reorders the elements so that front-to-back insertion produces a balanced
   * tree: central pivot, layer by layer (`TernarySearchTree.rb:184-201`).
   */
  private sortForBalancedTree(list: readonly T[],): T[] {
    let lists: T[][] = [[...list,].sort(),];
    const result: T[] = [];
    while (lists.length > 0) {
      const newLists: T[][] = [];
      for (const layer of lists) {
        const pivot = Math.floor(layer.length / 2,);
        result.push(layer[pivot]!,);
        if (pivot > 0) newLists.push(layer.slice(0, pivot,),);
        if (pivot < layer.length - 1) newLists.push(layer.slice(pivot + 1,),);
      }
      lists = newLists;
    }
    return result;
  }
}
