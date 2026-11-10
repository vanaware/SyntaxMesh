/**
 * `JournalEntryList` — a sortable list of journal entries.
 *
 * Port of `JournalEntryList` (`Journal.rb` l.193-337). In Ruby it is an `Array`
 * with a twist: the list sorts itself before any read (`[]`, `each`, `first`,
 * `last`) and the default ordering is `date ASC, alert ASC, seqno ASC` — the same
 * as `to_rti`.
 *
 * Divergences (Category A — Ruby raises `NoMethodError`/`ArgumentError`):
 * • `last()` without a date returns the most recent group instead of crashing on
 *   `e.date <= nil`;
 * • global entries (`property === null`) sort with `seqno` 0 instead of crashing
 *   on `@property.sequenceNo`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Journal.rb
 * @see docs/syntaxmesh/decisoes/029-journal-alertlevel.md
 */

import type { TjTime, } from "../time/tj-time.ts";
import type { JournalEntry, } from "./journal.ts";

/** Attributes accepted by `setSorting` (`JournalEntryList::SortingAttributes`). */
export const JOURNAL_SORTING_ATTRIBUTES = ["alert", "date", "seqno",] as const;

/** Sorting attribute. */
export type JournalSortingAttribute =
  (typeof JOURNAL_SORTING_ATTRIBUTES)[number];

/** Direction: 1 ascending, -1 descending. */
export type JournalSortingDirection = 1 | -1;

/** Sorting criterion (`[attribute, direction]`). */
export type JournalSorting = Array<
  [JournalSortingAttribute, JournalSortingDirection,]
>;

/** Ruby's default order: date, then severity, then sequence. */
export const DEFAULT_JOURNAL_SORTING: JournalSorting = [
  ["date", 1,],
  ["alert", 1,],
  ["seqno", 1,],
];

/**
 * Self-sorting list of `JournalEntry` (Ruby `JournalEntryList`).
 *
 * A utility class only: the canonical storage is the {@link Journal}.
 */
export class JournalEntryList {
  private entries: JournalEntry[] = [];
  private sorted = false;
  private sortBy: JournalSorting = DEFAULT_JOURNAL_SORTING;

  /** Sets the criteria; validates attribute and direction (Ruby l.203-214). */
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

  /** Number of entries. */
  count(): number {
    return this.entries.length;
  }

  /** Same as {@link count} (Ruby `length`). */
  length(): number {
    return this.entries.length;
  }

  /** `true` when there are no entries. */
  empty(): boolean {
    return this.entries.length === 0;
  }

  /** Appends an entry and marks the list as unsorted (Ruby `<<`). */
  push(entry: JournalEntry,): this {
    this.entries.push(entry,);
    this.sorted = false;
    return this;
  }

  /** Concatenates another list (Ruby `+`); returns `this`, as Ruby does. */
  add(list: JournalEntryList,): this {
    this.entries.push(...list.entries,);
    this.sorted = false;
    return this;
  }

  /** Removes the entry (Ruby `Array#delete`); returns `true` if it removed. */
  delete(entry: JournalEntry,): boolean {
    const i = this.entries.indexOf(entry,);
    if (i < 0) return false;
    this.entries.splice(i, 1,);
    return true;
  }

  /** Removes the entries satisfying `pred` (Ruby `delete_if`). */
  deleteIf(pred: (e: JournalEntry,) => boolean,): void {
    this.entries = this.entries.filter((e,) => !pred(e,));
    this.sorted = false;
  }

  /** `true` when the entry is in the list (Ruby `include?`). */
  include(entry: JournalEntry,): boolean {
    return this.entries.includes(entry,);
  }

  /** Entry at the index (list sorted first); `null` when out of range. */
  get(index: number,): JournalEntry | null {
    this.sort();
    return this.entries[index] ?? null;
  }

  /** First entry (list sorted first); `null` when empty. */
  first(): JournalEntry | null {
    this.sort();
    return this.entries[0] ?? null;
  }

  /**
   * Entries sharing the date of the last entry before `date` (Ruby `last`).
   *
   * An absent/`null` `date` returns the most recent group (see the divergences
   * at the top). The result comes back sorted as well, as in Ruby.
   */
  last(date: TjTime | null = null,): JournalEntryList {
    this.sort();
    // Cut-off date: that of the last entry still before `date`.
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
    // Walk in arrival order to preserve tie order (Ruby's `sort!` is not
    // stable; JS `Array#sort` is, so we avoid depending on the sorting step to
    // resolve date ties).
    for (const e of this.entries) {
      if (e.date.compareTo(cut,) === 0) result.push(e,);
    }
    return result.sort();
  }

  /** Removes duplicates preserving the order (Ruby `uniq!`). */
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
   * Sorts the list by the current criteria (Ruby `sort!`).
   *
   * Idempotent: once sorted, further calls do not re-sort until something is
   * added or removed.
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

  /** Sorted copy of the entries (without exposing the internal array). */
  toArray(): JournalEntry[] {
    this.sort();
    return this.entries.slice();
  }

  /**
   * Copy in **arrival order**, without sorting.
   *
   * Needed because the reports preserve the journal's insertion order (sorting
   * is applied later, per group/display criterion).
   */
  unsorted(): JournalEntry[] {
    return this.entries.slice();
  }

  /** Iterates in sorting order (Ruby `each`). */
  [Symbol.iterator](): IterableIterator<JournalEntry> {
    this.sort();
    return this.entries[Symbol.iterator]();
  }
}
