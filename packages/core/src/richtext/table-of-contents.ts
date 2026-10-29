/**
 * TableOfContents — coleção de TOCEntry (Fase 12.8).
 *
 * Port fiel de `RichText/TableOfContents.rb:28-64`. No Ruby `each` usa yield;
 * no port expomos `[Symbol.iterator]` (iterável nativo) além de `each`.
 *
 * @see docs/taskjuggler/lib/taskjuggler/RichText/TableOfContents.rb
 * @see ADR 025 (RichText e function handlers)
 */

import type { XMLElementLike, } from "./xml-like.ts";
import { SimpleXMLElement, } from "./xml-like.ts";
import { TOCEntry, } from "./toc-entry.ts";

export class TableOfContents {
  private entries: TOCEntry[];

  constructor() {
    this.entries = [];
  }

  /** Adiciona uma entrada à tabela. */
  addEntry(entry: TOCEntry,): void {
    this.entries.push(entry,);
  }

  /** Itera as entradas (equivalente ao `each` do Ruby). */
  each(callback: (entry: TOCEntry,) => void,): void {
    for (const e of this.entries) callback(e,);
  }

  [Symbol.iterator](): Iterator<TOCEntry> {
    return this.entries[Symbol.iterator]();
  }

  /** Árvore HTML (`div` > `table` > linhas da entrada). */
  to_html(): XMLElementLike {
    const div = new SimpleXMLElement("div", {
      style: "margin-left:15%; margin-right:15%;",
    },);
    const table = new SimpleXMLElement("table", {},);
    div.append(table,);
    for (const e of this.entries) {
      for (const el of e.to_html()) table.append(el,);
    }
    return div;
  }
}
