/**
 * RdoReport (phase 14 addendum C3) — Daily Construction Report.
 *
 * SyntaxMesh extension (no equivalent in TJ Ruby): builds the RDO from a
 * selected period, grouping the journal entries by day (`groupby date`, the
 * default), task, resource, material or account. Each block collects the
 * entries of the group, the image gallery (`picture` elements plus images
 * embedded in `details`) and the resource/material/charge tables.
 *
 * Data sources (all already ported):
 * - `Journal#entriesByDate` / `entriesByTask` / `entriesByResource` /
 *   `entriesByMaterial` / `entriesByAccount` (14C.0.4).
 * - `JournalEntry.pictures` plus `picturesFromDetails` (14C.3.7).
 * - `project.alertLevels` (14C.0.7) for the alert level name/color.
 * - `assignedResources` plus `getAllocatedTime`, `materialallocations` and
 *   `charge` for the block tables (the same lookups as `BreakdownReport`,
 *   14C.2.3).
 *
 * Outputs (ADR 027 — strings and in-memory structures, no disk, no DOM):
 * - HTML: one section per block with header, entries, gallery and tables.
 * - JSON: nested by `groupby` with the image array of every entry.
 *
 * Relative images: `src` is emitted as a relative descriptor by default; an
 * `ImageStore` (phase 19) injects the resolution through
 * {@link RdoReport.setImageResolver} (14C.3.12).
 *
 * The type is registered in the content factory under `rdoreport`
 * (`ReportType.RdoReport`), removing the `NotYetImplementedError` anchor of
 * 14C.0.10.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.3)
 * @see docs/syntaxmesh/fases/fase-10-complemento1.md §6
 */
import type { Report, } from "../model/report.ts";
import type { Task, } from "../model/task.ts";
import type { Resource, } from "../model/resource.ts";
import type { Account, } from "../model/account.ts";
import type { Material, } from "../model/material.ts";
import type { JournalEntry, } from "../model/journal.ts";
import type { AlertLevelDefinition, } from "../model/alert-levels.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import type { TableColumnDefinition, } from "./table-column-definition.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { Picture, PictureAlign, } from "../model/picture.ts";
import type { TjTime, } from "../time/tj-time.ts";
import { PropertyList, } from "../model/property-list.ts";
import { ReportBase, } from "./report-base.ts";
import {
  markdownHeading,
  markdownImage,
  markdownSections,
  markdownTable,
} from "./markdown.ts";
import { picturesFromDetails, picturesToHtml, } from "./gallery.ts";
import { XMLBlob, XMLElement, } from "../xml/xml-element.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/** Criterion used to group the blocks (`groupby`). */
export type RdoGroupBy = "date" | "task" | "resource" | "material" | "account";

/** Kind of block table (the matching title/column in the report). */
export type RdoTableKind = "resources" | "materials" | "charges";

/** Serialized image of an entry (JSON/HTML). */
export interface RdoImage {
  /** Relative path of the image file. */
  path: string;
  /** Alternative text, or `null` for none. */
  alt: string | null;
  /** Caption rendered under the image, or `null` for none. */
  caption: string | null;
  /** Horizontal alignment, or `null` for the default. */
  align: PictureAlign | null;
  /** Rendered width in pixels, or `null` for the intrinsic size. */
  width: number | null;
}

/** A journal entry already resolved for the RDO. */
export interface RdoEntry {
  /** Entry date formatted as `YYYY-MM-DD`. */
  date: string;
  /** One-line headline of the entry. */
  headline: string;
  /** Short summary, or `null` when the entry has none. */
  summary: string | null;
  /** Full text of the entry, or `null` when the entry has none. */
  details: string | null;
  /** Name of the entry author, or `null` when unknown. */
  author: string | null;
  /** Display name of the alert level, or `null` when not set. */
  alert: string | null;
  /** Id of the alert level (`green`/`yellow`/`red`), or `null`. */
  alertId: string | null;
  /** Index of the alert level, `0` being the lowest. */
  alertLevel: number;
  /** Free-form flags attached to the entry. */
  flags: string[];
  /** Id of the property the entry belongs to, or `null` for project-level. */
  entity: string | null;
  /** Markup format of `summary`/`details` (`wiki`, `markdown`, …). */
  format: string;
  /** Images declared or embedded in the entry. */
  pictures: RdoImage[];
}

/** Row of the resource/material/charge tables of a block. */
export interface RdoTableRow {
  /** Id of the entity the row describes. */
  id: string;
  /** Human-readable name of the entity. */
  name: string;
  /** Extra detail (effort, quantity, charge mode, …). */
  detail: string;
  /** Numeric amount (effort in days, cost, charge value, …). */
  amount: number;
}

/** One RDO block: a day, task, resource, material or account. */
export interface RdoGroup {
  /** Id of the entity (or the date string) the block aggregates. */
  id: string;
  /** Display name of the block. */
  name: string;
  /** Journal entries of the block, sorted by date. */
  entries: RdoEntry[];
  /** Gallery of the block, deduplicated by path. */
  pictures: Picture[];
  /** Name of the responsible resource, or `null` when not declared. */
  responsible: string | null;
  /** Resources allocated to the tasks of the block. */
  resources: RdoTableRow[];
  /** Materials allocated to the tasks of the block. */
  materials: RdoTableRow[];
  /** Charges declared on the tasks of the block. */
  charges: RdoTableRow[];
}

/** Column titles, in the canonical order of the report. */
const COLUMN_TITLES: Record<string, string> = {
  name: "Name",
  responsible: "Responsible",
  journal: "Journal",
  pictures: "Pictures",
  resources: "Resources",
  materials: "Materials",
  charges: "Charges",
};

/** Default order used when the report does not declare `columns`. */
const DEFAULT_COLUMN_ORDER = [
  "name",
  "responsible",
  "journal",
  "pictures",
  "resources",
  "materials",
  "charges",
];

/** `journalattributes` values recognized by the renderer (14C.3.5). */
const JOURNAL_ATTRIBUTES = new Set([
  "alert",
  "author",
  "date",
  "details",
  "flags",
  "headline",
  "property",
  "propertyid",
  "summary",
],);

/** Date format used for the blocks and for the entries. */
const DATE_FORMAT = "%Y-%m-%d";

/** Block tables, in the canonical order, with their markdown title. */
const RDO_TABLES: [RdoTableKind, string,][] = [
  ["resources", "Resources",],
  ["materials", "Materials",],
  ["charges", "Charges",],
];

/**
 * The RDO content generator.
 *
 * `generateIntermediateFormat()` builds the blocks once and derives every
 * output (HTML, JSON, Markdown) from them, so the sources are read only a
 * single time per report.
 */
export class RdoReport extends ReportBase {
  /** Blocks built by the last `generateIntermediateFormat()`. */
  private groups: RdoGroup[] = [];
  /** HTML tree built by the last `generateIntermediateFormat()`. */
  private html: XMLElementLike[] = [];
  /** Optional hook resolving a relative image path (phase 19 `ImageStore`). */
  private resolveRelative: ((path: string,) => string) | null = null;

  /**
   * Creates the content generator of an `rdoreport`.
   *
   * @param report Report node the generator renders.
   */
  constructor(report: Report,) {
    super(report,);
  }

  /** Effective grouping criterion (defaults to `date`, as in the parser). */
  groupby(): RdoGroupBy {
    const declared = this.a("groupby",);
    switch (declared) {
      case "task":
      case "resource":
      case "material":
      case "account":
      case "date":
        return declared;
      default:
        return "date";
    }
  }

  /** Blocks generated by the last run (read by tests and consumers). */
  getGroups(): RdoGroup[] {
    return this.groups;
  }

  /**
   * Registers the `ImageStore` (phase 19) that resolves relative paths in the
   * HTML (14C.3.12). `null` (the default) keeps the relative path as a plain
   * descriptor.
   *
   * @param resolve Hook turning a relative path into a renderable URL, or
   *   `null` to disable the resolution.
   */
  setImageResolver(
    resolve: ((path: string,) => string) | null,
  ): void {
    this.resolveRelative = resolve;
  }

  /** Builds the blocks and the HTML; every other output derives from them. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    this.groups = this.buildGroups();
    this.buildHtml();
  }

  /** Full RDO HTML (one element per block, inside a `<section>`). */
  to_html(): XMLElementLike[] {
    return this.html;
  }

  /** JSON nested by `groupby` (14C.0.1 / 14C.3.11). */
  toJSON(): string {
    return JSON.stringify(
      {
        groupby: this.groupby(),
        period: this.periodJson(),
        groups: this.groups,
      },
      null,
      2,
    );
  }

  /**
   * Markdown document (SyntaxMesh extension — addendum §10).
   *
   * Each block becomes `## <block>`; each journal entry becomes
   * `### <headline>` followed by an italic metadata pair, the text and the
   * images as `![alt](src)`. The resource/material/charge tables of the block
   * are rendered as pipe tables. Plain Markdown: no HTML tag is emitted.
   */
  to_markdown(): string {
    const sections: (string | null)[] = [this.rt_to_markdown("header",),];
    for (const group of this.groups) {
      sections.push(markdownHeading(2, group.name,),);
      if (group.responsible) {
        sections.push(`*${group.responsible}*`,);
      }
      for (const entry of group.entries) {
        sections.push(this.entryMarkdown(entry,),);
      }
      for (const picture of group.pictures) {
        sections.push(
          markdownImage(picture.path, picture.alt, picture.caption,),
        );
      }
      for (const [kind, title,] of RDO_TABLES) {
        const rows = group[kind];
        if (rows.length === 0) continue;
        sections.push(markdownHeading(3, title,),);
        sections.push(
          markdownTable(
            ["ID", "Name", "Detail", "Amount",],
            rows.map((row,) => [row.id, row.name, row.detail, row.amount,]),
          ),
        );
      }
    }
    sections.push(this.rt_to_markdown("footer",),);
    return markdownSections(sections,);
  }

  /** One journal entry as markdown (headline, metadata, text, images). */
  private entryMarkdown(entry: RdoEntry,): string {
    const parts: string[] = [markdownHeading(3, entry.headline,).trimEnd(),];
    const meta: string[] = [];
    if (entry.date !== "") meta.push(entry.date,);
    if (entry.author) meta.push(entry.author,);
    if (entry.alert) meta.push(entry.alert,);
    if (meta.length > 0) parts.push(`*${meta.join(" — ",)}*`,);
    if (entry.summary) parts.push(entry.summary,);
    if (entry.details) parts.push(entry.details,);
    for (const picture of entry.pictures) {
      parts.push(markdownImage(picture.path, picture.alt, picture.caption,),);
    }
    return parts.join("\n\n",);
  }

  // ------------------------------------------------------------------
  // Block construction
  // ------------------------------------------------------------------

  /** Dispatches to the builder of the current `groupby`. */
  private buildGroups(): RdoGroup[] {
    switch (this.groupby()) {
      case "date":
        return this.buildByDate();
      case "task":
        return this.buildByTasks();
      case "resource":
        return this.buildByResources();
      case "material":
        return this.buildByMaterials();
      case "account":
        return this.buildByAccounts();
    }
  }

  /** One block per day that has entries (empty days generate no block). */
  private buildByDate(): RdoGroup[] {
    const byDay = new Map<string, JournalEntry[]>();
    for (const entry of this.periodEntries()) {
      const key = entry.date.to_s(DATE_FORMAT,);
      const bucket = byDay.get(key,);
      if (bucket) bucket.push(entry,);
      else byDay.set(key, [entry,],);
    }

    const groups: RdoGroup[] = [];
    for (const day of [...byDay.keys(),].sort()) {
      const entries = byDay.get(day,)!;
      const dayStart = entries[0]!.date.midnight();
      const [startIdx, endIdx,] = this.idxRange(
        dayStart,
        dayStart.sameTimeNextDay(),
      );
      groups.push(
        this.makeGroup(day, day, entries, null, [startIdx, endIdx,],),
      );
    }
    return groups;
  }

  /** One block per task; `status_up` restricts the list to root tasks. */
  private buildByTasks(): RdoGroup[] {
    let list = new PropertyList<Task>(this.project.tasks,);
    list.query = this.currentQuery();
    list = this.filterTaskList(
      list,
      null,
      this.a("hideTask",) as never,
      this.a("rollupTask",) as never,
      this.a("openNodes",) as never,
    );
    list.sort();
    return this.entityGroups(
      list.toArray(),
      (task,) => task.id,
      (task,) => this.project.journal.entriesFor(task,),
    );
  }

  /** One block per resource (`hideresource` applied). */
  private buildByResources(): RdoGroup[] {
    let list = new PropertyList<Resource>(this.project.resources,);
    list.query = this.currentQuery();
    list = this.filterResourceList(
      list,
      null,
      this.a("hideResource",) as never,
      this.a("rollupResource",) as never,
      this.a("openNodes",) as never,
    );
    list.sort();
    return this.entityGroups(
      list.toArray(),
      (resource,) => resource.id,
      (resource,) => this.project.journal.entriesFor(resource,),
    );
  }

  /** One block per material (`hideMaterial`/`rollupMaterial` — 14C.6.6/6.9). */
  private buildByMaterials(): RdoGroup[] {
    const list = this.project.materials.toArray()
      .map((raw,) => raw as Material)
      .filter((material,) =>
        !this.hiddenBy("hideMaterial", material,) &&
        !this.hiddenBy("rollupMaterial", material,)
      )
      .sort((a, b,) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
    return this.entityGroups(
      list,
      (material,) => material.id,
      (material,) => this.project.journal.entriesFor(material,),
    );
  }

  /** One block per account (`hideaccount`/`rollupaccount` applied). */
  private buildByAccounts(): RdoGroup[] {
    let list = new PropertyList<Account>(this.project.accounts,);
    list.query = this.currentQuery();
    list = this.filterAccountList(
      list,
      this.a("hideAccount",) as never,
      this.a("rollupAccount",) as never,
      this.a("openNodes",) as never,
    );
    list.sort();
    return this.entityGroups(
      list.toArray(),
      (account,) => account.id,
      (account,) => this.project.journal.entriesFor(account,),
    );
  }

  /**
   * Builds one block per entity, using the journal index (14C.0.4) to find the
   * entries of the entity and intersecting that with the entries allowed by the
   * period plus `journalmode`. Entities without entries generate no block.
   *
   * @param entities Entities to iterate, already filtered and sorted.
   * @param idOf Returns the id used as the block key.
   * @param indexOf Returns every journal entry recorded for the entity.
   * @returns One block per entity that has at least one allowed entry.
   */
  private entityGroups<T extends PropertyTreeNode,>(
    entities: T[],
    idOf: (entity: T,) => string,
    indexOf: (entity: T,) => JournalEntry[],
  ): RdoGroup[] {
    const allowed = new Set(this.periodEntries(),);
    const range = this.periodRange();
    const [startIdx, endIdx,] = this.idxRange(range[0], range[1],);

    const groups: RdoGroup[] = [];
    for (const entity of entities) {
      const own = indexOf(entity,).filter((entry,) => allowed.has(entry,));
      if (own.length === 0) continue;
      groups.push(
        this.makeGroup(
          idOf(entity,),
          entity.name,
          own,
          entity,
          [startIdx, endIdx,],
        ),
      );
    }
    return groups;
  }

  /** Assembles the whole block (entries, gallery, tables, responsible). */
  private makeGroup(
    id: string,
    name: string,
    entries: JournalEntry[],
    entity: PropertyTreeNode | null,
    range: [number, number,],
  ): RdoGroup {
    const sorted = [...entries,].sort((a, b,) =>
      a.date.compareTo(b.date,) || 0
    );
    const tasks = this.tasksOf(sorted, entity,);
    return {
      id,
      name,
      entries: sorted.map((entry,) => this.makeEntry(entry,)),
      pictures: this.groupPictures(sorted,),
      responsible: this.responsibleOf(tasks,),
      resources: this.resourceRows(tasks, range,),
      materials: this.materialRows(tasks,),
      charges: this.chargeRows(tasks,),
    };
  }

  /**
   * Tasks of the block: the task itself under `groupby task`, the tasks of the
   * entries under `groupby date`, and none otherwise (empty tables).
   */
  private tasksOf(
    entries: JournalEntry[],
    entity: PropertyTreeNode | null,
  ): Task[] {
    if (entity && this.isTask(entity,)) return [entity as Task,];
    if (this.groupby() !== "date") return [];
    const seen = new Set<Task>();
    const tasks: Task[] = [];
    for (const entry of entries) {
      const property = entry.property;
      if (!property || !this.isTask(property,)) continue;
      const task = property as Task;
      if (seen.has(task,)) continue;
      seen.add(task,);
      tasks.push(task,);
    }
    return tasks;
  }

  // ------------------------------------------------------------------
  // Entries of the period and journal modes
  // ------------------------------------------------------------------

  /** Entries of the report period, already minus those hidden by `hideJournalEntry`. */
  private periodEntries(): JournalEntry[] {
    const [start, end,] = this.periodRange();
    const journal = this.project.journal;
    let entries = start && end
      ? journal.entriesByDate(start, end,)
      : [...journal.entries,];

    const hide = this.a("hideJournalEntry",) as
      | { eval?: (entry: unknown,) => unknown }
      | null;
    if (hide && typeof hide.eval === "function") {
      const evalHide = hide.eval.bind(hide,);
      entries = entries.filter((entry,) => !evalHide(entry,));
    }

    return this.applyMode(entries,);
  }

  /**
   * Applies `journalmode` (14C.3.4). The `status_*`/`alerts_*` modes select the
   * current entry per task (as Ruby's `Journal#to_rti`); entries of
   * resources/materials/accounts are preserved (SyntaxMesh extension — Ruby only
   * walks tasks in those modes).
   *
   * @param entries Entries of the period.
   * @returns The entries selected by the declared mode.
   */
  private applyMode(entries: JournalEntry[],): JournalEntry[] {
    const mode = String(this.a("journalMode",) ?? "journal",);
    switch (mode) {
      case "journal":
      case "journal_sub":
        return entries;
      case "status_up":
        return this.currentByTask(entries, false,);
      case "status_down":
      case "status_dep":
        return this.currentByTask(entries, true,);
      case "alerts_down":
      case "alerts_dep":
        return this.alertByTask(entries,);
      default: {
        const level = this.alertLevelIndex(mode.replace(/^alerts_/, "",),);
        return level === null
          ? entries
          : entries.filter((entry,) => entry.alertLevel === level);
      }
    }
  }

  /**
   * Current entries per root task: the most recent one of the task itself or,
   * when `deep`, the most recent one of the whole subtree.
   *
   * @param entries Entries to filter.
   * @param deep Whether to descend into the whole subtree.
   * @returns The selected entries, plus the non-task ones untouched.
   */
  private currentByTask(
    entries: JournalEntry[],
    deep: boolean,
  ): JournalEntry[] {
    const taskEntries = new Map<Task, JournalEntry[]>();
    const other: JournalEntry[] = [];
    for (const entry of entries) {
      const property = entry.property;
      if (!property || !this.isTask(property,)) {
        other.push(entry,);
        continue;
      }
      const task = property as Task;
      const bucket = taskEntries.get(task,);
      if (bucket) bucket.push(entry,);
      else taskEntries.set(task, [entry,],);
    }

    const picked: JournalEntry[] = [...other,];
    for (const root of this.rootTasks(taskEntries,)) {
      const entry = this.currentOf(root, taskEntries, deep,);
      if (entry) picked.push(entry,);
    }
    return picked;
  }

  /** Like {@link currentByTask}, keeping only the highest alert level. */
  private alertByTask(entries: JournalEntry[],): JournalEntry[] {
    const current = this.currentByTask(entries, true,);
    const maxLevel = current.reduce(
      (max, entry,) => Math.max(max, entry.alertLevel,),
      0,
    );
    return current.filter((entry,) => entry.alertLevel === maxLevel);
  }

  /** Root tasks present in the entries. */
  private rootTasks(taskEntries: Map<Task, JournalEntry[]>,): Task[] {
    const roots = new Set<Task>();
    for (const task of taskEntries.keys()) {
      let node: Task = task;
      while (node.parent) {
        const parent = node.parent as unknown as Task;
        if (typeof parent.container !== "function") break;
        node = parent;
      }
      roots.add(node,);
    }
    return [...roots,].sort((a, b,) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  }

  /**
   * Current entry of a task: the most recent one of the task itself wins over
   * its children's; `deep` descends the whole subtree, otherwise only the direct
   * children are considered.
   *
   * @param task Task whose current entry is being resolved.
   * @param taskEntries Entries grouped by task.
   * @param deep Whether to descend into the whole subtree.
   * @returns The current entry, or `null` when neither the task nor its
   *   descendants have one.
   */
  private currentOf(
    task: Task,
    taskEntries: Map<Task, JournalEntry[]>,
    deep: boolean,
  ): JournalEntry | null {
    const own = taskEntries.get(task,);
    let best = own && own.length > 0 ? own[own.length - 1]! : null;

    const kids = task.kids().map((kid,) => kid as unknown as Task);
    for (const kid of kids) {
      if (typeof kid.container !== "function") continue;
      const candidate = deep
        ? this.currentOf(kid, taskEntries, true,)
        : (taskEntries.get(kid,)?.at(-1,) ?? null);
      if (!candidate) continue;
      if (!best || candidate.date.compareTo(best.date,) > 0) best = candidate;
    }
    return best;
  }

  /** Alert level index by id (`green`/`yellow`/`red`); `null` when unknown. */
  private alertLevelIndex(id: string,): number | null {
    const levels = this.alertLevels();
    const index = levels.findIndex((level,) => level.id === id);
    return index < 0 ? null : index;
  }

  /** Alert level list of the project (defaults to green → red). */
  private alertLevels(): AlertLevelDefinition[] {
    const levels = this.project.get("alertLevels",) as
      | AlertLevelDefinition[]
      | undefined;
    return levels ?? [];
  }

  // ------------------------------------------------------------------
  // Conversion of the entries and tables
  // ------------------------------------------------------------------

  /** Converts a `JournalEntry` into the serializable RDO record. */
  private makeEntry(entry: JournalEntry,): RdoEntry {
    const levels = this.alertLevels();
    const level = levels[entry.alertLevel];
    const property = entry.property;
    const author = entry.author as { name?: string } | null;

    const pictures = this.picturesOf(entry,);
    return {
      date: entry.date.to_s(DATE_FORMAT,),
      headline: entry.headline,
      summary: entry.summary,
      details: entry.details,
      author: author?.name ?? null,
      alert: level?.name ?? null,
      alertId: level?.id ?? null,
      alertLevel: entry.alertLevel,
      flags: [...entry.flags,],
      entity: property?.id ?? null,
      format: entry.format,
      pictures: pictures.map((picture,) => ({
        path: picture.path,
        alt: picture.alt,
        caption: picture.caption,
        align: picture.align,
        width: picture.width,
      })),
    };
  }

  /**
   * Images declared (`picture`) followed by those embedded in `details`.
   *
   * `hidepicture` (14C.6.7) is evaluated on the **owning property** of the entry:
   * an entry whose owner matches contributes no images at all — neither in the
   * entry list nor in the block gallery (and therefore it does not count towards
   * `maxpictures` either).
   */
  private picturesOf(entry: JournalEntry,): Picture[] {
    const property = entry.property as PropertyTreeNode | null;
    if (property && this.hiddenBy("hidePicture", property,)) return [];
    return [...entry.pictures, ...picturesFromDetails(entry.details,),];
  }

  /** Gallery of the block: union of the entries, without repeating a path. */
  private groupPictures(entries: JournalEntry[],): Picture[] {
    const seen = new Set<string>();
    const pictures: Picture[] = [];
    for (const entry of entries) {
      for (const picture of this.picturesOf(entry,)) {
        if (seen.has(picture.path,)) continue;
        seen.add(picture.path,);
        pictures.push(picture,);
      }
    }
    return pictures;
  }

  /** Resources allocated to the tasks of the block, with effort in the range. */
  private resourceRows(
    tasks: Task[],
    range: [number, number,],
  ): RdoTableRow[] {
    const rows = new Map<string, RdoTableRow>();
    for (const task of tasks) {
      for (const scenarioIdx of this.scenarioIdxList()) {
        const scenario = task.scenarioData(scenarioIdx,);
        for (const raw of task.assignedResources(scenarioIdx,)) {
          const resource = (raw.ptn?.() ?? raw) as Resource;
          const effort = scenario.getAllocatedTime(
            range[0],
            range[1],
            resource,
          );
          const row = rows.get(resource.id,) ??
            { id: resource.id, name: resource.name, detail: "", amount: 0, };
          row.detail = `${formatNumber(effort,)} d`;
          rows.set(resource.id, row,);
        }
      }
    }
    return [...rows.values(),].sort(byId,);
  }

  /** Materials allocated to the tasks of the block (quantity × effective price). */
  private materialRows(tasks: Task[],): RdoTableRow[] {
    const rows = new Map<string, RdoTableRow>();
    for (const task of tasks) {
      for (const scenarioIdx of this.scenarioIdxList()) {
        const allocations =
          (task.getForScenario("materialallocations", scenarioIdx,) ??
            []) as Array<{ material: Material; quantity: number }>;
        for (const allocation of allocations) {
          const material = allocation.material;
          const unit = material.unitValue();
          const row = rows.get(material.id,) ?? {
            id: material.id,
            name: material.name,
            detail: "",
            amount: 0,
          };
          row.detail = `${formatNumber(allocation.quantity,)} ${
            unit === "" ? "u" : unit
          }`;
          row.amount += allocation.quantity * material.unitPriceValue();
          rows.set(material.id, row,);
        }
      }
    }
    return [...rows.values(),].sort(byId,);
  }

  /** Charges declared on the tasks of the block. */
  private chargeRows(tasks: Task[],): RdoTableRow[] {
    const rows: RdoTableRow[] = [];
    for (const task of tasks) {
      for (const scenarioIdx of this.scenarioIdxList()) {
        const charges = (task.getForScenario("charge", scenarioIdx,) ??
          []) as Array<{ amount: number; mode?: string }>;
        charges.forEach((charge, index,) => {
          rows.push({
            id: `${task.id}-charge-${index}`,
            name: `${task.name} charge ${index + 1}`,
            detail: charge.mode ?? "declared",
            amount: charge.amount,
          },);
        },);
      }
    }
    return rows.sort(byId,);
  }

  /**
   * Responsible of the block: the first resource of `responsible` (a resource
   * list — it may arrive resolved as a `Resource` or as an id, depending on
   * whether the parser resolved the reference).
   */
  private responsibleOf(tasks: Task[],): string | null {
    for (const task of tasks) {
      for (const scenarioIdx of this.scenarioIdxList()) {
        const value = task.getForScenario("responsible", scenarioIdx,);
        const list = Array.isArray(value,) ? value : value ? [value,] : [];
        const first = list[0];
        if (first === undefined || first === null) continue;
        if (typeof first === "string") {
          const resource = this.project.resources.get(first,) as
            | Resource
            | null;
          if (resource) return resource.name;
          continue;
        }
        const resolved = (first as { ptn?: () => unknown }).ptn?.() ?? first;
        const name = (resolved as { name?: string }).name;
        if (name) return name;
      }
    }
    return null;
  }

  // ------------------------------------------------------------------
  // HTML
  // ------------------------------------------------------------------

  /** Builds the RDO sections (14C.3.10). */
  private buildHtml(): void {
    const section = new XMLElement("section", { class: "tj_rdo", },);
    const columns = this.columnOrder();
    for (const group of this.groups) {
      section.append(this.renderGroup(group, columns,),);
    }

    const frame = new XMLElement("div", { class: "tj_rdo_frame", },);
    const header = this.rt_to_html("header",);
    if (header) frame.append(header,);
    const headline = this.rt_to_html("headline",);
    if (headline) frame.append(headline,);
    frame.append(section,);
    const footer = this.rt_to_html("footer",);
    if (footer) frame.append(footer,);

    this.html = [frame,];
  }

  /** Renders one block: header, entries, gallery and tables. */
  private renderGroup(group: RdoGroup, columns: string[],): XMLElementLike {
    const block = new XMLElement("article", {
      class: "tj_rdo_block",
      "data-group": group.id,
    },);

    const header = new XMLElement("header",);
    const title = new XMLElement("h3",);
    title.append(columns.includes("name",) ? group.name : group.id,);
    header.append(title,);
    if (columns.includes("responsible",) && group.responsible) {
      const responsible = new XMLElement("div", {
        class: "tj_rdo_responsible",
      },);
      responsible.append(group.responsible,);
      header.append(responsible,);
    }
    block.append(header,);

    if (columns.includes("journal",)) {
      const journal = new XMLElement("div", {
        class: "tj_rdo_journal",
      },);
      for (const entry of group.entries) {
        journal.append(this.renderEntry(entry,),);
      }
      block.append(journal,);
    }

    if (columns.includes("pictures",) && group.pictures.length > 0) {
      const gallery = picturesToHtml(
        group.pictures,
        this.maxPictures(),
        this.resolveRelative ? { resolveRelative: this.resolveRelative, } : {},
      );
      block.append(new XMLBlob(gallery,),);
    }

    if (columns.includes("resources",) && group.resources.length > 0) {
      block.append(this.renderTable("resources", group.resources,),);
    }
    if (columns.includes("materials",) && group.materials.length > 0) {
      block.append(this.renderTable("materials", group.materials,),);
    }
    if (columns.includes("charges",) && group.charges.length > 0) {
      block.append(this.renderTable("charges", group.charges,),);
    }

    return block;
  }

  /** Renders one entry honouring `journalattributes` (14C.3.5). */
  private renderEntry(entry: RdoEntry,): XMLElementLike {
    const div = new XMLElement("div", { class: "tj_rdo_entry", },);

    if (this.hasJournalAttribute("date",)) {
      const date = new XMLElement("div", { class: "tj_rdo_date", },);
      date.append(entry.date,);
      div.append(date,);
    }
    if (this.hasJournalAttribute("headline",)) {
      const headline = new XMLElement("h4", {
        class: "tj_rdo_headline",
      },);
      headline.append(entry.headline,);
      div.append(headline,);
    }
    if (this.hasJournalAttribute("alert",) && entry.alert) {
      const alert = new XMLElement("div", {
        class: `tj_rdo_alert tj_alert_${entry.alertId ?? "none"}`,
      },);
      alert.append(entry.alert,);
      div.append(alert,);
    }
    if (this.hasJournalAttribute("author",) && entry.author) {
      const author = new XMLElement("div", { class: "tj_rdo_author", },);
      author.append(entry.author,);
      div.append(author,);
    }
    if (this.hasJournalAttribute("flags",) && entry.flags.length > 0) {
      const flags = new XMLElement("div", { class: "tj_rdo_flags", },);
      flags.append(entry.flags.join(", ",),);
      div.append(flags,);
    }
    if (this.hasJournalAttribute("property",) && entry.entity) {
      const property = new XMLElement("div", {
        class: "tj_rdo_property",
      },);
      property.append(entry.entity,);
      div.append(property,);
    }
    if (this.hasJournalAttribute("summary",) && entry.summary) {
      const summary = new XMLElement("div", {
        class: "tj_rdo_summary",
      },);
      summary.append(entry.summary,);
      div.append(summary,);
    }
    if (this.hasJournalAttribute("details",) && entry.details) {
      const details = new XMLElement("div", {
        class: "tj_rdo_details",
      },);
      details.append(entry.details,);
      div.append(details,);
    }

    return div;
  }

  /** Renders a row table (`resources`/`materials`/`charges`). */
  private renderTable(
    kind: RdoTableKind,
    rows: RdoTableRow[],
  ): XMLElementLike {
    const table = new XMLElement("table", {
      class: `tj_rdo_table tj_rdo_${kind}`,
    },);

    const head = new XMLElement("tr",);
    for (const title of ["Name", "Detail", "Amount",]) {
      const th = new XMLElement("th",);
      th.append(title,);
      head.append(th,);
    }
    table.append(head,);

    for (const row of rows) {
      const tr = new XMLElement("tr",);
      for (const value of [row.name, row.detail, formatNumber(row.amount,),]) {
        const td = new XMLElement("td",);
        td.append(value,);
        tr.append(td,);
      }
      table.append(tr,);
    }
    return table;
  }

  // ------------------------------------------------------------------
  // Configuration
  // ------------------------------------------------------------------

  /** Effective column order (`columns` of the report ∩ canonical ones). */
  private columnOrder(): string[] {
    const declared = this.a("columns",) as TableColumnDefinition[] | null;
    const ids = (declared ?? [])
      .map((column,) => String(column.id,))
      .filter((id,) => Object.hasOwn(COLUMN_TITLES, id,));
    return ids.length > 0 ? ids : [...DEFAULT_COLUMN_ORDER,];
  }

  /** Does `journalattributes` contain `name`? (`*` means all of them). */
  private hasJournalAttribute(name: string,): boolean {
    if (!JOURNAL_ATTRIBUTES.has(name,)) return false;
    const declared = this.a("journalAttributes",) as string[] | null;
    if (!declared || declared.includes("*",)) return true;
    return declared.includes(name,);
  }

  /** Image limit per block (`maxpictures`); `null` means unlimited. */
  private maxPictures(): number | null {
    const declared = this.a("maxpictures",) as number | null;
    return declared && declared > 0 ? declared : null;
  }

  /** Period of the report (defaults to the project period). */
  private periodRange(): [TjTime | null, TjTime | null,] {
    const start = (this.a("start",) ?? this.project.get("start",)) as
      | TjTime
      | undefined;
    const end = (this.a("end",) ?? this.project.get("end",)) as
      | TjTime
      | undefined;
    return [start ?? null, end ?? null,];
  }

  /** Period serialized as `YYYY-MM-DD` for the JSON output. */
  private periodJson(): { start: string | null; end: string | null } {
    const [start, end,] = this.periodRange();
    return {
      start: start ? start.to_s(DATE_FORMAT,) : null,
      end: end ? end.to_s(DATE_FORMAT,) : null,
    };
  }

  /** Converts a date interval into scheduling slot indices. */
  private idxRange(
    start: TjTime | null,
    end: TjTime | null,
  ): [number, number,] {
    if (!start || !end) return [0, 0,];
    return [
      this.project.dateToIdx(start,),
      this.project.dateToIdx(end,),
    ];
  }

  /** Reported scenarios (defaults to scenario 0). */
  private scenarioIdxList(): number[] {
    const scenarios = this.a("scenarios",) as number[] | null;
    return scenarios && scenarios.length > 0 ? scenarios : [0,];
  }

  /** Type guard: is the property a `Task`? */
  private isTask(property: PropertyTreeNode,): boolean {
    return typeof (property as unknown as Task).container === "function" &&
      typeof (property as unknown as Task).assignedResources === "function";
  }
}

/** Formats a number without unnecessary decimals. */
function formatNumber(value: number,): string {
  return Number.isInteger(value,) ? String(value,) : value.toFixed(2,);
}

/** Sorts rows by id (keeps the outputs deterministic). */
function byId(a: RdoTableRow, b: RdoTableRow,): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Registers the `rdoreport` content in the factory (14.11 / 14C.3.1).
registerContentFactory(
  "rdoreport",
  (report: unknown,): RdoReport => new RdoReport(report as Report,),
);
