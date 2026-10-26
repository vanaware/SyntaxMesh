/**
 * Journal e JournalEntry (porta mínima para o parser — Fase 10).
 *
 * Port parcial de `docs/taskjuggler/lib/taskjuggler/Journal.rb`. A
 * renderização de relatórios (`to_rText`, query handlers) pertence à
 * Fase 14/16; aqui ficam apenas os dados que o parser preenche.
 */
import type { TjTime, } from "../time/tj-time.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import type { PropertyTreeNode, } from "./property-tree-node.ts";

export class JournalEntry {
  readonly journal: Journal;
  readonly date: TjTime;
  readonly headline: string;
  readonly property: PropertyTreeNode | null;
  readonly sourceFileInfo: SourceFileInfo | null;
  author: unknown = null;
  moderators: unknown[] = [];
  summary: string | null = null;
  details: string | null = null;
  alertLevel = 0;
  flags: string[] = [];
  timeSheetRecord: unknown = null;

  constructor(
    journal: Journal,
    date: TjTime,
    headline: string,
    property: PropertyTreeNode | null,
    sourceFileInfo: SourceFileInfo | null = null,
  ) {
    this.journal = journal;
    this.date = date;
    this.headline = headline;
    this.property = property;
    this.sourceFileInfo = sourceFileInfo;
    // Adiciona a nova entrada ao journal (Ruby Journal.rb:61).
    journal.addEntry(this,);
  }
}

export class Journal {
  readonly entries: JournalEntry[] = [];

  addEntry(entry: JournalEntry,): void {
    this.entries.push(entry,);
  }

  /** Remove entradas que satisfazem `pred` (Ruby `Journal#delete_if`). */
  deleteIf(pred: (e: JournalEntry,) => boolean,): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      if (pred(this.entries[i]!,)) this.entries.splice(i, 1,);
    }
  }

  /** Entradas da propriedade (ou globais quando `property` é null). */
  entriesFor(property: PropertyTreeNode | null,): JournalEntry[] {
    return this.entries.filter((e,) => e.property === property);
  }

  get empty(): boolean {
    return this.entries.length === 0;
  }
}
