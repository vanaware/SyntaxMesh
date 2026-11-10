/**
 * BreakdownReport (phase 14 addendum C2) — cost breakdown.
 *
 * SyntaxMesh extension (no equivalent in TJ Ruby): lists, in a unified way, the
 * materials, resources and charges that make up the costs of an account
 * (`groupby account`, the default) or of a task (`groupby task`).
 *
 * Data sources (all already ported):
 * - `project.costEvents` (8.2) — `task_charge` / `resource_effort` /
 *   `material_usage` events with account, task, resource and material assigned.
 * - `Task#assignedResources` plus `TaskScenario#getAllocatedTime` — effort per
 *   resource.
 * - `materialallocations` (8.1) plus `Material#unitPrice` — quantity and unit
 *   price when there is no material `CostEvent` (the same fallback as the
 *   `materialcost` column of `taskreport`, 14C.1.11).
 * - the `charge` attribute of the task — declared value when there is no
 *   `CostEvent`.
 *
 * Outputs (ADR 027 — strings and in-memory structures, no disk, no DOM):
 * - HTML: hierarchical `ReportTable`, group → contributors.
 * - CSV: flat rows `[entity, type, effort/quantity, cost, total]`.
 * - JSON: nested by `groupby` (`groups[].contributors[]`).
 *
 * The type is registered in the content factory under `breakdownreport`
 * (`ReportType.BreakdownReport`), removing the `NotYetImplementedError` anchor
 * of 14C.0.10.
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-complemento-tarefas.md (14C.2)
 * @see docs/syntaxmesh/fases/fase-10-complemento1.md §5
 */
import type { Report, } from "../model/report.ts";
import type { Account, } from "../model/account.ts";
import { Task, } from "../model/task.ts";
import type { Resource, } from "../model/resource.ts";
import type { CostEvent, } from "../model/cost-event.ts";
import type { Material, } from "../model/material.ts";
import type { MaterialAllocation, } from "../model/material-allocation.ts";
import type { TableColumnDefinition, } from "./table-column-definition.ts";
import { PropertyList, } from "../model/property-list.ts";
import { ReportBase, } from "./report-base.ts";
import { markdownSections, } from "./markdown.ts";
import { ReportTable, } from "./report-table.ts";
import { ReportTableColumn, } from "./report-table-column.ts";
import { ReportTableCell, } from "./report-table-cell.ts";
import { ReportTableLine, } from "./report-table-line.ts";
import type { XMLElementLike, } from "../xml/xml-element-like.ts";
import type { TjTime, } from "../time/tj-time.ts";
import { registerContentFactory, } from "../model/report-content.ts";

/** Grouping criterion (`groupby`). */
export type BreakdownGroupBy = "account" | "task";

/** Kind of contributor of a group. */
export type BreakdownContributorKind = "resource" | "material" | "charge";

/**
 * Contributor of a group: a resource, a material or a charge.
 *
 * `quantity` is effort (days) for resources, quantity for materials and the
 * number of events for charges; `unit` accompanies the material.
 */
export interface BreakdownContributor {
  /** Kind of the entity being accounted. */
  kind: BreakdownContributorKind;
  /** Id of the entity. */
  id: string;
  /** Human-readable name of the entity. */
  name: string;
  /** Effort in days, quantity in `unit`, or `1` for a declared charge. */
  quantity: number;
  /** Unit of `quantity` (empty for resources and charges). */
  unit: string;
  /** Cost attributed to the contributor. */
  cost: number;
  /** Source of the value (`chargeset`, `allocated`, `planned`, `actual`, …). */
  mode: string;
  /** Consolidated by `rollupmaterial` (14C.6.9): counted in the totals, not listed. */
  rolledUp?: boolean;
}

/** Totals per kind of contributor (plus the total of the group). */
export interface BreakdownTotals {
  /** Cost of the resources of the group. */
  resources: number;
  /** Cost of the materials of the group. */
  materials: number;
  /** Cost of the charges of the group. */
  charges: number;
  /** Cost of the group as a whole. */
  total: number;
}

/** Breakdown group: an account or a task, with its contributors. */
export interface BreakdownGroup {
  /** Id of the account or task the group aggregates. */
  id: string;
  /** Display name of the group. */
  name: string;
  /** Contributors of the group, sorted by kind and id. */
  contributors: BreakdownContributor[];
  /** Totals of the group. */
  totals: BreakdownTotals;
}

/** Titles of the HTML columns, in the canonical order of the report. */
const COLUMN_TITLES: Record<string, string> = {
  name: "Name",
  resources: "Resources",
  materials: "Materials",
  charges: "Charges",
  total: "Total",
};

/** Default order used when the report does not declare `columns`. */
const DEFAULT_COLUMN_ORDER = [
  "name",
  "resources",
  "materials",
  "charges",
  "total",
];

/**
 * The cost breakdown generator.
 *
 * `generateIntermediateFormat()` builds the groups once and derives the HTML
 * table, the CSV rows and the JSON from them.
 */
export class BreakdownReport extends ReportBase {
  /** Groups built by the last `generateIntermediateFormat()`. */
  private groups: BreakdownGroup[] = [];
  /** HTML table built by the last `generateIntermediateFormat()`. */
  private table: ReportTable | null = null;

  /**
   * Creates the breakdown generator of a report.
   *
   * @param report Report node the generator renders.
   */
  constructor(report: Report,) {
    super(report,);
    this.table = new ReportTable();
    this.table.selfcontained = !!this.a("selfcontained",);
    this.table.auxDir = (this.a("auxdir",) as string | undefined) ?? "";
  }

  /** Effective grouping criterion (defaults to `account`, as in the parser). */
  groupby(): BreakdownGroupBy {
    return this.a("groupby",) === "task" ? "task" : "account";
  }

  /** Groups generated by the last run (read by tests and consumers). */
  getGroups(): BreakdownGroup[] {
    return this.groups;
  }

  /** Intermediate HTML table (read access). */
  getTable(): ReportTable | null {
    return this.table;
  }

  /**
   * Builds the groups from the filtered accounts or tasks and assembles the
   * HTML table. The other formats derive from the same structure (CSV/JSON),
   * which keeps the outputs consistent.
   */
  override generateIntermediateFormat(): void {
    // Propagates the Query to the RichText blocks (ReportBase).
    super.generateIntermediateFormat();

    this.groups = this.groupby() === "task"
      ? this.buildByTask()
      : this.buildByAccount();
    this.groups = this.sortGroups(this.groups,);
    this.buildTable();
  }

  /** Full HTML of the hierarchical table. */
  to_html(): XMLElementLike[] {
    return this.table ? [this.table.to_html(),] : [];
  }

  /**
   * CSV as flat rows: one `total` row per group and one per contributor.
   * Columns: entity, contributor kind, effort/quantity, cost, total.
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
        if (contributor.rolledUp) continue;
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

  /** JSON nested by `groupby` (14C.0.1). */
  toJSON(): string {
    return JSON.stringify(
      {
        groupby: this.groupby(),
        groups: this.groups.map((group,) => ({
          id: group.id,
          name: group.name,
          totals: group.totals,
          contributors: group.contributors.filter((c,) => !c.rolledUp),
        })),
      },
      null,
      2,
    );
  }

  /**
   * Markdown document (SyntaxMesh extension — addendum §10): the same
   * hierarchical table as the HTML, rendered as pipes.
   */
  to_markdown(): string {
    return markdownSections([
      this.rt_to_markdown("header",),
      this.table ? this.table.to_markdown() : null,
      this.rt_to_markdown("footer",),
    ],);
  }

  // ------------------------------------------------------------------
  // Block construction
  // ------------------------------------------------------------------

  /** Groups per account (the default): contributors assigned to the account or to its children. */
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

  /** Groups per task (leaves and containers, according to `hidetask`). */
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
      // Containers aggregate their children (same semantics as `assignedResources`).
      const contributors = task.container()
        ? this.containerContributors(task,)
        : this.taskContributors(task,);
      if (contributors.length === 0) continue;
      groups.push(this.makeGroup(task.id, task.name, contributors,),);
    }
    return groups;
  }

  /**
   * Applies `sortby` (extension 14C.1.2) to the groups: `name` compares text;
   * the other criteria (`resources`/`materials`/`charges`/`total`) compare the
   * numeric totals. Without `sortby` the natural order is preserved.
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

  /** Direct contributors of an account (events plus the materials of the chargeset). */
  private accountContributors(account: Account,): BreakdownContributor[] {
    const byKey = new Map<string, BreakdownContributor>();
    const [startIdx, endIdx,] = this.periodIdx();
    for (const event of this.scopedEvents()) {
      if (!this.eventBelongsToAccount(event, account,)) continue;
      const contributor = this.contributorFromEvent(event, startIdx, endIdx,);
      if (contributor) this.mergeContributor(byKey, contributor,);
    }

    // Materials whose `chargeset` points at the account (or an `aggregate
    // materials` account): the quantity is derived from the allocations (Σ
    // `MaterialAllocation.quantity`, 14C.11.10) and the cost follows the
    // booking → allocation → material precedence (14C.11.6).
    const aggregate = account.get("aggregate",);
    for (const raw of this.project.materials.toArray()) {
      const material = raw as Material;
      if (this.materialHidden(material,)) continue;
      if (
        aggregate !== "materials" &&
        !chargesetTouches(material, account,)
      ) {
        continue;
      }
      const totals = this.materialAllocationTotals(material,);
      this.mergeContributor(
        byKey,
        {
          kind: "material",
          id: material.id,
          name: material.name,
          quantity: totals.quantity,
          unit: material.unitValue(),
          cost: totals.cost,
          mode: "chargeset",
          ...this.rolledUpFlag(material,),
        },
      );
    }

    return sortContributors(byKey,);
  }

  /** Contributors of a task: resources, materials and charges. */
  private taskContributors(task: Task,): BreakdownContributor[] {
    const byKey = new Map<string, BreakdownContributor>();
    const [startIdx, endIdx,] = this.periodIdx();

    for (const scenarioIdx of this.scenarioIdxList()) {
      // Allocated resources: effort through `getAllocatedTime`, cost through events.
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

      // Allocated materials: without a `CostEvent` the cost is quantity × price
      // of the allocation itself (14C.11.6).
      const allocations =
        (task.getForScenario("materialallocations", scenarioIdx,) ??
          []) as MaterialAllocation[];
      for (const allocation of allocations) {
        const material = allocation.material;
        if (this.materialHidden(material,)) continue;
        this.mergeContributor(
          byKey,
          {
            kind: "material",
            id: material.id,
            name: material.name,
            quantity: allocation.quantity,
            unit: material.unitValue(),
            cost: allocation.quantity * allocation.unitPriceFor(material,),
            mode: "allocated",
            ...this.rolledUpFlag(material,),
          },
        );
      }
    }

    // Costs: the `CostEvent`s replace the estimate of materials/resources.
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

    // Charges declared in the attribute, when there is no charge `CostEvent`.
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

  /** Contributors of a container: union of its children. */
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
  // Data helpers
  // ------------------------------------------------------------------

  /** Slot indices of the report period (defaults to the project period). */
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

  /** Reported scenarios (defaults to scenario 0). */
  private scenarioIdxList(): number[] {
    const scenarios = this.a("scenarios",) as number[] | null;
    return scenarios && scenarios.length > 0 ? scenarios : [0,];
  }

  /** Cost events restricted to the reported scenarios. */
  private scopedEvents(): CostEvent[] {
    const scenarios = this.scenarioIdxList();
    return this.project.costEvents.filter((event,) =>
      scenarios.includes(event.scenarioIdx,)
    );
  }

  /** Does the event belong to the given account or to one of its children? */
  private eventBelongsToAccount(
    event: CostEvent,
    account: Account,
  ): boolean {
    const owner = event.account as Account | null;
    if (!owner) return false;
    return owner === account || owner.isChildOf(account,);
  }

  /** Converts a `CostEvent` into a contributor (when it has an associated entity). */
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
    // `task_charge`: aggregated by mode (planned/actual).
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

  /** Accumulates into an existing contributor (same `kind:id` key). */
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
    if (contributor.rolledUp) existing.rolledUp = true;
  }

  /** Replaces the estimated cost by the `CostEvent` value (authoritative source). */
  private replaceContributorCost(
    byKey: Map<string, BreakdownContributor>,
    kind: BreakdownContributorKind,
    event: CostEvent,
  ): void {
    const entity = (kind === "resource" ? event.resource : event.material) as
      | { id: string; name: string }
      | null;
    if (!entity) return;
    // A material hidden by `hidematerial` generates no contributor (14C.6.6).
    const material = kind === "material"
      ? event.material as Material | null
      : null;
    if (material && this.materialHidden(material,)) return;
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
        ...this.rolledUpFlag(material,),
      },
    );
  }

  /** Material hidden by `hidematerial` (14C.6.6). */
  private materialHidden(material: Material,): boolean {
    return this.hiddenBy("hideMaterial", material,);
  }

  /**
   * Quantity and cost derived from the allocations of the material (14C.11.10):
   * Σ `MaterialAllocation.quantity` and Σ quantity × effective price of the
   * allocation. A material without allocations contributes 0 (the old
   * `totalquantity` was removed).
   */
  private materialAllocationTotals(
    material: Material,
  ): { quantity: number; cost: number } {
    let quantity = 0;
    let cost = 0;
    for (const scenarioIdx of this.scenarioIdxList()) {
      quantity += material.allocatedQuantity(scenarioIdx,);
      cost += material.allocatedCost(scenarioIdx,);
    }
    return { quantity, cost, };
  }

  /** Material consolidated by `rollupmaterial` (14C.6.9). */
  private materialRolledUp(material: Material,): boolean {
    return this.hiddenBy("rollupMaterial", material,);
  }

  /**
   * Fragment carrying `rolledUp` only when the material matches
   * `rollupmaterial`. Keeping the key absent in the other cases preserves the
   * JSON shape for callers that do not use the directive.
   */
  private rolledUpFlag(material: Material | null,): { rolledUp?: boolean } {
    return material && this.materialRolledUp(material,)
      ? { rolledUp: true, }
      : {};
  }

  /** Builds the group with its totals per kind. */
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
  // HTML table
  // ------------------------------------------------------------------

  /** Effective column order (`columns` of the report ∩ canonical ones). */
  private columnOrder(): string[] {
    const declared = this.a("columns",) as TableColumnDefinition[] | null;
    const ids = (declared ?? [])
      .map((column,) => String(column.id,))
      .filter((id,) => Object.hasOwn(COLUMN_TITLES, id,));
    return ids.length > 0 ? ids : [...DEFAULT_COLUMN_ORDER,];
  }

  /** Builds the hierarchical `ReportTable` (group → contributors). */
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
        if (contributor.rolledUp) continue;
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

  /** Text of a cell in the group line. */
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
   * Text of a cell in the contributor line: the name in the `name` column, the
   * quantity/effort in the column of its kind and the cost in `total`.
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

  /** Readable effort/quantity: `12 d`, `2 kg`, `planned`. */
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

/** Formats a number without unnecessary decimals. */
function formatNumber(value: number,): string {
  return Number.isInteger(value,) ? String(value,) : value.toFixed(2,);
}

/** Does the `chargeset` of the material point at the account (or a child)? */
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

/** Contributors sorted by kind and id (keeps the outputs deterministic). */
function sortContributors(
  byKey: Map<string, BreakdownContributor>,
): BreakdownContributor[] {
  return [...byKey.values(),].sort((a, b,) => {
    if (a.kind !== b.kind) return a.kind < b.kind ? -1 : 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  },);
}

// Registers the `breakdownreport` content in the factory (14.11 / 14C.2.1).
registerContentFactory(
  "breakdownreport",
  (report: unknown,): BreakdownReport => new BreakdownReport(report as Report,),
);
