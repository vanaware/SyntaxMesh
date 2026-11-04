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
import {
  JournalEntryList,
  type JournalSorting,
} from "./journal-entry-list.ts";
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
  scenarioIdx?: number | undefined;
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

/**
 * `property.ptn` do Ruby: para um `PTNProxy` devolve o nó real; para o próprio
 * `PropertyTreeNode` devolve ele mesmo (Ruby `PropertyTreeNode#ptn`→`self`).
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

/** Acrescenta entradas já calculadas (arrays) a uma `JournalEntryList`. */
function addAll(target: JournalEntryList, entries: JournalEntry[],): void {
  for (const entry of entries) target.push(entry,);
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

  /**
   * Entrada de journal é objeto de identidade: pertence à `entryList` e
   * referencia o `Journal` (que por sua vez lista todas as entradas). Copiar
   * duplicaria a entrada e arrastaria o grafo inteiro, então `deepClone`
   * devolve `this` (16.13.3).
   */
  deepClone(): this {
    return this;
  }
}

/** Chaves do índice por entidade (bring-forward 14C.0.4). */
type IndexedEntity = Task | Resource | Material | Account;

/** Comparador de data ascendente (ordenação estável dos baldes do índice). */
function byDate(a: JournalEntry, b: JournalEntry,): number {
  return a.date.compareTo(b.date,);
}

export class Journal {
  /** Lista canônica de todas as entradas (Ruby `@entries`). */
  readonly entryList = new JournalEntryList();

  /** Entradas por propriedade (Ruby `@propertyToEntries`), ordem de chegada. */
  private readonly propertyToEntries = new Map<
    PropertyTreeNode,
    JournalEntryList
  >();

  /**
   * Índices por entidade, ordenados por data (14C.0.4 — consumidos por
   * `rdo-report`). A API pública de consulta é `entriesBy*()`.
   */
  readonly indexByTask = new Map<Task, JournalEntry[]>();
  readonly indexByResource = new Map<Resource, JournalEntry[]>();
  readonly indexByMaterial = new Map<Material, JournalEntry[]>();
  readonly indexByAccount = new Map<Account, JournalEntry[]>();

  /**
   * Visão em array de todas as entradas (ordem de chegada).
   *
   * No Ruby `@entries` é uma `JournalEntryList`; aqui a lista é
   * {@link entryList} e este getter mantém a leitura simples usada pelos
   * relatórios (`journal.entries.length`, spread).
   */
  get entries(): JournalEntry[] {
    return this.entryList.unsorted();
  }

  /**
   * Insere a entrada na lista e no índice da entidade correspondente
   * (equivalente ao `Journal#addEntry` do Ruby; entradas com `property` null
   * ficam só na lista principal).
   */
  addEntry(entry: JournalEntry,): void {
    if (this.entryList.include(entry,)) return;
    this.entryList.push(entry,);
    const prop = entry.property;
    if (!prop) return;

    // Ruby: usa a PropertyTreeNode "real" (`entry.property.ptn`), nunca o
    // proxy do cenário.
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
    // Inserção ordenada por data (estável: empata = ordem de chegada).
    sorted.splice(lowerBound(sorted, entry,), 0, entry,);
  }

  /** Remove uma entrada (espelho do `Journal#delete` do Ruby). */
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
   * Remove entradas que satisfazem `pred` (Ruby `Journal#delete_if`).
   * A remoção passa por `removeEntry` para manter os índices coerentes
   * (não vazam entradas de entidades removidas — 14C.0.5).
   */
  deleteIf(pred: (e: JournalEntry,) => boolean,): void {
    for (const entry of this.entryList.toArray().reverse()) {
      if (pred(entry,)) this.removeEntry(entry,);
    }
  }

  /**
   * Entradas da propriedade (Ruby `getEntries`), na ordem de chegada;
   * `null` quando a propriedade não tem nenhuma.
   */
  getEntries(property: PropertyTreeNode,): JournalEntryList | null {
    return this.propertyToEntries.get(property,) ?? null;
  }

  /**
   * Entradas da propriedade (ou globais quando `property` é null).
   *
   * Para entidades indexáveis devolve o índice ordenado por data (14C.0.4);
   * caso contrário, varre a lista canônica preservando a ordem de chegada.
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
    if (prop instanceof Task) return this.indexByTask;
    if (prop instanceof Resource) return this.indexByResource;
    if (prop instanceof Material) return this.indexByMaterial;
    if (prop instanceof Account) return this.indexByAccount;
    return null;
  }

  get empty(): boolean {
    return this.entryList.empty();
  }

  // ------------------------------------------------------------------
  // Renderização para relatórios (14C.1.7)
  // ------------------------------------------------------------------

  /**
   * Monta o RTI do journal de uma propriedade (porta `Journal#to_rti`,
   * `Journal.rb` l.404-497).
   *
   * Modos (Ruby): `journal`, `journal_sub`, `status_up`, `status_down`,
   * `status_dep`, `alerts_down`, `alerts_dep`; mais os dois modos de coluna
   * do port (`journalmessages`/`journalsummaries`, 14C.1.7), que renderizam
   * só as entradas correntes. O resultado é gravado em `query.rti`.
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
        // Entradas datadas no intervalo; com propriedade, só as dela.
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
            // Extensão 16.21.5: material e conta entram como folha.
            entries.add(this.entriesByLeaf(property, start, end, logExp,),);
          }
        } else {
          entries.add(this.rangeEntries(start, end, logExp,),);
        }
        break;
      case "journal_sub":
        // Propriedade + descendentes. O Ruby só trata `Task` aqui; o port
        // estende a recursão a recurso/conta (14C.1.7) — material, por ser
        // folha, cai no mesmo caminho e devolve só as próprias entradas
        // (equivale a `journal`).
        if (property) {
          entries.add(this.entriesByTaskR(property, start, end, logExp,),);
        }
        break;
      case "status_up":
        // Últimas entradas antes de `end` de cada task, sem descendentes.
        for (const task of this.rootProperties(property, query, Task,)) {
          addAll(entries, this.currentEntries(end, task, 0, start, logExp,),);
          entries.uniq();
        }
        break;
      case "status_down":
      case "status_dep":
        // Últimas entradas antes de `end` incluindo sub-tasks (e dependências).
        for (const task of this.rootProperties(property, query, Task,)) {
          addAll(entries, this.currentEntriesR(end, task, 0, start, query,),);
          entries.uniq();
        }
        break;
      case "alerts_down":
      case "alerts_dep":
        // Idem, mas só as de maior nível de alerta.
        for (const task of this.rootProperties(property, query, Task,)) {
          addAll(entries, this.alertEntries(end, task, 1, start, query,),);
          entries.uniq();
        }
        break;
      case "journalmessages":
      case "journalsummaries":
        // Extensão do port (14C.1.7): entradas correntes da propriedade.
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

    // Ordena segundo o usuário (default date/alert/seqno).
    const sorting = query.sortJournalEntries;
    if (Array.isArray(sorting,) && sorting.length > 0) {
      entries.setSorting(sorting as JournalSorting,);
    }
    entries.sort();

    let markup = "";
    for (const entry of entries) markup += entry.to_rText(query,);

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
   * Propriedades-raiz do modo: a própria (se der) ou as tasks top-level do
   * projeto (Ruby: `query.project.tasks` pulando as que têm `parent`).
   */
  private rootProperties(
    property: PropertyTreeNode | null,
    query: JournalQueryLike,
    kind: typeof Task,
  ): PropertyTreeNode[] {
    if (property) return property instanceof kind ? [property,] : [];
    const project = query.project ?? null;
    if (!project) return [];
    return (project.tasks.toArray() as unknown as PropertyTreeNode[])
      .filter((t,) => t instanceof kind && t.parent === null);
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
   * Entradas de uma task no intervalo `[start, end)` (Ruby `entriesByTask`,
   * l.529-543). Entradas sem headline vazio são descartadas — o Ruby também
   * descarta (`!entry.headline.empty?`).
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

  /** Task + sub-tasks (Ruby `entriesByTaskR`, l.550-561). */
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
   * Entradas de um recurso como **autor** (Ruby `entriesByResource`,
   * l.504-522). Atenção às bordas: `startDate` é exclusivo e `endDate`
   * inclusivo (diferente de `entriesByTask`).
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

  /** Entradas de um material (extensão 16.21.2; bordas como `entriesByTask`). */
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

  /** Entradas de uma conta (extensão 16.21.3; bordas como `entriesByTask`). */
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
   * Entradas de uma propriedade folha sem sub-journal (material/conta).
   * Reaproveita a semântica de `entriesByTask` (start inclusivo).
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
   * Entradas no intervalo (Ruby `Journal#entries`, l.563-577): sem
   * propriedade, o journal inteiro; com propriedade, ela e descendentes.
   *
   * Divergência de nome apenas: o Ruby chama este método de `entries`, mas
   * aqui `entries` é a visão de leitura da lista canônica.
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
   * Entradas de `property` no intervalo `[start, end)` (implementação
   * anterior, mantida para quem já a chamava; delega a `entriesByTask`).
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
   * Versão recursiva de `currentEntries` (Ruby `Journal#currentEntriesR`,
   * l.657-734): percorre a árvore de propriedade de baixo para cima, e
   * (mode `status_dep`/`alerts_dep`) as dependências end->start de Tasks,
   * retornando as últimas entradas até `date` de cada propriedade, a menos
   * que um filho/dependência tenha entrada mais recente ou de nível maior.
   * O `DataCache` do Ruby é otimização e fica omitido (não altera resultado).
   */
  currentEntriesR(
    date: TjTime | null,
    property: PropertyTreeNode,
    minLevel: number,
    minDate: TjTime | null,
    query: JournalQueryLike,
  ): JournalEntry[] {
    if (!date) return [];
    // Entradas correntes desta propriedade (o filtro usa `==` minLevel, fiel
    // ao Ruby l.665-668 — distinto de `currentEntries`).
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
    // Se há entrada desta propriedade, só interessam entradas de filhos
    // posteriores (`date + 1` = +86400s, fiel ao Ruby l.681).
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

    // Somente Tasks têm dependências (Ruby l.695-712).
    const mode = query.journalMode;
    if (
      (mode === "status_dep" || mode === "alerts_dep") &&
      property instanceof Task
    ) {
      const scIdx = query.scenarioIdx ?? 0;
      for (
        const [depTask, onEnd,] of property.scenarioData(scIdx,).startpreds()
      ) {
        // Só seguimos dependências end->start.
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
   * Nível de alerta efetivo de `property` em `date` (Ruby `Journal#alertLevel`,
   * l.584-592): máximo nível entre as entradas correntes recursivas.
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
   * Entradas de alerta de `property` (Ruby `Journal#alertEntries`, l.598-612):
   * apenas as de maior nível global entre as entradas correntes recursivas.
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
