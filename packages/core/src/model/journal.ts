/**
 * Journal of a project: the dated, attributeless record of what was reported
 * about the plan (status lines, notes, alerts).
 *
 * Partial port of `docs/taskjuggler/lib/taskjuggler/Journal.rb`. Report
 * rendering (`to_rText`, query handlers) landed in phase 14; what lives here is
 * the data the parser fills plus the per-entity indices.
 *
 * Journal index (bring-forward 14C.0 — owner: phase 16, addendum 16.21): phase
 * 16 inherits and extends these indices with timesheet flag/status hooks and
 * cascading removal when the entity is destroyed. The Breakdown/RDO blocks of
 * phase 14 Complemento consume `entriesBy*`/`entriesByDate`.
 */
import type { TjTime, } from "../time/tj-time.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import { type PropertyTreeNode, } from "./property-tree-node.ts";
import { Task, } from "./task.ts";
import { Resource, } from "./resource.ts";
import { Account, } from "./account.ts";
import { Material, } from "./material.ts";
import { type Picture, } from "./picture.ts";
import { RichText, } from "../richtext/rich-text.ts";
import { RTFHandlers, } from "../richtext/handlers/rtf-handlers.ts";
import { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import { RichTextElement, } from "../richtext/rich-text-element.ts";
import { MarkdownFactory, } from "../markdown/factory.ts";
import {
  JournalEntryList,
  type JournalSorting,
} from "./journal-entry-list.ts";
import type { Project, } from "./project.ts";

/** Markup dialect of an entry body (`markdown` is the default). */
export type EntryFormat = "markdown" | "richtext";

/**
 * Fields of `Query` used while rendering the journal.
 *
 * A structural subset of `Query`, so the model layer does not depend on the
 * query layer. The real query object satisfies it.
 *
 * @see docs/taskjuggler/lib/taskjuggler/Journal.rb:to_rti
 */
export interface JournalQueryLike {
  /** Project whose journal is being rendered. */
  project?: Project | null;
  /** Property the entries are restricted to. */
  property?: PropertyTreeNode | null;
  /** Start of the reporting interval. */
  start?: TjTime | null;
  /** End of the reporting interval. */
  end?: TjTime | null;
  /** Format used for dates in the rendered output. */
  timeFormat?: string | null;
  /** When `true`, icons are replaced by inline text markers. */
  selfContained?: boolean;
  /** Journal mode (`journal`, `status_up`, …). */
  journalMode?: string | null;
  /** Entry parts to include; `*` means all of them. */
  journalAttributes?: string[] | null;
  /** Sort criterion applied to the entries. */
  sortJournalEntries?: unknown;
  /** Logical expression that hides matching entries. */
  hideJournalEntry?: unknown;
  /** Scenario the query is evaluated in. */
  scenarioIdx?: number | undefined;
  /** Result slot the renderer writes the rich text into. */
  rti?: unknown;
}

/** Does `query.journalAttributes` contain `name`? (`*` = all attributes). */
function hasJournalAttribute(
  query: JournalQueryLike,
  name: string,
): boolean {
  const attrs = query.journalAttributes ?? ["*",];
  return attrs.includes("*",) || attrs.includes(name,);
}

/** Alert level of the entry as a `{id, name, color}` record. */
function alertLevelOf(
  query: JournalQueryLike,
  level: number,
): { id: string; name: string; color: string } | null {
  const levels = query.project?.get("alertLevels",) as
    | Array<{ id: string; name: string; color: string }>
    | undefined;
  return levels?.[level] ?? null;
}

/** Logical expression hiding the entry (`Journal#hidden`, l.738). */
function hidden(entry: JournalEntry, logExp: unknown,): boolean {
  if (logExp === null || logExp === undefined) return false;
  const exp = logExp as { eval?: (e: JournalEntry,) => unknown };
  return typeof exp.eval === "function" ? !!exp.eval(entry,) : false;
}

/**
 * Ruby's `property.ptn`: for a `PTNProxy` returns the real node; for a
 * `PropertyTreeNode` itself returns it unchanged (Ruby `#ptn`→`self`).
 */
function unwrap(
  property: PropertyTreeNode | null,
): PropertyTreeNode | null {
  if (property === null) return null;
  const maybe = property as unknown as { ptn?: () => PropertyTreeNode };
  return typeof maybe.ptn === "function" ? maybe.ptn() : property;
}

/** `entry.property.isChildOf?(property)` do Ruby (l.570). */
function isChildOf(
  child: PropertyTreeNode | null,
  ancestor: PropertyTreeNode,
): boolean {
  return child === null ? false : child.isChildOf(ancestor,);
}

/** Appends already computed entries (arrays) to a `JournalEntryList`. */
function addAll(target: JournalEntryList, entries: JournalEntry[],): void {
  for (const entry of entries) target.push(entry,);
}

/**
 * One journal entry: a headline plus optional summary, details, author, flags
 * and alert level, attached to a date and (usually) to a property.
 *
 * Entries are created by the parser from `journalentry`, `statusentry` and
 * `alert` directives, and by the sheets apps when a timesheet is accepted.
 * Constructing one already appends it to its journal, mirroring the Ruby
 * `Journal.rb:61`.
 */
export class JournalEntry {
  /** Journal this entry belongs to. */
  readonly journal: Journal;
  /** Date the entry is reported for. */
  readonly date: TjTime;
  /** One-line title of the entry. */
  readonly headline: string;
  /** Property the entry is attached to, or `null` for a project-wide entry. */
  readonly property: PropertyTreeNode | null;
  /** Where the entry was declared; used in diagnostics. */
  readonly sourceFileInfo: SourceFileInfo | null;
  /** Who reported the entry, when known. */
  author: unknown = null;
  /** Users allowed to modify the entry. */
  moderators: unknown[] = [];
  /** Short summary shown in ordinary reports. */
  summary: string | null = null;
  /** Full text shown in detailed reports. */
  details: string | null = null;
  /** Severity index into the project's `alertLevels` list. */
  alertLevel = 0;
  /** Free-form flags attached to the entry. */
  flags: string[] = [];
  /** Timesheet record the entry was generated from, if any. */
  timeSheetRecord: unknown = null;
  // Phase 10 Complemento C3.3.5 — pictures and body format of the entry.
  /** Pictures attached to the entry, rendered with the details. */
  pictures: Picture[] = [];
  /** Markup dialect of `summary` and `details` (`markdown` by default). */
  format: EntryFormat = "markdown";

  /**
   * Creates an entry and registers it in `journal`.
   *
   * @param journal Journal the entry belongs to.
   * @param date Date the entry is reported for.
   * @param headline One-line title.
   * @param property Property the entry is attached to, or `null`.
   * @param sourceFileInfo Where the entry was declared.
   */
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

  /**
   * MediaWiki markup of the entry frame: alert, property, headline, date,
   * author and flags (first half of `JournalEntry#to_rText`).
   *
   * Each part is emitted only when `query.journalAttributes` asks for it. The
   * body (summary/details) and the pictures are appended separately so that
   * {@link Journal.to_rti} can parse the body in the entry's own `format`
   * (16.21.6). Timesheet parts belong to phase 18.
   */
  frameMarkup(query: JournalQueryLike,): string {
    let alertName = "";
    if (hasJournalAttribute(query, "alert",)) {
      const level = alertLevelOf(query, this.alertLevel,);
      if (level) {
        alertName = query.selfContained
          ? `<nowiki>[</nowiki><fcol:${level.color}><nowiki>${level.name}` +
            "</nowiki></fcol><nowiki>]</nowiki>"
          : `[[File:icons/flag-${level.id}.png|alt=[${level.name}]|text-bottom]] `;
      }
    }

    let rText = "";
    let hlMark = "===";

    if (hasJournalAttribute(query, "property",) && this.property) {
      const prop = this.property;
      if (prop instanceof Task) {
        rText += `${hlMark} ${alertName} <nowiki>${prop.name}</nowiki>`;
        if (hasJournalAttribute(query, "propertyid",)) {
          rText += ` (ID: ${prop.fullId})`;
        }
        rText += ` ${hlMark}\n\n`;
      } else if (prop instanceof Resource) {
        rText += `${hlMark} ${alertName} Personal Notes ${hlMark}\n\n`;
      } else {
        // SyntaxMesh extension (14C.1.7): material and account are identified
        // by name, like tasks.
        rText += `${hlMark} ${alertName} <nowiki>${prop.name}</nowiki>`;
        if (hasJournalAttribute(query, "propertyid",)) {
          rText += ` (ID: ${prop.fullId})`;
        }
        rText += ` ${hlMark}\n\n`;
      }
      // The alert already appeared; do not repeat it in the headline.
      alertName = "";
      hlMark += "=";
    }

    if (hasJournalAttribute(query, "headline",)) {
      rText +=
        `${hlMark} ${alertName}<nowiki>${this.headline}</nowiki> ${hlMark}\n\n`;
    }

    const showDate = hasJournalAttribute(query, "date",);
    const showAuthor = hasJournalAttribute(query, "author",) && !!this.author;
    if (showDate || showAuthor) rText += "''Reported ";
    if (showDate) {
      rText += `on ${this.date.to_s(query.timeFormat ?? undefined,)} `;
    }
    if (showAuthor) {
      const author = this.author as { name?: string };
      rText += `by <nowiki>${author.name ?? ""}</nowiki>`;
    }
    if (showDate || showAuthor) rText += "''\n\n";

    if (hasJournalAttribute(query, "flags",) && this.flags.length > 0) {
      rText += `''Flags:'' ${this.flags.join(", ",)}\n\n`;
    }
    return rText;
  }

  /**
   * MediaWiki markup of the entry pictures (16.21.6).
   *
   * Each picture becomes a `[[File:…|alt=…]]` image (plus an italic caption),
   * which the RichText parser turns into an `img` node of the intermediate
   * format. In `selfContained` mode the image is replaced by a textual marker,
   * mirroring the alert flag. Width/align are report-level concerns rendered by
   * `Picture#to_html` (14C.0.8), not by the lightweight RTI image.
   */
  picturesMarkup(query: JournalQueryLike,): string {
    if (this.pictures.length === 0) return "";
    let out = "";
    for (const pic of this.pictures) {
      if (query.selfContained) {
        out += `<nowiki>[image: ${pic.path}]</nowiki>\n\n`;
        continue;
      }
      out += `[[File:${pic.path}|alt=${pic.alt ?? ""}]]\n\n`;
      if (pic.caption) out += `''${pic.caption}''\n\n`;
    }
    return out;
  }

  /**
   * Renders the entry as MediaWiki markup (port of `JournalEntry#to_rText`).
   *
   * Frame + body (summary/details, raw) + pictures. Kept as the MediaWiki
   * serialization of the entry; {@link Journal.to_rti} uses {@link frameMarkup}
   * plus a format-aware body instead (16.21.6).
   */
  to_rText(query: JournalQueryLike,): string {
    let rText = this.frameMarkup(query,);
    if (hasJournalAttribute(query, "summary",) && this.summary) {
      rText += this.summary + "\n\n";
    }
    if (hasJournalAttribute(query, "details",) && this.details) {
      rText += this.details + "\n\n";
    }
    rText += this.picturesMarkup(query,);
    return rText;
  }

  /**
   * Returns the entry itself: journal entries are identity objects.
   *
   * An entry belongs to an `entryList` and references its `Journal`, which in
   * turn lists every entry; a copy would duplicate the entry and drag the whole
   * graph with it (16.13.3).
   */
  deepClone(): this {
    return this;
  }
}

/** Keys of the per-entity index (bring-forward 14C.0.4). */
type IndexedEntity = Task | Resource | Material | Account;

/** Ascending date comparator (stable ordering of the index buckets). */
function byDate(a: JournalEntry, b: JournalEntry,): number {
  return a.date.compareTo(b.date,);
}

/**
 * Collects the journal entries of a project and answers the journal queries.
 *
 * The journal keeps two views of the same data: the canonical chronology
 * (`entryList`) and per-property buckets, plus one date-sorted index per
 * indexable entity kind, which is what the RDO and breakdown reports read.
 */
export class Journal {
  /** Canonical list of all entries (Ruby `@entries`). */
  readonly entryList = new JournalEntryList();

  /** Entries per property (Ruby `@propertyToEntries`), in arrival order. */
  private readonly propertyToEntries = new Map<
    PropertyTreeNode,
    JournalEntryList
  >();

  /**
   * Date-sorted indices per entity (14C.0.4 — consumed by `rdo-report`).
   * The public query API is `entriesBy*()`.
   */
  readonly indexByTask = new Map<Task, JournalEntry[]>();
  /** Date-sorted entries per resource. */
  readonly indexByResource = new Map<Resource, JournalEntry[]>();
  /** Date-sorted entries per material. */
  readonly indexByMaterial = new Map<Material, JournalEntry[]>();
  /** Date-sorted entries per account. */
  readonly indexByAccount = new Map<Account, JournalEntry[]>();

  /**
   * Array view of all entries, in arrival order.
   *
   * In Ruby `@entries` is a `JournalEntryList`; here that list is
   * {@link entryList} and this getter keeps the simple read used by the
   * reports (`journal.entries.length`, spread).
   */
  get entries(): JournalEntry[] {
    return this.entryList.unsorted();
  }

  /**
   * Inserts the entry in the canonical list and in the index of its entity
   * (the Ruby `Journal#addEntry`); entries without a property stay in the main
   * list only. Inserting an entry twice is a no-op.
   */
  addEntry(entry: JournalEntry,): void {
    if (this.entryList.include(entry,)) return;
    this.entryList.push(entry,);
    const prop = entry.property;
    if (!prop) return;

    // Ruby: uses the "real" PropertyTreeNode (`entry.property.ptn`), never
    // the scenario proxy.
    let list = this.propertyToEntries.get(prop,);
    if (!list) {
      list = new JournalEntryList();
      this.propertyToEntries.set(prop, list,);
    }
    list.push(entry,);

    const bucket = this.indexFor(prop,);
    if (!bucket) return;
    let sorted = bucket.get(prop as IndexedEntity,);
    if (!sorted) {
      sorted = [];
      bucket.set(prop as IndexedEntity, sorted,);
    }
    // Ordered by date (stable: a tie keeps the arrival order).
    sorted.splice(lowerBound(sorted, entry,), 0, entry,);
  }

  /** Removes an entry (mirror of the Ruby `Journal#delete`). */
  removeEntry(entry: JournalEntry,): void {
    this.entryList.delete(entry,);
    const prop = entry.property as IndexedEntity | null;
    if (!prop) return;
    const list = this.propertyToEntries.get(prop,);
    if (list) {
      list.delete(entry,);
      if (list.empty()) this.propertyToEntries.delete(prop,);
    }
    for (
      const bucket of [
        this.indexByTask,
        this.indexByResource,
        this.indexByMaterial,
        this.indexByAccount,
      ] as Map<PropertyTreeNode, JournalEntry[]>[]
    ) {
      const entries = bucket.get(prop,);
      if (!entries) continue;
      const j = entries.indexOf(entry,);
      if (j >= 0) entries.splice(j, 1,);
      if (entries.length === 0) bucket.delete(prop,);
    }
  }

  /**
   * Removes the entries that satisfy `pred` (Ruby `Journal#delete_if`).
   *
   * Removal goes through `removeEntry` so the indices stay coherent — entries
   * of destroyed entities must not leak (14C.0.5).
   */
  deleteIf(pred: (e: JournalEntry,) => boolean,): void {
    for (const entry of this.entryList.toArray().reverse()) {
      if (pred(entry,)) this.removeEntry(entry,);
    }
  }

  /**
   * Empties the journal: canonical list, per-property buckets and indices.
   *
   * Equivalent to the Ruby `@project['journal'] = Journal.new`
   * (`TaskJuggler#checkTimeSheet`); here the field is `readonly`, so the old
   * data is discarded in place instead.
   */
  clear(): void {
    this.entryList.deleteIf(() => true);
    this.propertyToEntries.clear();
    this.indexByTask.clear();
    this.indexByResource.clear();
    this.indexByMaterial.clear();
    this.indexByAccount.clear();
  }

  /**
   * Entries of the property (Ruby `getEntries`), in arrival order; `null` when
   * the property has none.
   */
  getEntries(property: PropertyTreeNode,): JournalEntryList | null {
    return this.propertyToEntries.get(property,) ?? null;
  }

  /**
   * Entries of the property, or the global entries when `property` is `null`.
   *
   * For indexable entities this returns the date-sorted index (14C.0.4);
   * otherwise the canonical list is scanned, preserving arrival order.
   */
  entriesFor(property: PropertyTreeNode | null,): JournalEntry[] {
    if (property === null) {
      return this.entries.filter((e,) => e.property === null);
    }
    const indexed = this.indexFor(property,)?.get(property as IndexedEntity,);
    if (indexed) return indexed.slice();
    const ptn = unwrap(property,);
    return this.entries.filter((e,) => unwrap(e.property,) === ptn);
  }

  /** Entries inside the date range (both bounds inclusive), sorted by date. */
  entriesByDate(start: TjTime, end: TjTime,): JournalEntry[] {
    return this.entries.filter((e,) =>
      e.date.compareTo(start,) >= 0 && e.date.compareTo(end,) <= 0
    ).slice().sort(byDate,);
  }

  /** Index that matches the entity kind; `null` when it is not indexable. */
  private indexFor(
    prop: PropertyTreeNode,
  ): Map<IndexedEntity, JournalEntry[]> | null {
    if (prop instanceof Task) return this.indexByTask;
    if (prop instanceof Resource) return this.indexByResource;
    if (prop instanceof Material) return this.indexByMaterial;
    if (prop instanceof Account) return this.indexByAccount;
    return null;
  }

  /** Whether the journal holds no entry at all. */
  get empty(): boolean {
    return this.entryList.empty();
  }

  // ------------------------------------------------------------------
  // Rendering for reports (14C.1.7)
  // ------------------------------------------------------------------

  /**
   * Builds the rich text of a property's journal (port of `Journal#to_rti`,
   * `Journal.rb` l.404-497).
   *
   * Modes (Ruby): `journal`, `journal_sub`, `status_up`, `status_down`,
   * `status_dep`, `alerts_down`, `alerts_dep`; plus the two column modes of the
   * port (`journalmessages`/`journalsummaries`, 14C.1.7), which render only the
   * current entries. The result is stored in `query.rti`.
   */
  to_rti(query: JournalQueryLike,): void {
    const mode = query.journalMode ?? "journal";
    const property = query.property ?? null;
    const start = query.start ?? null;
    const end = query.end ?? null;
    const logExp = query.hideJournalEntry;
    const entries = new JournalEntryList();

    switch (mode) {
      case "journal":
        // Entries dated in the interval; with a property, only its own.
        if (property) {
          if (property instanceof Task) {
            entries.add(
              this.entriesByTask(property, start, end, logExp,),
            );
          } else if (property instanceof Resource) {
            entries.add(
              this.entriesByResource(property, start, end, logExp,),
            );
          } else {
            // Extension 16.21.5: material and account enter as leaves.
            entries.add(this.entriesByLeaf(property, start, end, logExp,),);
          }
        } else {
          entries.add(this.rangeEntries(start, end, logExp,),);
        }
        break;
      case "journal_sub":
        // Property + descendants. Ruby only handles `Task` here; the port
        // extends the recursion to resource/account (14C.1.7). Material is a
        // leaf: `journal_sub` collapses to `journal` (16.21.5).
        if (property) {
          if (property instanceof Material) {
            entries.add(this.entriesByLeaf(property, start, end, logExp,),);
          } else {
            entries.add(this.entriesByTaskR(property, start, end, logExp,),);
          }
        }
        break;
      case "status_up":
        // Last entries before `end` of each task, without descendants.
        for (const task of this.rootProperties(property, query, Task,)) {
          addAll(entries, this.currentEntries(end, task, 0, start, logExp,),);
          entries.uniq();
        }
        break;
      case "status_down":
      case "status_dep":
        // Last entries before `end` including sub-tasks (and dependencies).
        for (const task of this.rootProperties(property, query, Task,)) {
          addAll(entries, this.currentEntriesR(end, task, 0, start, query,),);
          entries.uniq();
        }
        break;
      case "alerts_down":
      case "alerts_dep":
        // Same, but only the highest alert level ones.
        for (const task of this.rootProperties(property, query, Task,)) {
          addAll(entries, this.alertEntries(end, task, 1, start, query,),);
          entries.uniq();
        }
        break;
      case "journalmessages":
      case "journalsummaries":
        // Port extension (14C.1.7): current entries of the property.
        if (property) {
          addAll(
            entries,
            this.currentEntries(end, property, 0, start, logExp,),
          );
        }
        break;
      default:
        throw new Error(`Unknown journal mode: ${mode}`,);
    }

    // Sorts according to the user (default date/alert/seqno).
    const sorting = query.sortJournalEntries;
    if (Array.isArray(sorting,) && sorting.length > 0) {
      entries.setSorting(sorting as JournalSorting,);
    }
    entries.sort();

    // 16.21.6: each entry is parsed in its own `format` (markdown body via the
    // MarkdownFactory, richtext body via MediaWiki) with its pictures appended;
    // the per-entry trees are merged into the journal RTI. The joined MediaWiki
    // markup (`to_rText`) is kept as the RTI's `inputText` back-reference, which
    // the `query_journal(...).richText.inputText` consumers (lastSheetReport /
    // query_dashboard) print — as in the Ruby.
    let markup = "";
    for (const entry of entries) markup += entry.to_rText(query,);
    const handlers = RTFHandlers.create(query.project ?? null,);
    const rti = new RichTextIntermediate(new RichText(markup, handlers,),);
    for (const handler of handlers) rti.registerFunctionHandler(handler,);
    const children: Array<RichTextElement | string> = [];
    for (const entry of entries) {
      const entryRti = this.assembleEntryRti(
        entry.frameMarkup(query,),
        entry,
        query,
        hasJournalAttribute(query, "summary",),
        hasJournalAttribute(query, "details",),
      );
      if (entryRti?.tree) children.push(...entryRti.tree.children,);
    }
    rti.tree = new RichTextElement(rti, "richtext", children,);
    rti.sectionNumbers = false;
    rti.cssClass = "tj_journal";
    query.rti = rti;
  }

  /**
   * Builds the RTI of one entry: the MediaWiki `frameMarkup`, the body parsed in
   * the entry's `format` (16.21.6) and the pictures, merged into a single tree.
   *
   * @param frameMarkup MediaWiki markup of the frame (headline, date, …).
   * @param entry Entry being rendered.
   * @param query Active query.
   * @param includeSummary Whether the summary is part of the body.
   * @param includeDetails Whether the details are part of the body.
   */
  private assembleEntryRti(
    frameMarkup: string,
    entry: JournalEntry,
    query: JournalQueryLike,
    includeSummary: boolean,
    includeDetails: boolean,
  ): RichTextIntermediate | null {
    const handlers = RTFHandlers.create(query.project ?? null,);
    const rti = this.tagJournal(
      new RichText(frameMarkup, handlers,).generateIntermediateFormat(),
    );
    if (!rti || !rti.tree) return rti;
    const body = this.entryBodyRti(
      entry,
      query,
      includeSummary,
      includeDetails,
    );
    if (body?.tree) rti.tree.children.push(...body.tree.children,);
    const pictures = entry.picturesMarkup(query,);
    if (pictures !== "") {
      const picRti = this.tagJournal(
        new RichText(pictures, handlers,).generateIntermediateFormat(),
      );
      if (picRti?.tree) rti.tree.children.push(...picRti.tree.children,);
    }
    return rti;
  }

  /**
   * RTI of the entry body (summary/details) in the entry's `format`: markdown
   * goes through the {@link MarkdownFactory} (16.21.6), richtext through the
   * MediaWiki parser. Returns `null` when there is no body to render.
   */
  private entryBodyRti(
    entry: JournalEntry,
    query: JournalQueryLike,
    includeSummary: boolean,
    includeDetails: boolean,
  ): RichTextIntermediate | null {
    const parts: string[] = [];
    if (includeSummary && entry.summary) parts.push(entry.summary,);
    if (includeDetails && entry.details) parts.push(entry.details,);
    if (parts.length === 0) return null;
    const body = parts.join("\n\n",) + "\n\n";
    if (entry.format === "markdown") {
      return this.tagJournal(
        new MarkdownFactory(query.project ?? null,).create(body,),
      );
    }
    return this.tagJournal(
      new RichText(body, RTFHandlers.create(query.project ?? null,),)
        .generateIntermediateFormat(),
    );
  }

  /**
   * Tags an RTI as journal output: no section numbers and the `tj_journal` CSS
   * class. Each per-entry RTI must carry these itself, because the merged tree
   * keeps the elements pointing at their originating RTI (16.21.6).
   */
  private tagJournal(
    rti: RichTextIntermediate | null,
  ): RichTextIntermediate | null {
    if (rti) {
      rti.sectionNumbers = false;
      rti.cssClass = "tj_journal";
    }
    return rti;
  }

  /**
   * Root properties of the mode: the property itself when it qualifies, or the
   * project's top-level tasks (Ruby: `query.project.tasks`, skipping the ones
   * with a `parent`).
   */
  private rootProperties(
    property: PropertyTreeNode | null,
    query: JournalQueryLike,
    kind: typeof Task,
  ): PropertyTreeNode[] {
    if (property) {
      // 16.21.5: material/account enter the status/alerts modes as leaves;
      // resource keeps the Ruby behaviour (it is not a status root).
      if (
        property instanceof kind || property instanceof Material ||
        property instanceof Account
      ) {
        return [property,];
      }
      return [];
    }
    const project = query.project ?? null;
    if (!project) return [];
    return (project.tasks.toArray() as unknown as PropertyTreeNode[])
      .filter((t,) => t instanceof kind && t.parent === null);
  }

  /**
   * Rich text of journal messages (port of `PropertyTreeNode#journalMessages`).
   *
   * @param entries Entries to render, already filtered.
   * @param query Active query (provider of the project and time format).
   * @param longVersion When `true` the details are included after the summary.
   */
  messagesRti(
    entries: JournalEntry[],
    query: JournalQueryLike,
    longVersion: boolean,
  ): RichTextIntermediate | null {
    const handlers = RTFHandlers.create(query.project ?? null,);
    let markup = "";
    const children: Array<RichTextElement | string> = [];
    for (const entry of entries) {
      let frame = `==== <nowiki>${entry.headline}</nowiki> ====\n`;
      frame += `''Reported on ${
        entry.date.to_s(query.timeFormat ?? undefined,)
      }'' `;
      if (entry.author) {
        const author = entry.author as { name?: string };
        frame += `''by <nowiki>${author.name ?? ""}</nowiki>''`;
      }
      frame += "\n\n";
      if (entry.flags.length > 0) {
        frame += `''Flags:'' ${entry.flags.join(", ",)}\n\n`;
      }
      // `inputText` back-reference: the original raw markup (frame + body), as
      // the `query_journalmessages(...).richText.inputText` consumers expect.
      markup += frame;
      if (entry.summary) markup += entry.summary + "\n\n";
      if (longVersion && entry.details) markup += entry.details + "\n\n";
      // 16.21.6: body in the entry's format + pictures, as in `to_rti`.
      const entryRti = this.assembleEntryRti(
        frame,
        entry,
        query,
        true,
        longVersion,
      );
      if (entryRti?.tree) children.push(...entryRti.tree.children,);
    }
    const rti = new RichTextIntermediate(new RichText(markup, handlers,),);
    for (const handler of handlers) rti.registerFunctionHandler(handler,);
    rti.tree = new RichTextElement(rti, "richtext", children,);
    rti.sectionNumbers = false;
    rti.cssClass = "tj_journal";
    return rti;
  }

  /**
   * Entries of one task in `[startDate, endDate)` (Ruby `entriesByTask`).
   *
   * Entries with an empty headline are dropped, as the Ruby code does
   * (`!entry.headline.empty?`).
   */
  entriesByTask(
    task: PropertyTreeNode,
    startDate: TjTime | null = null,
    endDate: TjTime | null = null,
    logExp: unknown = null,
    resource: Resource | null = null,
    alertLevel: number | null = null,
  ): JournalEntryList {
    const list = new JournalEntryList();
    const prop = unwrap(task,);
    for (const entry of this.entryList) {
      if (unwrap(entry.property,) !== prop) continue;
      if (startDate && entry.date.compareTo(startDate,) < 0) continue;
      if (endDate && entry.date.compareTo(endDate,) >= 0) continue;
      if (resource && entry.author !== resource) continue;
      if (alertLevel !== null && entry.alertLevel < alertLevel) continue;
      if (entry.headline === "" || hidden(entry, logExp,)) continue;
      list.push(entry,);
    }
    return list;
  }

  /** Entries of a task and of all of its sub-tasks (Ruby `entriesByTaskR`). */
  entriesByTaskR(
    task: PropertyTreeNode,
    startDate: TjTime | null = null,
    endDate: TjTime | null = null,
    logExp: unknown = null,
    resource: Resource | null = null,
    alertLevel: number | null = null,
  ): JournalEntryList {
    const list = this.entriesByTask(
      task,
      startDate,
      endDate,
      logExp,
      resource,
      alertLevel,
    );
    for (const kid of task.kids()) {
      list.add(
        this.entriesByTaskR(
          kid,
          startDate,
          endDate,
          logExp,
          resource,
          alertLevel,
        ),
      );
    }
    return list;
  }

  /**
   * Entries written **by** a resource (Ruby `entriesByResource`).
   *
   * Note the bounds: `startDate` is exclusive and `endDate` inclusive, which is
   * the opposite of `entriesByTask`.
   */
  entriesByResource(
    resource: Resource,
    startDate: TjTime | null = null,
    endDate: TjTime | null = null,
    logExp: unknown = null,
    task: PropertyTreeNode | null = null,
    alertLevel: number | null = null,
  ): JournalEntryList {
    const list = new JournalEntryList();
    const prop = unwrap(resource,);
    const taskPtn = task ? unwrap(task,) : null;
    for (const entry of this.entryList) {
      if (unwrap(entry.author as PropertyTreeNode | null,) !== prop) continue;
      if (startDate && entry.date.compareTo(startDate,) <= 0) continue;
      if (endDate && entry.date.compareTo(endDate,) > 0) continue;
      if (taskPtn && unwrap(entry.property,) !== taskPtn) continue;
      if (alertLevel !== null && entry.alertLevel < alertLevel) continue;
      if (entry.headline === "" || hidden(entry, logExp,)) continue;
      list.push(entry,);
    }
    return list;
  }

  /** Entries of a material (extension 16.21.2; bounds as `entriesByTask`). */
  entriesByMaterial(
    material: Material,
    startDate: TjTime | null = null,
    endDate: TjTime | null = null,
    logExp: unknown = null,
    alertLevel: number | null = null,
  ): JournalEntryList {
    return this.entriesByLeaf(
      material,
      startDate,
      endDate,
      logExp,
      alertLevel,
    );
  }

  /** Entries of an account (extension 16.21.3; bounds as `entriesByTask`). */
  entriesByAccount(
    account: Account,
    startDate: TjTime | null = null,
    endDate: TjTime | null = null,
    logExp: unknown = null,
    alertLevel: number | null = null,
  ): JournalEntryList {
    return this.entriesByLeaf(account, startDate, endDate, logExp, alertLevel,);
  }

  /**
   * Entries of a leaf property that has no sub-journal (material, account).
   * Reuses the semantics of `entriesByTask` (start inclusive).
   */
  private entriesByLeaf(
    property: PropertyTreeNode,
    startDate: TjTime | null,
    endDate: TjTime | null,
    logExp: unknown,
    alertLevel: number | null = null,
  ): JournalEntryList {
    return this.entriesByTask(
      property,
      startDate,
      endDate,
      logExp,
      null,
      alertLevel,
    );
  }

  /**
   * Entries inside the interval (Ruby `Journal#entries`): without a property
   * the whole journal, with one that property and its descendants.
   *
   * Only the name differs: Ruby calls this method `entries`, but here `entries`
   * is the read-only view of the canonical list.
   */
  rangeEntries(
    start: TjTime | null,
    end: TjTime | null,
    logExp: unknown,
    property: PropertyTreeNode | null = null,
    alertLevel: number | null = null,
  ): JournalEntryList {
    const list = new JournalEntryList();
    const prop = property ? unwrap(property,) : null;
    for (const entry of this.entryList) {
      if (start && entry.date.compareTo(start,) < 0) continue;
      if (end && entry.date.compareTo(end,) > 0) continue;
      if (prop) {
        const ep = unwrap(entry.property,);
        if (ep !== prop && !isChildOf(ep, prop,)) continue;
      }
      if (alertLevel !== null && entry.alertLevel !== alertLevel) continue;
      if (hidden(entry, logExp,)) continue;
      list.push(entry,);
    }
    return list;
  }

  /**
   * Entries of `property` in `[start, end)`.
   *
   * Earlier implementation kept for existing callers; it delegates to
   * `entriesByTask`.
   */
  propertyEntries(
    property: PropertyTreeNode,
    start: TjTime | null,
    end: TjTime | null,
    logExp: unknown,
    recursive = false,
  ): JournalEntry[] {
    return (recursive
      ? this.entriesByTaskR(property, start, end, logExp,)
      : this.entriesByTask(property, start, end, logExp,)).toArray();
  }

  /**
   * Most recent entries of `property` up to `date` (inclusive), all of those
   * that share the same date (Ruby `JournalEntryList#last`).
   */
  lastBefore(property: PropertyTreeNode, date: TjTime,): JournalEntry[] {
    let latest: TjTime | null = null;
    for (const e of this.entries) {
      if (e.property !== property || e.date.compareTo(date,) > 0) continue;
      if (latest === null || e.date.compareTo(latest,) > 0) latest = e.date;
    }
    if (latest === null) return [];
    return this.entries.filter((e,) =>
      e.property === property && e.date.compareTo(latest!,) === 0
    );
  }

  /**
   * Current entries of `property` (Ruby `Journal#currentEntries`): the last
   * entry up to `date`, dropped when an ancestor has a more recent one.
   */
  currentEntries(
    date: TjTime | null,
    property: PropertyTreeNode,
    minLevel: number,
    minDate: TjTime | null,
    logExp: unknown,
  ): JournalEntry[] {
    if (!date) return [];
    let pEntries = this.lastBefore(property, date,).filter((e,) =>
      e.headline !== "" && e.alertLevel >= minLevel &&
      !(e.alertLevel >= minLevel && minDate &&
        e.date.compareTo(minDate,) < 0)
    );
    if (pEntries.length > 0) {
      let p = property.parent;
      while (p) {
        const pp = this.lastBefore(p, date,);
        if (pp.length > 0 && pp[0]!.date.compareTo(pEntries[0]!.date,) >= 0) {
          return [];
        }
        p = p.parent;
      }
    }
    if (logExp) pEntries = pEntries.filter((e,) => !hidden(e, logExp,));
    return pEntries;
  }

  /**
   * Recursive version of `currentEntries` (Ruby `Journal#currentEntriesR`).
   *
   * Walks the property tree bottom-up and, in `status_dep`/`alerts_dep` mode,
   * also the end-to-start dependencies of tasks, returning the last entry up to
   * `date` of each property — unless a child or dependency has a more recent or
   * higher-level entry. The Ruby `DataCache` is only an optimisation and is
   * omitted here; it does not change the result.
   */
  currentEntriesR(
    date: TjTime | null,
    property: PropertyTreeNode,
    minLevel: number,
    minDate: TjTime | null,
    query: JournalQueryLike,
  ): JournalEntry[] {
    if (!date) return [];
    // Current entries of this property (the filter uses `==` minLevel,
    // faithful to Ruby l.665-668 — distinct from `currentEntries`).
    const pEntries = this.lastBefore(property, date,).filter((e,) =>
      e.headline !== "" && e.alertLevel >= minLevel &&
      !(e.alertLevel === minLevel && minDate &&
        e.date.compareTo(minDate,) < 0)
    );
    let maxPAlertLevel = 0;
    for (const e of pEntries) {
      if (e.alertLevel > maxPAlertLevel) maxPAlertLevel = e.alertLevel;
    }

    const cEntries: JournalEntry[] = [];
    let latestDate: TjTime | null = null;
    let maxAlertLevel = 0;
    // When this property has an entry, only later child entries matter
    // (`date + 1` = +86400s, faithful to Ruby l.681).
    const childMinDate = pEntries.length > 0
      ? pEntries[0]!.date.addSeconds(86400,)
      : minDate;

    const absorb = (entries: JournalEntry[],): void => {
      for (const e of entries) {
        if (latestDate === null || e.date.compareTo(latestDate,) > 0) {
          latestDate = e.date;
        }
        if (e.alertLevel > maxAlertLevel) maxAlertLevel = e.alertLevel;
        if (!cEntries.includes(e,)) cEntries.push(e,);
      }
    };

    for (const p of property.kids()) {
      absorb(
        this.currentEntriesR(date, p, minLevel, childMinDate, query,),
      );
    }

    // Only Tasks have dependencies (Ruby l.695-712).
    const mode = query.journalMode;
    if (
      (mode === "status_dep" || mode === "alerts_dep") &&
      property instanceof Task
    ) {
      const scIdx = query.scenarioIdx ?? 0;
      for (
        const [depTask, onEnd,] of property.scenarioData(scIdx,).startpreds()
      ) {
        // Only follow end->start dependencies.
        if (!onEnd || !depTask) continue;
        absorb(
          this.currentEntriesR(date, depTask, minLevel, childMinDate, query,),
        );
      }
    }

    let entries: JournalEntry[];
    if (
      pEntries.length > 0 &&
      (maxPAlertLevel > maxAlertLevel || latestDate === null ||
        pEntries[0]!.date.compareTo(latestDate,) >= 0)
    ) {
      entries = pEntries;
    } else {
      entries = cEntries;
    }

    if (query.hideJournalEntry) {
      entries = entries.filter((e,) => !hidden(e, query.hideJournalEntry,));
    }
    return entries;
  }

  /**
   * Effective alert level of `property` at `date` (Ruby `Journal#alertLevel`):
   * the highest level among the recursive current entries.
   */
  alertLevel(
    date: TjTime | null,
    property: PropertyTreeNode,
    query: JournalQueryLike,
  ): number {
    let maxLevel = 0;
    for (const e of this.currentEntriesR(date, property, 0, null, query,)) {
      if (maxLevel < e.alertLevel) maxLevel = e.alertLevel;
    }
    return maxLevel;
  }

  /**
   * Alert entries of `property` (Ruby `Journal#alertEntries`): only those that
   * carry the highest level among the recursive current entries.
   */
  alertEntries(
    date: TjTime | null,
    property: PropertyTreeNode,
    minLevel: number,
    minDate: TjTime | null,
    query: JournalQueryLike,
  ): JournalEntry[] {
    let maxLevel = 0;
    let entries: JournalEntry[] = [];
    for (
      const e of this.currentEntriesR(date, property, minLevel, minDate, query,)
    ) {
      if (maxLevel < e.alertLevel) {
        maxLevel = e.alertLevel;
        entries = [e,];
      } else if (maxLevel === e.alertLevel) {
        entries.push(e,);
      }
    }
    return entries;
  }

  /**
   * Sorts the entries according to `query.sortJournalEntries`
   * (`[attribute, direction]` pairs over `date`, `alert` and `seqno`).
   */
  sortEntries(entries: JournalEntry[], spec: unknown,): JournalEntry[] {
    const criteria: Array<[string, number,]> = Array.isArray(spec,) &&
        spec.length > 0
      ? (spec as Array<[string, number,]>)
      : [["date", 1,], ["alert", 1,], ["seqno", 1,],];
    const seq = new Map<JournalEntry, number>();
    this.entries.forEach((e, i,) => seq.set(e, i,));
    return entries.slice().sort((a, b,) => {
      for (const [attr, dir,] of criteria) {
        let cmp = 0;
        if (attr === "date") cmp = a.date.compareTo(b.date,);
        else if (attr === "alert") cmp = a.alertLevel - b.alertLevel;
        else if (attr === "seqno") {
          cmp = (seq.get(a,) ?? 0) - (seq.get(b,) ?? 0);
        }
        if (cmp !== 0) return cmp * (dir < 0 ? -1 : 1);
      }
      return 0;
    },);
  }
}

/** First index where `entry` could be inserted while keeping the list sorted. */
function lowerBound(
  list: JournalEntry[],
  entry: JournalEntry,
): number {
  let lo = 0;
  let hi = list.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (byDate(list[mid]!, entry,) <= 0) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}
