/**
 * TableOfContents — collection of `TOCEntry` (Phase 12.8).
 *
 * Faithful port of `RichText/TableOfContents.rb:28-64`. Ruby uses `yield` in
 * `each`; the port exposes `[Symbol.iterator]` (native iterable) in addition to
 * `each`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/TableOfContents.rb
 * @see ADR 025 (RichText e function handlers)
 */

import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import { XMLElement, } from "../xml/xml-element.ts";
import { TOCEntry, } from "./toc-entry.ts";

/**
 * Table of contents built from the section entries of a document.
 */
export class TableOfContents {
  private entries: TOCEntry[];

  /** Creates an empty table of contents. */
  constructor() {
    this.entries = [];
  }

  /** Adds an entry to the table. */
  addEntry(entry: TOCEntry,): void {
    this.entries.push(entry,);
  }

  /** Iterates over the entries (equivalent to Ruby's `each`). */
  each(callback: (entry: TOCEntry,) => void,): void {
    for (const e of this.entries) callback(e,);
  }

  /**
   * Default iterator over the entries, so the table can be used in `for ... of`
   * and spread expressions.
   *
   * @returns An iterator over the entries in insertion order.
   */
  [Symbol.iterator](): Iterator<TOCEntry> {
    return this.entries[Symbol.iterator]();
  }

  /** HTML tree (`div` > `table` > entry rows). */
  to_html(): XMLElementLike {
    const div = new XMLElement("div", {
      style: "margin-left:15%; margin-right:15%;",
    },);
    const table = new XMLElement("table", {},);
    div.append(table,);
    for (const e of this.entries) {
      for (const el of e.to_html()) table.append(el,);
    }
    return div;
  }
}
