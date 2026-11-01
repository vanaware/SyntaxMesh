/**
 * BreakdownReport (Fase 14 Complemento C2) — decomposição de custos.
 *
 * Extensão SyntaxMesh (sem equivalente no TJ Ruby): lista, de forma unificada,
 * os materiais, recursos e charges que compõem os custos de uma conta
 * (`groupby account`, default) ou de uma tarefa (`groupby task`).
 *
 * Fontes de dados (todas já portadas):
 * - `project.costEvents` (8.2) — eventos `task_charge` / `resource_effort` /
 *   `material_usage` com conta, tarefa, recurso e material atribuídos.
 * - `Task#assignedResources` + `TaskScenario#getAllocatedTime` — esforço por
 *   recurso.
 * - `materialallocations` (8.1) + `Material#unitPrice` — quantidade e preço
 *   unitário quando não há `CostEvent` de material (mesma queda da coluna
 *   `materialcost` do `taskreport`, 14C.1.11).
 * - atributo `charge` da tarefa — valor declarado quando não há `CostEvent`.
 *
 * Saídas (ADR 027 — string/estrutura em memória, zero disco, zero DOM):
 * - HTML: tabela hierárquica (`ReportTable`) grupo → contribuintes.
 * - CSV: linhas planas `[entidade, tipo, esforço/quantidade, custo, total]`.
 * - JSON: aninhado por `groupby` (`groups[].contributors[]`).
 *
 * O tipo é registrado na fábrica de conteúdo sob `breakdownreport`
 * (`ReportType.BreakdownReport`), removendo a âncora `NotYetImplementedError`
 * de 14C.0.10.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.2)
 * @see docs/syntaxmesh/fases/fase-10-complemento1.md §5
 */
import type { Report, } from "../model/report.ts";
import type { Account, } from "../model/account.ts";
import type { Task, } from "../model/task.ts";
import type { Resource, } from "../model/resource.ts";
import type { CostEvent, } from "../model/cost-event.ts";
import type { Material, } from "../model/material.ts";
import type { TableColumnDefinition, } from "./table-column-definition.ts";
import { PropertyList, } from "../model/property-list.ts";
import { ReportBase, } from "./report-base.ts";
import { ReportTable, } from "./report-table.ts";
import { ReportTableColumn, } from "./report-table-column.ts";
import { ReportTableCell, } from "./report-table-cell.ts";
import { ReportTableLine, } from "./report-table-line.ts";
import type { XMLElementLike, } from "../richtext/xml-like.ts";
import type { TjTime, } from "../time/tj-time.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/** Critério de agrupamento (`groupby`). */
export type BreakdownGroupBy = "account" | "task";

/** Tipo do contribuinte de um grupo. */
export type BreakdownContributorKind = "resource" | "material" | "charge";

/**
 * Contribuinte de um grupo: um recurso, um material ou uma charge.
 * `quantity` é esforço (dias) para recursos, quantidade para materiais e
 * número de eventos para charges; `unit` acompanha o material.
 */
export interface BreakdownContributor {
  kind: BreakdownContributorKind;
  id: string;
  name: string;
  quantity: number;
  unit: string;
  cost: number;
  mode: string;
}

/** Totais por tipo de contribuinte (e o total do grupo). */
export interface BreakdownTotals {
  resources: number;
  materials: number;
  charges: number;
  total: number;
}

/** Grupo do breakdown: uma conta ou uma tarefa, com seus contribuintes. */
export interface BreakdownGroup {
  id: string;
  name: string;
  contributors: BreakdownContributor[];
  totals: BreakdownTotals;
}

/** Títulos das colunas HTML, na ordem canônica do relatório. */
const COLUMN_TITLES: Record<string, string> = {
  name: "Name",
  resources: "Resources",
  materials: "Materials",
  charges: "Charges",
  total: "Total",
};

/** Ordem default quando o relatório não declara `columns`. */
const DEFAULT_COLUMN_ORDER = [
  "name",
  "resources",
  "materials",
  "charges",
  "total",
];

export class BreakdownReport extends ReportBase {
  private groups: BreakdownGroup[] = [];
  private table: ReportTable | null = null;

  constructor(report: Report,) {
    super(report,);
    this.table = new ReportTable();
    this.table.selfcontained = !!this.a("selfcontained",);
    this.table.auxDir = (this.a("auxdir",) as string | undefined) ?? "";
  }

  /** Critério de agrupamento efetivo (default `account`, como no parser). */
  groupby(): BreakdownGroupBy {
    return this.a("groupby",) === "task" ? "task" : "account";
  }

  /** Grupos gerados (leitura, para testes e consumidores). */
  getGroups(): BreakdownGroup[] {
    return this.groups;
  }

  /** Tabela intermediária do HTML (leitura). */
  getTable(): ReportTable | null {
    return this.table;
  }

  /**
   * Monta os grupos a partir das contas ou tarefas filtradas e constrói a
   * tabela HTML. Os formatos são derivados desta mesma estrutura (CSV/JSON),
   * garantindo consistência entre saídas.
   */
  override generateIntermediateFormat(): void {
    // Propaga o Query aos blocos de RichText (ReportBase).
    super.generateIntermediateFormat();

    this.groups = this.groupby() === "task"
      ? this.buildByTask()
      : this.buildByAccount();
    this.groups = this.sortGroups(this.groups,);
    this.buildTable();
  }

  /** HTML completo da tabela hierárquica. */
  to_html(): XMLElementLike[] {
    return this.table ? [this.table.to_html(),] : [];
  }

  /**
   * CSV em linhas planas: uma linha de grupo (`total`) e uma por contribuinte.
   * Colunas: entidade, tipo do contribuinte, esforço/quantidade, custo, total.
   */
  to_csv(): unknown[][] {
    const csv: unknown[][] = [[
      "Entity",
      "Type",
      "Effort/Quantity",
      "Cost",
      "Total",
    ],];
    for (const group of this.groups) {
      csv.push([
        group.name,
        "total",
        "",
        group.totals.total,
        group.totals.total,
      ],);
      for (const contributor of group.contributors) {
        csv.push([
          group.name,
          contributor.kind,
          this.quantityText(contributor,),
          contributor.cost,
          "",
        ],);
      }
    }
    return csv;
  }

  /** JSON aninhado por `groupby` (14C.0.1). */
  toJSON(): string {
    return JSON.stringify(
      {
        groupby: this.groupby(),
        groups: this.groups.map((group,) => ({
          id: group.id,
          name: group.name,
          totals: group.totals,
          contributors: group.contributors,
        })),
      },
      null,
      2,
    );
  }

  // ------------------------------------------------------------------
  // Construção dos grupos
  // ------------------------------------------------------------------

  /** Grupos por conta (default): contribuintes atribuídos à conta ou filhas. */
  private buildByAccount(): BreakdownGroup[] {
    let accountList = new PropertyList<Account>(this.project.accounts,);
    accountList.query = this.currentQuery();
    accountList = this.filterAccountList(
      accountList,
      this.a("hideAccount",) as never,
      this.a("rollupAccount",) as never,
      this.a("openNodes",) as never,
    );
    accountList.sort();

    const groups: BreakdownGroup[] = [];
    for (const account of accountList.toArray()) {
      const contributors = this.accountContributors(account,);
      if (contributors.length === 0) continue;
      groups.push(this.makeGroup(account.id, account.name, contributors,),);
    }
    return groups;
  }

  /** Grupos por tarefa (folhas e contêineres, conforme `hidetask`). */
  private buildByTask(): BreakdownGroup[] {
    let taskList = new PropertyList<Task>(this.project.tasks,);
    taskList.query = this.currentQuery();
    taskList = this.filterTaskList(
      taskList,
      null,
      this.a("hideTask",) as never,
      this.a("rollupTask",) as never,
      this.a("openNodes",) as never,
    );
    taskList.sort();

    const groups: BreakdownGroup[] = [];
    for (const task of taskList.toArray()) {
      // Contêineres agregam os filhos (mesma semântica de `assignedResources`).
      const contributors = task.container()
        ? this.containerContributors(task,)
        : this.taskContributors(task,);
      if (contributors.length === 0) continue;
      groups.push(this.makeGroup(task.id, task.name, contributors,),);
    }
    return groups;
  }

  /**
   * Aplica `sortby` (extensão 14C.1.2) aos grupos: `name` compara texto; os
   * demais critérios (`resources`/`materials`/`charges`/`total`) comparam
   * valores numéricos dos totais. Sem `sortby` preserva a ordem natural.
   */
  private sortGroups(groups: BreakdownGroup[],): BreakdownGroup[] {
    const criteria = this.a("sortBy",) as
      | Array<[string, boolean, number,]>
      | null;
    if (!criteria || criteria.length === 0) return groups;
    const valueOf = (
      group: BreakdownGroup,
      attribute: string,
    ): string | number => {
      if (attribute === "name") return group.name;
      const totals = group.totals as unknown as Record<string, number>;
      return totals[attribute] ?? 0;
    };
    return [...groups,].sort((a, b,) => {
      for (const [attribute, up,] of criteria) {
        const left = valueOf(a, attribute,);
        const right = valueOf(b, attribute,);
        if (left === right) continue;
        const cmp = typeof left === "string"
          ? (left < (right as string) ? -1 : 1)
          : (left as number) < (right as number)
          ? -1
          : 1;
        return up ? cmp : -cmp;
      }
      return 0;
    },);
  }

  /** Contribuintes diretos de uma conta (eventos + materiais do chargeset). */
  private accountContributors(account: Account,): BreakdownContributor[] {
    const byKey = new Map<string, BreakdownContributor>();
    const [startIdx, endIdx,] = this.periodIdx();
    for (const event of this.scopedEvents()) {
      if (!this.eventBelongsToAccount(event, account,)) continue;
      const contributor = this.contributorFromEvent(event, startIdx, endIdx,);
      if (contributor) this.mergeContributor(byKey, contributor,);
    }

    // Materiais cujo `chargeset` aponta para a conta (ou conta `aggregate
    // materials`): quantidade total e custo do material inteiro.
    const aggregate = account.get("aggregate",);
    for (const raw of this.project.materials.toArray()) {
      const material = raw as Material;
      if (
        aggregate !== "materials" &&
        !chargesetTouches(material, account,)
      ) {
        continue;
      }
      this.mergeContributor(
        byKey,
        {
          kind: "material",
          id: material.id,
          name: material.name,
          quantity: material.totalQuantityValue(),
          unit: material.unitValue(),
          cost: material.totalCost(),
          mode: "chargeset",
        },
      );
    }

    return sortContributors(byKey,);
  }

  /** Contribuintes de uma tarefa: recursos, materiais e charges. */
  private taskContributors(task: Task,): BreakdownContributor[] {
    const byKey = new Map<string, BreakdownContributor>();
    const [startIdx, endIdx,] = this.periodIdx();

    for (const scenarioIdx of this.scenarioIdxList()) {
      // Recursos alocados: esforço via `getAllocatedTime`, custo via eventos.
      const taskScenario = task.scenarioData(scenarioIdx,);
      for (const raw of task.assignedResources(scenarioIdx,)) {
        const resource = (raw.ptn?.() ?? raw) as Resource;
        const effort = taskScenario.getAllocatedTime(
          startIdx,
          endIdx,
          resource,
        );
        this.mergeContributor(
          byKey,
          {
            kind: "resource",
            id: resource.id,
            name: resource.name,
            quantity: effort,
            unit: "",
            cost: 0,
            mode: "",
          },
        );
      }

      // Materiais alocados: sem `CostEvent`, custo = quantidade × preço.
      const allocations =
        (task.getForScenario("materialallocations", scenarioIdx,) ??
          []) as Array<{
            material: Material;
            quantity: number;
          }>;
      for (const allocation of allocations) {
        const material = allocation.material;
        this.mergeContributor(
          byKey,
          {
            kind: "material",
            id: material.id,
            name: material.name,
            quantity: allocation.quantity,
            unit: material.unitValue(),
            cost: allocation.quantity * material.unitPriceValue(),
            mode: "allocated",
          },
        );
      }
    }

    // Custos: os `CostEvent` substituem a estimativa de materiais/recursos.
    for (const event of this.scopedEvents()) {
      if (event.task !== task) continue;
      if (event.type === "resource_effort") {
        this.replaceContributorCost(byKey, "resource", event,);
        continue;
      }
      if (event.type === "material_usage") {
        this.replaceContributorCost(byKey, "material", event,);
        continue;
      }
      const contributor = this.contributorFromEvent(event, 0, 0,);
      if (contributor) this.mergeContributor(byKey, contributor,);
    }

    // Charges declaradas no atributo, quando não há `CostEvent` de charge.
    if (![...byKey.values(),].some((c,) => c.kind === "charge")) {
      const charges = (task.getForScenario("charge", 0,) ??
        []) as Array<{ amount: number }>;
      charges.forEach((charge, idx,) => {
        this.mergeContributor(
          byKey,
          {
            kind: "charge",
            id: `charge-${idx}`,
            name: `charge ${idx + 1}`,
            quantity: 1,
            unit: "",
            cost: charge.amount,
            mode: "declared",
          },
        );
      },);
    }

    return sortContributors(byKey,);
  }

  /** Contribuintes de um contêiner: união dos filhos. */
  private containerContributors(task: Task,): BreakdownContributor[] {
    const byKey = new Map<string, BreakdownContributor>();
    for (const kid of task.kids()) {
      const child = kid as unknown as Task;
      if (typeof child.container !== "function") continue;
      const contributors = child.container()
        ? this.containerContributors(child,)
        : this.taskContributors(child,);
      for (const contributor of contributors) {
        this.mergeContributor(byKey, contributor,);
      }
    }
    return sortContributors(byKey,);
  }

  // ------------------------------------------------------------------
  // Helpers de dados
  // ------------------------------------------------------------------

  /** Índices do período do relatório (default: período do projeto). */
  private periodIdx(): [number, number,] {
    const start = (this.a("start",) ?? this.project.get("start",)) as
      | TjTime
      | undefined;
    const end = (this.a("end",) ?? this.project.get("end",)) as
      | TjTime
      | undefined;
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

  /** Eventos de custo restritos aos cenários reportados. */
  private scopedEvents(): CostEvent[] {
    const scenarios = this.scenarioIdxList();
    return this.project.costEvents.filter((event,) =>
      scenarios.includes(event.scenarioIdx,)
    );
  }

  /** O evento pertence à conta informada ou a uma de suas filhas? */
  private eventBelongsToAccount(
    event: CostEvent,
    account: Account,
  ): boolean {
    const owner = event.account as Account | null;
    if (!owner) return false;
    return owner === account || owner.isChildOf(account,);
  }

  /** Converte um `CostEvent` em contribuinte (quando tem entidade associada). */
  private contributorFromEvent(
    event: CostEvent,
    startIdx: number,
    endIdx: number,
  ): BreakdownContributor | null {
    if (event.type === "resource_effort") {
      const resource = event.resource as Resource | null;
      if (!resource) return null;
      const task = event.task as Task | null;
      const effort = task
        ? task.scenarioData(event.scenarioIdx,).getAllocatedTime(
          startIdx,
          endIdx,
          resource,
        )
        : 0;
      return {
        kind: "resource",
        id: resource.id,
        name: resource.name,
        quantity: effort,
        unit: "",
        cost: event.amount,
        mode: event.mode,
      };
    }
    if (event.type === "material_usage") {
      const material = event.material as
        | { id: string; name: string; unit?: string }
        | null;
      if (!material) return null;
      return {
        kind: "material",
        id: material.id,
        name: material.name,
        quantity: 0,
        unit: material.unit ?? "",
        cost: event.amount,
        mode: event.mode,
      };
    }
    // `task_charge`: agregado por modo (planned/actual).
    return {
      kind: "charge",
      id: event.mode,
      name: event.mode,
      quantity: 1,
      unit: "",
      cost: event.amount,
      mode: event.mode,
    };
  }

  /** Acumula um contribuinte já existente (mesma chave tipo:id). */
  private mergeContributor(
    byKey: Map<string, BreakdownContributor>,
    contributor: BreakdownContributor,
  ): void {
    const key = `${contributor.kind}:${contributor.id}`;
    const existing = byKey.get(key,);
    if (!existing) {
      byKey.set(key, { ...contributor, },);
      return;
    }
    existing.quantity += contributor.quantity;
    existing.cost += contributor.cost;
  }

  /** Troca o custo estimado pelo valor do `CostEvent` (fonte autoritativa). */
  private replaceContributorCost(
    byKey: Map<string, BreakdownContributor>,
    kind: BreakdownContributorKind,
    event: CostEvent,
  ): void {
    const entity = (kind === "resource" ? event.resource : event.material) as
      | { id: string; name: string }
      | null;
    if (!entity) return;
    const key = `${kind}:${entity.id}`;
    const existing = byKey.get(key,);
    if (existing) {
      existing.cost = event.amount;
      existing.mode = event.mode;
      return;
    }
    this.mergeContributor(
      byKey,
      {
        kind,
        id: entity.id,
        name: entity.name,
        quantity: 0,
        unit: "",
        cost: event.amount,
        mode: event.mode,
      },
    );
  }

  /** Monta o grupo com os totais por tipo. */
  private makeGroup(
    id: string,
    name: string,
    contributors: BreakdownContributor[],
  ): BreakdownGroup {
    const totals: BreakdownTotals = {
      resources: 0,
      materials: 0,
      charges: 0,
      total: 0,
    };
    for (const contributor of contributors) {
      if (contributor.kind === "resource") totals.resources += contributor.cost;
      if (contributor.kind === "material") totals.materials += contributor.cost;
      if (contributor.kind === "charge") totals.charges += contributor.cost;
      totals.total += contributor.cost;
    }
    return { id, name, contributors, totals, };
  }

  // ------------------------------------------------------------------
  // Tabela HTML
  // ------------------------------------------------------------------

  /** Ordem efetiva das colunas (`columns` do relatório ∩ canônicas). */
  private columnOrder(): string[] {
    const declared = this.a("columns",) as TableColumnDefinition[] | null;
    const ids = (declared ?? [])
      .map((column,) => String(column.id,))
      .filter((id,) => Object.hasOwn(COLUMN_TITLES, id,));
    return ids.length > 0 ? ids : [...DEFAULT_COLUMN_ORDER,];
  }

  /** Constrói a `ReportTable` hierárquica (grupo → contribuintes). */
  private buildTable(): void {
    const table = new ReportTable();
    table.selfcontained = !!this.a("selfcontained",);
    table.auxDir = (this.a("auxdir",) as string | undefined) ?? "";
    this.table = table;

    const columns = this.columnOrder();
    for (const id of columns) {
      new ReportTableColumn(table, null, COLUMN_TITLES[id]!,);
    }

    const query = this.currentQuery();
    for (const group of this.groups) {
      const groupLine = new ReportTableLine(table, null, null,);
      groupLine.bold = true;
      for (const id of columns) {
        const cell = new ReportTableCell(groupLine, query,);
        cell.alignment = id === "name" ? "left" : "right";
        cell.bold = true;
        cell.text = this.groupCellText(group, id,);
      }

      for (const contributor of group.contributors) {
        const line = new ReportTableLine(table, null, null,);
        line.indentation = 1;
        for (const id of columns) {
          const cell = new ReportTableCell(line, query,);
          cell.alignment = id === "name" ? "left" : "right";
          cell.indent = line.indentation;
          cell.text = this.contributorCellText(contributor, id,);
        }
      }
    }
  }

  /** Texto de uma célula na linha do grupo. */
  private groupCellText(
    group: BreakdownGroup,
    columnId: string,
  ): string {
    switch (columnId) {
      case "name":
        return group.name;
      case "resources":
        return group.totals.resources === 0
          ? ""
          : formatNumber(group.totals.resources,);
      case "materials":
        return group.totals.materials === 0
          ? ""
          : formatNumber(group.totals.materials,);
      case "charges":
        return group.totals.charges === 0
          ? ""
          : formatNumber(group.totals.charges,);
      case "total":
        return formatNumber(group.totals.total,);
      default:
        return "";
    }
  }

  /**
   * Texto de uma célula na linha do contribuinte: o nome na coluna `name`, a
   * quantidade/esforço na coluna do seu tipo e o custo em `total`.
   */
  private contributorCellText(
    contributor: BreakdownContributor,
    columnId: string,
  ): string {
    if (columnId === "name") return contributor.name;
    if (columnId === "total") return formatNumber(contributor.cost,);
    if (columnId !== contributor.kind) return "";
    return this.quantityText(contributor,);
  }

  /** Esforço/quantidade legível: `12 d`, `2 kg`, `planned`. */
  private quantityText(contributor: BreakdownContributor,): string {
    if (contributor.kind === "charge") return contributor.mode;
    const unit = contributor.unit;
    const quantity = formatNumber(contributor.quantity,);
    if (contributor.kind === "resource") {
      return `${quantity} d`;
    }
    return unit ? `${quantity} ${unit}` : quantity;
  }
}

/** Formata um número sem casas decimais desnecessárias. */
function formatNumber(value: number,): string {
  return Number.isInteger(value,) ? String(value,) : value.toFixed(2,);
}

/** O `chargeset` do material aponta para a conta (ou uma filha)? */
function chargesetTouches(material: Material, account: Account,): boolean {
  for (const set of material.chargeset.all()) {
    let touches = false;
    set.each((member,) => {
      if (member === account || member.isChildOf(account,)) touches = true;
    },);
    if (touches) return true;
  }
  return false;
}

/** Contribuintes ordenados por tipo e id (determinismo das saídas). */
function sortContributors(
  byKey: Map<string, BreakdownContributor>,
): BreakdownContributor[] {
  return [...byKey.values(),].sort((a, b,) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  },);
}

// Registra o conteúdo de `breakdownreport` na fábrica (14.11 / 14C.2.1).
registerContentFactory(
  "breakdownreport",
  (report: unknown,): BreakdownReport => new BreakdownReport(report as Report,),
);
