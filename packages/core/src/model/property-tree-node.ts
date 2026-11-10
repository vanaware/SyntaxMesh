import { type PropertyLike, } from "./property-like.ts";
import { MessageHandlerInstance, } from "../message-handler.ts";
import { type AttributeContainer, } from "../attributes/attribute-container.ts";
import { AttributeDefinition, } from "../attributes/attribute-definition.ts";
import { AttributeType, } from "../attributes/attribute-type.ts";
import { type ProjectLike, } from "./project-like.ts";
import { type MessageHandlerLike, } from "./message-handler-like.ts";
import { AttributeBase, } from "../attributes/attribute-base.ts";
import { AttributeOverwrite, TjArgumentError, } from "../attributes/errors.ts";
import { TjInternalError, } from "./errors.ts";
import { ScenarioData, } from "./scenario-data.ts";
import { Scenario, } from "./scenario.ts";
import { PropertySet, } from "./property-set.ts";
import type { SourceFileInfo, } from "../source-file-info.ts";
import { RichText, } from "../richtext/rich-text.ts";
import { RTFHandlers, } from "../richtext/handlers/rtf-handlers.ts";
import type { Query, } from "../query/query.ts";
import type { JournalEntry, } from "./journal.ts";
export { PropertySet, };
export type { SourceFileInfo, };

/**
 * Base class of every model entity that lives inside a property set.
 *
 * A node is a vertex of the hierarchy defined by one `PropertySet` (tasks,
 * resources, accounts, …). It carries two independent layers of state:
 *
 * - **structure** — `children` (real hierarchy), `adoptees`/`stepParents`
 *   (references created by `adopt`, which do not move the node) and the
 *   derived id/path accessors;
 * - **attributes** — `attributes` for scenario-independent values and one map
 *   per scenario for values that may differ between scenarios.
 *
 * The class implements `PropertyLike`, so the parser, the scheduler and the
 * report engine can all talk to a node without knowing whether it is a task,
 * a resource or a bare container.
 */
export class PropertyTreeNode implements PropertyLike, AttributeContainer {
  /** Property set this node is registered in. */
  readonly propertySet: PropertySet;
  /** Project the node belongs to (shortcut for `propertySet.project`). */
  readonly project: ProjectLike;
  /** Id relative to the parent: `a.b.c` has the sub id `c`. */
  readonly subId: string;
  readonly id: string;
  readonly name: string;
  /** Creation order, also stored as the `seqno` attribute. */
  readonly sequenceNo: number;
  /** Direct children of the real hierarchy. */
  readonly children: PropertyTreeNode[];
  /** Properties adopted by this node (see `adopt`). */
  readonly adoptees: PropertyTreeNode[];
  /** Nodes that adopted this one; they act as additional parents. */
  readonly stepParents: PropertyTreeNode[];
  /** Location in the source file that declared the node. */
  sourceFileInfo: SourceFileInfo | null;
  /** Per-scenario data; one entry per scenario, in declaration order. */
  data: ScenarioData[];
  private _level: number;

  /** Scenario-independent attributes, created on first access. */
  attributes: Map<string, AttributeBase<unknown>>;
  /** Attribute maps for scenario-specific values, one per scenario. */
  scenarioAttributes: Array<Map<string, AttributeBase<unknown>>>;
  private _parent: PropertyTreeNode | null;
  private _idProvided: boolean;
  private _values: Map<string, unknown>;
  private _fullId: string | null;

  /**
   * Creates a node and registers it in its property set.
   *
   * When `id` is `null` an id is generated from the parent path (or from the
   * class name at the root). When `id` contains dots and the set is not a flat
   * namespace, the part after the last dot becomes the `subId` and the prefix
   * is used to look the parent up.
   *
   * The constructor also stores `id`, `name` and `seqno` as attributes, which
   * is what makes the default sort criteria (`seqno.up`) and the `id`/`name`
   * columns work.
   *
   * @param propertySet Set that will own the node.
   * @param id Explicit id, or `null` to derive one.
   * @param name Human-readable name.
   * @param parent Parent node, or `null` at the root.
   */
  constructor(
    propertySet: PropertySet,
    id: string | null,
    name: string,
    parent: PropertyTreeNode | null,
  ) {
    this.propertySet = propertySet;
    this.project = propertySet.project;
    this.name = name;
    this.children = [];
    this.adoptees = [];
    this.stepParents = [];
    this.sourceFileInfo = null;
    this.data = Array.from(
      { length: this.project.scenarioCount, },
      (_, i,) => new ScenarioData(this, i, new Map(),),
    );
    this.attributes = new Map();
    this.scenarioAttributes = Array.from(
      { length: this.project.scenarioCount, },
      () => new Map(),
    );
    this._level = -1;
    this._parent = parent;
    this._idProvided = id !== null;
    this._values = new Map();
    this._fullId = null;

    let resolvedId: string;
    if (id === null) {
      if (parent) {
        resolvedId = parent.fullId + "." + name;
      } else {
        const tag = this.constructor.name.replace(/TaskJuggler::/, "",);
        resolvedId = "_" + tag + "_" + (propertySet.items + 1).toString();
      }
    } else {
      resolvedId = id;
    }

    if (id !== null) {
      // Handle hierarchical IDs like Ruby: split at last '.'
      if (!propertySet.flatNamespace && id.includes(".",)) {
        const lastDotIndex = id.lastIndexOf(".",);
        this.subId = id.substring(lastDotIndex + 1,);
        // Try to set parent from propertySet if parent is still null
        if (parent === null) {
          const parentId = id.substring(0, lastDotIndex,);
          const parentNode = propertySet.get(parentId,);
          if (parentNode) {
            this._parent = parentNode;
          } else {
            // Parent not found: store full id for fullId computation
            this._fullId = id;
          }
        }
      } else {
        this.subId = id;
      }
    } else if (!propertySet.flatNamespace && resolvedId.includes(".",)) {
      this.subId = resolvedId.substring(resolvedId.lastIndexOf(".",) + 1,);
    } else {
      this.subId = resolvedId;
    }

    this.id = this.fullId;
    // RUBY-COMPAT-FIX: `PropertyTreeNode.rb:111,115` store `id` (the fullId)
    // and `name` as ATTRIBUTES. Without them `sortTasks id.up`/`name.up`
    // compared `null` with `null`, `sortInternal` returned 0 for every pair
    // and the list stayed in definition order — diverging from tj3 (the
    // depArrows.tjp golden, whose chart rows came out unsorted).
    this.set("id", this.id,);
    this.set("name", name,);

    this.sequenceNo = this.propertySet.items + 1;
    // RUBY-COMPAT-FIX: `PropertyTreeNode.rb:121` stores the sequence number in
    // the `seqno` attribute. Without it the default ordering criterion of the
    // reports (`sortTasks seqno.up`) compares `null` with `null` and the order
    // becomes insertion order, diverging from tj3 on any tie-break.
    this.set("seqno", this.sequenceNo,);

    if (parent) {
      parent.addChild(this,);
    }
    propertySet.addProperty(this,);
  }

  /** Parent in the real hierarchy, or `null` for a root node. */
  get parent(): PropertyTreeNode | null {
    return this._parent;
  }

  /**
   * Depth of the node in the hierarchy (a root is level `0`).
   *
   * Computed once by walking up to the root and cached in `_level`.
   */
  get level(): number {
    if (this._level === -1) {
      let lvl = 0;
      let current: PropertyTreeNode | null = this._parent;
      while (current) {
        lvl++;
        current = current._parent;
      }
      this._level = lvl;
    }
    return this._level;
  }

  /**
   * Fully qualified id, built from the `subId` of every ancestor.
   *
   * In a flat namespace the `subId` is already unique and is returned as is.
   * When the parent could not be resolved at construction time, the id stored
   * at that moment is returned verbatim.
   */
  get fullId(): string {
    if (this.propertySet.flatNamespace) {
      return this.subId;
    }
    // If parent not found, return stored fullId
    if (this._fullId !== null) {
      return this._fullId;
    }
    let result = this.subId;
    let current: PropertyTreeNode | null = this._parent;
    while (current) {
      result = current.subId + "." + result;
      current = current._parent;
    }
    return result;
  }

  /** Debug helper: dumps the id/parent/flag triple used to resolve `fullId`. */
  _debugFullId(): string {
    return `subId=${this.subId}, _parent=${
      this._parent?.id ?? "null"
    }, _idProvided=${this._idProvided}`;
  }

  /**
   * Id used by logical expressions. Feeds the rubric columns (`rubric_id`)
   * when the expression is evaluated per enumerated item.
   */
  logicalId(): string {
    return this.fullId;
  }

  /** Topmost ancestor of the node, or the node itself when it has none. */
  root(): PropertyTreeNode {
    const parent = this.parents()[0];
    if (parent) {
      return parent.root();
    }
    return this;
  }

  /**
   * Ancestors of the node, ordered from the parent up to the root.
   *
   * @param includeStepParents When `true`, ancestors reachable only through
   *   `adopt` (`stepParents`) are included as well.
   */
  ancestors(includeStepParents: boolean = false,): PropertyTreeNode[] {
    const nodes: PropertyTreeNode[] = [];
    if (includeStepParents) {
      this.parents().forEach((parent,) => {
        nodes.push(parent,);
        nodes.push(...parent.ancestors(true,),);
      },);
    } else {
      const parent = this.parents()[0];
      if (parent) {
        nodes.push(parent,);
        nodes.push(...parent.ancestors(false,),);
      }
    }
    return nodes;
  }

  /**
   * Whether the node descends from `ancestor` in the real hierarchy.
   *
   * Step parents created by `adopt` are not followed: adoption is a reference,
   * not a move.
   */
  isChildOf(ancestor: PropertyTreeNode,): boolean {
    const parent = this.parents()[0];
    if (parent === ancestor) {
      return true;
    }
    if (parent) {
      return parent.isChildOf(ancestor,);
    }
    return false;
  }

  /** Whether the node has neither children nor adoptees. */
  leaf(): boolean {
    return this.children.length === 0 && this.adoptees.length === 0;
  }

  /** Whether the node has at least one child or adoptee. */
  container(): boolean {
    return this.children.length > 0 || this.adoptees.length > 0;
  }

  /** Direct children and adoptees, in that order. */
  kids(): PropertyTreeNode[] {
    return [...this.children, ...this.adoptees,];
  }

  /**
   * Parents of the node: the structural parent first, then step parents.
   *
   * The first element is therefore always the parent used for attribute
   * inheritance.
   */
  parents(): PropertyTreeNode[] {
    const result: PropertyTreeNode[] = [];
    if (this._parent) {
      result.push(this._parent,);
    }
    result.push(...this.stepParents,);
    return result;
  }

  /** The node and all of its descendants, depth first. */
  all(): PropertyTreeNode[] {
    const result: PropertyTreeNode[] = [this,];
    this.kids().forEach((child,) => {
      result.push(...child.all(),);
    },);
    return result;
  }

  /**
   * Returns the PropertyTreeNode itself (unwraps PTNProxy if present).
   *
   * @see docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb:ptn
   */
  ptn(): PropertyTreeNode {
    return this;
  }

  /**
   * Leaves of the subtree rooted at this node.
   *
   * @param withoutSelf When `true`, a leaf node does not include itself.
   */
  allLeaves(withoutSelf: boolean = false,): PropertyTreeNode[] {
    const result: PropertyTreeNode[] = [];
    if (this.leaf()) {
      if (!withoutSelf) {
        result.push(this,);
      }
    } else {
      this.kids().forEach((child,) => {
        result.push(...child.allLeaves(),);
      },);
    }
    return result;
  }

  /**
   * Structural position of the node, root first: for every level, the 1-based
   * index of the node in its parent's child list.
   *
   * Unlike `getIndicies`, these indices always exist — they describe where the
   * node sits in the tree regardless of any sorting applied by a report.
   */
  getBSIndicies(): number[] {
    const indices: number[] = [];
    const collect = (node: PropertyTreeNode | null,): void => {
      if (!node) return;
      const parent = node._parent as PropertyTreeNode | null;
      if (parent) {
        indices.unshift(parent.levelSeqNo(node,),);
      } else {
        indices.unshift(this.propertySet.levelSeqNo(node,),);
      }
      collect(parent,);
    };
    collect(this,);
    return indices;
  }

  /**
   * `index` attribute of the node and of all its ancestors, root first.
   *
   * This is the Ruby `getIndicies` and the basis of the `tree` attribute used
   * by tree-mode sorting (`PropertyList#indexTree`). Unlike `getBSIndicies`
   * (structural position, always defined), the values come from the `index`
   * attribute recomputed by the last sort and are `null` when the node does
   * not carry it yet.
   */
  getIndicies(): Array<number | null> {
    const indices: Array<number | null> = [];
    // Walks up to the root prepending `index`: the final order is root → node.
    const collect = (node: PropertyTreeNode,): void => {
      // Ruby: `p.get('index')`, which is nil when the node has no attribute.
      const index = node.attributeDefinition("index",)
        ? node.get("index",)
        : null;
      indices.unshift(typeof index === "number" ? index : null,);
      const parent = node.parents()[0] as PropertyTreeNode | undefined;
      if (parent) collect(parent,);
    };
    collect(this,);
    return indices;
  }

  /** 1-based position of `node` in this node's child list (0 when absent). */
  levelSeqNo(node: PropertyTreeNode,): number {
    return this.children.indexOf(node,) + 1;
  }

  /** Appends a child to the real hierarchy. */
  addChild(child: PropertyTreeNode,): void {
    this.children.push(child,);
  }

  /**
   * Drops every reference this node holds to `property`.
   *
   * Used when a property is deleted: the node disappears from the child list,
   * from the adoptee list and from the step-parent list.
   */
  removeReferences(property: PropertyTreeNode,): void {
    const index = this.children.indexOf(property,);
    if (index !== -1) {
      this.children.splice(index, 1,);
    }
    const adopteeIndex = this.adoptees.indexOf(property,);
    if (adopteeIndex !== -1) {
      this.adoptees.splice(adopteeIndex, 1,);
    }
    const stepParentIndex = this.stepParents.indexOf(property,);
    if (stepParentIndex !== -1) {
      this.stepParents.splice(stepParentIndex, 1,);
    }
  }

  getStoredValue(attributeId: string,): unknown {
    return this._values.get(attributeId,) ?? null;
  }

  setStoredValue(attributeId: string, value: unknown,): void {
    this._values.set(attributeId, value,);
  }

  /**
   * Returns the scenario-independent attribute object for `id`, creating it on
   * first access.
   *
   * The object class comes from the attribute definition, so a task's `start`
   * attribute, a resource's `rate` attribute and so on all behave as declared.
   *
   * @throws {TjArgumentError} When the attribute is unknown, or when it is a
   *   scenario attribute (use `getForScenario`/`setForScenario` instead).
   */
  attribute(id: string,): AttributeBase<unknown> {
    let attr = this.attributes.get(id,);
    if (attr === undefined) {
      const aDef = this.attributeDefinition(id,);
      if (!aDef) {
        throw new TjArgumentError(`Unknown attribute '${id}'`,);
      }
      if (aDef.isScenarioAttribute) {
        throw new TjArgumentError(`Attribute '${id}' é específico de cenário`,);
      }
      attr = new aDef.objClass(this, aDef, this,);
      this.attributes.set(id, attr,);
    }
    return attr!;
  }

  /**
   * Returns the attribute object for `id` inside scenario `scIdx`, creating it
   * on first access.
   *
   * @throws {TjArgumentError} When the attribute is unknown, or when it is not
   *   scenario-specific.
   * @throws {TjInternalError} When the scenario data was not initialised yet.
   */
  private scenarioAttribute(
    scIdx: number,
    id: string,
  ): AttributeBase<unknown> {
    let attr = this.scenarioAttributes[scIdx]?.get(id,);
    if (attr === undefined) {
      const aDef = this.attributeDefinition(id,);
      if (!aDef) {
        throw new TjArgumentError(`Unknown attribute '${id}'`,);
      }
      if (!aDef.isScenarioAttribute) {
        throw new TjArgumentError(
          `Attribute '${id}' não é específico de cenário`,
        );
      }
      if (!this.data[scIdx]) {
        throw new TjInternalError(
          "ScenarioData must be initialized before scenario-specific attributes",
        );
      }
      attr = new aDef.objClass(this, aDef, this.data[scIdx],);
      if (!this.scenarioAttributes[scIdx]) {
        this.scenarioAttributes[scIdx] = new Map();
      }
      this.scenarioAttributes[scIdx].set(id, attr,);
    }
    return attr!;
  }

  /**
   * Value of a scenario-independent attribute.
   *
   * @throws {TjArgumentError} When the attribute is unknown or scenario
   *   specific.
   */
  get(id: string,): unknown {
    return this.attribute(id,).get();
  }

  /**
   * Attribute object for `id`, resolving to the scenario layer when `scIdx` is
   * given and to the scenario-independent layer otherwise.
   */
  getAttribute(id: string, scIdx?: number,): AttributeBase<unknown> {
    if (scIdx !== undefined) {
      return this.scenarioAttribute(scIdx, id,);
    }
    return this.attribute(id,);
  }

  /**
   * Public access to the scenario attribute object, creating it when needed.
   * Used by `ScenarioData` to read and write scenario values.
   *
   * @param scIdx Scenario index.
   * @param id Attribute name.
   */
  getScenarioAttribute(scIdx: number, id: string,): AttributeBase<unknown> {
    return this.scenarioAttribute(scIdx, id,);
  }

  /**
   * Attribute map of scenario `scIdx`, created when the scenario has never been
   * touched. Used by the subclass helpers that work on the whole map.
   */
  protected getScenarioAttributes(
    scIdx: number,
  ): Map<string, AttributeBase<unknown>> {
    if (!this.scenarioAttributes[scIdx]) {
      this.scenarioAttributes[scIdx] = new Map();
    }
    return this.scenarioAttributes[scIdx];
  }

  /** Value of `id` inside scenario `scIdx`. */
  getForScenario(id: string, scIdx: number,): unknown {
    return this.scenarioAttribute(scIdx, id,).get();
  }

  /**
   * Writes a scenario-independent attribute.
   *
   * A value that is not a list may only be provided once; a second write is
   * still applied to the attribute but then raises `AttributeOverwrite` so the
   * parser can report it.
   *
   * @throws {TjArgumentError} When the attribute is unknown or scenario
   *   specific.
   * @throws {AttributeOverwrite} When a non-list attribute is written twice.
   */
  set(id: string, value: unknown,): void {
    const attr = this.attribute(id,);
    const overwrite = attr.provided && !attr.isList();
    attr.set(value as never,);
    if (overwrite) {
      throw new AttributeOverwrite(id,);
    }
  }

  /**
   * Writes a scenario-independent attribute without the overwrite guard.
   *
   * Used by the engine (and by the constructor) where replacing a value is
   * legitimate; the `provided` guard exists for parser input only.
   */
  force(id: string, value: unknown,): void {
    const attr = this.attribute(id,);
    attr.set(value as never,);
  }

  /**
   * Writes a scenario value without the overwrite guard.
   *
   * Used by the scheduler for runtime attributes — the equivalent of the Ruby
   * `instance_variable_set` in `TaskScenario#propagateDate` — because the
   * `provided` guard is meant for parser input, not for the engine.
   *
   * @param id Attribute name.
   * @param value New value.
   * @param scIdx Scenario index.
   */
  forceForScenario(id: string, value: unknown, scIdx: number,): void {
    const attr = this.scenarioAttribute(scIdx, id,);
    attr.set(value as never,);
  }

  /**
   * Writes `id` inside scenario `scIdx`.
   *
   * When the engine runs in inheritance mode every scenario derived from
   * `scIdx` is updated as well: the value is set on the target scenario and
   * inherited by its children. The Ruby code walks `scenario(scIdx).all` for
   * exactly this reason — writing to the whole project would leak a child's
   * override (`delayed:effort 8d`) into its parent scenario.
   *
   * @param id Attribute name.
   * @param value New value.
   * @param scIdx Scenario index.
   * @throws {AttributeOverwrite} When a non-list attribute is written twice.
   */
  setForScenario(id: string, value: unknown, scIdx: number,): void {
    if (scIdx === undefined) {
      this.set(id, value,);
      return;
    }
    let overwrite = false;
    if (AttributeBase.mode === 0) {
      // RUBY-COMPAT-FIX: Ruby walks `@project.scenario(scIdx).all`
      // (PropertyTreeNode.rb#[]=), that is, the target scenario **and its
      // descendants** — not every scenario of the project. Walking the whole
      // project made the override of a sub-scenario (`delayed:effort 8d`) be
      // inherited by the parent scenario (`baseline`), and the parent report
      // came out with the child's dates (mwe008 Gantt golden).
      const target = this.project.scenario(scIdx,) as unknown as
        | Scenario
        | null;
      const affected: Scenario[] = target ? target.all() : [];
      for (const sc of affected) {
        const scenarioIdx = this.project.scenarioIdx(sc.fullId,);
        if (scenarioIdx === undefined) continue;
        const scenarioAttr = this.scenarioAttribute(scenarioIdx, id,);
        // Assignments to list attributes always accumulate; not an overwrite.
        if (scenarioAttr.provided && !scenarioAttr.isList()) overwrite = true;
        if (scenarioIdx === scIdx) {
          scenarioAttr.set(value as never,);
        } else {
          scenarioAttr.inherit(value as never,);
        }
      }
    } else {
      const attr = this.scenarioAttribute(scIdx, id,);
      overwrite = attr.provided && !attr.isList();
      attr.set(value as never,);
    }
    if (overwrite) {
      throw new AttributeOverwrite(id,);
    }
  }

  /**
   * Whether `id` was explicitly provided (by the parser or the engine).
   *
   * @param id Attribute name.
   * @param scIdx Scenario index; when omitted the scenario-independent layer
   *   is inspected.
   */
  provided(id: string, scIdx?: number,): boolean {
    if (scIdx !== undefined) {
      const attr = this.scenarioAttributes[scIdx]?.get(id,);
      return attr ? attr.provided : false;
    }
    const attr = this.attributes.get(id,);
    return attr ? attr.provided : false;
  }

  /**
   * Whether the value of `id` was inherited from a parent or from the project
   * instead of being provided directly.
   *
   * @param id Attribute name.
   * @param scIdx Scenario index; when omitted the scenario-independent layer
   *   is inspected.
   */
  inherited(id: string, scIdx?: number,): boolean {
    if (scIdx !== undefined) {
      const attr = this.scenarioAttributes[scIdx]?.get(id,);
      return attr ? attr.inherited : false;
    }
    const attr = this.attributes.get(id,);
    return attr ? attr.inherited : false;
  }

  /**
   * Whether `id` holds a value at all — provided or inherited.
   *
   * @param id Attribute name.
   * @param scIdx Scenario index; when omitted the scenario-independent layer
   *   is inspected.
   */
  modified(id: string, scIdx?: number,): boolean {
    if (scIdx !== undefined) {
      const attr = this.scenarioAttributes[scIdx]?.get(id,);
      return attr ? (attr.provided || attr.inherited) : false;
    }
    const attr = this.attributes.get(id,);
    return attr ? (attr.provided || attr.inherited) : false;
  }

  /** Definition of `id` as seen by this node's property set. */
  attributeDefinition(id: string,): AttributeDefinition<unknown> | undefined {
    return this.propertySet.attributeDefinition(id,);
  }

  /** Data container of scenario `scIdx` for this node. */
  scenarioData(scIdx: number,): ScenarioData {
    return this.data[scIdx]!;
  }

  /**
   * Declares that this node adopts `property`.
   *
   * Adoption is a cross reference, not a move: `property` keeps its place in
   * the hierarchy and gains this node as a step parent, while this node lists
   * it in `adoptees`. Both ends therefore become containers, which is how
   * `task A { ... }` plus `task B { ... }` can share a dependency target.
   *
   * A node may not adopt itself, and a leaf may not be adopted twice by the
   * same root; both cases are reported through the global message handler.
   *
   * @param property Node to adopt.
   */
  adopt(property: PropertyTreeNode,): void {
    // Ruby PropertyTreeNode#adopt (l.154-172): uses the global MessageHandler;
    // under `trapSetup` the first error aborts the parse (TjRuntimeError).
    if (property === this) {
      MessageHandlerInstance.instance.error(
        "adopt_self",
        "A property cannot adopt itself",
        null,
        null,
        null,
        null,
      );
    }
    const allOfRoot = this.root().all();
    for (const leaf of property.allLeaves()) {
      if (allOfRoot.includes(leaf,)) {
        MessageHandlerInstance.instance.error(
          "adopt_duplicate_child",
          `The task '${leaf.fullId}' has already been adopted by property ` +
            `'${this.root().fullId}' or any of its sub-properties.`,
          null,
          null,
          null,
          null,
        );
      }
    }
    this.adoptees.push(property,);
    property.getAdopted(this,);
  }

  /**
   * Records that `property` adopted this node.
   *
   * Called from `adopt` on the other end, so callers should not invoke it
   * directly. Ignores duplicates.
   */
  getAdopted(property: PropertyTreeNode,): void {
    if (this.stepParents.includes(property,)) {
      return;
    }
    this.stepParents.push(property,);
  }

  /**
   * Copies inheritable attribute values from the first parent, in two passes.
   *
   * The first pass handles scenario-independent attributes, the second one
   * handles scenario attributes scenario by scenario. In both passes the parent
   * wins only when it provided or inherited the value; a missing parent value
   * falls back to the project when the definition allows it
   * (`inheritedFromProject`).
   *
   * Called once the parent is known — typically at the end of parsing the
   * property — not on every write.
   */
  inheritAttributes(): void {
    this.propertySet.eachAttributeDefinition((attrDef,) => {
      if (attrDef.isScenarioAttribute || !attrDef.inheritedFromParent) {
        return;
      }
      const aId = attrDef.id;
      const parent = this.parents()[0];
      if (parent) {
        if (parent.provided(aId,) || parent.inherited(aId,)) {
          this.attribute(aId,).inherit(parent.get(aId,) as never,);
        }
      } else if (attrDef.inheritedFromProject) {
        const projectVal = this.project.get(aId,);
        if (projectVal !== undefined) {
          this.attribute(aId,).inherit(projectVal as never,);
        }
      }
    },);

    this.propertySet.eachAttributeDefinition((attrDef,) => {
      if (!attrDef.isScenarioAttribute || !attrDef.inheritedFromParent) {
        return;
      }
      const aId = attrDef.id;
      for (let scIdx = 0; scIdx < this.project.scenarioCount; scIdx++) {
        const parent = this.parents()[0];
        if (parent) {
          if (parent.provided(aId, scIdx,) || parent.inherited(aId, scIdx,)) {
            this.scenarioAttribute(scIdx, aId,).inherit(
              parent.getForScenario(aId, scIdx,) as never,
            );
          }
        } else if (attrDef.inheritedFromProject) {
          const projectVal = this.project.get(aId,);
          if (
            projectVal !== undefined &&
            this.scenarioAttributes[scIdx]?.has(aId,)
          ) {
            this.scenarioAttribute(scIdx, aId,).inherit(projectVal as never,);
          }
        }
      }
    },);
  }

  /**
   * Returns the node itself; it already is the "deep clone" of a property.
   *
   * `deep_clone` only ever applies to attributes: because an attribute value
   * may reference another property, those references must stay references
   * instead of being duplicated. That invariant is what makes returning `this`
   * correct.
   *
   * @see docs/taskjuggler/lib/taskjuggler/PropertyTreeNode.rb#deep_clone
   */
  deepClone(): this {
    return this;
  }

  /**
   * Shallow copy of both attribute layers, for use with `restoreAttributes`.
   *
   * The maps are copied; the attribute objects inside them are shared, which
   * is what allows a speculative pass (scenario parsing, report setup) to keep
   * working with the same attribute instances.
   */
  backupAttributes(): [
    Map<string, AttributeBase<unknown>>,
    Array<Map<string, AttributeBase<unknown>>>,
  ] {
    return [
      new Map(this.attributes,),
      this.scenarioAttributes.map((m,) => new Map(m,)),
    ];
  }

  /**
   * Replaces the attribute layers with a snapshot produced by
   * `backupAttributes`, discarding every attribute created since.
   *
   * @param backup Pair returned by `backupAttributes`.
   */
  restoreAttributes(
    backup: [
      Map<string, AttributeBase<unknown>>,
      Array<Map<string, AttributeBase<unknown>>>,
    ],
  ): void {
    this.attributes.clear();
    this.scenarioAttributes.forEach((m,) => m.clear());
    backup[0].forEach((value, key,) => {
      this.attributes.set(key, value,);
    },);
    backup[1].forEach((map, scIdx,) => {
      map.forEach((value, key,) => {
        if (!this.scenarioAttributes[scIdx]) {
          this.scenarioAttributes[scIdx] = new Map();
        }
        this.scenarioAttributes[scIdx].set(key, value,);
      },);
    },);
  }

  // ------------------------------------------------------------------
  // Shared query_* handlers (wave B1 — port of PropertyTreeNode.rb:594-673).
  //
  // `Query.process` resolves `query_<attribute>` first on the property
  // (step h) and then on the ScenarioData (step i). These methods are step h:
  // they apply to any property (task/resource/account/…) and delegate to the
  // already ported `Journal` (currentEntriesR/alertLevel/alertEntries/to_rti/
  // messagesRti).
  // ------------------------------------------------------------------

  /**
   * Children of the property as a list (Ruby `query_children`).
   *
   * With `query.listItem` each entry is rendered as rich text with the query
   * forwarded to the child; otherwise the entry is `"name (fullId)"`.
   */
  query_children(query: Query,): void {
    const list: string[] = [];
    for (const property of this.kids()) {
      if (query.listItem) {
        const rti = new RichText(
          query.listItem,
          RTFHandlers.create(query.project ?? null,),
        ).generateIntermediateFormat();
        if (!rti) continue;
        const q = query.dup();
        q.property = property;
        rti.setQuery(q,);
        list.push(`<nowiki>${rti.to_s()}</nowiki>`,);
      } else {
        list.push(`<nowiki>${property.name} (${property.fullId})</nowiki>`,);
      }
    }
    query.assignList(list,);
  }

  /** Full journal of the property (Ruby `query_journal`). */
  query_journal(query: Query,): void {
    query.project?.journal.to_rti(query,);
  }

  /**
   * Effective alert level at `query.end` (Ruby `query_alert`).
   *
   * The numeric and sortable columns carry the level index; the string and
   * rich-text columns carry the (colourised) level name.
   */
  query_alert(query: Query,): void {
    const journal = query.project?.journal;
    if (!journal) return;
    const alert = journal.alertLevel(query.end, this, query,);
    query.sortable = query.numerical = alert;
    const levels = query.project?.get("alertLevels",) as
      | Array<{ id: string; name: string; color: string }>
      | undefined;
    const alertLevel = levels?.[alert];
    if (!alertLevel) return;
    query.string = alertLevel.name;
    const rText = `<fcol:${alertLevel.color}><nowiki>${alertLevel.name}` +
      "</nowiki></fcol>";
    const rti = new RichText(
      rText,
      RTFHandlers.create(query.project ?? null,),
    ).generateIntermediateFormat();
    if (!rti) return;
    rti.blockMode = false;
    query.rti = rti;
  }

  /** Alert messages of the property (Ruby `query_alertmessages`). */
  query_alertmessages(query: Query,): void {
    this.journalMessages(
      query.project!.journal.alertEntries(
        query.end,
        this,
        1,
        query.start,
        query,
      ),
      query,
      true,
    );
  }

  /** Alert summaries of the property (Ruby `query_alertsummaries`). */
  query_alertsummaries(query: Query,): void {
    this.journalMessages(
      query.project!.journal.alertEntries(
        query.end,
        this,
        1,
        query.start,
        query,
      ),
      query,
      false,
    );
  }

  /** Journal messages of the property (Ruby `query_journalmessages`). */
  query_journalmessages(query: Query,): void {
    this.journalMessages(
      query.project!.journal.currentEntries(
        query.end,
        this,
        0,
        query.start,
        query.hideJournalEntry,
      ),
      query,
      true,
    );
  }

  /** Journal summaries of the property (Ruby `query_journalsummaries`). */
  query_journalsummaries(query: Query,): void {
    this.journalMessages(
      query.project!.journal.currentEntries(
        query.end,
        this,
        0,
        query.start,
        query.hideJournalEntry,
      ),
      query,
      false,
    );
  }

  /**
   * Alert-level trend between `query.start` and `query.end` (Ruby
   * `query_alerttrend`): Up (0) / Flat (1) / Down (2).
   */
  query_alerttrend(query: Query,): void {
    const journal = query.project?.journal;
    if (!journal) return;
    const startAlert = journal.alertLevel(query.start, this, query,);
    const endAlert = journal.alertLevel(query.end, this, query,);
    if (startAlert < endAlert) {
      query.sortable = 0;
      query.string = "Up";
    } else if (startAlert > endAlert) {
      query.sortable = 2;
      query.string = "Down";
    } else {
      query.sortable = 1;
      query.string = "Flat";
    }
  }

  /**
   * Builds the blog-style rich text of `entries` (Ruby `journalMessages`),
   * delegating the markup to {@link Journal.messagesRti}.
   */
  private journalMessages(
    entries: JournalEntry[],
    query: Query,
    longVersion: boolean,
  ): void {
    const rti = query.project!.journal.messagesRti(
      entries,
      query,
      longVersion,
    );
    if (!rti) return;
    query.rti = rti;
  }
}
