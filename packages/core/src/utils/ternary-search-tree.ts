/**
 * TernarySearchTree — árvore de busca ternária sobre strings (22.1b.1).
 *
 * Port fiel de `docs/taskjuggler/lib/taskjuggler/TernarySearchTree.rb` (206
 * linhas). Elementos com prefixos comuns compartilham nós, o que a torna
 * eficiente para listas grandes de identificadores; `find(str, true)` devolve
 * **todos** os elementos que começam com `str`.
 *
 * Consumidores: `syntaxmesh man` usa `find(prefix, true)` para a busca por
 * prefixo de keyword (`Tj3Man.rb:30,76`) e o `doc-core` usa `all()`
 * ordenado para a barra de navegação do manual.
 *
 * Divergências conscientes (o runtime não permite o original):
 * - `inspect()` do Ruby é debug-only (`puts` na árvore) e **não** foi portado.
 * - `find` numa árvore vazia devolve `null` em vez de estourar: no Ruby a
 *   comparação `str[0] < nil` levanta `NoMethodError`.
 * - `sortForBalancedTree` usa `Array#sort` do JS (code units UTF-16); para as
 *   keywords ASCII equivale ao `String#<=>` do Ruby.
 *
 * @see docs/syntaxmesh/fases/fase-22-vscode-extension-tarefas.md §Bloco C
 */

/** Erro equivalente ao `ArgumentError` do Ruby (nome preservado). */
function argumentError(message: string,): Error {
  const error = new Error(message,);
  error.name = "ArgumentError";
  return error;
}

/**
 * Árvore de busca ternária clássica.
 *
 * Cada nó guarda **um caractere** (`value`) e três filhos: `smaller`/`larger`
 * para os caracteres menores/maiores no mesmo índice e `equal` para os nós do
 * índice seguinte. `last` marca o fim de uma palavra armazenada.
 */
export class TernarySearchTree<T extends string = string,> {
  /** Caractere deste nó; `null` numa árvore vazia. */
  value: string | null = null;
  /** Filho com caractere menor no mesmo índice. */
  smaller: TernarySearchTree<T> | null = null;
  /** Filho do índice seguinte (quando o caractere casa). */
  equal: TernarySearchTree<T> | null = null;
  /** Filho com caractere maior no mesmo índice. */
  larger: TernarySearchTree<T> | null = null;
  /** `true` quando uma palavra termina neste nó. */
  last = false;

  /**
   * Cria a árvore. `arg` pode ser uma palavra, uma lista de palavras ou
   * `null` (árvore vazia). Listas são inseridas em ordem de árvore balanceada.
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
   * Armazena `str` na árvore. `index` é de uso interno (recursão).
   *
   * @throws {Error} `ArgumentError` para `null`/vazio e índice fora de faixa.
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

  /** Alias de {@link insert} (o `<<` do Ruby). */
  add(str: T, index = 0,): void {
    this.insert(str, index,);
  }

  /** Insere todos os elementos de `list`. */
  insertList(list: readonly T[],): void {
    for (const value of list) this.insert(value,);
  }

  /**
   * Busca `str`. Com `partialMatch`, devolve **todos** os elementos que
   * começam com `str` (ordem alfabética); senão, `str` quando ele é uma
   * palavra completa. `null` quando não há correspondência.
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
        // `str[0..-2]` do Ruby — tudo menos o último caractere.
        const prefix = str.slice(0, -1,);
        return this.collect(null, (value,) => prefix + value,) as T[];
      }
      return this.last ? (str as T) : null;
    }
    return this.equal?.find(str, partialMatch, index + 1,) ?? null;
  }

  /**
   * Invoca `fn` para cada palavra da subárvore, em ordem alfabética
   * (`smaller` → `equal` → `larger`), acumulando `prefix`.
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

  /** Número de elementos armazenados. */
  length(): number {
    let result = 0;
    if (this.smaller) result += this.smaller.length();
    if (this.last) result += 1;
    if (this.equal) result += this.equal.length();
    if (this.larger) result += this.larger.length();
    return result;
  }

  /** Profundidade máxima da árvore (0 na árvore vazia). */
  maxDepth(depth = 0,): number {
    const next = depth + 1;
    const depths: number[] = [];
    if (this.smaller) depths.push(this.smaller.maxDepth(next,),);
    if (this.equal) depths.push(this.equal.maxDepth(next,),);
    if (this.larger) depths.push(this.larger.maxDepth(next,),);
    if (this.last) depths.push(next,);
    return depths.length === 0 ? 0 : Math.max(...depths,);
  }

  /** Todos os elementos, em ordem alfabética. */
  toArray(): T[] {
    return this.collect(null, (value,) => value,) as T[];
  }

  /** Reescreve a árvore balanceada (o `balance!` do Ruby). */
  balance(): void {
    const list = this.sortForBalancedTree(this.toArray(),);
    this.clear();
    for (const value of list) this.insert(value,);
  }

  /** Devolve uma árvore nova, balanceada, com os mesmos elementos. */
  balanced(): TernarySearchTree<T> {
    return new TernarySearchTree<T>(this.toArray(),);
  }

  /** Esvazia o nó (usado pela construção e por `balance`). */
  private clear(): void {
    this.value = null;
    this.smaller = null;
    this.equal = null;
    this.larger = null;
    this.last = false;
  }

  /**
   * Separa o primeiro elemento do resto (`TernarySearchTree.rb:174-180`).
   *
   * Sem chamadores no Ruby atual — mantido por fidelidade ao port (regra zero,
   * ADR 011) e coberto por teste próprio.
   */
  private split(str: string,): [string, string | null,] {
    if (str === null || str === undefined || str.length === 0) {
      throw argumentError("Cannot split nil or empty lists",);
    }
    return [str[0]!, str.length > 1 ? str.slice(1,) : null,];
  }

  /**
   * Reordena os elementos para que a inserção da frente para trás produza uma
   * árvore balanceada: pivô central em camadas (`TernarySearchTree.rb:184-201`).
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
