/**
 * TjpExportRE (phase 14.18.2) — exports the project data as TJP syntax.
 *
 * Faithful port of
 * `docs/taskjuggler/lib/taskjuggler/reports/TjpExportRE.rb`. Emits a
 * `.tjp`/`.tji` text with `project`, `flags` declarations, `projectids`,
 * `shifts`, `resource`/`task` lists and `supplement`s carrying the supported
 * attributes (booking/depends/flags/… plus the user-defined ones).
 *
 * ⚠️ Browser (ADR 027): `to_tjp()` returns the string; nothing is written to
 * disk. The `booking` case depends on the scheduler scoreboard (phase 7); with
 * no bookings the branch is not exercised. `alertLevels` is not serialized (the
 * ported `Project` keeps raw values, without an accessible
 * `AttributeBase#modified?`/`to_tjp`).
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
import type { MaterialBooking, } from "../model/material-booking.ts";
import type { BookingTail, } from "../model/booking-period.ts";
import type { TjTime, } from "../time/tj-time.ts";
import type { Shift, } from "../model/shift.ts";
import type { Scenario, } from "../model/scenario.ts";
import type { AttributeDefinition, } from "../attributes/attribute-definition.ts";
import type { Booking, } from "../scheduling/booking.ts";
import { TimeInterval, } from "../time/time-interval.ts";
import { Log, } from "../log.ts";
import { ReportBase, } from "./report-base.ts";

/** `[resource, booking]` pair used for the stable ordering of bookings per task. */
type ResourceBooking = [Resource, Booking,];

/**
 * The TJP exporter.
 *
 * Walks the resource/task lists and the materials and rebuilds a TJP document
 * from the parsed model, so `parse → export → parse` is lossless for the
 * supported attributes.
 */
export class TjpExportRE extends ReportBase {
  /** Task attributes the exporter knows how to serialize. */
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
  /** Resource attributes the exporter knows how to serialize. */
  private readonly supportedResourceAttrs = new Set<string>([
    "booking",
    "flags",
    "shifts",
    "vacation",
    "workinghours",
  ],);

  /** Resources to export, already filtered and sorted. */
  private resourceList!: PropertyList<Resource>;
  /** Tasks to export, already filtered and sorted. */
  private taskList!: PropertyList<Task>;
  /** Bookings indexed by scenario, then task, then resource. */
  private bookings: Map<number, Map<Task, Map<Resource, Booking>>> = new Map();
  /** Text being assembled by the current `to_tjp()` call. */
  private file = "";

  /**
   * Creates the TJP exporter of a report.
   *
   * @param report Report node the exporter renders.
   */
  constructor(report: Report,) {
    super(report,);
  }

  /** There is no intermediate format for the TJP exporter. */
  override generateIntermediateFormat(): void {
    super.generateIntermediateFormat();
  }

  /** Returns the project data as TJP syntax. */
  to_tjp(): string {
    // Prepares the resource list.
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

    // Prepares the task list.
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
  // Project sections
  // ------------------------------------------------------------------

  /**
   * Emits the `project` block: ids, granularity, timezone, custom attribute
   * declarations and the root scenario.
   */
  private generateProjectProperty(): void {
    const p = this.project;
    // Ruby reads `@project['projectid'/'name'/'version']` (these are attributes
    // in TJ); in the port they live as fields of `Project` and only enter the
    // attribute map when declared by `projectid`/`project`. The fallback keeps
    // the round-trip (parse → export → parse) possible — C5.7/ADR 039.
    const pid = p.get("projectid",) ?? p.id;
    const pname = p.get("name",) ?? p.name;
    const pver = p.get("version",) ?? p.version;
    this.file += `project ${pid} "${pname}" ` +
      `"${pver}" ${p.get("start",)} - ${p.get("end",)} {\n`;
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

  /**
   * Emits one `scenario <id> "<name>" { … }` block, nested for the scenario
   * hierarchy and closed by its `active` flag.
   *
   * @param scenario Scenario to emit.
   * @param indent Indentation level in spaces.
   */
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

  /**
   * Emits the `extend <tag> { … }` block declaring the user-defined attributes
   * of a property set.
   *
   * @param tag Property type the attributes belong to (`task`, `resource`).
   * @param propertySet Property set whose definitions are inspected.
   * @param attributes Attribute ids the report asked to export.
   */
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

    this.file += "  extend " + tag + " {\n";
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

  /** Emits the `flags` declaration with every flag used in the project. */
  private generateFlagDeclaration(): void {
    const flags: string[] = [];
    // Materials are a SyntaxMesh extension, so their flags must be declared as
    // well (14C.1.13).
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

  /** Emits the `projectids` declaration with every id used by a task. */
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
  // Shifts / resources / tasks (structural definitions)
  // ------------------------------------------------------------------

  /** Emits one `shift` block per root shift. */
  private generateShiftList(): void {
    for (const shift of this.project.shifts.toArray() as Shift[]) {
      if (!shift.parent) this.generateShift(shift, 0,);
    }
  }

  /**
   * Emits one `shift <id> "<name>" { … }` block, recursively for the sub-shifts.
   *
   * @param shift Shift to emit.
   * @param indent Indentation level in spaces.
   */
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

  /** Emits one `resource` block per root resource of the filtered list. */
  private generateResourceList(): void {
    for (const resource of this.resourceList.toArray()) {
      if (resource.parent === null) this.generateResource(resource, 0,);
    }
    this.file += "\n";
  }

  /**
   * Emits one `resource <id> "<name>" { … }` block, recursively nesting the
   * sub-resources that survived the filters.
   *
   * @param resource Resource to emit.
   * @param indent Indentation level in spaces.
   */
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

  /** Emits one `task` block per root task of the filtered list. */
  private generateTaskList(): void {
    for (const task of this.taskList.toArray()) {
      if (task.parent === null) this.generateTask(task, 0,);
    }
  }

  // ------------------------------------------------------------------
  // Materials (SyntaxMesh extension — see 14C.1.13)
  // ------------------------------------------------------------------

  /**
   * Emits the `material <id> "<name>" { … }` declarations, nesting sub-materials
   * as `resource`/`task` do.
   *
   * SyntaxMesh extension: TJ 3.8.4's `TjpExportRE` knows nothing about
   * materials. `hidematerial` (14C.6.8) omits the material from the export and
   * from the task allocations. `rollupmaterial` does not change the file: the
   * export is the TJP source itself and rewriting the tree would break the
   * round-trip.
   */
  private generateMaterialList(): void {
    const materials = (this.project.materials.toArray() as Material[])
      .filter((material,) => !this.hiddenBy("hideMaterial", material,));
    for (const material of materials) {
      if (material.parent === null) this.generateMaterial(material, 0,);
    }
    if (materials.length > 0) this.file += "\n";
  }

  /**
   * Emits one `material` block: unit, unit price, stock bookings, flags, note
   * and the nested sub-materials.
   *
   * @param material Material to emit.
   * @param indent Indentation level in spaces.
   */
  private generateMaterial(material: Material, indent: number,): void {
    this.file += " ".repeat(indent,) + `material ${material.id} ` +
      `${quotedString(material.name,)} {\n`;

    // `unit`/`cost` are non-scenario attributes; the parser uses the keyword
    // `unitprice` for the `cost` attribute. `totalquantity` was removed in
    // 14C.11.10 — the quantity is derived from the allocations.
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
    // Stock bookings (addendum §12.1 / 14C.13.8): emitted in the form of the
    // material body, `booking quantity <n> [unitprice <p>] on <date>` — no task
    // reference, keeping the sign (a negative value is a reversal).
    for (const scenarioIdx of this.scenarioList()) {
      this.generateStockBookings(material, indent + 2, scenarioIdx,);
    }
    for (const scenarioIdx of this.scenarioList()) {
      this.generateAttribute(material, "flags", indent + 2, scenarioIdx,);
    }
    this.generateAttribute(material, "note", indent + 2,);

    for (const sub of material.children as Material[]) {
      if (this.hiddenBy("hideMaterial", sub,)) continue;
      this.generateMaterial(sub, indent + 2,);
    }
    this.file += " ".repeat(indent,) + "}\n";
  }

  /**
   * Emits one `task` block with its dependencies, material allocations and
   * bookings, and with the scheduling attributes of a leaf task.
   *
   * @param task Task to emit.
   * @param indent Indentation level in spaces.
   */
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
    if (taskAttributes.includes("materialbookings",)) {
      for (const scenarioIdx of this.scenarioList()) {
        this.generateMaterialBookings(task, indent + 2, scenarioIdx,);
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

  /**
   * Emits the `depends`/`precedes` line of a task, skipping the dependencies
   * that already come from the parent.
   *
   * @param scenarioIdx Scenario the dependencies are read from.
   * @param task Task owning the dependencies.
   * @param tag Either `depends` or `precedes`.
   * @param indent Indentation level in spaces.
   */
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
   * Emits the material allocations of the task in the given scenario.
   *
   * The `material <id> <quantity> [modifier]` form is the canonical one accepted
   * by the parser (`materialAllocation`); the default `distributed` modifier is
   * omitted to keep the round-trip minimal.
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
      if (this.hiddenBy("hideMaterial", allocation.material,)) continue;
      const modifier = allocation.modifier &&
          allocation.modifier !== "distributed"
        ? ` ${allocation.modifier}`
        : "";
      // The allocation's own unit price (14C.11.2/11.8): only emitted when
      // declared, so the round-trip does not invent a `unitprice` on the material.
      const unitPrice = allocation.unitPrice !== undefined
        ? ` unitprice ${allocation.unitPrice}`
        : "";
      this.generateAttributeText(
        `material ${allocation.material.fullId} ${allocation.quantity}` +
          modifier + unitPrice,
        indent,
        scenarioIdx,
      );
    }
  }

  /**
   * Temporal tail of a booking (wave D3, round-trip): the legacy `on <date>` form
   * or the temporal `<modifier> <i1>, <i2>`. A one-day interval becomes a single
   * date; the others come back as `start - end` with the **raw end as the parser
   * stored it** (`B 00:00`, exclusive end) — the `String` of a midnight prints
   * only the date, so `A - B` re-imports into the same `TimeInterval`. The
   * `onstart` of a single interval becomes `on <date>`: as the value of
   * `onstart` only depends on the first covered day, that is equivalent for
   * accounting.
   */
  private bookingTailText(booking: {
    isTemporal(): boolean;
    date: TjTime;
    tail: BookingTail;
  },): string {
    if (!booking.isTemporal()) return `on ${String(booking.date,)}`;
    const { modifier, intervals, } = booking.tail;
    if (modifier === "onstart" && intervals.length === 1) {
      return `on ${String(intervals[0]!.start,)}`;
    }
    const parts = intervals.map((iv,) =>
      iv.end.toSeconds() - iv.start.toSeconds() <= 86400
        ? String(iv.start,)
        : `${iv.start.toString()} - ${iv.end.toString()}`
    );
    return `${modifier} ${parts.join(", ",)}`;
  }

  /**
   * Emits the material bookings of the task (14C.11.4/11.8) in the body form of
   * the task: `booking material <id> quantity <q> [unitprice <p>]` followed by
   * the temporal tail (legacy `on <date>` or `<modifier> <intervals>`, wave D3).
   * Both forms are accepted by the parser.
   */
  private generateMaterialBookings(
    task: Task,
    indent: number,
    scenarioIdx: number,
  ): void {
    const bookings = (task.getForScenario("materialbookings", scenarioIdx,) ??
      []) as MaterialBooking[];
    for (const booking of bookings) {
      if (this.hiddenBy("hideMaterial", booking.material,)) continue;
      const unitPrice = booking.unitPrice !== undefined
        ? ` unitprice ${booking.unitPrice}`
        : "";
      this.generateAttributeText(
        `booking material ${booking.material.fullId} quantity ` +
          `${booking.quantity}${unitPrice} ` + this.bookingTailText(booking,),
        indent,
        scenarioIdx,
      );
    }
  }

  /**
   * Emits the stock movements of the material itself (14C.13.8):
   * `booking quantity <n> [unitprice <p>]` plus the temporal tail (legacy or
   * wave D3), with the signed quantity (negative means a reversal).
   */
  private generateStockBookings(
    material: Material,
    indent: number,
    scenarioIdx: number,
  ): void {
    if (this.hiddenBy("hideMaterial", material,)) return;
    const bookings = (material.getForScenario(
      "stockbookings",
      scenarioIdx,
    ) ?? []) as MaterialBooking[];
    for (const booking of bookings) {
      const unitPrice = booking.unitPrice !== undefined
        ? ` unitprice ${booking.unitPrice}`
        : "";
      this.generateAttributeText(
        `booking quantity ${booking.quantity}${unitPrice} ` +
          this.bookingTailText(booking,),
        indent,
        scenarioIdx,
      );
    }
  }

  // ------------------------------------------------------------------
  // Supplements (attributes)
  // ------------------------------------------------------------------

  /** Emits one `supplement resource` block per exported resource. */
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

      // 'booking' is a task attribute; in the resource context it is handled
      // separately (Ruby: same remark).
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

  /** Emits one `supplement task` block per exported task. */
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
                break; // already handled in generateTask
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

  /**
   * Emits one attribute of a property in TJP form, skipping empty values and
   * values inherited from the parent scenario.
   *
   * @param property Property the attribute belongs to.
   * @param attrId Attribute id to emit.
   * @param indent Indentation level in spaces.
   * @param scenarioIdx Scenario the value is read from, or `null` for a
   *   non-scenario attribute.
   */
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

  /**
   * Appends an indented line, prefixing the scenario tag when the attribute
   * belongs to a non-default scenario.
   *
   * @param text Line to append (may span several lines; they are re-indented).
   * @param indent Indentation level in spaces.
   * @param scenarioIdx Scenario the line belongs to, or `null` for a
   *   scenario-independent line.
   */
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

  /** Collects the bookings by scenario, task and resource. */
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

  /**
   * Emits the `booking` lines of a task, ordered by resource full id.
   *
   * @param task Task whose bookings are emitted.
   * @param indent Indentation level in spaces.
   * @param scenarioIdx Scenario the bookings are read from.
   */
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

  /**
   * Emits the `booking` lines of a resource in the report window.
   *
   * @param resource Resource whose bookings are emitted.
   * @param indent Indentation level in spaces.
   * @param scenarioIdx Scenario the bookings are read from.
   */
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

  /** Scenarios reported by this export. */
  private scenarioList(): number[] {
    return (this.a("scenarios",) as number[]) ?? [];
  }

  /** Whether the value of `attrId` can be inherited from the parent scenario. */
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

/** Wraps a string for TJP: quoted, or as a `-8<-` heredoc when it has newlines. */
function quotedString(str: string,): string {
  if (str.includes("\n",)) {
    return `-8<-\n${str}\n->8-`;
  }
  const escaped = str.replace(/"/g, '\\"',);
  return `"${escaped}"`;
}

/**
 * Indents multi-line blocks: every line after the first receives the extra
 * indentation after the first word. (Faithful to `TjpExportRE#indentBlock`.)
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
