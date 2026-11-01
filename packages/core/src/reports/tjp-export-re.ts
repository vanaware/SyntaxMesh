/**
 * TjpExportRE (Fase 14.18.2) — exporta os dados do projeto em sintaxe TJP.
 *
 * Porta fiel de `docs/taskjuggler/lib/taskjuggler/reports/TjpExportRE.rb`.
 * Gera um texto `.tjp`/`.tji` com `project`, declarações de `flags`,
 * `projectids`, `shifts`, listas de `resource`/`task` e `supplement`s com os
 * atributos suportados (booking/depends/flags/… e atributos de usuário).
 *
 * ⚠️ Browser (ADR 027): `to_tjp()` retorna a string; nenhuma escrita a disco.
 * O caso `booking` depende do scoreboard do scheduler (Fase 7); sem bookings,
 * a trilha não é exercida. `alertLevels` não é serializado (o `Project` do port
 * guarda valores crus, sem `AttributeBase#modified?`/`to_tjp` acessível).
 *
 * @see docs/syntaxmesh/fases/fase-14-relatorios-tarefas.md (14.18.2)
 */
import type { Report, } from "../model/report.ts";
import type { PropertyTreeNode, } from "../model/property-tree-node.ts";
import { PropertyList, } from "../model/property-list.ts";
import type { Task, } from "../model/task.ts";
import type { Resource, } from "../model/resource.ts";
import type { Material, } from "../model/material.ts";
import type { MaterialAllocation, } from "../model/material-allocation.ts";
import type { Shift, } from "../model/shift.ts";
import type { Scenario, } from "../model/scenario.ts";
import type { AttributeDefinition, } from "../attributes/attribute-definition.ts";
import type { Booking, } from "../scheduling/booking.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { Log, } from "../log.ts";
import { ReportBase, } from "./report-base.ts";

/** Par `[recurso, booking]` usado na ordenação estável de bookings por tarefa. */
type ResourceBooking = [Resource, Booking,];

export class TjpExportRE extends ReportBase {
  private readonly supportedTaskAttrs = new Set<string>([
    "booking",
    "complete",
    "depends",
    "flags",
    "maxend",
    "maxstart",
    "minend",
    "minstart",
    "note",
    "priority",
    "projectid",
    "responsible",
  ],);
  private readonly supportedResourceAttrs = new Set<string>([
    "booking",
    "flags",
    "shifts",
    "vacation",
    "workinghours",
  ],);

  private resourceList!: PropertyList<Resource>;
  private taskList!: PropertyList<Task>;
  private bookings: Map<number, Map<Task, Map<Resource, Booking>>> = new Map();
  private file = "";

  constructor(report: Report,) {
    super(report,);
  }

  /** Não há formato intermediário para o exportador TJP. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
  }

  /** Retorna os dados do projeto em sintaxe TJP. */
  to_tjp(): string {
    // Prepara a lista de recursos.
    this.resourceList = new PropertyList<Resource>(this.project.resources,);
    this.resourceList.setSorting(
      this.a("sortResources",) as Array<[string, boolean, number,]>,
    );
    this.resourceList = this.filterResourceList(
      this.resourceList,
      null,
      this.a("hideResource",) as never,
      this.a("rollupResource",) as never,
      this.a("openNodes",) as never,
    );
    this.resourceList.sort();

    // Prepara a lista de tarefas.
    this.taskList = new PropertyList<Task>(this.project.tasks,);
    this.taskList.setSorting(
      this.a("sortTasks",) as Array<[string, boolean, number,]>,
    );
    this.taskList = this.filterTaskList(
      this.taskList,
      null,
      this.a("hideTask",) as never,
      this.a("rollupTask",) as never,
      this.a("openNodes",) as never,
    );
    this.taskList.sort();

    this.collectBookings();

    this.file = "";
    const definitions = (this.a("definitions",) as string[]) ?? [];

    if (definitions.includes("project",)) this.generateProjectProperty();
    if (definitions.includes("flags",)) this.generateFlagDeclaration();
    if (definitions.includes("projectids",)) this.generateProjectIDs();
    if (definitions.includes("shifts",)) this.generateShiftList();
    if (definitions.includes("resources",)) this.generateResourceList();
    if (definitions.includes("materials",)) this.generateMaterialList();
    if (definitions.includes("tasks",)) this.generateTaskList();

    const taskAttributes = (this.a("taskAttributes",) as string[]) ?? [];
    const resourceAttributes = (this.a("resourceAttributes",) as string[]) ??
      [];
    if (taskAttributes.length > 0) this.generateTaskAttributes();
    if (resourceAttributes.length > 0) this.generateResourceAttributes();

    return this.file;
  }

  // ------------------------------------------------------------------
  // Seções do projeto
  // ------------------------------------------------------------------

  private generateProjectProperty(): void {
    const p = this.project;
    this.file += `project ${p.get("projectid",)} "${p.get("name",)}" ` +
      `"${p.get("version",)}" ${p.get("start",)} - ${p.get("end",)} {\n`;
    const granularity = p.get("scheduleGranularity",) as number;
    if (granularity !== 3600) {
      this.generateAttributeText(
        `timingresolution ${Math.floor(granularity / 60,)}min`,
        2,
      );
    }
    this.generateAttributeText(`timezone "${p.get("timezone",)}"`, 2,);
    this.generateCustomAttributeDeclarations(
      "resource",
      this.project.resources,
      (this.a("resourceAttributes",) as string[]) ?? [],
    );
    this.generateCustomAttributeDeclarations(
      "task",
      this.project.tasks,
      (this.a("taskAttributes",) as string[]) ?? [],
    );
    const scenario = this.project.scenario(0,);
    if (scenario) this.generateScenarioDefinition(scenario, 2,);
    this.file += "}\n\n";
  }

  private generateScenarioDefinition(
    scenario: Scenario,
    indent: number,
  ): void {
    this.file += `${" ".repeat(indent,)}scenario ${scenario.id} ` +
      `${quotedString(scenario.name,)} {\n`;
    for (const sc of scenario.children as Scenario[]) {
      this.generateScenarioDefinition(sc, indent + 2,);
    }
    this.file += `${" ".repeat(indent + 2,)}active ` +
      `${scenario.get("active",) ? "yes" : "no"}\n`;
    this.file += `${" ".repeat(indent,)}}\n`;
  }

  private generateCustomAttributeDeclarations(
    tag: string,
    propertySet: {
      eachAttributeDefinition(
        cb: (ad: AttributeDefinition<unknown>,) => void,
      ): void;
    },
    attributes: string[],
  ): void {
    let customAttributes = 0;
    propertySet.eachAttributeDefinition((ad,) => {
      if (ad.userDefined) customAttributes++;
    },);
    if (customAttributes === 0) return;

    this.file += "  extend " + tag + "{\n";
    propertySet.eachAttributeDefinition((ad,) => {
      if (!(ad.userDefined && attributes.includes(ad.id,))) return;
      const tjpId = (ad.objClass as unknown as { tjpId?: string }).tjpId ??
        ad.id;
      this.file += `    ${tjpId} ${ad.id} ${quotedString(ad.name,)}`;
      if (ad.isScenarioAttribute || ad.inheritedFromParent) {
        this.file += " { ";
        if (ad.isScenarioAttribute) this.file += "scenariospecific ";
        if (ad.inheritedFromParent) this.file += "inherit ";
        this.file += "}";
      }
      this.file += "\n";
    },);
    this.file += "  }\n";
  }

  private generateFlagDeclaration(): void {
    const flags: string[] = [];
    // Materiais são uma extensão SyntaxMesh; suas flags também precisam ser
    // declaradas (14C.1.13).
    const properties: PropertyTreeNode[] = [
      ...this.resourceList.toArray(),
      ...this.taskList.toArray(),
      ...(this.project.materials.toArray() as Material[]),
    ];
    for (const property of properties) {
      for (const scenarioIdx of this.scenarioList()) {
        const propertyFlags = (property.getForScenario("flags", scenarioIdx,) ??
          []) as string[];
        for (const flag of propertyFlags) {
          if (!flags.includes(flag,)) flags.push(flag,);
        }
      }
    }
    flags.sort();
    if (flags.length > 0) this.file += `flags ${flags.join(", ",)}\n\n`;
  }

  private generateProjectIDs(): void {
    const projectIDs: string[] = [];
    for (const scenarioIdx of this.scenarioList()) {
      for (const task of this.taskList.toArray()) {
        const pid = task.getForScenario("projectid", scenarioIdx,) as
          | string
          | null;
        if (pid !== null && pid !== undefined && !projectIDs.includes(pid,)) {
          projectIDs.push(pid,);
        }
      }
    }
    if (projectIDs.length > 0) {
      this.file += `projectids ${projectIDs.join(", ",)}\n\n`;
    }
  }

  // ------------------------------------------------------------------
  // Shifts / recursos / tarefas (definições estruturais)
  // ------------------------------------------------------------------

  private generateShiftList(): void {
    for (const shift of this.project.shifts.toArray() as Shift[]) {
      if (!shift.parent) this.generateShift(shift, 0,);
    }
  }

  private generateShift(shift: Shift, indent: number,): void {
    this.file += " ".repeat(indent,) + `shift ${shift.id} ` +
      `${quotedString(shift.name,)} {\n`;
    for (const scenarioIdx of this.scenarioList()) {
      this.generateAttribute(shift, "workinghours", indent + 2, scenarioIdx,);
    }
    for (const subshift of shift.children as Shift[]) {
      this.generateShift(subshift, indent + 2,);
    }
    this.file += " ".repeat(indent,) + "}\n";
  }

  private generateResourceList(): void {
    for (const resource of this.resourceList.toArray()) {
      if (resource.parent === null) this.generateResource(resource, 0,);
    }
    this.file += "\n";
  }

  private generateResource(resource: Resource, indent: number,): void {
    if (resource.sequenceNo % 100 === 0) Log.activity();
    this.file += " ".repeat(indent,) + `resource ${resource.id} ` +
      `${quotedString(resource.name,)}`;
    this.file += resource.children.length > 0 ? " {" : "";
    this.file += "\n";
    for (const subresource of resource.children as Resource[]) {
      if (this.resourceList.includes(subresource,)) {
        this.generateResource(subresource, indent + 2,);
      }
    }
    if (resource.children.length > 0) {
      this.file += " ".repeat(indent,) + "}\n";
    }
  }

  private generateTaskList(): void {
    for (const task of this.taskList.toArray()) {
      if (task.parent === null) this.generateTask(task, 0,);
    }
  }

  // ------------------------------------------------------------------
  // Materiais (extensão SyntaxMesh — ver 14C.1.13)
  // ------------------------------------------------------------------

  /**
   * Emite as declarações `material <id> "<nome>" { ... }`, aninhando
   * sub-materiais como em `resource`/`task`.
   *
   * Extensão SyntaxMesh: o `TjpExportRE` do TJ 3.8.4 não conhece materiais.
   * O filtro `hidematerial`/`rollupmaterial` só existe a partir de 14C.6.
   */
  private generateMaterialList(): void {
    const materials = this.project.materials.toArray() as Material[];
    for (const material of materials) {
      if (material.parent === null) this.generateMaterial(material, 0,);
    }
    if (materials.length > 0) this.file += "\n";
  }

  private generateMaterial(material: Material, indent: number,): void {
    this.file += " ".repeat(indent,) + `material ${material.id} ` +
      `${quotedString(material.name,)} {\n`;

    // `unit`/`cost`/`totalquantity` são atributos não-cenário; o parser usa a
    // palavra-chave `unitprice` para o atributo `cost`.
    const unit = material.get("unit",);
    if (typeof unit === "string" && unit !== "" && unit !== "{}") {
      this.generateAttributeText(
        `unit ${quotedString(unit,)}`,
        indent + 2,
      );
    }
    const unitPrice = material.get("cost",);
    if (typeof unitPrice === "number" && unitPrice !== 0) {
      this.generateAttributeText(`unitprice ${unitPrice}`, indent + 2,);
    }
    const totalQuantity = material.get("totalquantity",);
    if (typeof totalQuantity === "number" && totalQuantity !== 0) {
      this.generateAttributeText(
        `totalquantity ${totalQuantity}`,
        indent + 2,
      );
    }
    for (const scenarioIdx of this.scenarioList()) {
      this.generateAttribute(material, "flags", indent + 2, scenarioIdx,);
    }
    this.generateAttribute(material, "note", indent + 2,);

    for (const sub of material.children as Material[]) {
      this.generateMaterial(sub, indent + 2,);
    }
    this.file += " ".repeat(indent,) + "}\n";
  }

  private generateTask(task: Task, indent: number,): void {
    if (task.sequenceNo % 100 === 0) Log.activity();
    this.file += " ".repeat(indent,) + `task ${task.subId} ` +
      `${quotedString(task.name,)} {\n`;

    const taskAttributes = (this.a("taskAttributes",) as string[]) ?? [];
    if (taskAttributes.includes("depends",)) {
      for (const scenarioIdx of this.scenarioList()) {
        this.generateTaskDependency(scenarioIdx, task, "depends", indent + 2,);
        this.generateTaskDependency(scenarioIdx, task, "precedes", indent + 2,);
      }
    }
    if (taskAttributes.includes("materialallocations",)) {
      for (const scenarioIdx of this.scenarioList()) {
        this.generateMaterialAllocations(task, indent + 2, scenarioIdx,);
      }
    }

    for (const subtask of task.children as Task[]) {
      if (this.taskList.includes(subtask,)) {
        this.generateTask(subtask, indent + 2,);
      }
    }

    let isLeafTask = true;
    for (const subtask of task.children as Task[]) {
      if (this.taskList.includes(subtask,)) {
        isLeafTask = false;
        break;
      }
    }

    if (isLeafTask) {
      for (const scenarioIdx of this.scenarioList()) {
        this.generateAttribute(task, "start", indent + 2, scenarioIdx,);
        if (!task.getForScenario("milestone", scenarioIdx,)) {
          this.generateAttribute(task, "end", indent + 2, scenarioIdx,);
          this.generateAttributeText(
            "scheduling " +
              (task.getForScenario("forward", scenarioIdx,) ? "asap" : "alap"),
            indent + 2,
            scenarioIdx,
          );
        }
        if (
          task.getForScenario("scheduled", scenarioIdx,) &&
          !this.inheritable(task, "scheduled", scenarioIdx,)
        ) {
          this.generateAttributeText("scheduled", indent + 2, scenarioIdx,);
        }
      }
    }

    this.file += " ".repeat(indent,) + "}\n";
  }

  private generateTaskDependency(
    scenarioIdx: number,
    task: Task,
    tag: string,
    indent: number,
  ): void {
    const taskAttributes = (this.a("taskAttributes",) as string[]) ?? [];
    if (!taskAttributes.includes("depends",)) return;

    const taskDeps = (task.getForScenario(tag, scenarioIdx,) ?? []) as Array<
      { task: Task }
    >;
    if (taskDeps.length === 0) return;
    let str = `${tag} `;
    let first = true;
    for (const dep of taskDeps) {
      const parentDeps = task.parent
        ? (task.parent.getForScenario(tag, scenarioIdx,) ?? []) as unknown[]
        : [];
      if (
        this.inheritable(task, tag, scenarioIdx, dep,) ||
        (task.parent && parentDeps.includes(dep,))
      ) {
        continue;
      }
      if (first) first = false;
      else str += ", ";
      str += dep.task.fullId;
    }
    if (!first) this.generateAttributeText(str, indent, scenarioIdx,);
  }

  /**
   * Emite as alocações de material da tarefa no cenário dado.
   *
   * A forma `material <id> <quantidade> [modificador]` é a canônica aceita
   * pelo parser (`materialAllocation`); o modificador padrão `distributed` é
   * omitido para preservar o round-trip mínimo.
   */
  private generateMaterialAllocations(
    task: Task,
    indent: number,
    scenarioIdx: number,
  ): void {
    const allocations =
      (task.getForScenario("materialallocations", scenarioIdx,) ??
        []) as MaterialAllocation[];
    for (const allocation of allocations) {
      const modifier = allocation.modifier &&
          allocation.modifier !== "distributed"
        ? ` ${allocation.modifier}`
        : "";
      this.generateAttributeText(
        `material ${allocation.material.fullId} ${allocation.quantity}` +
          modifier,
        indent,
        scenarioIdx,
      );
    }
  }

  // ------------------------------------------------------------------
  // Supplements (atributos)
  // ------------------------------------------------------------------

  private generateResourceAttributes(): void {
    const resourceAttributes = (this.a("resourceAttributes",) as string[]) ??
      [];
    for (const resource of this.resourceList.toArray()) {
      if (resource.sequenceNo % 100 === 0) Log.activity();
      this.file += `supplement resource ${resource.fullId} {\n`;
      this.project.resources.eachAttributeDefinition((attrDef,) => {
        const id = attrDef.id;
        if (
          (!this.supportedResourceAttrs.has(id,) && !attrDef.userDefined) ||
          !resourceAttributes.includes(id,)
        ) {
          return;
        }
        if (attrDef.isScenarioAttribute) {
          for (const scenarioIdx of this.scenarioList()) {
            if (this.inheritable(resource, id, scenarioIdx,)) continue;
            this.generateAttribute(resource, id, 2, scenarioIdx,);
          }
        } else {
          this.generateAttribute(resource, id, 2,);
        }
      },);

      // 'booking' é um atributo de tarefa; no contexto de recurso tratamos à
      // parte (Ruby: mesma observação).
      if (
        resourceAttributes.includes("booking",) &&
        resourceAttributes[0] !== "*"
      ) {
        for (const scenarioIdx of this.scenarioList()) {
          this.generateBookingsByResource(resource, 2, scenarioIdx,);
        }
      }
      this.file += "}\n";
    }
  }

  private generateTaskAttributes(): void {
    const taskAttributes = (this.a("taskAttributes",) as string[]) ?? [];
    for (const task of this.taskList.toArray()) {
      if (task.sequenceNo % 100 === 0) Log.activity();
      this.file += `supplement task ${task.fullId} {\n`;

      let adoptees = "";
      for (const adoptee of task.adoptees) {
        if (!this.taskList.includes(adoptee as Task,)) continue;
        adoptees += adoptees === "" ? "" : ", ";
        adoptees += adoptee.fullId;
      }
      if (adoptees !== "") {
        this.generateAttributeText(`adopt ${adoptees}`, 2,);
      }

      this.project.tasks.eachAttributeDefinition((attrDef,) => {
        const id = attrDef.id;
        if (
          (!this.supportedTaskAttrs.has(id,) && !attrDef.userDefined) ||
          !taskAttributes.includes(id,)
        ) {
          return;
        }
        if (attrDef.isScenarioAttribute) {
          for (const scenarioIdx of this.scenarioList()) {
            switch (id) {
              case "depends":
                break; // já tratado em generateTask
              case "booking":
                this.generateBookingsByTask(task, 2, scenarioIdx,);
                break;
              default:
                this.generateAttribute(task, id, 2, scenarioIdx,);
            }
          }
        } else {
          this.generateAttribute(task, id, 2,);
        }
      },);
      this.file += "}\n";
    }
  }

  private generateAttribute(
    property: PropertyTreeNode,
    attrId: string,
    indent: number,
    scenarioIdx: number | null = null,
  ): void {
    const val = scenarioIdx === null
      ? property.get(attrId,)
      : property.getForScenario(attrId, scenarioIdx,);
    if (
      val === null || val === undefined ||
      (Array.isArray(val,) && val.length === 0) ||
      (scenarioIdx !== null && this.inheritable(property, attrId, scenarioIdx,))
    ) {
      return;
    }
    this.generateAttributeText(
      property.getAttribute(attrId, scenarioIdx ?? undefined,).to_tjp(),
      indent,
      scenarioIdx,
    );
  }

  private generateAttributeText(
    text: string,
    indent: number,
    scenarioIdx: number | null = null,
  ): void {
    this.file += " ".repeat(indent,);
    let tag = "";
    if (scenarioIdx !== null && scenarioIdx !== 0) {
      const scenario = this.project.scenario(scenarioIdx,);
      tag = `${scenario ? scenario.id : ""}:`;
      this.file += tag;
    }
    this.file += `${indentBlock(text, indent + tag.length + 2,)}\n`;
  }

  // ------------------------------------------------------------------
  // Bookings
  // ------------------------------------------------------------------

  /** Coleta os bookings por cenário, tarefa e recurso. */
  private collectBookings(): void {
    this.bookings = new Map();
    const taskAttributes = (this.a("taskAttributes",) as string[]) ?? [];
    const resourceAttributes = (this.a("resourceAttributes",) as string[]) ??
      [];
    if (
      !(
        taskAttributes.includes("booking",) ||
        resourceAttributes.includes("booking",)
      )
    ) {
      return;
    }
    const iv = new TimeInterval(
      this.a("start",) as never,
      this.a("end",) as never,
    );
    for (const scenarioIdx of this.scenarioList()) {
      const byTask = new Map<Task, Map<Resource, Booking>>();
      this.bookings.set(scenarioIdx, byTask,);
      for (const resource of this.resourceList.toArray()) {
        const result = resource.getBookings(scenarioIdx, iv,);
        const bookings = result as Map<Task, Booking>;
        for (const [task, booking,] of bookings.entries()) {
          if (!this.taskList.includes(task,)) continue;
          let inner = byTask.get(task,);
          if (!inner) {
            inner = new Map<Resource, Booking>();
            byTask.set(task, inner,);
          }
          inner.set(resource, booking,);
        }
      }
    }
  }

  private generateBookingsByTask(
    task: Task,
    indent: number,
    scenarioIdx: number,
  ): void {
    const byTask = this.bookings.get(scenarioIdx,);
    if (!byTask) return;
    const resourceBookings = byTask.get(task,);
    if (!resourceBookings) return;
    const sorted: ResourceBooking[] = [...resourceBookings.entries(),];
    sorted.sort((a, b,) => {
      if (a[0].fullId < b[0].fullId) return -1;
      if (a[0].fullId > b[0].fullId) return 1;
      return 0;
    },);
    for (const [, booking,] of sorted) {
      this.generateAttributeText(
        "booking " + booking.to_tjp(false,),
        indent,
        scenarioIdx,
      );
    }
  }

  private generateBookingsByResource(
    resource: Resource,
    indent: number,
    scenarioIdx: number,
  ): void {
    const iv = new TimeInterval(
      this.a("start",) as never,
      this.a("end",) as never,
    );
    const bookings = resource.getBookings(scenarioIdx, iv, false,) as Booking[];
    for (const booking of bookings) {
      if (!this.taskList.includes(booking.task,)) continue;
      this.generateAttributeText(
        "booking " + booking.to_tjp(true,),
        indent,
        scenarioIdx,
      );
    }
  }

  /**cenários reportados. */
  private scenarioList(): number[] {
    return (this.a("scenarios",) as number[]) ?? [];
  }

  /** Retorna true se o valor de `attrId` pode ser herdado do cenário pai. */
  private inheritable(
    property: PropertyTreeNode,
    attrId: string,
    scenarioIdx: number,
    listItem: unknown = null,
  ): boolean {
    const scenario = this.project.scenario(scenarioIdx,);
    const parentScenario = scenario ? scenario.parent as Scenario | null : null;
    if (!parentScenario) return false;
    const parentScenarioIdx = this.project.scenarioIdx(parentScenario,);
    if (parentScenarioIdx === undefined) return false;
    const parentAttr = property.getForScenario(attrId, parentScenarioIdx,);
    if (Array.isArray(parentAttr,) && listItem !== null) {
      return (parentAttr as unknown[]).includes(listItem,);
    }
    return property.getForScenario(attrId, scenarioIdx,) === parentAttr;
  }
}

/** Embrulha uma string para TJP: aspas ou heredoc `-8<-`. */
function quotedString(str: string,): string {
  if (str.includes("\n",)) {
    return `-8<-\n${str}\n->8-`;
  }
  const escaped = str.replace(/"/g, '\\"',);
  return `"${escaped}"`;
}

/**
 * Indenta blocos de múltiplas linhas: todas menos a primeira linha recebem o
 * recuo adicional após a primeira palavra. (Fiél a `TjpExportRE#indentBlock`.)
 */
function indentBlock(text: string, indent: number,): string {
  let out = "";
  let firstSpace = 0;
  for (let i = 0; i < text.length; i++) {
    if (firstSpace === 0 && text[i] === " ") firstSpace = i;
    out += text[i];
    if (text[i] === "\n") out += " ".repeat(indent + firstSpace - 1,);
  }
  return out;
}
