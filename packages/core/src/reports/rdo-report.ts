/**
 * RdoReport (Fase 14 Complemento C3) — Relatório Diário de Obra.
 *
 * Extensão SyntaxMesh (sem equivalente no TJ Ruby): gera o RDO a partir de um
 * período selecionado, agrupando as entradas de diário por dia (`groupby date`,
 * default), tarefa, recurso, material ou conta. Cada bloco reúne as entradas do
 * grupo, a galeria de imagens (elementos `picture` + imagens embutidas em
 * `details`) e as tabelas de recursos/materiais/charges.
 *
 * Fontes de dados (todas já portadas):
 * - `Journal#entriesByDate` / `entriesByTask` / `entriesByResource` /
 *   `entriesByMaterial` / `entriesByAccount` (14C.0.4).
 * - `JournalEntry.pictures` + `picturesFromDetails` (14C.3.7).
 * - `project.alertLevels` (14C.0.7) para o nome/cor do nível de alerta.
 * - `assignedResources` + `getAllocatedTime`, `materialallocations` e `charge`
 *   para as tabelas do bloco (mesmas quedas do BreakdownReport, 14C.2.3).
 *
 * Saídas (ADR 027 — string/estrutura em memória, zero disco, zero DOM):
 * - HTML: seções por bloco com cabeçalho, entradas, galeria e tabelas.
 * - JSON: aninhado por `groupby` com o array de imagens de cada entrada.
 *
 * Imagens relativas: o `src` é emitido como descritor relativo por default; um
 * `ImageStore` (Fase 19) injeta a resolução via {@link RdoReport.setImageResolver}
 * (14C.3.12).
 *
 * O tipo é registrado na fábrica de conteúdo sob `rdoreport`
 * (`ReportType.RdoReport`), removendo a âncora `NotYetImplementedError` de
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
import type { XMLElementLike, } from "../richtext/xml-like.ts";
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
import { createBlob, SimpleXMLElement, } from "../richtext/xml-like.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/** Critério de agrupamento dos blocos (`groupby`). */
export type RdoGroupBy = "date" | "task" | "resource" | "material" | "account";

/** Tipo de tabela do bloco (título/coluna correspondente no relatório). */
export type RdoTableKind = "resources" | "materials" | "charges";

/** Imagem serializada de uma entrada (JSON/HTML). */
export interface RdoImage {
  path: string;
  alt: string | null;
  caption: string | null;
  align: PictureAlign | null;
  width: number | null;
}

/** Entrada de diário já resolvida para o RDO. */
export interface RdoEntry {
  date: string;
  headline: string;
  summary: string | null;
  details: string | null;
  author: string | null;
  alert: string | null;
  alertId: string | null;
  alertLevel: number;
  flags: string[];
  entity: string | null;
  format: string;
  pictures: RdoImage[];
}

/** Linha das tabelas de recursos/materiais/charges de um bloco. */
export interface RdoTableRow {
  id: string;
  name: string;
  detail: string;
  amount: number;
}

/** Bloco do RDO: um dia, tarefa, recurso, material ou conta. */
export interface RdoGroup {
  id: string;
  name: string;
  entries: RdoEntry[];
  pictures: Picture[];
  responsible: string | null;
  resources: RdoTableRow[];
  materials: RdoTableRow[];
  charges: RdoTableRow[];
}

/** Títulos das colunas, na ordem canônica do relatório. */
const COLUMN_TITLES: Record<string, string> = {
  name: "Name",
  responsible: "Responsible",
  journal: "Journal",
  pictures: "Pictures",
  resources: "Resources",
  materials: "Materials",
  charges: "Charges",
};

/** Ordem default quando o relatório não declara `columns`. */
const DEFAULT_COLUMN_ORDER = [
  "name",
  "responsible",
  "journal",
  "pictures",
  "resources",
  "materials",
  "charges",
];

/** Atributos de `journalattributes` reconhecidos (14C.3.5). */
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

/** Formato de data usado nos blocos e nas entradas. */
const DATE_FORMAT = "%Y-%m-%d";

/** Tabelas do bloco, na ordem canônica, com o título markdown. */
const RDO_TABLES: [RdoTableKind, string,][] = [
  ["resources", "Resources",],
  ["materials", "Materials",],
  ["charges", "Charges",],
];

export class RdoReport extends ReportBase {
  private groups: RdoGroup[] = [];
  private html: XMLElementLike[] = [];
  private resolveRelative: ((path: string,) => string) | null = null;

  constructor(report: Report,) {
    super(report,);
  }

  /** Critério de agrupamento efetivo (default `date`, como no parser). */
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

  /** Blocos gerados (leitura, para testes e consumidores). */
  getGroups(): RdoGroup[] {
    return this.groups;
  }

  /**
   * Registra o `ImageStore` (Fase 19) que resolve caminhos relativos no HTML
   * (14C.3.12). `null` (default) mantém o caminho relativo como descritor.
   */
  setImageResolver(
    resolve: ((path: string,) => string) | null,
  ): void {
    this.resolveRelative = resolve;
  }

  /** Monta os blocos e o HTML. As demais saídas derivam da mesma estrutura. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
    this.groups = this.buildGroups();
    this.buildHtml();
  }

  /** HTML completo do RDO (um elemento por bloco, dentro de `<section>`). */
  to_html(): XMLElementLike[] {
    return this.html;
  }

  /** JSON aninhado por `groupby` (14C.0.1 / 14C.3.11). */
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
   * Documento Markdown (extensão SyntaxMesh — adendo §10).
   *
   * Cada bloco vira `## <bloco>`; cada entrada de diário vira `### <manchete>`
   * com um par de metadados em itálico, o texto e as imagens como `![alt](src)`.
   * As tabelas de recursos/materiais/charges do bloco saem em pipes. Markdown
   * puro: nenhuma tag HTML é emitida.
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

  /** Uma entrada de diário em markdown (manchete, metadados, texto, imagens). */
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
  // Construção dos blocos
  // ------------------------------------------------------------------

  /** Despacha para o construtor do `groupby` corrente. */
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

  /** Um bloco por dia com entradas (dias vazios não geram bloco). */
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

  /** Um bloco por tarefa; `status_up` restringe às tarefas de topo. */
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

  /** Um bloco por recurso (`hideresource` aplicado). */
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
      (resource,) =>
        this.project.journal.entriesFor(resource,),
    );
  }

  /** Um bloco por material (`hideMaterial`/`rollupMaterial` — 14C.6.6/6.9). */
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
      (material,) =>
        this.project.journal.entriesFor(material,),
    );
  }

  /** Um bloco por conta (`hideaccount`/`rollupaccount` aplicados). */
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
   * Constrói um bloco por entidade, usando o índice do journal (14C.0.4) para
   * achar as entradas da entidade e intersectando com as entradas permitidas
   * pelo período + `journalmode`. Entidades sem entradas não geram bloco.
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

  /** Monta o bloco completo (entradas, galeria, tabelas, responsável). */
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
   * Tarefas do bloco: a própria tarefa no `groupby task`, as tarefas das
   * entradas no `groupby date` e nenhuma nos demais (tabelas vazias).
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
  // Entradas do período e modos de journal
  // ------------------------------------------------------------------

  /** Entradas do período do relatório, já sem as ocultas pelo `hideJournalEntry`. */
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
   * Aplica o `journalmode` (14C.3.4). Modos `status_*`/`alerts_*` selecionam a
   * entrada corrente por tarefa (como o `Journal#to_rti` do Ruby); entradas de
   * recursos/materiais/contas são preservadas (extensão SyntaxMesh — o Ruby só
   * percorre tarefas nesses modos).
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
   * Entradas correntes por tarefa de topo: a mais recente da própria tarefa
   * ou, quando `deep`, a mais recente de toda a subárvore.
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

  /** Como {@link currentByTask}, mantendo só o maior nível de alerta do bloco. */
  private alertByTask(entries: JournalEntry[],): JournalEntry[] {
    const current = this.currentByTask(entries, true,);
    const maxLevel = current.reduce(
      (max, entry,) => Math.max(max, entry.alertLevel,),
      0,
    );
    return current.filter((entry,) => entry.alertLevel === maxLevel);
  }

  /** Tarefas de topo presentes nas entradas. */
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
   * Entrada corrente de uma tarefa: a mais recente da própria tarefa vence as
   * dos filhos; `deep` desce por toda a subárvore, senão só os filhos diretos.
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

  /** Nível de alerta pelo id (`green`/`yellow`/`red`); `null` se desconhecido. */
  private alertLevelIndex(id: string,): number | null {
    const levels = this.alertLevels();
    const index = levels.findIndex((level,) => level.id === id);
    return index < 0 ? null : index;
  }

  /** Lista de níveis de alerta do projeto (default verde→vermelho). */
  private alertLevels(): AlertLevelDefinition[] {
    const levels = this.project.get("alertLevels",) as
      | AlertLevelDefinition[]
      | undefined;
    return levels ?? [];
  }

  // ------------------------------------------------------------------
  // Conversão das entradas e das tabelas
  // ------------------------------------------------------------------

  /** Converte uma `JournalEntry` no registro serializável do RDO. */
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
   * Imagens declaradas (`picture`) seguidas das embutidas em `details`.
   *
   * `hidepicture` (14C.6.7) é avaliado na **propriedade dona** da entrada: uma
   * entrada cujo dono casa não contribui imagens — nem na lista da entrada nem
   * na galeria do bloco (portanto também não conta para `maxpictures`).
   */
  private picturesOf(entry: JournalEntry,): Picture[] {
    const property = entry.property as PropertyTreeNode | null;
    if (property && this.hiddenBy("hidePicture", property,)) return [];
    return [...entry.pictures, ...picturesFromDetails(entry.details,),];
  }

  /** Galeria do bloco: união das entradas, sem repetir o mesmo caminho. */
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

  /** Recursos alocados às tarefas do bloco, com esforço no intervalo. */
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

  /** Materiais alocados às tarefas do bloco (quantidade × preço efetivo). */
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

  /** Charges declaradas nas tarefas do bloco. */
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
   * Responsável do bloco: o primeiro recurso de `responsible` (lista de
   * recursos — pode vir resolvida como `Resource` ou como id, conforme o
   * parser tenha resolvido a referência).
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

  /** Constrói as seções do RDO (14C.3.10). */
  private buildHtml(): void {
    const section = new SimpleXMLElement("section", { class: "tj_rdo", },);
    const columns = this.columnOrder();
    for (const group of this.groups) {
      section.append(this.renderGroup(group, columns,),);
    }

    const frame = new SimpleXMLElement("div", { class: "tj_rdo_frame", },);
    const header = this.rt_to_html("header",);
    if (header) frame.append(header,);
    const headline = this.rt_to_html("headline",);
    if (headline) frame.append(headline,);
    frame.append(section,);
    const footer = this.rt_to_html("footer",);
    if (footer) frame.append(footer,);

    this.html = [frame,];
  }

  /** Renderiza um bloco: cabeçalho, entradas, galeria e tabelas. */
  private renderGroup(group: RdoGroup, columns: string[],): XMLElementLike {
    const block = new SimpleXMLElement("article", {
      class: "tj_rdo_block",
      "data-group": group.id,
    },);

    const header = new SimpleXMLElement("header",);
    const title = new SimpleXMLElement("h3",);
    title.append(columns.includes("name",) ? group.name : group.id,);
    header.append(title,);
    if (columns.includes("responsible",) && group.responsible) {
      const responsible = new SimpleXMLElement("div", {
        class: "tj_rdo_responsible",
      },);
      responsible.append(group.responsible,);
      header.append(responsible,);
    }
    block.append(header,);

    if (columns.includes("journal",)) {
      const journal = new SimpleXMLElement("div", {
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
      block.append(createBlob(gallery,),);
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

  /** Renderiza uma entrada respeitando `journalattributes` (14C.3.5). */
  private renderEntry(entry: RdoEntry,): XMLElementLike {
    const div = new SimpleXMLElement("div", { class: "tj_rdo_entry", },);

    if (this.hasJournalAttribute("date",)) {
      const date = new SimpleXMLElement("div", { class: "tj_rdo_date", },);
      date.append(entry.date,);
      div.append(date,);
    }
    if (this.hasJournalAttribute("headline",)) {
      const headline = new SimpleXMLElement("h4", {
        class: "tj_rdo_headline",
      },);
      headline.append(entry.headline,);
      div.append(headline,);
    }
    if (this.hasJournalAttribute("alert",) && entry.alert) {
      const alert = new SimpleXMLElement("div", {
        class: `tj_rdo_alert tj_alert_${entry.alertId ?? "none"}`,
      },);
      alert.append(entry.alert,);
      div.append(alert,);
    }
    if (this.hasJournalAttribute("author",) && entry.author) {
      const author = new SimpleXMLElement("div", { class: "tj_rdo_author", },);
      author.append(entry.author,);
      div.append(author,);
    }
    if (this.hasJournalAttribute("flags",) && entry.flags.length > 0) {
      const flags = new SimpleXMLElement("div", { class: "tj_rdo_flags", },);
      flags.append(entry.flags.join(", ",),);
      div.append(flags,);
    }
    if (this.hasJournalAttribute("property",) && entry.entity) {
      const property = new SimpleXMLElement("div", {
        class: "tj_rdo_property",
      },);
      property.append(entry.entity,);
      div.append(property,);
    }
    if (this.hasJournalAttribute("summary",) && entry.summary) {
      const summary = new SimpleXMLElement("div", {
        class: "tj_rdo_summary",
      },);
      summary.append(entry.summary,);
      div.append(summary,);
    }
    if (this.hasJournalAttribute("details",) && entry.details) {
      const details = new SimpleXMLElement("div", {
        class: "tj_rdo_details",
      },);
      details.append(entry.details,);
      div.append(details,);
    }

    return div;
  }

  /** Renderiza uma tabela de linhas (`resources`/`materials`/`charges`). */
  private renderTable(
    kind: RdoTableKind,
    rows: RdoTableRow[],
  ): XMLElementLike {
    const table = new SimpleXMLElement("table", {
      class: `tj_rdo_table tj_rdo_${kind}`,
    },);

    const head = new SimpleXMLElement("tr",);
    for (const title of ["Name", "Detail", "Amount",]) {
      const th = new SimpleXMLElement("th",);
      th.append(title,);
      head.append(th,);
    }
    table.append(head,);

    for (const row of rows) {
      const tr = new SimpleXMLElement("tr",);
      for (const value of [row.name, row.detail, formatNumber(row.amount,),]) {
        const td = new SimpleXMLElement("td",);
        td.append(value,);
        tr.append(td,);
      }
      table.append(tr,);
    }
    return table;
  }

  // ------------------------------------------------------------------
  // Configuração
  // ------------------------------------------------------------------

  /** Ordem efetiva das colunas (`columns` do relatório ∩ canônicas). */
  private columnOrder(): string[] {
    const declared = this.a("columns",) as TableColumnDefinition[] | null;
    const ids = (declared ?? [])
      .map((column,) => String(column.id,))
      .filter((id,) => Object.hasOwn(COLUMN_TITLES, id,));
    return ids.length > 0 ? ids : [...DEFAULT_COLUMN_ORDER,];
  }

  /** `journalattributes` contém `name`? (`*` = todos). */
  private hasJournalAttribute(name: string,): boolean {
    if (!JOURNAL_ATTRIBUTES.has(name,)) return false;
    const declared = this.a("journalAttributes",) as string[] | null;
    if (!declared || declared.includes("*",)) return true;
    return declared.includes(name,);
  }

  /** Limite de imagens por bloco (`maxpictures`); `null` = ilimitado. */
  private maxPictures(): number | null {
    const declared = this.a("maxpictures",) as number | null;
    return declared && declared > 0 ? declared : null;
  }

  /** Período do relatório (default: período do projeto). */
  private periodRange(): [TjTime | null, TjTime | null,] {
    const start = (this.a("start",) ?? this.project.get("start",)) as
      | TjTime
      | undefined;
    const end = (this.a("end",) ?? this.project.get("end",)) as
      | TjTime
      | undefined;
    return [start ?? null, end ?? null,];
  }

  /** Período serializado (`YYYY-MM-DD`) para o JSON. */
  private periodJson(): { start: string | null; end: string | null } {
    const [start, end,] = this.periodRange();
    return {
      start: start ? start.to_s(DATE_FORMAT,) : null,
      end: end ? end.to_s(DATE_FORMAT,) : null,
    };
  }

  /** Converte um intervalo de datas em índices de slot. */
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

  /** Cenários reportados (default: cenário 0). */
  private scenarioIdxList(): number[] {
    const scenarios = this.a("scenarios",) as number[] | null;
    return scenarios && scenarios.length > 0 ? scenarios : [0,];
  }

  /** Guard de tipo: a propriedade é uma `Task`? */
  private isTask(property: PropertyTreeNode,): boolean {
    return typeof (property as unknown as Task).container === "function" &&
      typeof (property as unknown as Task).assignedResources === "function";
  }
}

/** Formata um número sem casas decimais desnecessárias. */
function formatNumber(value: number,): string {
  return Number.isInteger(value,) ? String(value,) : value.toFixed(2,);
}

/** Ordena linhas por id (determinismo das saídas). */
function byId(a: RdoTableRow, b: RdoTableRow,): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

// Registra o conteúdo de `rdoreport` na fábrica (14.11 / 14C.3.1).
registerContentFactory(
  "rdoreport",
  (report: unknown,): RdoReport => new RdoReport(report as Report,),
);
