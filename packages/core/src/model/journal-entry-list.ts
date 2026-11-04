/**
 * `JournalEntryList` — lista ordenável de entradas de journal.
 *
 * Port de `JournalEntryList` (`Journal.rb` l.193-337). No Ruby é um `Array`
 * com "twist": a lista se ordena sozinha antes de qualquer leitura
 * (`[]`, `each`, `first`, `last`) e a ordenação default é
 * `date ASC, alert ASC, seqno ASC` — a mesma do `to_rti`.
 *
 * Divergências (Category A — o Ruby lança `NoMethodError`/`ArgumentError`):
 * • `last()` sem data devolve o grupo mais recente em vez de quebrar em
 *   `e.date <= nil`;
 * • entradas globais (`property === null`) ordenam com `seqno` 0 em vez de
 *   quebrar em `@property.sequenceNo`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Journal.rb
 * @see docs/syntaxmesh/decisoes/029-journal-alertlevel.md
 */

import type { TjTime, } from "../time/tj-time.ts";
import type { JournalEntry, } from "./journal.ts";

/** Atributos aceitos em `setSorting` (`JournalEntryList::SortingAttributes`). */
export const JOURNAL_SORTING_ATTRIBUTES = ["alert", "date", "seqno",] as const;

/** Atributo de ordenação. */
export type JournalSortingAttribute =
  (typeof JOURNAL_SORTING_ATTRIBUTES)[number];

/** Direção: 1 ascendente, -1 descendente. */
export type JournalSortingDirection = 1 | -1;

/** Critério de ordenação (`[atributo, direção]`). */
export type JournalSorting = Array<
  [JournalSortingAttribute, JournalSortingDirection,]
>;

/** Ordenação default do Ruby: data, depois severidade, depois sequência. */
export const DEFAULT_JOURNAL_SORTING: JournalSorting = [
  ["date", 1,],
  ["alert", 1,],
  ["seqno", 1,],
];

/**
 * Lista de `JournalEntry` auto-ordenável (Ruby `JournalEntryList`).
 *
 * Utility class apenas: o armazenamento canônico é o {@link Journal}.
 */
export class JournalEntryList {
  private entries: JournalEntry[] = [];
  private sorted = false;
  private sortBy: JournalSorting = DEFAULT_JOURNAL_SORTING;

  /** Define os critérios; valida atributo e direção (Ruby l.203-214). */
  setSorting(by: JournalSorting,): void {
    for (const [attr, direction,] of by) {
      if (!JOURNAL_SORTING_ATTRIBUTES.includes(attr,)) {
        throw new Error(`Unknown attribute ${String(attr,)}`,);
      }
      if (direction !== 1 && direction !== -1) {
        throw new Error(`Unknown direction ${String(direction,)}`,);
      }
    }
    this.sortBy = by;
    this.sorted = false;
  }

  /** Número de entradas. */
  count(): number {
    return this.entries.length;
  }

  /** Igual a {@link count} (Ruby `length`). */
  length(): number {
    return this.entries.length;
  }

  /** `true` quando não há entradas. */
  empty(): boolean {
    return this.entries.length === 0;
  }

  /** Acrescenta uma entrada e marca a lista como não-ordenada (Ruby `<<`). */
  push(entry: JournalEntry,): this {
    this.entries.push(entry,);
    this.sorted = false;
    return this;
  }

  /** Concatena outra lista (Ruby `+`); devolve `this` como o Ruby. */
  add(list: JournalEntryList,): this {
    this.entries.push(...list.entries,);
    this.sorted = false;
    return this;
  }

  /** Remove a entrada (Ruby `Array#delete`); devolve `true` se removeu. */
  delete(entry: JournalEntry,): boolean {
    const i = this.entries.indexOf(entry,);
    if (i < 0) return false;
    this.entries.splice(i, 1,);
    return true;
  }

  /** Remove as entradas que satisfazem `pred` (Ruby `delete_if`). */
  deleteIf(pred: (e: JournalEntry,) => boolean,): void {
    this.entries = this.entries.filter((e,) => !pred(e,));
    this.sorted = false;
  }

  /** `true` quando a entrada está na lista (Ruby `include?`). */
  include(entry: JournalEntry,): boolean {
    return this.entries.includes(entry,);
  }

  /** Entrada no índice (lista ordenada antes); `null` fora de faixa. */
  get(index: number,): JournalEntry | null {
    this.sort();
    return this.entries[index] ?? null;
  }

  /** Primeira entrada (lista ordenada antes); `null` se vazia. */
  first(): JournalEntry | null {
    this.sort();
    return this.entries[0] ?? null;
  }

  /**
   * Entradas de mesma data da última entrada antes de `date` (Ruby `last`).
   *
   * `date` ausente/null devolve o grupo mais recente (ver divergências no
   * topo). O resultado também volta ordenado, como no Ruby.
   */
  last(date: TjTime | null = null,): JournalEntryList {
    this.sort();
    // Data de corte: a da última entrada que ainda está antes de `date`.
    let cut: TjTime | null = null;
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const d = this.entries[i]!.date;
      if (date === null || d.compareTo(date,) <= 0) {
        cut = d;
        break;
      }
    }
    const result = new JournalEntryList();
    if (cut === null) return result;
    // Percorre na ordem de chegada para preservar a ordem das empates (o
    // `sort!` do Ruby não é estável; o `Array#sort` do JS é, então evitamos
    // depender do passo de ordenação para resolver empates de data).
    for (const e of this.entries) {
      if (e.date.compareTo(cut,) === 0) result.push(e,);
    }
    return result.sort();
  }

  /** Remove duplicatas preservando a ordem (Ruby `uniq!`). */
  uniq(): void {
    const seen = new Set<JournalEntry>();
    this.entries = this.entries.filter((e,) => {
      if (seen.has(e,)) return false;
      seen.add(e,);
      return true;
    },);
    this.sorted = false;
  }

  /**
   * Ordena a lista pelos critérios correntes (Ruby `sort!`).
   *
   * Idempotente: uma vez ordenada, chamadas seguintes não reordenam até que
   * algo seja adicionado/removido.
   */
  sort(): this {
    if (this.sorted) return this;
    const seq = new Map<JournalEntry, number>();
    for (const e of this.entries) seq.set(e, e.property?.sequenceNo ?? 0,);
    this.entries.sort((a, b,) => {
      for (const [attr, direction,] of this.sortBy) {
        let res = 0;
        if (attr === "date") res = a.date.compareTo(b.date,);
        else if (attr === "alert") res = a.alertLevel - b.alertLevel;
        else res = (seq.get(a,) ?? 0) - (seq.get(b,) ?? 0);
        res *= direction;
        if (res !== 0) return res;
      }
      return 0;
    },);
    this.sorted = true;
    return this;
  }

  /** Cópia ordenada das entradas (sem expor o array interno). */
  toArray(): JournalEntry[] {
    this.sort();
    return this.entries.slice();
  }

  /**
   * Cópia na **ordem de chegada**, sem ordenar.
   *
   * Necessário porque os relatórios preservam a ordem de inserção do journal
   * (a ordenação é aplicada depois, por grupo/critério de exibição).
   */
  unsorted(): JournalEntry[] {
    return this.entries.slice();
  }

  /** Itera na ordem de ordenação (Ruby `each`). */
  [Symbol.iterator](): IterableIterator<JournalEntry> {
    this.sort();
    return this.entries[Symbol.iterator]();
  }
}
