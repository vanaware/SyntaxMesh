/**
 * Journal e JournalEntry (porta mínima para o parser — Fase 10).
 *
 * Port parcial de `docs/taskjuggler/lib/taskjuggler/Journal.rb`. A
 * renderização de relatórios (`to_rText`, query handlers) foi entregue na
 * Fase 14; aqui ficam os dados que o parser preenche mais os índices por
 * entidade.
 *
 * Índice do Journal (bring-forward 14C.0 — dona: Fase 16, adendo 16.21):
 * a **Fase 16 herda e estende** estes índices com hooks de flags/status de
 * timesheet e remoção em cascata quando a entidade é destruída. Os blocos
 * Breakdown/RDO da Fase 14 Complemento consomem `entriesBy*`/`entriesByDate`.
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
import type { RichTextIntermediate, } from "../richtext/rich-text-intermediate.ts";
import { NotYetImplementedError, } from "./errors.ts";
import type { Project, } from "./project.ts";

/** Formato do corpo de uma entrada (`markdown` é o default). */
export type EntryFormat = "markdown" | "richtext";

/**
 * Campos de `Query` consumidos pela renderização do journal (subconjunto de
 * `Query`, para o modelo não depender da camada de queries).
 *
 * @see docs/taskjuggler/lib/taskjuggler/Journal.rb:to_rti
 */
export interface JournalQueryLike {
  project?: Project | null;
  property?: PropertyTreeNode | null;
  start?: TjTime | null;
  end?: TjTime | null;
  timeFormat?: string | null;
  selfContained?: boolean;
  journalMode?: string | null;
  journalAttributes?: string[] | null;
  sortJournalEntries?: unknown;
  hideJournalEntry?: unknown;
  rti?: unknown;
}

/** A `query.journalAttributes` contém `name`? (`*` = todos os atributos). */
function hasJournalAttribute(
  query: JournalQueryLike,
  name: string,
): boolean {
  const attrs = query.journalAttributes ?? ["*",];
  return attrs.includes("*",) || attrs.includes(name,);
}

/** Nível de alerta da entrada como registro `{id, name, color}`. */
function alertLevelOf(
  query: JournalQueryLike,
  level: number,
): { id: string; name: string; color: string } | null {
  const levels = query.project?.get("alertLevels",) as
    | Array<{ id: string; name: string; color: string }>
    | undefined;
  return levels?.[level] ?? null;
}

/** Expressão lógica de ocultação da entrada (`Journal#hidden`, l.738). */
function hidden(entry: JournalEntry, logExp: unknown,): boolean {
  if (logExp === null || logExp === undefined) return false;
  const exp = logExp as { eval?: (e: JournalEntry,) => unknown };
  return typeof exp.eval === "function" ? !!exp.eval(entry,) : false;
}

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
  // Fase 10 Complemento C3.3.5 — imagens e formato da entrada.
  pictures: Picture[] = [];
  format: EntryFormat = "markdown";

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
   * Converte a entrada em markup RichText (porta `JournalEntry#to_rText`).
   * O conteúdo é montado em markup MediaWiki e reconvertido a RTI por
   * {@link Journal.to_rti}. Timesheet fica com a Fase 18.
   */
  to_rText(query: JournalQueryLike,): string {
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
        // Extensão SyntaxMesh (14C.1.7): material e conta identificam-se pelo
        // nome, como as tarefas.
        rText += `${hlMark} ${alertName} <nowiki>${prop.name}</nowiki>`;
        if (hasJournalAttribute(query, "propertyid",)) {
          rText += ` (ID: ${prop.fullId})`;
        }
        rText += ` ${hlMark}\n\n`;
      }
      // O alerta já apareceu; não repetir no headline.
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
    if (hasJournalAttribute(query, "summary",) && this.summary) {
      rText += this.summary + "\n\n";
    }
    if (hasJournalAttribute(query, "details",) && this.details) {
      rText += this.details + "\n\n";
    }
    return rText;
  }
}

/** Chaves do índice por entidade (bring-forward 14C.0.4). */
type IndexedEntity = Task | Resource | Material | Account;

/** Comparador de data ascendente (ordenação estável dos baldes do índice). */
function byDate(a: JournalEntry, b: JournalEntry,): number {
  return a.date.compareTo(b.date,);
}

export class Journal {
  readonly entries: JournalEntry[] = [];

  /** Índices por entidade, ordenados por data (14C.0.4 — Fase 16 estende). */
  readonly entriesByTask = new Map<Task, JournalEntry[]>();
  readonly entriesByResource = new Map<Resource, JournalEntry[]>();
  readonly entriesByMaterial = new Map<Material, JournalEntry[]>();
  readonly entriesByAccount = new Map<Account, JournalEntry[]>();

  /**
   * Insere a entrada na lista e no índice da entidade correspondente
   * (equivalente ao `Journal#<<` do Ruby mais o índice — entradas com
   * `property` null ficam só em `entries`).
   */
  addEntry(entry: JournalEntry,): void {
    this.entries.push(entry,);
    const prop = entry.property;
    if (!prop) return;
    const bucket = this.indexFor(prop,);
    if (!bucket) return;
    let list = bucket.get(prop as IndexedEntity,);
    if (!list) {
      list = [];
      bucket.set(prop as IndexedEntity, list,);
    }
    // Inserção ordenada por data (estável: empata = ordem de chegada).
    const at = lowerBound(list, entry,);
    list.splice(at, 0, entry,);
  }

  /** Remove uma entrada (espelho do `Journal#delete` do Ruby). */
  removeEntry(entry: JournalEntry,): void {
    const i = this.entries.indexOf(entry,);
    if (i >= 0) this.entries.splice(i, 1,);
    const prop = entry.property as IndexedEntity | null;
    if (!prop) return;
    for (
      const bucket of [
        this.entriesByTask,
        this.entriesByResource,
        this.entriesByMaterial,
        this.entriesByAccount,
      ] as Map<PropertyTreeNode, JournalEntry[]>[]
    ) {
      const list = bucket.get(prop,);
      if (!list) continue;
      const j = list.indexOf(entry,);
      if (j >= 0) list.splice(j, 1,);
      if (list.length === 0) bucket.delete(prop,);
    }
  }

  /**
   * Remove entradas que satisfazem `pred` (Ruby `Journal#delete_if`).
   * A remoção passa por `removeEntry` para manter os índices coerentes
   * (não vazam entradas de entidades removidas — 14C.0.5).
   */
  deleteIf(pred: (e: JournalEntry,) => boolean,): void {
    for (let i = this.entries.length - 1; i >= 0; i--) {
      const entry = this.entries[i]!;
      if (pred(entry,)) this.removeEntry(entry,);
    }
  }

  /** Entradas da propriedade (ou globais quando `property` é null). */
  entriesFor(property: PropertyTreeNode | null,): JournalEntry[] {
    return this.entries.filter((e,) => e.property === property);
  }

  /** Entradas no intervalo de datas (inclusive), ordenadas por data. */
  entriesByDate(start: TjTime, end: TjTime,): JournalEntry[] {
    return this.entries.filter((e,) =>
      e.date.compareTo(start,) >= 0 && e.date.compareTo(end,) <= 0
    ).slice().sort(byDate,);
  }

  /** Índice correspondente ao tipo da entidade; `null` se não indexável. */
  private indexFor(
    prop: PropertyTreeNode,
  ): Map<IndexedEntity, JournalEntry[]> | null {
    if (prop instanceof Task) return this.entriesByTask;
    if (prop instanceof Resource) return this.entriesByResource;
    if (prop instanceof Material) return this.entriesByMaterial;
    if (prop instanceof Account) return this.entriesByAccount;
    return null;
  }

  get empty(): boolean {
    return this.entries.length === 0;
  }

  // ------------------------------------------------------------------
  // Renderização para relatórios (14C.1.7)
  // ------------------------------------------------------------------

  /**
   * Monta o RTI do journal de uma propriedade (porta `Journal#to_rti`).
   *
   * Modos suportados: `journal`, `journal_sub` (entidade + descendentes),
   * `journalmessages` e `journalsummaries` (última entrada corrente). Os
   * modos `status_*`/`alerts_*` dependem do scheduling completo e ficam com a
   * Fase 16. O resultado é gravado em `query.rti`.
   */
  to_rti(query: JournalQueryLike,): void {
    const mode = query.journalMode ?? "journal";
    const property = query.property ?? null;
    const start = query.start ?? null;
    const end = query.end ?? null;
    let entries: JournalEntry[];

    switch (mode) {
      case "journal":
        entries = property
          ? this.propertyEntries(property, start, end, query.hideJournalEntry,)
          : this.rangeEntries(start, end, query.hideJournalEntry,);
        break;
      case "journal_sub":
        entries = property
          ? this.propertyEntries(
            property,
            start,
            end,
            query.hideJournalEntry,
            true,
          )
          : [];
        break;
      case "journalmessages":
      case "journalsummaries":
        entries = property
          ? this.currentEntries(
            end,
            property,
            0,
            start,
            query.hideJournalEntry,
          )
          : [];
        break;
      case "status_up":
      case "status_down":
      case "status_dep":
      case "alerts_down":
      case "alerts_dep":
        // Ancorado: Fase 16 — modos de status/alerta dependem do scheduling.
        throw new NotYetImplementedError("16", `Journal#to_rti(${mode})`,);
      default:
        throw new Error(`Unknown journal mode: ${mode}`,);
    }

    entries = this.sortEntries(entries, query.sortJournalEntries,);
    const markup = entries.map((e,) => e.to_rText(query,)).join("",);
    const rti = new RichText(
      markup,
      RTFHandlers.create(query.project ?? null,),
    ).generateIntermediateFormat();
    if (!rti) return;
    rti.sectionNumbers = false;
    rti.cssClass = "tj_journal";
    query.rti = rti;
  }

  /**
   * RTI de mensagens de journal (porta `PropertyTreeNode#journalMessages`).
   * `longVersion` inclui os detalhes além do resumo.
   */
  messagesRti(
    entries: JournalEntry[],
    query: JournalQueryLike,
    longVersion: boolean,
  ): RichTextIntermediate | null {
    let markup = "";
    for (const entry of entries) {
      markup += `==== <nowiki>${entry.headline}</nowiki> ====\n`;
      markup += `''Reported on ${
        entry.date.to_s(query.timeFormat ?? undefined,)
      }'' `;
      if (entry.author) {
        const author = entry.author as { name?: string };
        markup += `''by <nowiki>${author.name ?? ""}</nowiki>''`;
      }
      markup += "\n\n";
      if (entry.flags.length > 0) {
        markup += `''Flags:'' ${entry.flags.join(", ",)}\n\n`;
      }
      if (entry.summary) markup += entry.summary + "\n\n";
      if (longVersion && entry.details) markup += entry.details + "\n\n";
    }
    const rti = new RichText(
      markup,
      RTFHandlers.create(query.project ?? null,),
    ).generateIntermediateFormat();
    if (!rti) return null;
    rti.sectionNumbers = false;
    rti.cssClass = "tj_journal";
    return rti;
  }

  /**
   * Entradas no intervalo (Ruby `Journal#entries`): sem propriedade, o
   * journal inteiro; com propriedade, ela e os descendentes.
   */
  rangeEntries(
    start: TjTime | null,
    end: TjTime | null,
    logExp: unknown,
    property: PropertyTreeNode | null = null,
  ): JournalEntry[] {
    return this.entries.filter((e,) => {
      if (start && e.date.compareTo(start,) < 0) return false;
      if (end && e.date.compareTo(end,) > 0) return false;
      if (property && e.property !== property) return false;
      return !hidden(e, logExp,);
    },);
  }

  /**
   * Entradas de `property` no intervalo `[start, end)` (Ruby
   * `entriesByTask`/`entriesByResource`, estendido a material e conta em
   * 14C.1.7). Com `recursive`, inclui os descendentes (`entriesByTaskR`).
   */
  propertyEntries(
    property: PropertyTreeNode,
    start: TjTime | null,
    end: TjTime | null,
    logExp: unknown,
    recursive = false,
  ): JournalEntry[] {
    const out: JournalEntry[] = [];
    const visit = (p: PropertyTreeNode,): void => {
      for (const e of this.entries) {
        if (e.property !== p || e.headline === "") continue;
        if (start && e.date.compareTo(start,) < 0) continue;
        if (end && e.date.compareTo(end,) >= 0) continue;
        if (hidden(e, logExp,)) continue;
        out.push(e,);
      }
      if (recursive) { for (const kid of p.kids()) visit(kid,); }
    };
    visit(property,);
    return out;
  }

  /**
   * Entradas mais recentes de `property` até `date` (inclusive), todas as que
   * compartilham a mesma data (Ruby `JournalEntryList#last`).
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
   * Entradas correntes de `property` (Ruby `Journal#currentEntries`): última
   * entrada até `date`, ignorada quando algum ancestral tem entrada mais
   * recente.
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
   * Ordena as entradas segundo `query.sortJournalEntries`
   * (`[atributo, direção]`, atributos `date`/`alert`/`seqno`).
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

/** Primeiro índice onde `entry` poderia ser inserido (data ≥). */
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
